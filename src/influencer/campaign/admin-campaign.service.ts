import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CampaignEntity,
  CampaignStatus,
  PaymentStatus,
} from './entities/campaign.entity';
import {
  CampaignAssignmentEntity,
  JobStatus,
} from './entities/campaign-assignment.entity';
import { CampaignMilestoneEntity } from './entities/campaign-milestone.entity';
import { CampaignReportEntity } from './entities/campaign-report.entity';
import { AgencyProfileEntity } from '../agency/entities/agency-profile.entity';
import { InfluencerProfileEntity } from '../influencer/entities/influencer-profile.entity';
import {
  CampaignNegotiationEntity,
  NegotiationSender,
  NegotiationAction,
} from './entities/campaign-negotiation.entity';
import {
  AdminSearchCampaignDto,
  UpdatePlatformFeeDto,
  AdminAssignVendorsDto,
  AdminReviewMilestoneDto,
  AdminSendQuoteDto,
  AdminInviteAgencyDto,
  AdminSearchEntityDto,
  AdminInviteInfluencersDto,
} from './dto/admin-campaign.dto';

const VAT_RATE = 0.15; // 15%

@Injectable()
export class AdminCampaignService {
  constructor(
    @InjectRepository(CampaignEntity)
    private readonly campaignRepo: Repository<CampaignEntity>,
    @InjectRepository(CampaignNegotiationEntity)
    private readonly negotiationRepo: Repository<CampaignNegotiationEntity>,
    @InjectRepository(CampaignAssignmentEntity)
    private readonly assignmentRepo: Repository<CampaignAssignmentEntity>,
    @InjectRepository(CampaignMilestoneEntity)
    private readonly milestoneRepo: Repository<CampaignMilestoneEntity>,
    @InjectRepository(CampaignReportEntity)
    private readonly reportRepo: Repository<CampaignReportEntity>,
    @InjectRepository(AgencyProfileEntity)
    private readonly agencyRepo: Repository<AgencyProfileEntity>,
    @InjectRepository(InfluencerProfileEntity)
    private readonly influencerRepo: Repository<InfluencerProfileEntity>,
  ) {}

