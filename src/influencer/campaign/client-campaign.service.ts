import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  CampaignEntity,
  CampaignStatus,
  PaymentStatus,
} from './entities/campaign.entity';
import { ClientProfileEntity } from '../client/entities/client-profile.entity';
import { InfluencerProfileEntity } from '../influencer/entities/influencer-profile.entity';
import { AgencyProfileEntity } from '../agency/entities/agency-profile.entity';
import { CampaignMilestoneEntity } from './entities/campaign-milestone.entity';
import { CampaignAssetEntity } from './entities/campaign-asset.entity';
import {
  CreateCampaignStep1Dto,
  UpdateCampaignStep2Dto,
  UpdateCampaignStep3Dto,
  UpdateCampaignStep4Dto,
  UpdateCampaignStep5Dto,
  SearchCampaignDto,
  FundCampaignDto,
} from './dto/client-campaign.dto';
import {
  CreateReportDto,
  RateCampaignDto,
  ReviewMilestoneDto,
  SendBonusDto,
  SubmitMilestoneDto,
} from './dto/execution.dto';
import { CampaignReportEntity } from './entities/campaign-report.entity';
import {
  CampaignNegotiationEntity,
  NegotiationAction,
  NegotiationSender,
} from './entities/campaign-negotiation.entity';

@Injectable()
export class ClientCampaignService {
  constructor(
    @InjectRepository(CampaignEntity)
    private readonly campaignRepo: Repository<CampaignEntity>,
    @InjectRepository(ClientProfileEntity)
    private readonly clientRepo: Repository<ClientProfileEntity>,
    @InjectRepository(InfluencerProfileEntity)
    private readonly influencerRepo: Repository<InfluencerProfileEntity>,
    @InjectRepository(AgencyProfileEntity)
    private readonly agencyRepo: Repository<AgencyProfileEntity>,
    @InjectRepository(CampaignMilestoneEntity)
    private readonly milestoneRepo: Repository<CampaignMilestoneEntity>,
    @InjectRepository(CampaignAssetEntity)
    private readonly assetRepo: Repository<CampaignAssetEntity>,
    @InjectRepository(CampaignReportEntity)
    private readonly reportRepo: Repository<CampaignReportEntity>,
    @InjectRepository(CampaignNegotiationEntity)
    private readonly negotiationRepo: Repository<CampaignNegotiationEntity>,
  ) {}

