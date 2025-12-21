import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  CampaignMilestoneEntity,
  MilestonePaymentStatus,
  MilestoneStatus,
} from './entities/campaign-milestone.entity';
import {
  CampaignAssignmentEntity,
  JobStatus,
} from './entities/campaign-assignment.entity';
import { InfluencerProfileEntity } from '../influencer/entities/influencer-profile.entity';
import {
  InfluencerSearchCampaignDto,
  InfluencerDeclineDto,
  AddDeliveryAddressDto,
  WithdrawalRequestDto,
} from './dto/influencer-campaign.dto';
import { SubmitMilestoneDto } from './dto/execution.dto';

@Injectable()
export class InfluencerCampaignService {
  constructor(
    @InjectRepository(CampaignAssignmentEntity)
    private readonly assignmentRepo: Repository<CampaignAssignmentEntity>,
    @InjectRepository(CampaignMilestoneEntity)
    private readonly milestoneRepo: Repository<CampaignMilestoneEntity>,
    @InjectRepository(InfluencerProfileEntity)
    private readonly influencerRepo: Repository<InfluencerProfileEntity>,
  ) {}

  // Helper: Verify Influencer
  private async getInfluencerProfile(userId: string) {
    const influencer = await this.influencerRepo.findOne({ where: { userId } });
    if (!influencer) throw new ForbiddenException('User is not an influencer');
    return influencer;
  }

  // ============================================
  // 1. DASHBOARD STATS
  // ============================================
  async getDashboardStats(userId: string) {
    const influencer = await this.getInfluencerProfile(userId);

    const activeCount = await this.assignmentRepo.count({
      where: { influencerId: influencer.id, status: JobStatus.ACTIVE },
    });

    const completedCount = await this.assignmentRepo.count({
      where: { influencerId: influencer.id, status: JobStatus.COMPLETED },
    });

    const newRequests = await this.assignmentRepo.count({
      where: { influencerId: influencer.id, status: JobStatus.NEW_OFFER },
    });

    const { totalEarnings } = await this.assignmentRepo
      .createQueryBuilder('a')
      .select('SUM(a.offeredAmount)', 'totalEarnings')
      .where('a.influencerId = :iid', { iid: influencer.id })
      .andWhere('a.status = :status', { status: JobStatus.COMPLETED })
      .getRawOne();

    return {
      activeCampaigns: activeCount,
      completedCampaigns: completedCount,
      newRequests: newRequests,
      totalEarnings: parseFloat(totalEarnings) || 0,
    };
  }