  // ============================================
  // 1. DASHBOARD LIST (Grid View)
  // ============================================
  async findAll(query: AdminSearchCampaignDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const qb = this.campaignRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.client', 'client')
      .select([
        'c.id',
        'c.campaignName',
        'c.campaignType',
        'c.status',
        'c.clientBudget',
        'c.totalBudget',
        'c.createdAt',
        'client.brandName',
        'client.profileImage',
      ])
      .skip(skip)
      .take(limit)
      .orderBy('c.createdAt', 'DESC');

    if (query.status) {
      qb.andWhere('c.status = :status', { status: query.status });
    }

    if (query.search) {
      qb.andWhere(
        '(c.campaignName ILIKE :search OR client.brandName ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const [data, total] = await qb.getManyAndCount();

    return {
      data: data.map((c) => ({
        id: c.id,
        name: c.campaignName,
        client: {
          name: c.client?.brandName || 'Unknown',
          image: c.client?.profileImg,
        },
        type: c.campaignType,
        budget: c.totalBudget || c.clientBudget,
        status: c.status,
        date: c.createdAt,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ============================================
  // 2. CAMPAIGN DETAILS (With Financials & Progress)
  //Matches "Admin-Agency Active Campaign Paid.jpg"
  // ============================================
  async findOne(id: string) {
    const campaign = await this.campaignRepo.findOne({
      where: { id },
      relations: [
        'client',
        'milestones',
        'assets',
        'negotiations',
        'agency',
        'preferredInfluencers',
        'assignments',
        'assignments.influencer',
      ],
    });

    if (!campaign) throw new NotFoundException('Campaign not found');

    // Calculate Progress Step
    let progressStep = 1;
    if (campaign.status === CampaignStatus.QUOTED) progressStep = 2;
    if (
      campaign.paymentStatus === PaymentStatus.FULL ||
      campaign.paymentStatus === PaymentStatus.PARTIAL
    )
      progressStep = 3; // Paid
    if (
      campaign.status === CampaignStatus.ACTIVE ||
      campaign.status === CampaignStatus.PROMOTING
    )
      progressStep = 4; // Promoting
    if (campaign.status === CampaignStatus.COMPLETED) progressStep = 5;

    // Calculate Financials (Partially Paid logic)
    let paidAmount = 0;
    let dueAmount = campaign.totalBudget;

    if (campaign.paymentStatus === PaymentStatus.FULL) {
      paidAmount = campaign.totalBudget;
      dueAmount = 0;
    } else if (campaign.paymentStatus === PaymentStatus.PARTIAL) {
      // Logic: Assuming 50% for partial if exact transaction amount isn't stored,
      // OR you can add 'amountPaid' column to Entity for accuracy.
      paidAmount = campaign.totalBudget * 0.5;
      dueAmount = campaign.totalBudget - paidAmount;
    }

    return {
      id: campaign.id,
      info: {
        name: campaign.campaignName,
        type: campaign.campaignType,
        status: campaign.status,
        progressStep,
      },
      // ✅ Financial Management Section (Matches Figma "Platform Profit" card)
      management: {
        finalQuotedBudget: campaign.totalBudget,
        platformFee: campaign.platformFee,
        availableForVendors: campaign.availableForVendor,

        // Payment Tracking
        paymentStatus: campaign.paymentStatus,
        amountPaid: paidAmount,
        amountDue: dueAmount,
        isFullyPaid: campaign.paymentStatus === PaymentStatus.FULL,
      },
      // ✅ Assignments Overview (Split List)
      assignments: campaign.assignments.map((a) => ({
        id: a.id,
        name: a.influencer
          ? `${a.influencer.firstName} ${a.influencer.lastName}`
          : 'Agency',
        image: a.influencer?.profileImage,
        percentage: a.percentage,
        offerAmount: a.offeredAmount,
        status: a.status,
      })),
      // Standard Details
      client: {
        name: campaign.client.brandName,
        image: campaign.client.profileImg,
      },
      milestones: campaign.milestones.map((m) => ({
        id: m.id,
        title: m.contentTitle,
        status: m.status,
        submission:
          m.status === 'in_review' || m.status === 'accepted'
            ? {
                description: m.submissionDescription,
                files: m.submissionAttachments,
              }
            : null,
      })),
    };
  }

  // ============================================
  // 3. PROFIT MANAGEMENT
  // ============================================
  async updatePlatformFee(id: string, dto: UpdatePlatformFeeDto) {
    const campaign = await this.campaignRepo.findOne({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    if (dto.feeAmount > campaign.totalBudget) {
      throw new BadRequestException('Fee cannot exceed total budget');
    }

    campaign.platformFee = dto.feeAmount;
    campaign.availableForVendor = campaign.totalBudget - dto.feeAmount;

    await this.campaignRepo.save(campaign);

    return {
      success: true,
      data: {
        platformFee: campaign.platformFee,
        availableForVendor: campaign.availableForVendor,
      },
    };
  }

  // ============================================
  // 4. ACTION: SEND QUOTE
  // ============================================
  async sendQuote(id: string, dto: AdminSendQuoteDto) {
    const campaign = await this.campaignRepo.findOne({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const vat = Math.round(dto.baseBudget * VAT_RATE * 100) / 100;
    const total = Math.round((dto.baseBudget + vat) * 100) / 100;

    campaign.quotedBaseBudget = dto.baseBudget;
    campaign.quotedVatAmount = vat;
    campaign.quotedTotalBudget = total;
    campaign.status = CampaignStatus.QUOTED;
    campaign.negotiationTurn = 'client';

    const negotiation = this.negotiationRepo.create({
      campaignId: id,
      sender: NegotiationSender.ADMIN,
      action: NegotiationAction.REQUEST,
      proposedBaseBudget: dto.baseBudget,
      proposedVatAmount: vat,
      proposedTotalBudget: total,
      message: 'Admin submitted a quote.',
    });

    await this.campaignRepo.save(campaign);
    await this.negotiationRepo.save(negotiation);

    return { success: true, message: 'Quote sent', data: { total } };
  }

  // ============================================
  // 5. SEARCH & INVITE (Agencies/Influencers)
  // ============================================
  async searchAgencies(query: AdminSearchEntityDto) {
    const qb = this.agencyRepo
      .createQueryBuilder('agency')
      .select([
        'agency.id',
        'agency.agencyName',
        'agency.profileImage',
        'agency.rating',
      ]);

    if (query.search) {
      qb.where('agency.agencyName ILIKE :search', {
        search: `%${query.search}%`,
      });
    }

    const agencies = await qb.take(10).getMany();
    return agencies.map((a) => ({
      id: a.id,
      name: a.agencyName,
      image: a.logo, // Ensure property exists in Agency entity
      rating: 5,
    }));
  }

  async searchInfluencers(query: AdminSearchEntityDto) {
    const qb = this.influencerRepo
      .createQueryBuilder('inf')
      .select(['inf.id', 'inf.firstName', 'inf.lastName', 'inf.profileImage']);

    if (query.search) {
      qb.where('(inf.firstName ILIKE :search OR inf.lastName ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    const influencers = await qb.take(10).getMany();
    return influencers.map((i) => ({
      id: i.id,
      name: `${i.firstName} ${i.lastName}`,
      image: i.profileImage,
      rating: 5,
    }));
  }

  async inviteAgency(id: string, dto: AdminInviteAgencyDto) {
    const campaign = await this.campaignRepo.findOne({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const agency = await this.agencyRepo.findOne({
      where: { id: dto.agencyId },
    });
    if (!agency) throw new NotFoundException('Agency not found');

    campaign.agency = agency;
    campaign.status = CampaignStatus.PENDING_AGENCY;

    await this.campaignRepo.save(campaign);
    return {
      success: true,
      message: `Invitation sent to ${agency.agencyName}`,
    };
  }

  async assignVendors(id: string, dto: AdminAssignVendorsDto) {
    const campaign = await this.campaignRepo.findOne({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const assignments: CampaignAssignmentEntity[] = [];

    for (const assign of dto.assignments) {
      const newAssignment = this.assignmentRepo.create({
        campaignId: id,
        influencerId: assign.entityId,
        percentage: assign.percentage,
        offeredAmount: assign.offerAmount,
        status: JobStatus.NEW_OFFER,
        assignedBy: 'admin',
      });
      assignments.push(newAssignment);
    }

    await this.assignmentRepo.save(assignments);

    // If fully funded, promote to active
    if (campaign.paymentStatus === PaymentStatus.FULL) {
      campaign.status = CampaignStatus.PROMOTING;
    }

    await this.campaignRepo.save(campaign);

    return {
      success: true,
      message: `Invitations sent to ${assignments.length} vendors`,
    };
  }

  async inviteInfluencers(id: string, dto: AdminInviteInfluencersDto) {
    const campaign = await this.campaignRepo.findOne({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const assignments = dto.influencerIds.map((infId) =>
      this.assignmentRepo.create({
        campaignId: id,
        influencerId: infId,
        assignedBy: 'admin',
        status: JobStatus.NEW_OFFER,
      }),
    );

    await this.assignmentRepo.save(assignments);

    if (campaign.paymentStatus === PaymentStatus.FULL) {
      campaign.status = CampaignStatus.ACTIVE;
      await this.campaignRepo.save(campaign);
    }

    return {
      success: true,
      message: `${assignments.length} invitations sent.`,
    };
  }

  // ============================================
  // 6. EXECUTION: Review Milestone
  // ============================================
  async reviewMilestone(milestoneId: string, dto: AdminReviewMilestoneDto) {
    const milestone = await this.milestoneRepo.findOne({
      where: { id: milestoneId },
      relations: ['campaign'],
    });
    if (!milestone) throw new NotFoundException('Milestone not found');

    if (dto.status === 'declined' && !dto.declineReason) {
      throw new BadRequestException('Decline reason is required');
    }

    milestone.status = dto.status;
    if (dto.status === 'declined') {
      milestone.rejectionReason = dto.declineReason!;
    }

    await this.milestoneRepo.save(milestone);

    // Check for Full Campaign Completion
    if (dto.status === 'accepted') {
      await this.checkCompletion(milestone.campaignId);
    }

    return { success: true, message: `Milestone ${dto.status}` };
  }

  // ✅ Helper: Check and Mark Completion
  async checkCompletion(campaignId: string) {
    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId },
      relations: ['milestones'],
    });

    if (!campaign) return; // ✅ Fix: Handle null

    const allDone = campaign.milestones.every((m) => m.status === 'accepted');
    const fullyPaid = campaign.paymentStatus === PaymentStatus.FULL;

    if (allDone && fullyPaid) {
      campaign.status = CampaignStatus.COMPLETED;
      await this.campaignRepo.save(campaign);
    }
  }

  // ============================================
  // 7. EXTRAS: Manual Payment Verification
  // ============================================
  async manualVerifyPayment(id: string, amount: number) {
    const campaign = await this.campaignRepo.findOne({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found'); // ✅ Fix: Handle null

    campaign.paymentStatus = PaymentStatus.FULL;
    campaign.status = CampaignStatus.PAID;

    await this.campaignRepo.save(campaign);
    return { success: true, message: 'Payment verified' };
  }

  // ============================================
  // 8. VIEW REPORTS
  // ============================================
  async getCampaignReports(id: string) {
    const reports = await this.reportRepo.find({
      where: { campaignId: id },
      order: { createdAt: 'DESC' },
    });

    return reports.map((r) => ({
      id: r.id,
      reason: r.reason,
      status: r.status,
      date: r.createdAt,
    }));
  }
}
