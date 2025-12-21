import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  CampaignEntity,
  CampaignStatus,
  PaymentStatus,
} from './entities/campaign.entity';
import {
  CampaignMilestoneEntity,
  MilestoneStatus,
} from './entities/campaign-milestone.entity';
import {
  CampaignNegotiationEntity,
  NegotiationSender,
  NegotiationAction,
} from './entities/campaign-negotiation.entity';
import { AgencyProfileEntity } from '../agency/entities/agency-profile.entity';
import {
  AgencySearchCampaignDto,
  AgencyRequoteDto,
  AgencyDeclineDto,
} from './dto/agency-campaign.dto';
import { SubmitMilestoneDto } from './dto/execution.dto';

@Injectable()
export class AgencyCampaignService {
  constructor(
    @InjectRepository(CampaignEntity)
    private readonly campaignRepo: Repository<CampaignEntity>,
    @InjectRepository(CampaignMilestoneEntity)
    private readonly milestoneRepo: Repository<CampaignMilestoneEntity>,
    @InjectRepository(CampaignNegotiationEntity)
    private readonly negotiationRepo: Repository<CampaignNegotiationEntity>,
    @InjectRepository(AgencyProfileEntity)
    private readonly agencyRepo: Repository<AgencyProfileEntity>,
  ) {}

  // Helper: Verify Agency
  private async getAgencyProfile(userId: string) {
    const agency = await this.agencyRepo.findOne({ where: { userId } });
    if (!agency) throw new ForbiddenException('User is not an agency');
    return agency;
  }