  // ============================================
  // 2. LIST CAMPAIGNS (Tabs Overview)
  // ============================================
  async findAll(userId: string, query: InfluencerSearchCampaignDto) {
    const influencer = await this.getInfluencerProfile(userId);
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const qb = this.assignmentRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.campaign', 'c')
      .leftJoinAndSelect('c.client', 'client')
      .where('a.influencerId = :iid', { iid: influencer.id })
      .skip(skip)
      .take(limit)
      .orderBy('a.createdAt', 'DESC');

    switch (query.tab) {
      case 'new_offer':
        qb.andWhere('a.status = :status', { status: JobStatus.NEW_OFFER });
        break;
      case 'active':
        qb.andWhere('a.status = :status', { status: JobStatus.ACTIVE });
        break;
      case 'completed':
        qb.andWhere('a.status = :status', { status: JobStatus.COMPLETED });
        break;
      case 'pending_payment':
        qb.andWhere('a.status IN (:...statuses)', {
          statuses: [JobStatus.ACTIVE, JobStatus.COMPLETED],
        });
        break;
      case 'declined':
        qb.andWhere('a.status = :status', { status: JobStatus.DECLINED });
        break;
      default:
        qb.andWhere('a.status = :status', { status: JobStatus.ACTIVE });
    }

    const [data, total] = await qb.getManyAndCount();

    return {
      data: data.map((a) => ({
        id: a.campaign.id,
        name: a.campaign.campaignName,
        client: a.campaign.client?.brandName || 'Client',
        clientImage: a.campaign.client?.profileImg, // ✅ Fixed: profileImg
        offerAmount: a.offeredAmount,
        status: a.status,
        deadline: a.campaign.startingDate,
        isPhysicalProduct: a.campaign.needSampleProduct,
        requiresAddress: a.campaign.needSampleProduct && !a.deliveryAddress,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ============================================
  // 3. CAMPAIGN DETAILS (Single View)
  // ============================================
  async findOne(campaignId: string, userId: string) {
    const influencer = await this.getInfluencerProfile(userId);

    const assignment = await this.assignmentRepo.findOne({
      where: { campaignId, influencerId: influencer.id },
      relations: [
        'campaign',
        'campaign.client',
        'campaign.milestones',
        'campaign.assets',
      ],
    });

    if (!assignment) throw new NotFoundException('Assignment not found');
    const campaign = assignment.campaign;

    // Calculate Progress
    const totalMilestones = campaign.milestones.length;
    const completed = campaign.milestones.filter(
      (m) => m.status === MilestoneStatus.ACCEPTED,
    ).length;
    const progress =
      totalMilestones > 0 ? Math.round((completed / totalMilestones) * 100) : 0;

    return {
      id: campaign.id,
      name: campaign.campaignName,
      status: assignment.status,

      financials: {
        yourOffer: assignment.offeredAmount,
        paidAmount: assignment.paidAmount || 0, // Tracked in assignment entity
        isFullyPaid: assignment.paidAmount >= assignment.offeredAmount,
      },

      // Product Delivery Logic
      product: {
        isPhysical: campaign.needSampleProduct,
        deliveryStatus: assignment.deliveryStatus, // 'pending', 'shipped', 'received'
        deliveryAddress: assignment.deliveryAddress, // Influencer's address
      },

      client: {
        name: campaign.client.brandName,
        image: campaign.client.profileImg,
      },

      brief: {
        goals: campaign.campaignGoals,
        details: campaign.productServiceDetails,
        assets: campaign.assets,
      },

      milestones: campaign.milestones
        .sort((a, b) => a.order - b.order)
        .map((m) => ({
          id: m.id,
          title: m.contentTitle,
          amount: m.contentQuantity,
          status: m.status,
          // Payment status per milestone (if tracked individually)
          isPaid: m.paymentStatus === MilestonePaymentStatus.PAID,
          payoutAmount: (assignment.offeredAmount / totalMilestones).toFixed(2), // Estimate
        })),

      progressPercentage: progress,
    };
  }

  // ============================================
  // 4. ACTION: ADD ADDRESS (For Physical Product)
  // ============================================
  async addDeliveryAddress(
    campaignId: string,
    userId: string,
    dto: AddDeliveryAddressDto,
  ) {
    const influencer = await this.getInfluencerProfile(userId);
    const assignment = await this.assignmentRepo.findOne({
      where: { campaignId, influencerId: influencer.id },
    });

    if (!assignment) throw new NotFoundException('Assignment not found');

    // Fixed: Assignment entity now supports deliveryAddress
    assignment.deliveryAddress = `${dto.address}, ${dto.city}. Phone: ${dto.phone}`;
    await this.assignmentRepo.save(assignment);

    return { success: true, message: 'Delivery address updated' };
  }

  // ============================================
  // 5. ACTION: ACCEPT / DECLINE
  // ============================================
  async acceptOffer(campaignId: string, userId: string) {
    const influencer = await this.getInfluencerProfile(userId);
    const assignment = await this.assignmentRepo.findOne({
      where: { campaignId, influencerId: influencer.id },
    });

    if (assignment?.status !== JobStatus.NEW_OFFER)
      throw new BadRequestException('Invalid offer state');

    assignment.status = JobStatus.ACTIVE;
    await this.assignmentRepo.save(assignment);
    return { success: true, message: 'Offer accepted' };
  }

  async declineOffer(
    campaignId: string,
    userId: string,
    dto: InfluencerDeclineDto,
  ) {
    const influencer = await this.getInfluencerProfile(userId);
    const assignment = await this.assignmentRepo.findOne({
      where: { campaignId, influencerId: influencer.id },
    });

    if (assignment?.status !== JobStatus.NEW_OFFER)
      throw new BadRequestException('Invalid offer state');

    assignment.status = JobStatus.DECLINED;
    // assignment.rejectionReason = dto.reason;
    await this.assignmentRepo.save(assignment);
    return { success: true, message: 'Offer declined' };
  }

  // ============================================
  // 6. ACTION: WITHDRAWAL REQUEST
  // ============================================
  async requestWithdrawal(userId: string, dto: WithdrawalRequestDto) {
    const influencer = await this.getInfluencerProfile(userId);

    // ✅ NOTE: Please add 'walletBalance' to InfluencerProfileEntity to use this check
    // if ((influencer as any).walletBalance < dto.amount) {
    //   throw new BadRequestException('Insufficient balance');
    // }

    return {
      success: true,
      message: 'Withdrawal request submitted',
      // remainingBalance: (influencer as any).walletBalance - dto.amount,
    };
  }

  // ============================================
  // 7. MILESTONE DETAILS (Specific View)
  // ============================================
  async getMilestoneDetails(milestoneId: string, userId: string) {
    const influencer = await this.getInfluencerProfile(userId);

    // Fetch Milestone with Campaign
    const milestone = await this.milestoneRepo.findOne({
      where: { id: milestoneId },
      relations: ['campaign'],
    });

    if (!milestone) throw new NotFoundException('Milestone not found');

    // Verify Access: Influencer must be assigned to this campaign
    const assignment = await this.assignmentRepo.findOne({
      where: { campaignId: milestone.campaignId, influencerId: influencer.id },
    });
    if (!assignment) throw new ForbiddenException('Access denied');

    // Calculate Payout (e.g. from Assignment offer split or milestone specific)
    // Assuming equal split of Assignment Offer for simplicity here
    const totalMilestones = await this.milestoneRepo.count({
      where: { campaignId: milestone.campaignId },
    });
    const payoutAmount = assignment.offeredAmount
      ? assignment.offeredAmount / totalMilestones
      : 0;

    return {
      id: milestone.id,
      header: {
        title: milestone.contentTitle, // "For Milestone 4: Campaign Wrap Up"
        campaignName: milestone.campaign.campaignName,
      },
      requirements: {
        content: 'Final Report + 2 Stories',
        platform: milestone.platform,
      },
      target: {
        reach: milestone.expectedReach || 300000,
        views: milestone.expectedViews || 250000,
      },
      financials: {
        payoutOnApproval: Math.round(payoutAmount),
        status: this.mapStatusToUI(milestone.status, milestone.paymentStatus), // "To Do", "In Review", "Paid"
        paymentStatus: milestone.paymentStatus,
        partialPaidReason:
          milestone.paymentStatus === MilestonePaymentStatus.PARTIAL
            ? 'Target reach not met'
            : null, // Placeholder logic
        date: milestone.updatedAt,
      },
      // Submission Data (Pre-fill for Resubmission or View Only)
      submission: {
        description: milestone.submissionDescription,
        attachments: milestone.submissionAttachments,
        liveLinks: milestone.liveLinks,
        metrics: {
          reach: milestone.actualReach,
          views: milestone.actualViews,
          likes: milestone.actualLikes,
          comments: milestone.actualComments,
        },
        requestedAmount: milestone.requestedAmount,
      },
      // Review Feedback
      review: {
        isDeclined: milestone.status === MilestoneStatus.DECLINED,
        rejectionReason: milestone.rejectionReason,
        canResubmit:
          milestone.status === MilestoneStatus.DECLINED ||
          milestone.status === MilestoneStatus.PENDING,
      },
    };
  }

  private mapStatusToUI(status: string, paymentStatus: string): string {
    if (paymentStatus === MilestonePaymentStatus.PAID) return 'Paid';
    if (paymentStatus === MilestonePaymentStatus.PARTIAL) return 'Partial Paid';
    if (status === MilestoneStatus.IN_REVIEW) return 'In Review';
    if (status === MilestoneStatus.DECLINED) return 'Declined';
    if (status === MilestoneStatus.ACCEPTED) return 'Completed';
    return 'To Do';
  }

  // ============================================
  // 8. ACTION: SUBMIT / RESUBMIT MILESTONE
  // ============================================
  async submitMilestone(
    milestoneId: string,
    userId: string,
    dto: SubmitMilestoneDto,
  ) {
    const influencer = await this.getInfluencerProfile(userId);
    const milestone = await this.milestoneRepo.findOne({
      where: { id: milestoneId },
      relations: ['campaign'],
    });

    if (!milestone) throw new NotFoundException('Milestone not found');

    // Verify Active Assignment
    const assignment = await this.assignmentRepo.findOne({
      where: {
        campaignId: milestone.campaignId,
        influencerId: influencer.id,
        status: JobStatus.ACTIVE,
      },
    });
    if (!assignment)
      throw new ForbiddenException('No active assignment for this campaign');

    // Update Status -> In Review ("Request Review to Admin")
    milestone.status = MilestoneStatus.IN_REVIEW;

    // Save Submission Data
    if (dto.description) milestone.submissionDescription = dto.description;
    if (dto.attachments) milestone.submissionAttachments = dto.attachments;
    if (dto.liveLinks) milestone.liveLinks = dto.liveLinks;
    if (dto.requestedAmount) milestone.requestedAmount = dto.requestedAmount;

    // Update Metrics
    if (dto.actualReach) milestone.actualReach = dto.actualReach;
    if (dto.actualViews) milestone.actualViews = dto.actualViews;
    if (dto.actualLikes) milestone.actualLikes = dto.actualLikes;
    if (dto.actualComments) milestone.actualComments = dto.actualComments;

    // Clear previous rejection if resubmitting
    milestone.rejectionReason = null;

    await this.milestoneRepo.save(milestone);

    return { success: true, message: 'Milestone submitted for Admin review' };
  }
}