  // --- Helper: Verify Ownership ---
  private async getOwnedCampaign(
    campaignId: string,
    userId: string,
  ): Promise<CampaignEntity> {
    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId },
      relations: ['client'],
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.client.userId !== userId)
      throw new ForbiddenException('Access Denied');
    return campaign;
  }

  // ============================================
  // WIZARD STEP 1: Create Draft
  // ============================================
  async createDraft(userId: string, dto: CreateCampaignStep1Dto) {
    const client = await this.clientRepo.findOne({ where: { userId } });
    if (!client) throw new NotFoundException('Client profile not found');

    const campaign = this.campaignRepo.create({
      campaignName: dto.campaignName,
      campaignType: dto.campaignType,
      clientId: client.id, // Direct ID assignment
      status: CampaignStatus.DRAFT,
      currentStep: 1,
    });

    const saved = await this.campaignRepo.save(campaign);
    return { success: true, id: saved.id, step: 2 };
  }

  // ============================================
  // WIZARD STEP 2: Preferences (Targeting)
  // ============================================
  async updateStep2(id: string, userId: string, dto: UpdateCampaignStep2Dto) {
    const campaign = await this.getOwnedCampaign(id, userId);

    // Explicit null handling
    campaign.productType = dto.productType ?? null;
    campaign.campaignNiche = dto.campaignNiche ?? null;

    // Handle Influencer Lists
    if (dto.preferredInfluencerIds) {
      campaign.preferredInfluencers = await this.influencerRepo.findBy({
        id: In(dto.preferredInfluencerIds),
      });
    }
    if (dto.notPreferableInfluencerIds) {
      campaign.notPreferableInfluencers = await this.influencerRepo.findBy({
        id: In(dto.notPreferableInfluencerIds),
      });
    }

    // Handle Agency Selection
    if (dto.agencyId) {
      const agency = await this.agencyRepo.findOne({
        where: { id: dto.agencyId },
      });
      if (agency) campaign.agency = agency;
    } else {
      campaign.agency = null; // Clear if deselected
    }

    campaign.currentStep = 2;
    await this.campaignRepo.save(campaign);
    return { success: true, step: 3 };
  }

  // ============================================
  // WIZARD STEP 3: Details & Do's/Don'ts
  // ============================================
  async updateStep3(id: string, userId: string, dto: UpdateCampaignStep3Dto) {
    const campaign = await this.getOwnedCampaign(id, userId);

    // Using simple checks to avoid overwriting with undefined
    if (dto.campaignGoals !== undefined)
      campaign.campaignGoals = dto.campaignGoals;
    if (dto.productServiceDetails !== undefined)
      campaign.productServiceDetails = dto.productServiceDetails;

    // ✅ Design Specific Fields
    if (dto.dos !== undefined) campaign.dos = dto.dos;
    if (dto.donts !== undefined) campaign.donts = dto.donts;

    if (dto.reportingRequirements !== undefined)
      campaign.reportingRequirements = dto.reportingRequirements;
    if (dto.usageRights !== undefined) campaign.usageRights = dto.usageRights;

    if (dto.startingDate) {
      campaign.startingDate = new Date(dto.startingDate);
    }
    if (dto.duration !== undefined) campaign.duration = dto.duration;

    campaign.currentStep = 3;
    await this.campaignRepo.save(campaign);
    return { success: true, step: 4 };
  }

  // ============================================
  // WIZARD STEP 4: Budget & Targets
  // ============================================
  async updateStep4(id: string, userId: string, dto: UpdateCampaignStep4Dto) {
    const campaign = await this.getOwnedCampaign(id, userId);

    campaign.clientBudget = dto.clientBudget;

    // ✅ Design Specific Fields
    campaign.targetReach = dto.targetReach ?? null;
    campaign.targetViews = dto.targetViews ?? null;
    campaign.targetLikes = dto.targetLikes ?? null;
    campaign.targetComments = dto.targetComments ?? null;

    campaign.currentStep = 4;
    await this.campaignRepo.save(campaign);

    // Save Milestones (overwrite strategy)
    await this.milestoneRepo.delete({ campaignId: id });
    const milestones = dto.milestones.map((m, i) =>
      this.milestoneRepo.create({
        contentTitle: m.contentTitle,
        platform: m.platform,
        contentQuantity: m.contentQuantity,
        deliveryDays: m.deliveryDays,
        campaignId: id,
        order: i,
        status: 'pending',
      }),
    );
    await this.milestoneRepo.save(milestones);

    return { success: true, step: 5 };
  }

  // ============================================
  // WIZARD STEP 5: Assets
  // ============================================
  async updateStep5(id: string, userId: string, dto: UpdateCampaignStep5Dto) {
    const campaign = await this.getOwnedCampaign(id, userId);

    campaign.needSampleProduct = dto.needSampleProduct;
    campaign.currentStep = 5;
    await this.campaignRepo.save(campaign);

    if (dto.assets && dto.assets.length > 0) {
      await this.assetRepo.delete({ campaignId: id });
      const assets = dto.assets.map((a) =>
        this.assetRepo.create({
          assetType: a.assetType,
          fileName: a.fileName,
          fileUrl: a.fileUrl,
          campaignId: id,
        }),
      );
      await this.assetRepo.save(assets);
    }

    return { success: true, step: 6 };
  }

  // ============================================
  // WIZARD STEP 6: Review Data
  // ============================================
  async getReviewData(id: string, userId: string) {
    const campaign = await this.campaignRepo.findOne({
      where: { id },
      relations: [
        'milestones',
        'assets',
        'preferredInfluencers',
        'agency',
        'client',
      ],
    });

    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.client.userId !== userId)
      throw new ForbiddenException('Access Denied');

    return {
      id: campaign.id,
      name: campaign.campaignName,
      type: campaign.campaignType,
      status: campaign.status,
      // Budget Display Logic
      budget: {
        estimated: campaign.clientBudget,
        quoted: campaign.quotedTotalBudget, // The Admin/Agency Quote
        base: campaign.baseBudget,
        vat: campaign.vatAmount,
        total: campaign.totalBudget, // Final Payable
        paid: 0, // Calculate from transactions if implemented
        due: campaign.netPayableAmount, // Remaining
      },
      deadline: campaign.startingDate,
      target: campaign.agency
        ? campaign.agency.agencyName
        : `${campaign.preferredInfluencers?.length || 0} Influencers`,
      milestones: campaign.milestones,
      assets: campaign.assets,
      dos: campaign.dos,
      donts: campaign.donts,
      targets: {
        reach: campaign.targetReach,
        views: campaign.targetViews,
      },
    };
  }

  // ============================================
  // FINAL ACTION: Place Campaign
  // ============================================
  async placeCampaign(id: string, userId: string) {
    const campaign = await this.getOwnedCampaign(id, userId);

    // Move from DRAFT to RECEIVED (Pending Quote)
    campaign.status = CampaignStatus.RECEIVED;
    campaign.isPlaced = true;
    campaign.placedAt = new Date();

    await this.campaignRepo.save(campaign);
    return { success: true, message: 'Campaign Placed Successfully' };
  }

  // ============================================
  // DASHBOARD: List Campaigns (Tabs)
  // ============================================
  async getClientCampaigns(userId: string, query: SearchCampaignDto) {
    const client = await this.clientRepo.findOne({ where: { userId } });
    if (!client) throw new NotFoundException('Client profile not found');

    // Map UI Tabs to DB Statuses based on Figma
    let statuses: CampaignStatus[] = [];
    switch (query.tab) {
      case 'active':
        statuses = [
          CampaignStatus.ACTIVE,
          CampaignStatus.PROMOTING,
          CampaignStatus.PENDING_AGENCY,
          CampaignStatus.AGENCY_ACCEPTED,
        ];
        break;
      case 'budgeting':
        statuses = [
          CampaignStatus.RECEIVED, // Needs Quote
          CampaignStatus.QUOTED, // Quote Received
          CampaignStatus.NEGOTIATING,
          CampaignStatus.ACCEPTED, // Waiting Payment
        ];
        break;
      case 'completed':
        statuses = [CampaignStatus.COMPLETED];
        break;
      case 'draft':
        statuses = [CampaignStatus.DRAFT];
        break;
      case 'canceled':
        statuses = [CampaignStatus.CANCELLED];
        break;
      default:
        statuses = [CampaignStatus.ACTIVE, CampaignStatus.PROMOTING];
    }

    const campaigns = await this.campaignRepo.find({
      where: { clientId: client.id, status: In(statuses) },
      order: { updatedAt: 'DESC' },
      select: [
        'id',
        'campaignName',
        'campaignType',
        'status',
        'clientBudget',
        'quotedTotalBudget',
        'createdAt',
        'duration',
      ],
    });

    // Minimal Response for Dashboard Cards
    return campaigns.map((c) => ({
      id: c.id,
      name: c.campaignName,
      type: c.campaignType,
      status: c.status,
      // Logic: Show Quoted Budget if available (Admin/Agency response), else Client's estimated budget
      budget:
        c.quotedTotalBudget &&
        c.status !== CampaignStatus.DRAFT &&
        c.status !== CampaignStatus.RECEIVED
          ? c.quotedTotalBudget
          : c.clientBudget,
      date: c.createdAt,
      duration: c.duration,
    }));
  }

  // ============================================
  // DASHBOARD: SINGLE CAMPAIGN DETAILS
  // Matches "Client-Influencer Campaign Details.jpg"
  // ============================================
  async getCampaignDetails(id: string, userId: string) {
    const campaign = await this.getOwnedCampaign(id, userId);

    // Load full details including negotiations and agency
    const details = await this.campaignRepo.findOne({
      where: { id },
      relations: ['milestones', 'assets', 'negotiations', 'agency', 'client'],
    });

    if (!details) throw new NotFoundException('Campaign details not found');

    // Calculate Paid vs Due
    const paidAmount =
      details.paymentStatus === PaymentStatus.FULL ? details.totalBudget : 0;
    const dueAmount = details.netPayableAmount || 0;

    return {
      id: details.id,
      campaignName: details.campaignName,
      status: details.status, // e.g. "QUOTED", "ACTIVE"
      duration: details.duration,
      deadline: details.startingDate,

      // Budgeting Section (Matches "Quote Details" card)
      budget: {
        clientBudget: details.clientBudget,
        // Quote from Admin/Agency
        quotedTotal: details.quotedTotalBudget,
        base: details.baseBudget,
        vat: details.vatAmount,
        total: details.totalBudget,
        // Payment State
        paymentStatus: details.paymentStatus,
        paid: paidAmount,
        due: dueAmount,
      },

      // Negotiation History (For "Budgeting & Quoting" tab)
      negotiations:
        details.negotiations?.map((n) => ({
          sender: n.sender,
          action: n.action,
          amount: n.proposedTotalBudget,
          message: n.message,
          date: n.createdAt,
        })) || [],

      // Execution Progress
      milestones: details.milestones?.sort((a, b) => a.order - b.order) || [],

      // Assets & Targeting
      assets: details.assets || [],
      target: details.agency
        ? details.agency.agencyName
        : `${details.preferredInfluencers?.length || 0} Influencers`,
    };
  }

  // ============================================
  // NEGOTIATION: REQUOTE (Counter-Offer)
  // ============================================
  async requote(id: string, userId: string, amount: number) {
    const campaign = await this.getOwnedCampaign(id, userId);

    if (
      campaign.status !== CampaignStatus.QUOTED &&
      campaign.status !== CampaignStatus.NEGOTIATING
    ) {
      throw new BadRequestException('Campaign is not in negotiation stage');
    }

    // Create Negotiation Record
    const negotiation = this.negotiationRepo.create({
      campaignId: id,
      sender: NegotiationSender.CLIENT,
      action: NegotiationAction.COUNTER_OFFER,
      proposedTotalBudget: amount,
      senderId: userId,
    });
    await this.negotiationRepo.save(negotiation);

    // Update Campaign Status
    campaign.status = CampaignStatus.NEGOTIATING;
    campaign.negotiationTurn = 'admin'; // Waiting for Admin/Agency response
    await this.campaignRepo.save(campaign);

    return { success: true, message: 'Requote sent successfully' };
  }

  // ============================================
  // NEGOTIATION: CONFIRM BUDGET (Accept Quote)
  // ============================================
  async confirmBudget(id: string, userId: string) {
    const campaign = await this.getOwnedCampaign(id, userId);

    if (!campaign.quotedTotalBudget) {
      throw new BadRequestException('No quote available to accept');
    }

    // Create Acceptance Record
    const negotiation = this.negotiationRepo.create({
      campaignId: id,
      sender: NegotiationSender.CLIENT,
      action: NegotiationAction.ACCEPT,
      senderId: userId,
    });
    await this.negotiationRepo.save(negotiation);

    // Lock in Budget from the Quote
    campaign.baseBudget = campaign.quotedBaseBudget || 0;
    campaign.vatAmount = campaign.quotedVatAmount || 0;
    campaign.totalBudget = campaign.quotedTotalBudget;
    campaign.netPayableAmount = campaign.quotedTotalBudget;

    // Move to Funding Stage
    campaign.status = CampaignStatus.ACCEPTED;
    await this.campaignRepo.save(campaign);

    return {
      success: true,
      message: 'Budget confirmed. Please fund the campaign.',
    };
  }

  // ============================================
  // FUNDING: "Pay Dues" / "Fund Campaign"
  // ============================================
  async fundCampaign(id: string, userId: string, amount: number) {
    const campaign = await this.getOwnedCampaign(id, userId);

    if (
      campaign.status !== CampaignStatus.ACCEPTED &&
      campaign.status !== CampaignStatus.PARTIAL_PAID
    ) {
      throw new BadRequestException('Campaign is not ready for funding');
    }

    // [Insert Stripe/Payment Gateway Logic Here]

    // Simulate Payment Success
    const totalPaidSoFar =
      (campaign.paymentStatus === 'partial' ? 500 : 0) + amount; // Example logic

    if (totalPaidSoFar >= campaign.netPayableAmount) {
      campaign.status = CampaignStatus.PAID; // Fully Funded -> Ready for Admin/Agency
      campaign.paymentStatus = PaymentStatus.FULL;
    } else {
      campaign.status = CampaignStatus.PARTIAL_PAID;
      campaign.paymentStatus = PaymentStatus.PARTIAL;
    }

    await this.campaignRepo.save(campaign);

    return {
      success: true,
      message: 'Payment successful',
      status: campaign.status,
    };
  }

  // ============================================
  // EXECUTION: MILESTONE MANAGEMENT
  // ============================================

  // 1. Submit Milestone (Influencer/Agency Side)
  async submitMilestone(
    milestoneId: string,
    userId: string,
    dto: SubmitMilestoneDto,
  ) {
    const milestone = await this.milestoneRepo.findOne({
      where: { id: milestoneId },
      relations: ['campaign'],
    });
    if (!milestone) throw new NotFoundException('Milestone not found');

    if (!milestone.campaign)
      throw new NotFoundException('Campaign link missing for milestone');

    milestone.status = 'in_review';

    // ✅ FIX: Only assign if values exist (Handling Optional Fields)
    if (dto.description) milestone.submissionDescription = dto.description;
    if (dto.attachments) milestone.submissionAttachments = dto.attachments;

    if (dto.actualReach) milestone.actualReach = dto.actualReach;
    if (dto.actualViews) milestone.actualViews = dto.actualViews;

    await this.milestoneRepo.save(milestone);

    if (milestone.campaign.status === CampaignStatus.PROMOTING) {
      milestone.campaign.status = CampaignStatus.IN_REVIEW;
      await this.campaignRepo.save(milestone.campaign);
    }

    return { success: true, message: 'Milestone submitted for review' };
  }

  // 2. Review Milestone (Client/Admin Side) - UPDATED FOR COMPLETION
  async reviewMilestone(
    milestoneId: string,
    userId: string,
    dto: ReviewMilestoneDto,
  ) {
    const milestone = await this.milestoneRepo.findOne({
      where: { id: milestoneId },
      relations: ['campaign'], // Need campaign relation to check siblings
    });
    if (!milestone) throw new NotFoundException('Milestone not found');

    // [Optional: Verify Client Ownership]

    if (dto.action === 'accept') {
      milestone.status = 'accepted';
      await this.milestoneRepo.save(milestone);

      // ✅ CHECK COMPLETION: Are all milestones accepted?
      const allMilestones = await this.milestoneRepo.find({
        where: { campaignId: milestone.campaignId },
      });
      const allDone = allMilestones.every((m) => m.status === 'accepted');

      if (allDone) {
        milestone.campaign.status = CampaignStatus.COMPLETED;
        await this.campaignRepo.save(milestone.campaign);
        return {
          success: true,
          message: 'Milestone accepted. Campaign Completed!',
          campaignStatus: 'completed',
        };
      }
    } else {
      milestone.status = 'declined';
      milestone.rejectionReason = dto.rejectionReason || 'No reason provided';
      await this.milestoneRepo.save(milestone);

      // Revert campaign status to Active/Promoting so they can resubmit
      milestone.campaign.status = CampaignStatus.ACTIVE;
      await this.campaignRepo.save(milestone.campaign);
    }

    return { success: true, message: `Milestone ${dto.action}ed` };
  }

  // ============================================
  // EXTRAS (Popups)
  // ============================================

  async createReport(userId: string, dto: CreateReportDto) {
    const report = this.reportRepo.create({
      campaignId: dto.campaignId,
      reporterId: userId,
      reason: dto.reason,
      status: 'pending',
    });
    await this.reportRepo.save(report);
    return { success: true, message: 'Report submitted to Admin' };
  }

  async sendBonus(userId: string, dto: SendBonusDto) {
    const campaign = await this.getOwnedCampaign(dto.campaignId, userId);
    // [Simulate Payment Logic]
    return {
      success: true,
      message: `Bonus of ${dto.amount} sent successfully`,
    };
  }

  async rateCampaign(userId: string, dto: RateCampaignDto) {
    const campaign = await this.getOwnedCampaign(dto.campaignId, userId);

    if (campaign.status !== CampaignStatus.COMPLETED) {
      throw new BadRequestException('Can only rate completed campaigns');
    }
    // [Save Rating Logic - e.g., to AgencyProfile or InfluencerProfile]

    return { success: true, message: 'Rating submitted' };
  }

  async getTargetOverflow(campaignId: string) {
    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId },
      relations: ['milestones'],
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    let totalTargetReach = campaign.targetReach || 0;
    let totalActualReach = 0;

    if (campaign.milestones) {
      campaign.milestones.forEach((m) => {
        totalActualReach += m.actualReach || 0;
      });
    }

    const isOverflow = totalActualReach > totalTargetReach;
    const percentage =
      totalTargetReach > 0 ? (totalActualReach / totalTargetReach) * 100 : 0;

    return {
      targetReach: totalTargetReach,
      actualReach: totalActualReach,
      isOverflow,
      percentage: Math.round(percentage),
      bonusEligible: isOverflow,
    };
  }
}