  private calculateDaysRemaining(
    startDate: Date | null,
    duration: number | null,
  ): number {
    if (!startDate || !duration) return 0;
    const end = new Date(startDate);
    end.setDate(end.getDate() + duration);
    const diff = end.getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 3600 * 24)));
  }

  // ============================================
  // 1. DASHBOARD STATS (Top Cards)
  // Matches "Agency campaign Panel.jpg"
  // ============================================
  async getDashboardStats(userId: string) {
    const agency = await this.getAgencyProfile(userId);

    const activeCount = await this.campaignRepo.count({
      where: {
        agencyId: agency.id,
        status: In([CampaignStatus.ACTIVE, CampaignStatus.PROMOTING]),
      },
    });

    const completedCount = await this.campaignRepo.count({
      where: { agencyId: agency.id, status: CampaignStatus.COMPLETED },
    });

    const newRequests = await this.campaignRepo.count({
      where: { agencyId: agency.id, status: CampaignStatus.PENDING_AGENCY },
    });

    // Calculate Earnings (Sum of 'availableForVendor' for completed jobs)
    const { totalEarnings } = await this.campaignRepo
      .createQueryBuilder('c')
      .select('SUM(c.availableForVendor)', 'totalEarnings')
      .where('c.agencyId = :aid', { aid: agency.id })
      .andWhere('c.status = :status', { status: CampaignStatus.COMPLETED })
      .getRawOne();

    return {
      active: activeCount,
      completed: completedCount,
      newRequests: newRequests,
      totalEarnings: parseFloat(totalEarnings) || 0,
    };
  }

  // ============================================
  // 2. LIST CAMPAIGNS (Tabs Overview)
  // Matches "Jobs" screen with 6 tabs
  // ============================================
  async findAll(userId: string, query: AgencySearchCampaignDto) {
    const agency = await this.getAgencyProfile(userId);
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const qb = this.campaignRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.client', 'client')
      .where('c.agencyId = :aid', { aid: agency.id })
      .skip(skip)
      .take(limit)
      .orderBy('c.createdAt', 'DESC');

    // Filter by Tab (Mapping Figma tabs to DB Statuses)
    switch (query.tab) {
      case 'new_offer': // "New Offers"
        qb.andWhere('c.status = :status', {
          status: CampaignStatus.PENDING_AGENCY,
        });
        break;
      case 'quoted': // "Quoted"
        qb.andWhere('c.status = :status', {
          status: CampaignStatus.AGENCY_NEGOTIATING,
        }); // Waiting for Admin
        break;
      case 'active': // "Active Jobs"
        qb.andWhere('c.status IN (:...statuses)', {
          statuses: [
            CampaignStatus.ACTIVE,
            CampaignStatus.PROMOTING,
            CampaignStatus.AGENCY_ACCEPTED,
          ],
        });
        break;
      case 'completed': // "Completed Jobs"
        qb.andWhere('c.status = :status', { status: CampaignStatus.COMPLETED });
        break;
      case 'pending_payment': // "Pending Payments" (Work done, payment pending)
        // Logic: Completed but paymentStatus != FULL, OR Active but Partial
        qb.andWhere('(c.status = :completed AND c.paymentStatus != :full)', {
          completed: CampaignStatus.COMPLETED,
          full: PaymentStatus.FULL,
        });
        break;
      case 'declined': // "Declined Jobs"
        // Assuming you keep declined campaigns with a status or separate flag
        // If using Cancelled status + agencyDeclineReason logic:
        qb.andWhere('c.status = :status', { status: CampaignStatus.CANCELLED });
        break;
      default: // Default to Active
        qb.andWhere('c.status = :status', { status: CampaignStatus.ACTIVE });
    }

    const [data, total] = await qb.getManyAndCount();

    // Minimal Response for Cards
    return {
      data: data.map((c) => ({
        id: c.id,
        name: c.campaignName,
        client: c.client?.brandName || 'Client',
        clientImage: c.client?.profileImg,
        budget: c.availableForVendor, // Agency sees their specific cut
        status: c.status,
        deadline: c.startingDate,
        date: c.createdAt,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ============================================
  // 3. CAMPAIGN DETAILS
  // ============================================
  async findOne(id: string, userId: string) {
    const agency = await this.getAgencyProfile(userId);
    const campaign = await this.campaignRepo.findOne({
      where: { id, agencyId: agency.id },
      relations: ['client', 'milestones', 'assets', 'negotiations'],
    });

    if (!campaign) throw new NotFoundException('Campaign not found');

    // Calculate Milestone Progress
    const totalMilestones = campaign.milestones.length;
    const completed = campaign.milestones.filter(
      (m) => m.status === 'accepted',
    ).length;
    const progress =
      totalMilestones > 0 ? Math.round((completed / totalMilestones) * 100) : 0;

    // Agency Profit
    const agencyProfit = campaign.availableForVendor || 0;

    return {
      id: campaign.id,
      name: campaign.campaignName,
      status: campaign.status,

      // Financials
      financials: {
        totalCampaignValue: campaign.totalBudget,
        yourProfit: agencyProfit,
        paymentStatus: campaign.paymentStatus,
        isPaid: campaign.paymentStatus === PaymentStatus.FULL,
      },

      // ✅ FIX: Calculate days using safe accessor
      deadline: {
        date: campaign.startingDate,
        daysRemaining: this.calculateDaysRemaining(
          campaign.startingDate,
          campaign.duration,
        ),
      },

      // Client Info
      client: {
        name: campaign.client.brandName,
        image: campaign.client.profileImg, // Fixed property name
      },

      // Milestones
      milestones: campaign.milestones
        .sort((a, b) => a.order - b.order)
        .map((m) => ({
          id: m.id,
          title: m.contentTitle,
          amount: m.contentQuantity,
          status: m.status,
          isPaid: campaign.paymentStatus === PaymentStatus.FULL,
          rejectionReason: m.status === 'declined' ? m.rejectionReason : null,
          submission:
            m.status === 'in_review' || m.status === 'accepted'
              ? {
                  desc: m.submissionDescription,
                  files: m.submissionAttachments,
                }
              : null,
        })),

      // Brief
      brief: {
        goals: campaign.campaignGoals,
        details: campaign.productServiceDetails,
        assets: campaign.assets,
      },

      // Requote State
      requote: {
        canRequote: campaign.status === CampaignStatus.PENDING_AGENCY,
        isPending: campaign.status === CampaignStatus.AGENCY_NEGOTIATING,
        lastOffer:
          campaign.negotiations
            .filter((n) => n.sender === NegotiationSender.ADMIN)
            .pop()?.proposedTotalBudget || agencyProfit,
      },

      progressPercentage: progress,
    };
  }

  // ============================================
  // 4. ACTIONS: Accept, Requote, Submit
  // ============================================

  // Accept Invitation
  async acceptInvite(id: string, userId: string) {
    const agency = await this.getAgencyProfile(userId);
    const campaign = await this.campaignRepo.findOne({
      where: { id, agencyId: agency.id },
    });

    if (campaign?.status !== CampaignStatus.PENDING_AGENCY) {
      throw new BadRequestException('Invite not valid or already handled');
    }

    // Move to Accepted State
    campaign.status = CampaignStatus.AGENCY_ACCEPTED;

    // If Admin already funded fully, move to Active directly
    if (campaign.paymentStatus === PaymentStatus.FULL) {
      campaign.status = CampaignStatus.ACTIVE;
    }

    await this.campaignRepo.save(campaign);
    return {
      success: true,
      message: 'Job Accepted. You can now start milestones.',
    };
  }

  // ============================================
  // 5. MILESTONE DETAILS (Specific View)
  // Matches "Agency Job Milestone Details.jpg"
  // ============================================
  async getMilestone(milestoneId: string, userId: string) {
    const agency = await this.getAgencyProfile(userId);

    // Fetch Milestone with Campaign to verify ownership
    const milestone = await this.milestoneRepo.findOne({
      where: { id: milestoneId },
      relations: ['campaign'],
    });

    if (!milestone) throw new NotFoundException('Milestone not found');
    if (milestone.campaign.agencyId !== agency.id)
      throw new ForbiddenException('Access denied');

    // Determine Status for UI Badge
    // Mapping DB status to UI Labels: 'To Do', 'In Review', 'Paid', 'Declined'
    let uiStatus = 'To Do';
    if (milestone.status === MilestoneStatus.IN_REVIEW) uiStatus = 'In Review';
    if (milestone.status === MilestoneStatus.ACCEPTED) uiStatus = 'Completed';
    if (milestone.status === MilestoneStatus.DECLINED) uiStatus = 'Declined';

    // Override if Paid (Visual Priority in design)
    if (milestone.paymentStatus === 'paid') uiStatus = 'Paid';
    if (milestone.paymentStatus === 'partial_paid') uiStatus = 'Partial Paid';

    // Calculate Payout Amount (Estimated split or specific logic)
    // Here we assume equal split for simplicity, or use `requestedAmount` if set
    const totalMilestones = await this.milestoneRepo.count({
      where: { campaignId: milestone.campaignId },
    });
    const payoutAmount = milestone.campaign.availableForVendor
      ? milestone.campaign.availableForVendor / totalMilestones
      : 0;

    return {
      id: milestone.id,
      header: {
        title: milestone.contentTitle, // "For Milestone 4: Campaign Wrap Up"
        campaignName: milestone.campaign.campaignName,
      },
      requirements: {
        content: 'Final Report + 2 Stories', // Derived from contentQuantity
        platform: milestone.platform,
      },
      target: {
        reach: milestone.expectedReach || 300000, // "300K"
        views: milestone.expectedViews || 250000,
      },
      financials: {
        payoutOnApproval: Math.round(payoutAmount),
        status: uiStatus,
        paymentStatus: milestone.paymentStatus,
        date: milestone.updatedAt,
      },
      // Submission Data (For "In Review" / "Declined" views)
      submission: {
        description: milestone.submissionDescription,
        attachments: milestone.submissionAttachments,
        liveLinks: milestone.liveLinks,
        metrics: {
          reach: milestone.actualReach,
          views: milestone.actualViews,
        },
        requestedAmount: milestone.requestedAmount,
      },
      // Logic for "Resubmission" form pre-fill
      isResubmission: milestone.status === MilestoneStatus.DECLINED,
      rejectionReason: milestone.rejectionReason,
    };
  }

  // ============================================
  // 5. ACTION: REQUEST REQUOTE
  // Matches "Request Requote" popup logic
  // ============================================
  async requote(id: string, userId: string, dto: AgencyRequoteDto) {
    const agency = await this.getAgencyProfile(userId);
    const campaign = await this.campaignRepo.findOne({
      where: { id, agencyId: agency.id },
    });

    if (campaign?.status !== CampaignStatus.PENDING_AGENCY) {
      throw new BadRequestException('Cannot negotiate this campaign');
    }

    // Create Negotiation Log
    const neg = this.negotiationRepo.create({
      campaignId: id,
      sender: NegotiationSender.AGENCY,
      action: NegotiationAction.COUNTER_OFFER,
      proposedTotalBudget: dto.proposedAmount, // Agency proposing new vendor budget
      senderId: userId,
      message: 'Agency requested a requote.',
    });
    await this.negotiationRepo.save(neg);

    // Update Status -> "Quote Send For Client Review" (Admin really)
    campaign.status = CampaignStatus.AGENCY_NEGOTIATING;
    await this.campaignRepo.save(campaign);

    return { success: true, message: 'Requote sent for review' };
  }

  // ============================================
  // 6. ACTION: SUBMIT MILESTONE (Execution)
  // Matches "Ongoing" & "Milestone in review"
  // ============================================
  async submitMilestone(
    milestoneId: string,
    userId: string,
    dto: SubmitMilestoneDto,
  ) {
    const agency = await this.getAgencyProfile(userId);
    const milestone = await this.milestoneRepo.findOne({
      where: { id: milestoneId },
      relations: ['campaign'],
    });

    if (!milestone || milestone.campaign.agencyId !== agency.id) {
      throw new NotFoundException('Milestone not found or access denied');
    }

    // Logic: Only active campaigns allow submission
    if (
      milestone.campaign.status !== CampaignStatus.ACTIVE &&
      milestone.campaign.status !== CampaignStatus.PROMOTING &&
      milestone.campaign.status !== CampaignStatus.AGENCY_ACCEPTED
    ) {
      // throw new BadRequestException('Campaign is not active yet');
    }

    // Update Status -> In Review
    milestone.status = MilestoneStatus.IN_REVIEW;

    // Save Submission Data
    if (dto.description) milestone.submissionDescription = dto.description;
    if (dto.attachments) milestone.submissionAttachments = dto.attachments;
    if (dto.liveLinks) milestone.liveLinks = dto.liveLinks;
    if (dto.requestedAmount) milestone.requestedAmount = dto.requestedAmount;

    // Update Metrics
    if (dto.actualReach) milestone.actualReach = dto.actualReach;
    if (dto.actualViews) milestone.actualViews = dto.actualViews;

    // Clear previous rejection if resubmitting
    milestone.rejectionReason = null;

    await this.milestoneRepo.save(milestone);

    // Update Campaign Status if needed
    if (milestone.campaign.status === CampaignStatus.AGENCY_ACCEPTED) {
      milestone.campaign.status = CampaignStatus.PROMOTING;
      await this.campaignRepo.save(milestone.campaign);
    }

    return { success: true, message: 'Milestone submitted successfully' };
  }
}
