import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, MoreThanOrEqual } from 'typeorm';

import {
  CampaignEntity,
  CampaignStatus,
  PaymentStatus,
} from './entities/campaign.entity';
import { CampaignMilestoneEntity } from './entities/campaign-milestone.entity';
import { CampaignAssetEntity } from './entities/campaign-asset.entity';
import {
  CampaignNegotiationEntity,
  NegotiationSender,
  NegotiationAction,
} from './entities/campaign-negotiation.entity';
import {
  CampaignAssignmentEntity,
  JobStatus,
} from './entities/campaign-assignment.entity';
import { ClientProfileEntity } from '../client/entities/client-profile.entity';
import { InfluencerProfileEntity } from '../influencer/entities/influencer-profile.entity';

import {
  CreateCampaignStep1Dto,
  UpdateCampaignStep2Dto,
  UpdateCampaignStep3Dto,
  UpdateCampaignStep4Dto,
  UpdateCampaignStep5Dto,
} from './dto/create-campaign.dto';
import {
  UpdateCampaignStatusDto,
  SearchCampaignDto,
} from './dto/update-campaign.dto';
import {
  SendQuoteDto,
  CounterOfferDto,
  AcceptNegotiationDto,
  RejectCampaignDto,
} from './dto/campaign-negotiation.dto';
import {
  AssignCampaignDto,
  UpdateAssignmentDto,
  AcceptJobDto,
  DeclineJobDto,
  SearchAssignmentDto,
  SubmitMilestoneDto,
} from './dto/campaign-assignment.dto';
import { AgencyProfileEntity } from '../agency/entities/agency-profile.entity';
import { AgencySearchCampaignDto } from './dto/agency-campaign.dto';
import {
  AgencyQuoteActionDto,
  AgencyRequoteDto,
  AssignAgencyDto,
  SelectAgencyDto,
} from './dto/admin-agency.dto';
import { SystemSettingEntity } from '../admin/entities/system-setting.entity';
import {
  AdminPayMilestoneDto,
  ApproveMilestoneDto,
  ReviewMilestoneDto,
  UpdateMilestoneAmountDto,
  UpdateMilestoneResultDto,
} from './dto/campaign-milestone.dto';
import { MilestoneSubmissionEntity } from './entities/milestone-submission.entity';
import { UserEntity, UserRole } from '../user/entities/user.entity';
import { PayBonusDto } from './dto/payment.dto';
import { RateCampaignDto } from './dto/rate-campaign.dto';
import { SubmissionReportEntity } from './entities/submission-report.entity';

// VAT Rate constant
const VAT_RATE = 0.15;

@Injectable()
export class CampaignService {
  constructor(
    @InjectRepository(CampaignEntity)
    private readonly campaignRepo: Repository<CampaignEntity>,
    @InjectRepository(CampaignMilestoneEntity)
    private readonly milestoneRepo: Repository<CampaignMilestoneEntity>,
    @InjectRepository(CampaignAssetEntity)
    private readonly assetRepo: Repository<CampaignAssetEntity>,
    @InjectRepository(CampaignNegotiationEntity)
    private readonly negotiationRepo: Repository<CampaignNegotiationEntity>,
    @InjectRepository(CampaignAssignmentEntity)
    private readonly assignmentRepo: Repository<CampaignAssignmentEntity>,
    @InjectRepository(UserEntity) // ✅ Added
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(ClientProfileEntity)
    private readonly clientRepo: Repository<ClientProfileEntity>,
    @InjectRepository(InfluencerProfileEntity)
    private readonly influencerRepo: Repository<InfluencerProfileEntity>,
    @InjectRepository(AgencyProfileEntity) // ✅ Added
    private readonly agencyRepo: Repository<AgencyProfileEntity>,
    @InjectRepository(SystemSettingEntity) // ✅ Added
    private readonly systemSettingRepo: Repository<SystemSettingEntity>,
    @InjectRepository(MilestoneSubmissionEntity) // ✅ Added
    private readonly submissionRepo: Repository<MilestoneSubmissionEntity>,
    @InjectRepository(SubmissionReportEntity)
    private reportRepo: Repository<SubmissionReportEntity>,
    private readonly dataSource: DataSource,
  ) {}

  // ============================================
  // HELPER: Budget Calculation
  // ============================================
  private calculateBudget(baseBudget: number) {
    const vatAmount = baseBudget * VAT_RATE;
    const totalBudget = baseBudget + vatAmount;
    return {
      baseBudget,
      vatAmount: Math.round(vatAmount * 100) / 100,
      totalBudget: Math.round(totalBudget * 100) / 100,
      netPayableAmount: Math.round(totalBudget * 100) / 100,
    };
  }

  // ============================================
  // HELPER: Get Client Profile
  // ============================================
  private async getClientProfile(userId: string) {
    const client = await this.clientRepo.findOne({ where: { userId } });
    if (!client) {
      throw new NotFoundException('Client profile not found');
    }
    return client;
  }

  private async getAgencyProfile(userId: string) {
    const agency = await this.agencyRepo.findOne({ where: { userId } });
    if (!agency) throw new ForbiddenException('User is not an agency');
    return agency;
  }

  // ============================================
  // HELPER: Verify Campaign Ownership
  // ============================================
  private async verifyCampaignOwnership(
    campaignId: string,
    userId: string,
    allowPlaced = false,
  ) {
    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId },
      relations: ['preferredInfluencers', 'notPreferableInfluencers'],
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const client = await this.getClientProfile(userId);
    if (campaign.clientId !== client.id) {
      throw new ForbiddenException('Access denied');
    }

    if (!allowPlaced && campaign.isPlaced) {
      throw new BadRequestException('Cannot modify a placed campaign');
    }

    return campaign;
  }

  // ============================================
  // STEP 1: Create Campaign
  // ============================================
  async createCampaign(userId: string, dto: CreateCampaignStep1Dto) {
    const client = await this.getClientProfile(userId);

    const campaign = this.campaignRepo.create({
      campaignName: dto.campaignName,
      campaignType: dto.campaignType,
      clientId: client.id,
      status: CampaignStatus.RECEIVED,
      currentStep: 1,
    });

    const saved = await this.campaignRepo.save(campaign);

    return {
      success: true,
      message: 'Campaign created',
      data: {
        id: saved.id,
        campaignName: saved.campaignName,
        currentStep: saved.currentStep,
        nextStep: 2,
      },
    };
  }

  // ============================================
  // STEP 2: Targeting & Agency/Influencer Preferences
  // ============================================
  async updateStep2(
    campaignId: string,
    userId: string,
    dto: UpdateCampaignStep2Dto,
  ) {
    const campaign = await this.verifyCampaignOwnership(campaignId, userId);

    // 1. Update Core Required Fields
    // campaign.productType = dto.productType; // Mandatory in your DTO
    if (dto.productType) {
      campaign.productType = dto.productType;
    }
    campaign.campaignNiche = dto.campaignNiche; // Mandatory in your DTO
    campaign.currentStep = Math.max(campaign.currentStep, 2);

    // 2. Handle Selected Ad Agency
    // Note: Entity supports one agencyId. Mapping the first one from the DTO array.
    // ✅ FIX: Handle Multiple Selected Agencies
    if (dto.agencyId && dto.agencyId.length > 0) {
      const agencies = await this.agencyRepo.find({
        where: { id: In(dto.agencyId) }, // Use In() for multiple IDs
      });
      campaign.assignedAgencies = agencies;
    } else {
      campaign.assignedAgencies = [];
    }

    // 3. Handle Influencer Relationships (Preferred)
    if (dto.preferredInfluencerIds && dto.preferredInfluencerIds.length > 0) {
      const foundPreferred = await this.influencerRepo.find({
        where: { id: In(dto.preferredInfluencerIds) },
      });
      campaign.preferredInfluencers = foundPreferred;
    } else {
      campaign.preferredInfluencers = [];
    }

    // 4. Handle Influencer Relationships (Not Preferable)
    if (
      dto.notPreferableInfluencerIds &&
      dto.notPreferableInfluencerIds.length > 0
    ) {
      const foundNotPreferable = await this.influencerRepo.find({
        where: { id: In(dto.notPreferableInfluencerIds) },
      });
      campaign.notPreferableInfluencers = foundNotPreferable;
    } else {
      campaign.notPreferableInfluencers = [];
    }

    await this.campaignRepo.save(campaign);

    return {
      success: true,
      message: 'Targeting and Agency preferences saved successfully',
      data: {
        id: campaign.id,
        currentStep: campaign.currentStep,
        nextStep: 3,
      },
    };
  }

  // ============================================
  // STEP 3: Campaign Details
  // ============================================
  async updateStep3(
    campaignId: string,
    userId: string,
    dto: UpdateCampaignStep3Dto,
  ) {
    const campaign = await this.verifyCampaignOwnership(campaignId, userId);

    if (new Date(dto.startingDate) < new Date()) {
      throw new BadRequestException('Starting date must be in the future');
    }

    campaign.campaignGoals = dto.campaignGoals;
    campaign.productServiceDetails = dto.productServiceDetails;
    if (dto.reportingRequirements) {
      campaign.reportingRequirements = dto.reportingRequirements;
    }
    if (dto.usageRights) {
      campaign.usageRights = dto.usageRights;
    }
    if (dto.dos) {
      campaign.dos = dto.dos;
    }
    if (dto.donts) {
      campaign.donts = dto.donts;
    }
    campaign.startingDate = dto.startingDate;
    campaign.duration = dto.duration;
    campaign.currentStep = Math.max(campaign.currentStep, 3);

    await this.campaignRepo.save(campaign);

    return {
      success: true,
      message: 'Campaign details saved',
      data: {
        id: campaign.id,
        currentStep: campaign.currentStep,
        nextStep: 4,
      },
    };
  }

  // ============================================
  // STEP 4: Budget & Milestones
  // ============================================
  async updateStep4(
    campaignId: string,
    userId: string,
    dto: UpdateCampaignStep4Dto,
  ) {
    const campaign = await this.verifyCampaignOwnership(campaignId, userId);

    // 1. Calculate budget (backend is source of truth)
    const budget = this.calculateBudget(dto.baseBudget);

    campaign.baseBudget = budget.baseBudget;
    campaign.vatAmount = budget.vatAmount;
    campaign.totalBudget = budget.totalBudget;
    campaign.netPayableAmount = budget.netPayableAmount;
    campaign.currentStep = Math.max(campaign.currentStep, 4);

    await this.campaignRepo.save(campaign);

    // 2. Replace milestones
    // We delete existing ones and recreate to ensure the order and data are fresh
    await this.milestoneRepo.delete({ campaignId });

    const milestones = dto.milestones.map((m, i) =>
      this.milestoneRepo.create({
        ...m, // ✅ Automatically picks up promotionGoal, expectedReach, etc.
        campaignId,
        order: m.order ?? i,
      }),
    );

    await this.milestoneRepo.save(milestones);

    return {
      success: true,
      message: 'Budget and milestones saved successfully',
      data: {
        id: campaign.id,
        currentStep: campaign.currentStep,
        nextStep: 5,
        budget,
        milestonesCount: milestones.length,
      },
    };
  }

  // ============================================
  // STEP 5: Assets & Final Setup
  // ============================================
  async updateStep5(
    campaignId: string,
    userId: string,
    dto: UpdateCampaignStep5Dto,
  ) {
    const campaign = await this.verifyCampaignOwnership(campaignId, userId);

    campaign.needSampleProduct = dto.needSampleProduct;
    campaign.currentStep = 5;
    await this.campaignRepo.save(campaign);

    if (dto.assets?.length) {
      // Logic: If you want to replace existing assets for this campaign:
      await this.assetRepo.delete({ campaignId });

      const assets = dto.assets.map((a) =>
        this.assetRepo.create({
          ...a, // ✅ Picks up fileName, fileUrl, assetType, and category
          campaignId,
        }),
      );
      await this.assetRepo.save(assets);
    }

    const summary = await this.getCampaignSummary(campaignId);
    return {
      success: true,
      message: 'Brand and Content assets saved successfully.',
      data: { summary },
    };
  }

  // ============================================
  // PLACE CAMPAIGN (Submit for Quote)
  // ============================================
  async placeCampaign(campaignId: string, userId: string) {
    const campaign = await this.verifyCampaignOwnership(campaignId, userId);

    // Validate completeness
    this.validateCampaignForPlacement(campaign);

    campaign.status = CampaignStatus.RECEIVED;
    campaign.isPlaced = true;
    campaign.placedAt = new Date();
    await this.campaignRepo.save(campaign);

    return {
      success: true,
      message: 'Campaign placed successfully',
      data: {
        id: campaign.id,
        campaignName: campaign.campaignName,
        status: campaign.status,
        placedAt: campaign.placedAt,
        budget: {
          baseBudget: campaign.baseBudget,
          vatAmount: campaign.vatAmount,
          totalBudget: campaign.totalBudget,
          netPayableAmount: campaign.netPayableAmount,
        },
      },
    };
  }

  // ============================================
  // HELPER: Campaign Summary (for Step 5)
  // ============================================
  private async getCampaignSummary(campaignId: string) {
    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId },
      relations: ['milestones', 'assets'],
    });

    if (!campaign) return null;

    return {
      campaignName: campaign.campaignName,
      campaignType: campaign.campaignType,
      productType: campaign.productType,
      campaignNiche: campaign.campaignNiche,
      startingDate: campaign.startingDate,
      duration: campaign.duration,
      budget: {
        baseBudget: campaign.baseBudget,
        vatAmount: campaign.vatAmount,
        totalBudget: campaign.totalBudget,
        netPayableAmount: campaign.netPayableAmount,
      },
      milestonesCount: campaign.milestones?.length || 0,
      assetsCount: campaign.assets?.length || 0,
      needSampleProduct: campaign.needSampleProduct,
    };
  }

  // ============================================
  // VALIDATION: Placement
  // ============================================
  private validateCampaignForPlacement(campaign: CampaignEntity) {
    const errors: string[] = [];

    // --- Step 1 Validation ---
    if (!campaign.campaignName) errors.push('Campaign name is required');
    if (!campaign.campaignType) errors.push('Campaign type is required');

    // --- Step 2 Validation ---
    // ✅ FIX: Removed 'Product type is required' check to align with Figma design
    // if (!campaign.productType) errors.push('Product type is required');

    if (!campaign.campaignNiche) errors.push('Campaign niche is required');

    // --- Step 3 Validation ---
    if (!campaign.campaignGoals) errors.push('Campaign goals are required');
    if (!campaign.startingDate) errors.push('Starting date is required');
    if (!campaign.duration) errors.push('Campaign duration is required');

    // --- Step 4 Validation ---
    if (!campaign.totalBudget || campaign.totalBudget <= 0) {
      errors.push('Total budget must be greater than 0');
    }
    if (!campaign.milestones || campaign.milestones.length === 0) {
      errors.push('At least one milestone is required');
    }

    if (errors.length > 0) {
      // Custom exception to return 400 with the error list
      throw new BadRequestException({
        message: 'Validation failed',
        errors: errors,
      });
    }
  }

  // ============================================
  // GET: Client's Campaigns (List)
  // ============================================
  async getClientCampaigns(userId: string, query: SearchCampaignDto) {
    const client = await this.getClientProfile(userId);

    const qb = this.campaignRepo
      .createQueryBuilder('c')
      .select([
        'c.id',
        'c.campaignName',
        'c.campaignType',
        'c.status',
        'c.startingDate',
        'c.duration',
        'c.totalBudget',
        'c.currentStep',
        'c.isPlaced',
        'c.createdAt',
      ])
      .where('c.clientId = :clientId', { clientId: client.id });

    if (query.status) {
      qb.andWhere('c.status = :status', { status: query.status });
    }
    if (query.campaignType) {
      qb.andWhere('c.campaignType = :type', { type: query.campaignType });
    }
    if (query.search) {
      qb.andWhere('c.campaignName ILIKE :search', {
        search: `%${query.search}%`,
      });
    }

    const page = query.page || 1;
    const limit = query.limit || 10;

    const [data, total] = await qb
      .orderBy('c.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      success: true,
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ============================================
  // GET: Single Campaign (Full Details)
  // ============================================
  async getCampaignById(campaignId: string) {
    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId },
      relations: [
        'milestones',
        'assets',
        'preferredInfluencers',
        'notPreferableInfluencers',
        'client',
        'assignedAgencies',
      ],
      select: {
        // Select all campaign fields
        id: true,
        campaignName: true,
        campaignType: true,
        status: true,
        currentStep: true,
        baseBudget: true,
        vatAmount: true,
        totalBudget: true,
        startingDate: true,
        duration: true,
        dos: true,
        donts: true,
        productServiceDetails: true,
        campaignGoals: true,
        campaignNiche: true,
        productType: true,
        createdAt: true,

        // Select specific fields for Client
        client: {
          id: true,
          brandName: true,
          profileImg: true,
        },

        // Select specific fields for Agency
        assignedAgencies: {
          id: true,
          agencyName: true,
          logo: true,
        },

        // Select specific fields for Influencers (if any)
        preferredInfluencers: {
          id: true,
          firstName: true,
          lastName: true,
          profileImg: true,
        },
        notPreferableInfluencers: {
          id: true,
          firstName: true,
          lastName: true,
          profileImg: true,
        },

        // Select all fields for related assets/milestones
        milestones: true,
        assets: true,
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    return {
      success: true,
      data: campaign,
    };
  }

  // ============================================
  // GET: Campaign for Client (with ownership)
  // ============================================
  async getClientCampaignById(campaignId: string, userId: string) {
    await this.verifyCampaignOwnership(campaignId, userId, true);
    return this.getCampaignById(campaignId);
  }

  // ============================================
  // DELETE: Campaign (Only if not active)
  // ============================================
  async deleteCampaign(campaignId: string, userId: string) {
    const campaign = await this.verifyCampaignOwnership(campaignId, userId);

    if (campaign.status !== CampaignStatus.RECEIVED) {
      throw new BadRequestException(
        'Only campaigns in received status can be deleted',
      );
    }

    await this.campaignRepo.remove(campaign);

    return { success: true, message: 'Campaign deleted' };
  }

  // ============================================
  // DELETE: Asset
  // ============================================
  async deleteAsset(assetId: string, userId: string) {
    const asset = await this.assetRepo.findOne({
      where: { id: assetId },
      relations: ['campaign'],
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    const client = await this.getClientProfile(userId);
    if (asset.campaign.clientId !== client.id) {
      throw new ForbiddenException('Access denied');
    }

    if (asset.campaign.isPlaced) {
      throw new BadRequestException(
        'Cannot delete assets from placed campaign',
      );
    }

    await this.assetRepo.remove(asset);

    return { success: true, message: 'Asset deleted' };
  }

  // ============================================
  // GET: Budget Preview
  // ============================================
  getBudgetPreview(baseBudget: number) {
    return {
      success: true,
      data: this.calculateBudget(baseBudget),
    };
  }

  // ============================================
  // ADMIN: Get All Campaigns
  // ============================================
  async getAllCampaigns(query: SearchCampaignDto) {
    const qb = this.campaignRepo
      .createQueryBuilder('c')
      .leftJoin('c.client', 'client')
      .select([
        'c.id',
        'c.campaignName',
        'c.campaignType',
        'c.status',
        'c.startingDate',
        'c.duration',
        'c.totalBudget',
        'c.isPlaced',
        'c.placedAt',
        'c.createdAt',
        'client.id',
        'client.brandName',
      ]);

    if (query.status) {
      qb.andWhere('c.status = :status', { status: query.status });
    }
    if (query.campaignType) {
      qb.andWhere('c.campaignType = :type', { type: query.campaignType });
    }
    if (query.clientId) {
      qb.andWhere('c.clientId = :clientId', { clientId: query.clientId });
    }
    if (query.search) {
      qb.andWhere('c.campaignName ILIKE :search', {
        search: `%${query.search}%`,
      });
    }
    if (query.startDateFrom) {
      qb.andWhere('c.startingDate >= :from', { from: query.startDateFrom });
    }
    if (query.startDateTo) {
      qb.andWhere('c.startingDate <= :to', { to: query.startDateTo });
    }

    const page = query.page || 1;
    const limit = query.limit || 10;

    const [data, total] = await qb
      .orderBy('c.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      success: true,
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ============================================
  // ADMIN: Update Campaign Status
  // ============================================
  async updateCampaignStatus(campaignId: string, dto: UpdateCampaignStatusDto) {
    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    campaign.status = dto.status;
    await this.campaignRepo.save(campaign);

    return {
      success: true,
      message: `Status updated to ${dto.status}`,
      data: {
        id: campaign.id,
        status: campaign.status,
      },
    };
  }

  // ============================================
  // ADMIN: Send Quote
  // ============================================
  async sendQuote(userId: string, dto: SendQuoteDto) {
    const campaign = await this.campaignRepo.findOne({
      where: { id: dto.campaignId },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    // Check if it's admin's turn (or first quote)
    if (campaign.negotiationTurn && campaign.negotiationTurn !== 'admin') {
      throw new ConflictException(
        'Cannot send quote - waiting for client to respond first',
      );
    }

    // Calculate budget with VAT
    const proposedBudget = this.calculateBudget(dto.proposedBaseBudget);

    const negotiation = this.negotiationRepo.create({
      campaignId: dto.campaignId,
      sender: NegotiationSender.ADMIN,
      action: NegotiationAction.REQUEST,
      proposedBaseBudget: proposedBudget.baseBudget,
      proposedVatAmount: proposedBudget.vatAmount,
      proposedTotalBudget: proposedBudget.totalBudget,
      senderId: userId,
    });

    await this.negotiationRepo.save(negotiation);

    // Update campaign status to QUOTED and turn
    campaign.status = CampaignStatus.QUOTED;
    campaign.negotiationTurn = 'client';
    await this.campaignRepo.save(campaign);

    return {
      success: true,
      message: 'Quote sent to client',
      data: {
        campaignId: campaign.id,
        quotedAmount: proposedBudget.baseBudget,
        totalWithVat: proposedBudget.totalBudget,
        waitingFor: 'client',
      },
    };
  }

  // ============================================
  // CLIENT: Send Counter-Offer
  // ============================================
  async sendCounterOffer(userId: string, dto: CounterOfferDto) {
    const campaign = await this.campaignRepo.findOne({
      where: { id: dto.campaignId },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    // Validate client access
    const client = await this.getClientProfile(userId);
    if (campaign.clientId !== client.id) {
      throw new ForbiddenException('Access denied');
    }

    // Check if it's client's turn
    if (campaign.negotiationTurn !== 'client') {
      throw new ConflictException(
        'Cannot send counter-offer - waiting for admin to send quote first',
      );
    }

    // Calculate budget with VAT
    const proposedBudget = this.calculateBudget(dto.proposedBaseBudget);

    const negotiation = this.negotiationRepo.create({
      campaignId: dto.campaignId,
      sender: NegotiationSender.CLIENT,
      action: NegotiationAction.COUNTER_OFFER,
      proposedBaseBudget: proposedBudget.baseBudget,
      proposedVatAmount: proposedBudget.vatAmount,
      proposedTotalBudget: proposedBudget.totalBudget,
      clientProposedServiceFee: dto.clientProposedServiceFee,
      senderId: userId,
    });

    await this.negotiationRepo.save(negotiation);

    // Switch turn to admin
    campaign.negotiationTurn = 'admin';
    await this.campaignRepo.save(campaign);

    return {
      success: true,
      message: 'Counter-offer sent',
      data: {
        campaignId: campaign.id,
        offeredAmount: proposedBudget.baseBudget,
        totalWithVat: proposedBudget.totalBudget,
        clientProposedServiceFee: dto.clientProposedServiceFee,
        waitingFor: 'admin',
      },
    };
  }

  // ============================================
  // Accept Quote (Client or Admin)
  // ============================================
  async acceptQuote(
    userId: string,
    role: 'client' | 'admin',
    dto: AcceptNegotiationDto,
  ) {
    const campaign = await this.campaignRepo.findOne({
      where: { id: dto.campaignId },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (role === 'client') {
      const client = await this.getClientProfile(userId);
      if (campaign.clientId !== client.id) {
        throw new ForbiddenException('Access denied');
      }
    }

    // Get last negotiation to apply the quoted price
    const lastNegotiation = await this.negotiationRepo.findOne({
      where: { campaignId: dto.campaignId },
      order: { createdAt: 'DESC' },
    });

    // Apply the accepted quote price to campaign
    if (lastNegotiation && lastNegotiation.proposedBaseBudget) {
      campaign.baseBudget = lastNegotiation.proposedBaseBudget;
      campaign.vatAmount = lastNegotiation.proposedVatAmount;
      campaign.totalBudget = lastNegotiation.proposedTotalBudget;
    }

    // Create acceptance entry
    await this.negotiationRepo.save(
      this.negotiationRepo.create({
        campaignId: dto.campaignId,
        sender:
          role === 'client'
            ? NegotiationSender.CLIENT
            : NegotiationSender.ADMIN,
        action: NegotiationAction.ACCEPT,
        senderId: userId,
      }),
    );

    // Campaign is now PAID (ready for influencer assignment)
    campaign.status = CampaignStatus.QUOTED;
    campaign.negotiationTurn = null;
    await this.campaignRepo.save(campaign);

    return {
      success: true,
      message: 'Quote accepted. Campaign budget finalized.',
      data: {
        campaignId: campaign.id,
        status: campaign.status,
        agreedBudget: campaign.baseBudget,
        totalWithVat: campaign.totalBudget,
      },
    };
  }

  // ============================================
  // Reject Campaign (Client or Admin)
  // ============================================
  async rejectCampaign(
    userId: string,
    role: 'client' | 'admin',
    dto: RejectCampaignDto,
  ) {
    const campaign = await this.campaignRepo.findOne({
      where: { id: dto.campaignId },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (role === 'client') {
      const client = await this.getClientProfile(userId);
      if (campaign.clientId !== client.id) {
        throw new ForbiddenException('Access denied');
      }
    }

    await this.negotiationRepo.save(
      this.negotiationRepo.create({
        campaignId: dto.campaignId,
        sender:
          role === 'client'
            ? NegotiationSender.CLIENT
            : NegotiationSender.ADMIN,
        action: NegotiationAction.REJECT,
        message: dto.reason,
        senderId: userId,
      }),
    );

    campaign.status = CampaignStatus.CANCELLED;
    campaign.negotiationTurn = null;
    await this.campaignRepo.save(campaign);

    return {
      success: true,
      message: 'Campaign cancelled',
      data: {
        campaignId: campaign.id,
        status: campaign.status,
      },
    };
  }

  // ============================================
  // GET: Negotiation History
  // ============================================
  async getNegotiationHistory(
    campaignId: string,
    userId: string,
    role: 'client' | 'admin',
  ) {
    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (role === 'client') {
      const client = await this.getClientProfile(userId);
      if (campaign.clientId !== client.id) {
        throw new ForbiddenException('Access denied');
      }
    }

    const negotiations = await this.negotiationRepo.find({
      where: { campaignId },
      order: { createdAt: 'ASC' },
      select: [
        'id',
        'sender',
        'action',
        'message',
        'proposedBaseBudget',
        'proposedTotalBudget',
        'isRead',
        'createdAt',
      ],
    });

    return {
      success: true,
      data: {
        campaign: {
          id: campaign.id,
          campaignName: campaign.campaignName,
          status: campaign.status,
          negotiationTurn: campaign.negotiationTurn,
          yourTurn: campaign.negotiationTurn === role,
        },
        negotiations,
      },
    };
  }

  // ============================================
  // Admin: Reset Negotiation (to resend quote)
  // ============================================
  async resetNegotiation(campaignId: string) {
    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    // Reset turn to allow admin to send new quote
    campaign.negotiationTurn = null;
    campaign.status = CampaignStatus.RECEIVED;
    await this.campaignRepo.save(campaign);

    return {
      success: true,
      message: 'Negotiation reset - Admin can now send a new quote',
      data: {
        campaignId: campaign.id,
        status: campaign.status,
        negotiationTurn: campaign.negotiationTurn,
      },
    };
  }

  // ============================================
  // PATCH: Mark Negotiation as Read
  // ============================================
  async markNegotiationRead(negotiationId: string) {
    const negotiation = await this.negotiationRepo.findOne({
      where: { id: negotiationId },
    });

    if (!negotiation) {
      throw new NotFoundException('Negotiation not found');
    }

    negotiation.isRead = true;
    negotiation.readAt = new Date();
    await this.negotiationRepo.save(negotiation);

    return { success: true, message: 'Marked as read' };
  }

  // ============================================
  // CAMPAIGN ASSIGNMENT METHODS (SIMPLIFIED)
  // ============================================

  // --- Helper: Calculate Assignment Budget ---
  private calculateAssignmentBudget(offeredAmount: number) {
    const vatAmount = offeredAmount * VAT_RATE;
    const totalAmount = offeredAmount + vatAmount;
    return {
      offeredAmount,
      vatAmount: Math.round(vatAmount * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
    };
  }

  // ============================================
  // Admin: Assign Campaign to Multiple Influencers
  // Auto-calculates budget split based on number of influencers
  // ============================================
  async assignCampaignToInfluencers(adminId: string, dto: AssignCampaignDto) {
    // Check campaign exists
    const campaign = await this.campaignRepo.findOne({
      where: { id: dto.campaignId },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    // Ensure we have influencer IDs
    if (!dto.influencerIds || dto.influencerIds.length === 0) {
      throw new BadRequestException('At least one influencer ID is required');
    }

    // Check all influencers exist
    const influencers = await this.influencerRepo.find({
      where: { id: In(dto.influencerIds) },
    });

    if (influencers.length !== dto.influencerIds.length) {
      throw new NotFoundException('One or more influencers not found');
    }

    // Check for already assigned influencers (not declined) - CHECK BEFORE CAMPAIGN STATUS
    const existingAssignments = await this.assignmentRepo.find({
      where: {
        campaignId: dto.campaignId,
        influencerId: In(dto.influencerIds),
        status: In([JobStatus.NEW_OFFER, JobStatus.PENDING, JobStatus.ACTIVE]),
      },
    });

    const alreadyAssignedIds = existingAssignments.map((a) => a.influencerId);
    if (alreadyAssignedIds.length > 0) {
      throw new ConflictException(
        `Influencers with IDs ${alreadyAssignedIds.join(', ')} already have active assignments for this campaign`,
      );
    }

    // Campaign must be in PAID status to assign influencers - CHECK AFTER DUPLICATE CHECK
    if (campaign.status !== CampaignStatus.PAID) {
      throw new BadRequestException(
        'Campaign must be paid before assigning influencers',
      );
    }

    // Create assignments for all influencers
    const assignments = dto.influencerIds.map((influencerId) =>
      this.assignmentRepo.create({
        campaignId: dto.campaignId,
        influencerId,
        assignedBy: adminId,
        status: JobStatus.NEW_OFFER,
      }),
    );

    await this.assignmentRepo.save(assignments);

    // Recalculate budget split for ALL assignments of this campaign
    await this.recalculateCampaignBudgetSplit(dto.campaignId);

    // Update campaign status to promoting
    campaign.status = CampaignStatus.PROMOTING;
    await this.campaignRepo.save(campaign);

    // Fetch updated assignments with calculated amounts
    const updatedAssignments = await this.assignmentRepo.find({
      where: {
        campaignId: dto.campaignId,
        influencerId: In(dto.influencerIds),
      },
    });

    return {
      success: true,
      message: `Campaign assigned to ${updatedAssignments.length} influencer(s)`,
      data: updatedAssignments.map((assignment) => ({
        assignmentId: assignment.id,
        campaignId: assignment.campaignId,
        influencerId: assignment.influencerId,
        percentage: assignment.percentage,
        offeredAmount: assignment.offeredAmount,
        totalAmount: assignment.totalAmount,
        status: assignment.status,
      })),
    };
  }

  // ============================================
  // Helper: Recalculate budget split for all influencers
  // ============================================
  private async recalculateCampaignBudgetSplit(campaignId: string) {
    // Get campaign with budget
    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId },
    });

    if (!campaign || !campaign.baseBudget) {
      return;
    }

    // Get all active assignments (not declined/completed)
    const assignments = await this.assignmentRepo.find({
      where: {
        campaignId,
        status: In([JobStatus.NEW_OFFER, JobStatus.PENDING, JobStatus.ACTIVE]),
      },
    });

    if (assignments.length === 0) {
      return;
    }

    // Calculate equal percentage for each influencer
    const percentage = Math.round((100 / assignments.length) * 100) / 100; // e.g., 33.33

    // Calculate amount per influencer
    const amountPerInfluencer =
      Math.round((campaign.baseBudget / assignments.length) * 100) / 100;
    const vatAmount = Math.round(amountPerInfluencer * VAT_RATE * 100) / 100;
    const totalAmount =
      Math.round((amountPerInfluencer + vatAmount) * 100) / 100;

    // Update all assignments
    for (const assignment of assignments) {
      assignment.percentage = percentage;
      assignment.offeredAmount = amountPerInfluencer;
      assignment.vatAmount = vatAmount;
      assignment.totalAmount = totalAmount;
    }

    await this.assignmentRepo.save(assignments);
  }

  // ============================================
  // Admin: Get Campaign Assignments
  // ============================================
  async getCampaignAssignments(campaignId: string) {
    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const assignments = await this.assignmentRepo.find({
      where: { campaignId },
      relations: ['influencer'],
      order: { createdAt: 'DESC' },
    });

    return {
      success: true,
      data: assignments.map((a) => ({
        id: a.id,
        influencerId: a.influencer.id,
        influencerName: `${a.influencer.firstName} ${a.influencer.lastName}`,
        profileImage: a.influencer.profileImage,
        offeredAmount: a.offeredAmount,
        totalAmount: a.totalAmount,
        status: a.status,
        acceptedAt: a.acceptedAt,
        startedAt: a.startedAt,
        completedAt: a.completedAt,
        createdAt: a.createdAt,
        // Delivery address (only if job accepted)
        address:
          a.status !== JobStatus.NEW_OFFER
            ? {
                addressName: a.influencerAddressName,
                street: a.influencerStreet,
                thana: a.influencerThana,
                zilla: a.influencerZilla,
                fullAddress: a.influencerFullAddress,
              }
            : null,
      })),
    };
  }

  // --- Get Campaign Assignments (Client - verify ownership) ---
  async getCampaignAssignmentsForClient(
    campaignId: string,
    clientUserId: string,
  ) {
    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId },
      relations: ['client'],
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    // Verify client owns this campaign
    if (campaign.client.userId !== clientUserId) {
      throw new ForbiddenException('You do not have access to this campaign');
    }

    // Return same response as getCampaignAssignments
    return this.getCampaignAssignments(campaignId);
  }

  // ============================================
  // Admin: Update Assignment (only for new_offer)
  // ============================================
  async updateAssignment(assignmentId: string, dto: UpdateAssignmentDto) {
    const assignment = await this.assignmentRepo.findOne({
      where: { id: assignmentId },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    if (assignment.status !== JobStatus.NEW_OFFER) {
      throw new BadRequestException(
        'Can only update assignments with "new_offer" status',
      );
    }

    if (dto.offeredAmount !== undefined) {
      const budget = this.calculateAssignmentBudget(dto.offeredAmount);
      assignment.offeredAmount = budget.offeredAmount;
      assignment.vatAmount = budget.vatAmount;
      assignment.totalAmount = budget.totalAmount;
    }

    if (dto.message !== undefined) {
      assignment.message = dto.message;
    }

    await this.assignmentRepo.save(assignment);

    return {
      success: true,
      message: 'Assignment updated',
      data: {
        id: assignment.id,
        offeredAmount: assignment.offeredAmount,
        totalAmount: assignment.totalAmount,
      },
    };
  }

  // ============================================
  // Admin: Cancel Assignment
  // ============================================
  async cancelAssignment(assignmentId: string) {
    const assignment = await this.assignmentRepo.findOne({
      where: { id: assignmentId },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    // Can only cancel if not completed
    if (assignment.status === JobStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel a completed assignment');
    }

    const campaignId = assignment.campaignId;

    // Delete the assignment
    await this.assignmentRepo.remove(assignment);

    // Recalculate budget split for remaining influencers
    await this.recalculateCampaignBudgetSplit(campaignId);

    return {
      success: true,
      message: 'Assignment cancelled',
    };
  }

  // ============================================
  // INFLUENCER: Job Management (Simple 5-Stage Flow)
  // ============================================

  // --- Get Influencer's Available Addresses ---
  async getInfluencerAddresses(userId: string) {
    const influencer = await this.influencerRepo.findOne({
      where: { userId },
    });

    if (!influencer) {
      throw new NotFoundException('Influencer profile not found');
    }

    const addresses = influencer.addresses || [];

    return {
      success: true,
      data: addresses.map((addr, index) => ({
        index,
        addressName: addr.addressName,
        thana: addr.thana,
        zilla: addr.zilla,
        fullAddress: addr.fullAddress,
        isDefault: index === 0, // First address is default
      })),
      defaultAddressIndex: addresses.length > 0 ? 0 : null,
    };
  }

  // --- Get Influencer Dashboard Summary ---
  async getInfluencerDashboardSummary(userId: string) {
    const influencer = await this.influencerRepo.findOne({
      where: { userId },
    });

    if (!influencer) {
      throw new NotFoundException('Influencer profile not found');
    }

    // Get all assignments for this influencer
    const assignments = await this.assignmentRepo.find({
      where: { influencerId: influencer.id },
    });

    // Calculate metrics
    let lifetimeEarnings = 0;
    let pendingEarnings = 0;
    let activeJobs = 0;
    let NewOffers = 0;

    assignments.forEach((assignment) => {
      // Count new offers
      if (assignment.status === JobStatus.NEW_OFFER) {
        NewOffers++;
      } else if (assignment.status === JobStatus.PENDING) {
        // Add to pending earnings
        if (assignment.totalAmount) {
          pendingEarnings += Number(assignment.totalAmount);
        }
      } else if (assignment.status === JobStatus.ACTIVE) {
        activeJobs++;
        // Add to pending earnings
        if (assignment.totalAmount) {
          pendingEarnings += Number(assignment.totalAmount);
        }
      } else if (assignment.status === JobStatus.COMPLETED) {
        // Add to lifetime earnings
        if (assignment.totalAmount) {
          lifetimeEarnings += Number(assignment.totalAmount);
        }
      }
    });

    return {
      success: true,
      data: {
        lifetimeEarnings,
        pendingEarnings,
        activeJobs,
        NewOffers,
      },
    };
  }

  // --- Get My Jobs (with status filter for sections) ---
  async getInfluencerJobs(userId: string, query: SearchAssignmentDto) {
    const influencer = await this.influencerRepo.findOne({
      where: { userId },
    });

    if (!influencer) {
      throw new NotFoundException('Influencer profile not found');
    }

    const qb = this.assignmentRepo
      .createQueryBuilder('job')
      .leftJoinAndSelect('job.campaign', 'campaign')
      .leftJoinAndSelect('campaign.client', 'client')
      .where('job.influencerId = :influencerId', {
        influencerId: influencer.id,
      });

    // Filter by status (maps to UI sections)
    if (query.status) {
      qb.andWhere('job.status = :status', { status: query.status });
    }

    if (query.campaignId) {
      qb.andWhere('job.campaignId = :campaignId', {
        campaignId: query.campaignId,
      });
    }

    const page = query.page || 1;
    const limit = query.limit || 10;

    const [jobs, total] = await qb
      .orderBy('job.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      success: true,
      data: jobs.map((job) => ({
        id: job.id,
        campaignId: job.campaign.id,
        campaignName: job.campaign.campaignName,
        brandName: job.campaign.client?.brandName,
        offeredAmount: job.offeredAmount,
        totalAmount: job.totalAmount,
        status: job.status,
        message: job.message,
        address:
          job.status !== JobStatus.NEW_OFFER
            ? {
                addressName: job.influencerAddressName,
                street: job.influencerStreet,
                thana: job.influencerThana,
                zilla: job.influencerZilla,
                fullAddress: job.influencerFullAddress,
              }
            : null,
        createdAt: job.createdAt,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // --- Get Job Counts by Status (for UI badges) ---
  async getInfluencerJobCounts(userId: string) {
    const influencer = await this.influencerRepo.findOne({
      where: { userId },
    });

    if (!influencer) {
      throw new NotFoundException('Influencer profile not found');
    }

    const counts = await this.assignmentRepo
      .createQueryBuilder('job')
      .select('job.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('job.influencerId = :influencerId', {
        influencerId: influencer.id,
      })
      .groupBy('job.status')
      .getRawMany();

    // Convert to object
    const result = {
      new_offer: 0,
      pending: 0,
      active: 0,
      completed: 0,
      declined: 0,
    };

    counts.forEach((c) => {
      result[c.status] = parseInt(c.count, 10);
    });

    return {
      success: true,
      data: result,
    };
  }

  // --- Get Single Job Details ---
  async getJobDetails(assignmentId: string, userId: string) {
    const influencer = await this.influencerRepo.findOne({
      where: { userId },
    });

    if (!influencer) {
      throw new NotFoundException('Influencer profile not found');
    }

    const job = await this.assignmentRepo.findOne({
      where: { id: assignmentId, influencerId: influencer.id },
      relations: ['campaign', 'campaign.client', 'campaign.assets'],
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return {
      success: true,
      data: {
        id: job.id,
        campaignName: job.campaign.campaignName,
        brandName: job.campaign.client?.brandName,
        campaignGoals: job.campaign.campaignGoals,
        productServiceDetails: job.campaign.productServiceDetails,
        startingDate: job.campaign.startingDate,
        duration: job.campaign.duration,
        offeredAmount: job.offeredAmount,
        totalAmount: job.totalAmount,
        message: job.message,
        status: job.status,
        acceptedAt: job.acceptedAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        address:
          job.status !== JobStatus.NEW_OFFER
            ? {
                addressName: job.influencerAddressName,
                street: job.influencerStreet,
                thana: job.influencerThana,
                zilla: job.influencerZilla,
                fullAddress: job.influencerFullAddress,
              }
            : null,
        assets: job.campaign.assets,
      },
    };
  }

  // ============================================
  // Influencer Actions
  // ============================================

  // --- Helper: Resolve Influencer Address ---
  private async resolveInfluencerAddress(
    influencer: InfluencerProfileEntity,
    addressId?: number,
  ) {
    // Get all addresses
    const addresses = influencer.addresses || [];

    if (addresses.length === 0) {
      throw new BadRequestException(
        'No addresses found in profile. Please add at least one address before accepting jobs.',
      );
    }

    // If addressId provided, validate and use it
    if (addressId !== undefined && addressId !== null) {
      if (addressId < 0 || addressId >= addresses.length) {
        throw new BadRequestException(
          `Invalid address ID. You have ${addresses.length} address(es) (0-${addresses.length - 1})`,
        );
      }
      const selectedAddress = addresses[addressId];
      return {
        influencerAddressName: selectedAddress.addressName,
        influencerStreet: selectedAddress.fullAddress, // fullAddress contains the complete address
        influencerThana: selectedAddress.thana,
        influencerZilla: selectedAddress.zilla,
        influencerFullAddress: selectedAddress.fullAddress,
      };
    }

    // Otherwise, use default address (first one)
    const defaultAddress = addresses[0];
    return {
      influencerAddressName: defaultAddress.addressName,
      influencerStreet: defaultAddress.fullAddress,
      influencerThana: defaultAddress.thana,
      influencerZilla: defaultAddress.zilla,
      influencerFullAddress: defaultAddress.fullAddress,
    };
  }

  // --- Accept Job (new_offer → pending) ---
  async acceptJob(assignmentId: string, userId: string, dto?: AcceptJobDto) {
    const influencer = await this.influencerRepo.findOne({
      where: { userId },
    });

    if (!influencer) {
      throw new NotFoundException('Influencer profile not found');
    }

    const job = await this.assignmentRepo.findOne({
      where: { id: assignmentId, influencerId: influencer.id },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.status !== JobStatus.NEW_OFFER) {
      throw new BadRequestException(
        'Can only accept jobs with "new_offer" status',
      );
    }

    // Resolve and save address
    const address = await this.resolveInfluencerAddress(
      influencer,
      dto?.addressId,
    );

    job.status = JobStatus.PENDING;
    job.acceptedAt = new Date();
    job.influencerAddressName = address.influencerAddressName;
    job.influencerStreet = address.influencerStreet;
    job.influencerThana = address.influencerThana;
    job.influencerZilla = address.influencerZilla;
    job.influencerFullAddress = address.influencerFullAddress;

    await this.assignmentRepo.save(job);

    return {
      success: true,
      message: 'Job accepted! It is now in your pending jobs.',
      data: {
        assignmentId: job.id,
        address: {
          addressName: job.influencerAddressName,
          street: job.influencerStreet,
          thana: job.influencerThana,
          zilla: job.influencerZilla,
          fullAddress: job.influencerFullAddress,
        },
      },
    };
  }

  // --- Decline Job (new_offer → declined) ---
  async declineJob(assignmentId: string, userId: string, dto?: DeclineJobDto) {
    const influencer = await this.influencerRepo.findOne({
      where: { userId },
    });

    if (!influencer) {
      throw new NotFoundException('Influencer profile not found');
    }

    const job = await this.assignmentRepo.findOne({
      where: { id: assignmentId, influencerId: influencer.id },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.status !== JobStatus.NEW_OFFER) {
      throw new BadRequestException(
        'Can only decline jobs with "new_offer" status',
      );
    }

    job.status = JobStatus.DECLINED;
    job.declinedAt = new Date();
    if (dto?.reason) {
      job.declineReason = dto.reason;
    }

    await this.assignmentRepo.save(job);

    // Recalculate budget split for remaining influencers
    await this.recalculateCampaignBudgetSplit(job.campaignId);

    return {
      success: true,
      message: 'Job declined.',
    };
  }

  // --- Start Job (pending → active) ---
  async startJob(assignmentId: string, userId: string) {
    const influencer = await this.influencerRepo.findOne({
      where: { userId },
    });

    if (!influencer) {
      throw new NotFoundException('Influencer profile not found');
    }

    const job = await this.assignmentRepo.findOne({
      where: { id: assignmentId, influencerId: influencer.id },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.status !== JobStatus.PENDING) {
      throw new BadRequestException(
        'Can only start jobs with "pending" status',
      );
    }

    job.status = JobStatus.ACTIVE;
    job.startedAt = new Date();

    await this.assignmentRepo.save(job);

    return {
      success: true,
      message: 'Job started! It is now in your active jobs.',
    };
  }

  // --- Complete Job (active → completed) ---
  async completeJob(assignmentId: string, userId: string) {
    const influencer = await this.influencerRepo.findOne({
      where: { userId },
    });

    if (!influencer) {
      throw new NotFoundException('Influencer profile not found');
    }

    const job = await this.assignmentRepo.findOne({
      where: { id: assignmentId, influencerId: influencer.id },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.status !== JobStatus.ACTIVE) {
      throw new BadRequestException(
        'Can only complete jobs with "active" status',
      );
    }

    job.status = JobStatus.COMPLETED;
    job.completedAt = new Date();

    await this.assignmentRepo.save(job);

    return {
      success: true,
      message: 'Congratulations! Job completed successfully.',
    };
  }

  // ============================================
  // Admin: Get All Assignments
  // ============================================
  async getAllAssignments(query: SearchAssignmentDto) {
    const qb = this.assignmentRepo
      .createQueryBuilder('assignment')
      .leftJoinAndSelect('assignment.campaign', 'campaign')
      .leftJoinAndSelect('assignment.influencer', 'influencer');

    if (query.status) {
      qb.andWhere('assignment.status = :status', { status: query.status });
    }

    if (query.campaignId) {
      qb.andWhere('assignment.campaignId = :campaignId', {
        campaignId: query.campaignId,
      });
    }

    if (query.influencerId) {
      qb.andWhere('assignment.influencerId = :influencerId', {
        influencerId: query.influencerId,
      });
    }

    const page = query.page || 1;
    const limit = query.limit || 10;

    const [assignments, total] = await qb
      .orderBy('assignment.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      success: true,
      data: assignments.map((a) => ({
        id: a.id,
        campaignName: a.campaign.campaignName,
        influencerName: `${a.influencer.firstName} ${a.influencer.lastName}`,
        offeredAmount: a.offeredAmount,
        totalAmount: a.totalAmount,
        status: a.status,
        createdAt: a.createdAt,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // --- Get Influencer Earnings Overview with Date Range ---
  async getEarningsOverview(userId: string, range: string = '7d') {
    const influencer = await this.influencerRepo.findOne({
      where: { userId },
    });

    if (!influencer) {
      throw new NotFoundException('Influencer profile not found');
    }

    // Calculate date range
    const now = new Date();
    let startDate = new Date();

    switch (range) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      case 'all':
        startDate = new Date('2000-01-01');
        break;
      default:
        startDate.setDate(now.getDate() - 7);
    }

    // Get completed assignments within date range
    const assignments = await this.assignmentRepo.find({
      where: {
        influencerId: influencer.id,
        status: JobStatus.COMPLETED,
        completedAt: MoreThanOrEqual(startDate),
      },
      relations: ['campaign'],
    });

    // Calculate totals
    let totalEarnings = 0;
    const dailyBreakdown: { [key: string]: { amount: number; count: number } } =
      {};

    assignments.forEach((assignment) => {
      if (assignment.totalAmount) {
        const amount = Number(assignment.totalAmount);
        totalEarnings += amount;

        // Group by date
        const date = assignment.completedAt
          ? assignment.completedAt.toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];

        if (!dailyBreakdown[date]) {
          dailyBreakdown[date] = { amount: 0, count: 0 };
        }
        dailyBreakdown[date].amount += amount;
        dailyBreakdown[date].count++;
      }
    });

    // Format breakdown
    const breakdown = Object.entries(dailyBreakdown)
      .map(([date, data]) => ({
        date,
        amount: data.amount,
        jobCount: data.count,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return {
      success: true,
      data: {
        totalEarnings,
        completedJobs: assignments.length,
        currency: 'BDT',
        timeRange: range,
        breakdown,
      },
    };
  }

  async assignCampaignToAgencies(adminUserId: string, dto: AssignAgencyDto) {
    const settings = await this.systemSettingRepo.findOne({ where: {} });
    if (!settings)
      throw new InternalServerErrorException('System settings not configured');

    const campaign = await this.campaignRepo.findOne({
      where: { id: dto.campaignId },
      relations: ['assignedAgencies', 'milestones'],
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    // --- 1. Snapshot Rates ---
    const VAT_RATE = Number(settings.vatTax) / 100;
    const ADMIN_FEE_RATE = Number(settings.platformFee) / 100;

    // --- 2. Calculate Budgets ---
    const base = Number(campaign.baseBudget);
    campaign.vatAmount = base * VAT_RATE;
    campaign.totalBudget = base + campaign.vatAmount;

    campaign.platformFeeAmount = base * ADMIN_FEE_RATE;
    campaign.availableBudgetForAgency = base - campaign.platformFeeAmount;

    const milestoneCount = campaign.milestones.length;
    if (milestoneCount > 0) {
      const perMilestoneAmount =
        campaign.availableBudgetForAgency / milestoneCount;

      campaign.milestones.forEach((m) => {
        m.amount = perMilestoneAmount;
        m.status = 'pending';
      });
      await this.milestoneRepo.save(campaign.milestones);
    }

    const initialPercent = parseFloat(
      dto.assignedServiceFeePercent.replace('%', ''),
    );
    campaign.proposedServiceFeePercent = initialPercent;

    const agencies = await this.agencyRepo.findBy({ id: In(dto.agencyIds) });
    campaign.assignedAgencies = agencies;
    campaign.status = CampaignStatus.PENDING_AGENCY;
    campaign.assignedAt = new Date();

    await this.campaignRepo.save(campaign);

    return {
      success: true,
      message: `${agencies.length} agencies assigned and they have left only 12 hr for requote. Budget distributed to ${milestoneCount} milestones.`,
    };
  }

  async updateMilestoneAmount(
    milestoneId: string,
    dto: UpdateMilestoneAmountDto,
  ) {
    const milestone = await this.milestoneRepo.findOne({
      where: { id: milestoneId },
      relations: ['campaign'],
    });

    if (!milestone) {
      throw new NotFoundException('Milestone not found');
    }

    milestone.amount = dto.amount;

    await this.milestoneRepo.save(milestone);

    return {
      success: true,
      message: 'Milestone amount updated successfully',
      data: {
        milestoneId: milestone.id,
        newAmount: milestone.amount,
      },
    };
  }

  // ============================================
  // CLIENT: Select
  // ============================================
  async getCampaignAgencyBids(campaignId: string, userId: string) {
    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId, clientId: userId },
      relations: ['assignedAgencies', 'assignedAgencies.user'],
    });

    if (!campaign) throw new NotFoundException('Campaign not found');

    const negotiations = await this.negotiationRepo.find({
      where: {
        campaignId: campaignId,
        action: NegotiationAction.COUNTER_OFFER,
      },
      order: { createdAt: 'DESC' },
    });

    const base = Number(campaign.baseBudget);
    const vat = Number(campaign.vatAmount);
    const total = Number(campaign.totalBudget);
    const adminFee = Number(campaign.platformFeeAmount);

    const bids = campaign.assignedAgencies.map((agency) => {
      const latestAgencyBid = negotiations.find(
        (n) => n.senderId === agency.user?.id,
      );

      const appliedFeePercent = latestAgencyBid
        ? Number(latestAgencyBid.proposedServiceFeePercent)
        : Number(campaign.proposedServiceFeePercent);

      const grossServiceFee = base * (appliedFeePercent / 100);
      const netAvailable = total - grossServiceFee;
      const agencyProfit = grossServiceFee - adminFee;

      return {
        agencyId: agency.id,
        agencyName: agency.agencyName,
        logo: agency.logo,
        proposedServiceFeePercent: `${appliedFeePercent}%`,
        breakdown: {
          baseBudget: base.toFixed(2),
          vatAmount: vat.toFixed(2),
          totalCampaignBudget: total.toFixed(2),
          agencyServiceFeeAmount: grossServiceFee.toFixed(2),
          platformFee: adminFee.toFixed(2),
          estimatedAgencyProfit: agencyProfit.toFixed(2),
          remainingForExecutionOfMilestones: netAvailable.toFixed(2),
        },
        hasRequoted: !!latestAgencyBid,
        submittedAt: latestAgencyBid ? latestAgencyBid.createdAt : null,
      };
    });

    return {
      success: true,
      campaignName: campaign.campaignName,
      data: bids,
    };
  }

  async clientSelectAgency(userId: string, dto: SelectAgencyDto) {
    const campaign = await this.campaignRepo.findOne({
      where: { id: dto.campaignId, clientId: userId },
      relations: ['milestones', 'assignedAgencies'],
    });

    if (!campaign) throw new NotFoundException('Campaign not found');

    const selectedAgency = campaign.assignedAgencies.find(
      (a) => a.id === dto.agencyId,
    );
    if (!selectedAgency)
      throw new BadRequestException('Invalid Agency selection');

    const latestBid = await this.negotiationRepo.findOne({
      where: { campaignId: campaign.id, senderId: selectedAgency.userId },
      order: { createdAt: 'DESC' },
    });

    const finalPercent = latestBid
      ? latestBid.proposedServiceFeePercent
      : campaign.proposedServiceFeePercent;

    const totalAmount = Number(campaign.totalBudget);
    const payAmount = Number(dto.paymentAmount);

    if (payAmount > totalAmount)
      throw new BadRequestException('Payment exceeds total budget');

    campaign.paidAmount = payAmount;
    campaign.dueAmount = totalAmount - payAmount;
    campaign.selectedAgencyId = dto.agencyId;
    campaign.proposedServiceFeePercent = finalPercent;

    if (campaign.dueAmount === 0) {
      campaign.paymentStatus = PaymentStatus.FULL;
    } else {
      campaign.paymentStatus = PaymentStatus.PARTIAL;
    }

    campaign.status = CampaignStatus.AGENCY_ACCEPTED;
    if (campaign.milestones) {
      campaign.milestones.forEach((m) => {
        m.status = 'todo';
      });
      await this.milestoneRepo.save(campaign.milestones);
    }

    await this.campaignRepo.save(campaign);

    return {
      success: true,
      message: `Agency ${selectedAgency.agencyName} selected successfully and milestones activated (todo).`,
      finalFee: `${campaign.proposedServiceFeePercent}%`,
      data: {
        paymentStatus: campaign.paymentStatus,
        totalBudget: campaign.totalBudget,
        paidAmount: campaign.paidAmount,
        dueAmount: campaign.dueAmount,
      },
    };
  }

  async getClientCampaignDetails(campaignId: string, authUserId: string) {
    const clientProfile = await this.clientRepo.findOne({
      where: { userId: authUserId },
    });

    if (!clientProfile) {
      throw new NotFoundException(
        'Client profile not found. Please complete onboarding.',
      );
    }

    const campaign = await this.campaignRepo.findOne({
      where: {
        id: campaignId,
        clientId: clientProfile.id,
      },
      relations: ['client', 'milestones'],
      select: {
        client: {
          id: true,
          brandName: true,
          profileImg: true,
        },
      },
    });

    if (!campaign) throw new NotFoundException('Campaign not found');

    const total = Number(campaign.totalBudget);
    const paid = Number(campaign.paidAmount);
    const due = Number(campaign.dueAmount);

    return {
      success: true,
      data: {
        ...campaign,
        paymentInfo: {
          totalAmount: total.toFixed(2),
          paidAmount: paid.toFixed(2),
          dueAmount: due.toFixed(2),
          showPayDueButton: due > 0,
        },
      },
    };
  }

  async payDueAmount(authUserId: string, campaignId: string, amount: number) {
    const clientProfile = await this.clientRepo.findOne({
      where: { userId: authUserId },
    });

    if (!clientProfile) throw new NotFoundException('Client profile not found');

    const campaign = await this.campaignRepo.findOne({
      where: {
        id: campaignId,
        clientId: clientProfile.id,
      },
    });

    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.dueAmount <= 0)
      throw new BadRequestException('No due amount to pay');

    const currentDue = Number(campaign.dueAmount);
    if (amount > currentDue)
      throw new BadRequestException('Payment exceeds due amount');

    campaign.paidAmount = Number(campaign.paidAmount) + Number(amount);
    campaign.dueAmount = currentDue - amount;

    if (campaign.dueAmount === 0) {
      campaign.paymentStatus = PaymentStatus.FULL;
    }

    await this.campaignRepo.save(campaign);

    return {
      success: true,
      message: `Payment of ${amount} successful. Current due: ${campaign.dueAmount}`,
    };
  }

  // async clientApproveMilestone(userId: string, dto: ApproveMilestoneDto) {
  //   const milestone = await this.milestoneRepo.findOne({
  //     where: { id: dto.milestoneId },
  //     relations: ['campaign'],
  //   });

  //   if (!milestone) throw new NotFoundException('Milestone not found');

  //   const clientProfile = await this.getClientProfile(userId);
  //   if (milestone.campaign.clientId !== clientProfile.id) {
  //     throw new ForbiddenException('Access Denied');
  //   }

  //   // if (milestone.status !== 'in_review') {
  //   //   throw new BadRequestException('Milestone is not ready for approval');
  //   // }

  //   const submission = await this.submissionRepo.findOne({
  //     where: { milestoneId: milestone.id, status: 'pending' },
  //     order: { createdAt: 'DESC' },
  //   });

  //   if (!submission) {
  //     throw new BadRequestException('No pending submission found to approve.');
  //   }

  //   submission.isClientApproved = true;
  //   submission.status = 'approved';
  //   submission.clientReport = 'Approved directly via milestone approval';
  //   await this.submissionRepo.save(submission);

  //   milestone.status = 'client_approved';
  //   await this.milestoneRepo.save(milestone);

  //   return {
  //     success: true,
  //     message:
  //       'Milestone approved by client. Waiting for Admin to release payment.',
  //     data: {
  //       milestoneId: milestone.id,
  //       milestoneStatus: milestone.status,
  //       submissionId: submission.id,
  //       submissionStatus: submission.status,
  //     },
  //   };
  // }

  // ============================================
  // Admin: Update Agency Assignment
  // ============================================
  async updateAgencyAssignment(campaignId: string, dto: AgencyQuoteActionDto) {
    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId },
      relations: ['assignedAgencies'],
    });

    if (!campaign || !campaign.assignedAgencies.length) {
      throw new NotFoundException('No agencies assigned');
    }

    if (dto.approvedBudget !== undefined) {
      campaign.totalBudget = dto.approvedBudget;
    }

    await this.campaignRepo.save(campaign);
    return { success: true, message: 'Updated' };
  }
  // ============================================
  // Admin: Cancel/Remove Agency Assignment
  // ============================================
  async cancelAgencyAssignment(campaignId: string, agencyId?: string) {
    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId },
      relations: ['assignedAgencies'],
    });

    if (!campaign) throw new NotFoundException('Campaign not found');

    if (agencyId) {
      // Remove specific agency
      campaign.assignedAgencies = campaign.assignedAgencies.filter(
        (a) => a.id !== agencyId,
      );
    } else {
      // Clear all
      campaign.assignedAgencies = [];
    }

    if (campaign.assignedAgencies.length === 0) {
      campaign.status = CampaignStatus.RECEIVED;
    }

    await this.campaignRepo.save(campaign);
    return { success: true, message: 'Agency assignment updated' };
  }

  // ============================================
  // ADMIN-AGENCY: Manage Agency Quote (Accept/Reject)
  // ============================================
  async adminManageAgencyQuote(
    adminUserId: string,
    dto: AgencyQuoteActionDto,
    action: 'accept' | 'reject',
  ) {
    const campaign = await this.campaignRepo.findOne({
      where: { id: dto.campaignId },
      relations: ['agency'],
    });

    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.status !== CampaignStatus.AGENCY_NEGOTIATING) {
      throw new BadRequestException(
        'Campaign is not in negotiation with an agency',
      );
    }

    if (action === 'accept') {
      campaign.status = CampaignStatus.AGENCY_ACCEPTED;
      // If admin adjusts budget
      if (dto.approvedBudget) {
        campaign.totalBudget = dto.approvedBudget;
      }
    } else {
      // Rejecting returns it to Pending (or cancels it, depending on business logic)
      campaign.status = CampaignStatus.PENDING_AGENCY;
    }

    await this.campaignRepo.save(campaign);

    return {
      success: true,
      message: `Agency quote ${action}ed`,
      status: campaign.status,
    };
  }

  // ============================================
  // CLIENT/ADMIN: Review Milestone (Approve/Reject)
  // ============================================
  // async reviewMilestone(
  //   milestoneId: string,
  //   userId: string,
  //   action: 'approve' | 'reject',
  //   rejectionReason?: string,
  // ) {
  //   const milestone = await this.milestoneRepo.findOne({
  //     where: { id: milestoneId },
  //     relations: ['campaign', 'campaign.client'],
  //   });

  //   if (!milestone) throw new NotFoundException('Milestone not found');

  //   // Security: Only the Client or Assigned Admin can review
  //   // (You can expand this check based on your needs)
  //   if (
  //     milestone.campaign.client.id !== (await this.getClientProfile(userId)).id
  //   ) {
  //     // Optional: Allow Admin to review too if needed
  //     // throw new ForbiddenException('Only the client can review milestones');
  //   }

  //   if (action === 'approve') {
  //     milestone.status = 'approved';
  //     milestone.rejectionReason = null;
  //   } else {
  //     milestone.status = 'rejected'; // Or 'in_progress' to request re-work
  //     milestone.rejectionReason = rejectionReason || 'Needs revision';
  //   }

  //   await this.milestoneRepo.save(milestone);

  //   return {
  //     success: true,
  //     message: `Milestone ${action}d successfully`,
  //     data: {
  //       milestoneId: milestone.id,
  //       status: milestone.status,
  //     },
  //   };
  // }

  // ============================================
  // AGENCY: Dashboard & Management
  // ============================================

  // --- 1. Agency Dashboard Stats ---
  async getAgencyDashboardStats(userId: string) {
    const agency = await this.getAgencyProfile(userId);

    // ✅ Fix: Use QueryBuilder because agencyId is not a direct column anymore
    const baseQuery = this.campaignRepo
      .createQueryBuilder('c')
      .innerJoin('c.assignedAgencies', 'agency')
      .where('agency.id = :aid', { aid: agency.id });

    const activeCount = await baseQuery
      .clone()
      .andWhere('c.status IN (:...statuses)', {
        statuses: [
          CampaignStatus.ACTIVE,
          CampaignStatus.PROMOTING,
          CampaignStatus.AGENCY_ACCEPTED,
        ],
      })
      .getCount();

    const completedCount = await baseQuery
      .clone()
      .andWhere('c.status = :status', { status: CampaignStatus.COMPLETED })
      .getCount();

    const newRequests = await baseQuery
      .clone()
      .andWhere('c.status = :status', { status: CampaignStatus.PENDING_AGENCY })
      .getCount();

    const { totalEarnings } = await baseQuery
      .clone()
      .select('SUM(c.availableBudgetForAgency)', 'totalEarnings')
      .andWhere('c.status = :status', { status: CampaignStatus.COMPLETED })
      .getRawOne();

    return {
      success: true,
      data: {
        active: activeCount,
        completed: completedCount,
        newRequests: newRequests,
        totalEarnings: parseFloat(totalEarnings) || 0,
      },
    };
  }

  // --- 2. List Agency Campaigns (Tabs) ---
  async getAgencyCampaigns(userId: string, query: AgencySearchCampaignDto) {
    const agency = await this.getAgencyProfile(userId);
    const page = query.page || 1;
    const limit = query.limit || 10;

    const qb = this.campaignRepo
      .createQueryBuilder('c')
      // ✅ FIX: Use Inner Join on 'assignedAgencies' to filter by this agency
      .innerJoin('c.assignedAgencies', 'agency')
      .leftJoinAndSelect('c.client', 'client')

      // ✅ FIX: Filter where the JOINED agency ID matches the user's agency ID
      .where('agency.id = :aid', { aid: agency.id })

      .select([
        'c.id',
        'c.campaignName',
        'c.status',
        'c.startingDate',
        'c.availableBudgetForAgency',
        'c.createdAt',
        'client.brandName',
        'client.profileImg',
      ])
      .orderBy('c.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    // Filter by Tab
    if (query.tab === 'new_offer') {
      qb.andWhere('c.status = :status', {
        status: CampaignStatus.PENDING_AGENCY,
      });
    } else if (query.tab === 'active') {
      qb.andWhere('c.status IN (:...statuses)', {
        statuses: [
          CampaignStatus.ACTIVE,
          CampaignStatus.PROMOTING,
          CampaignStatus.AGENCY_ACCEPTED,
          CampaignStatus.AGENCY_NEGOTIATING, // Added negotiating state
        ],
      });
    } else if (query.tab === 'completed') {
      qb.andWhere('c.status = :status', { status: CampaignStatus.COMPLETED });
    } else if (query.tab === 'declined') {
      qb.andWhere('c.status = :status', { status: CampaignStatus.CANCELLED });
    }

    if (query.search) {
      qb.andWhere('c.campaignName ILIKE :search', {
        search: `%${query.search}%`,
      });
    }

    const [data, total] = await qb.getManyAndCount();

    return {
      success: true,
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // --- 3. Get Single Campaign (With Agency Auth) ---
  async getAgencyCampaignById(campaignId: string, userId: string) {
    const agency = await this.getAgencyProfile(userId);
    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId },
      relations: ['client', 'milestones'],
    });

    if (!campaign) throw new NotFoundException('Campaign not found');

    // --- 1. Budget Calculations ---
    const base = Number(campaign.baseBudget);
    const vat = Number(campaign.vatAmount);
    const total = Number(campaign.totalBudget);
    const adminFee = Number(campaign.platformFeeAmount);
    const netAvailable = Number(campaign.availableBudgetForAgency);

    const feePercent = Number(
      campaign.proposedServiceFeePercent || agency.serviceFee || 0,
    );
    const grossServiceFee = base * (feePercent / 100);
    const agencyProfit = grossServiceFee - adminFee;

    // --- 2. Data Sanitization (Filtering) ---
    const {
      selectedAgencyId,
      paymentStatus,
      baseBudget,
      vatAmount,
      totalBudget,
      platformFeeAmount,
      availableBudgetForAgency,
      netPayableAmount,
      paidAmount,
      dueAmount,
      currentStep,
      isPlaced,
      placedAt,
      client,
      ...safeCampaignData
    } = campaign;

    return {
      success: true,
      data: {
        ...safeCampaignData,

        client: {
          id: client.id,
          brandName: client.brandName,
          firstName: client.firstName,
          lastName: client.lastName,
          profileImg: client.profileImg,
        },
        budgetBreakdown: {
          baseBudget: base.toFixed(2),
          vat: vat.toFixed(2),
          totalBudget: total.toFixed(2),
          adminPlatformFee: adminFee.toFixed(2),
          estimatedAgencyProfit: agencyProfit.toFixed(2),
          netAvailableForAgency: netAvailable.toFixed(2),
        },
      },
    };
  }

  // --- 4. Accept Invite ---
  async agencyAcceptInvite(campaignId: string, userId: string) {
    const agency = await this.getAgencyProfile(userId);

    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId },
      relations: ['assignedAgencies'],
    });

    if (!campaign) throw new NotFoundException('Campaign not found');

    const isAssigned = campaign.assignedAgencies?.some(
      (a) => a.id === agency.id,
    );
    if (!isAssigned) {
      throw new ForbiddenException(
        'This campaign is not assigned to your agency',
      );
    }

    this.checkDeadline(campaign.assignedAt);

    const existingResponse = await this.negotiationRepo.findOne({
      where: { campaignId, senderId: userId },
    });
    if (existingResponse) {
      throw new BadRequestException(
        'You have already responded (Accepted or Requoted) to this campaign.',
      );
    }

    const negotiation = this.negotiationRepo.create({
      campaignId: campaignId,
      senderId: userId,
      sender: NegotiationSender.AGENCY,
      action: NegotiationAction.ACCEPT,
      proposedServiceFeePercent: campaign.proposedServiceFeePercent,
      message: 'Agency accepted the standard invite offer.',
    });

    await this.negotiationRepo.save(negotiation);

    if (campaign.status === CampaignStatus.PENDING_AGENCY) {
      campaign.status = CampaignStatus.AGENCY_NEGOTIATING;
      await this.campaignRepo.save(campaign);
    }

    return {
      success: true,
      message:
        'Invite accepted. You are now listed as a bidder at standard rate.',
    };
  }

  // --- 1. Get all agencies for a specific campaign ---
  async getCampaignAssignedAgencies(campaignId: string) {
    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId },
      relations: ['assignedAgencies'],
      select: {
        id: true,
        campaignName: true,
        assignedAgencies: {
          id: true,
          agencyName: true,
          logo: true,
          firstName: true,
          lastName: true,
        },
      },
    });

    if (!campaign) throw new NotFoundException('Campaign not found');

    return {
      success: true,
      data: campaign.assignedAgencies,
    };
  }

  // --- 2. Get all campaigns that have at least one agency (Admin View) ---
  async getAllAgencyAssignments(query: AgencySearchCampaignDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;

    const qb = this.campaignRepo
      .createQueryBuilder('c')
      // Use innerJoin (not innerJoinAndSelect) so we can manually pick fields below
      .innerJoin('c.assignedAgencies', 'agency')
      .leftJoin('c.client', 'client')

      // ✅ Explicitly select ONLY minimal fields
      .select([
        // Campaign Fields
        'c.id',
        'c.campaignName',
        'c.campaignType',
        'c.status',
        'c.totalBudget',
        'c.paymentStatus',
        'c.updatedAt',
        'c.createdAt',

        // Minimal Agency Info
        'agency.id',
        'agency.agencyName',
        'agency.logo',
        'agency.firstName',
        'agency.lastName',

        // Minimal Client Info
        'client.id',
        'client.brandName',
        'client.profileImg',
      ])
      .orderBy('c.updatedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.status) {
      qb.andWhere('c.status = :status', { status: query.status });
    }

    const [data, total] = await qb.getManyAndCount();

    return {
      success: true,
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // --- 5. Requote (Negotiation) ---
  async agencyRequote(
    campaignId: string,
    userId: string,
    dto: AgencyRequoteDto,
  ) {
    const agency = await this.getAgencyProfile(userId);

    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId },
      relations: ['assignedAgencies'],
    });

    if (!campaign) throw new NotFoundException('Campaign not found');

    const isAssigned = campaign.assignedAgencies?.some(
      (a) => a.id === agency.id,
    );
    if (!isAssigned) throw new ForbiddenException('Access Denied');

    this.checkDeadline(campaign.assignedAt);

    const negotiation = this.negotiationRepo.create({
      campaignId: campaignId,
      senderId: userId,
      sender: NegotiationSender.AGENCY,
      action: NegotiationAction.COUNTER_OFFER,
      proposedServiceFeePercent: dto.proposedServiceFeePercent,
      message: dto.message,
    });

    await this.negotiationRepo.save(negotiation);

    if (campaign.status === CampaignStatus.PENDING_AGENCY) {
      campaign.status = CampaignStatus.AGENCY_NEGOTIATING;
      await this.campaignRepo.save(campaign);
    }

    return {
      success: true,
      message:
        'Requote submitted. You are listed as a bidder with custom rate.',
      data: {
        proposedServiceFeePercent: dto.proposedServiceFeePercent,
        senderId: userId,
      },
    };
  }
  // ============================================
  // Helper Function: 12-Hour Deadline Check
  // ============================================
  private checkDeadline(assignedAt: Date) {
    if (assignedAt) {
      const assignedTime = new Date(assignedAt).getTime();
      const currentTime = new Date().getTime();
      const hoursPassed = (currentTime - assignedTime) / (1000 * 60 * 60);

      if (hoursPassed > 12) {
        throw new ForbiddenException(
          'Response period expired. You can only Accept or Requote within 12 hours.',
        );
      }
    }
  }

  async getAgencyMilestones(campaignId: string, userId: string) {
    const agency = await this.getAgencyProfile(userId);

    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId, selectedAgencyId: agency.id },
      relations: ['milestones'],
    });

    if (!campaign) {
      throw new ForbiddenException(
        'You are not authorized or assigned to this campaign.',
      );
    }

    return {
      success: true,
      data: campaign.milestones.sort((a, b) => a.order - b.order),
    };
  }

  // --- 6. Submit Milestone (Agency Execution) ---
  async agencySubmitMilestone(
    milestoneId: string,
    userId: string,
    dto: SubmitMilestoneDto,
  ) {
    const agency = await this.getAgencyProfile(userId);

    const milestone = await this.milestoneRepo.findOne({
      where: { id: milestoneId },
      relations: ['campaign', 'submissions'],
    });

    if (!milestone) throw new NotFoundException('Milestone not found');

    if (milestone.campaign.selectedAgencyId !== agency.id) {
      throw new ForbiddenException(
        'You are not the selected agency for this campaign.',
      );
    }

    if (['completed', 'paid'].includes(milestone.status)) {
      throw new BadRequestException('Milestone is already completed/paid.');
    }

    // if (milestone.status === 'in_review') {
    //   throw new BadRequestException('Milestone is already under review.');
    // }

    // Requested Amount Validation Logic
    const alreadyPaid =
      milestone.submissions?.reduce((sum, sub) => {
        return sum + (Number(sub.paidToAgencyAmount) || 0);
      }, 0) || 0;
    const totalBudget = Number(milestone.amount);
    const availableBalance = totalBudget - alreadyPaid;
    const requested = Number(dto.requestPaymentAmount);

    if (requested > availableBalance) {
      throw new BadRequestException(
        `Requested amount (${requested}) exceeds available milestone balance (${availableBalance}). Already paid: ${alreadyPaid}`,
      );
    }

    if (requested <= 0) {
      throw new BadRequestException(
        'Requested amount must be greater than zero.',
      );
    }

    const submission = this.submissionRepo.create({
      milestone: { id: milestoneId } as any,
      submissionDescription: dto.description,
      submissionAttachments: dto.proofAttachments,
      submissionLiveLinks: dto.liveLinks,
      requestedAmount: requested,
      status: 'pending',
      rejectionReason: null,
      isClientApproved: false,
    });

    await this.submissionRepo.save(submission);

    milestone.status = 'in_review'; // for response
    await this.milestoneRepo.update(milestone.id, { status: 'in_review' });

    return {
      success: true,
      message: 'Milestone submitted successfully',
      data: {
        milestoneId: milestone.id,
        milestoneStatus: milestone.status,
        submissionId: submission.id,
        submissionStatus: submission.status,
        requestedAmount: submission.requestedAmount,
        availableBalanceAfterRequest: availableBalance - requested,
      },
    };
  }

  // ==================================================================
  // AGENCY: Resubmit / Edit Submission (Fixing Declined Work)
  // ==================================================================
  async agencyResubmitSubmission(
    submissionId: string,
    userId: string,
    dto: SubmitMilestoneDto,
  ) {
    const submission = await this.submissionRepo.findOne({
      where: { id: submissionId },
      relations: ['milestone', 'milestone.campaign', 'milestone.submissions'],
    });

    if (!submission) throw new NotFoundException('Submission not found');

    const milestone = submission.milestone;
    const campaign = milestone.campaign;

    const agency = await this.getAgencyProfile(userId);
    if (campaign.selectedAgencyId !== agency.id) {
      throw new ForbiddenException(
        'You are not the selected agency for this campaign.',
      );
    }

    if (['approved', 'paid'].includes(submission.status)) {
      throw new BadRequestException(
        'Cannot edit a submission that is already approved or paid.',
      );
    }

    const totalBudget = Number(milestone.amount);

    const totalPaid = milestone.submissions.reduce((sum, sub) => {
      return sum + (Number(sub.paidToAgencyAmount) || 0);
    }, 0);

    const availableBalance = totalBudget - totalPaid;
    const requested = Number(dto.requestPaymentAmount);

    if (requested > availableBalance) {
      throw new BadRequestException(
        `Resubmission amount (${requested}) exceeds available milestone balance (${availableBalance}).`,
      );
    }

    if (requested <= 0) {
      throw new BadRequestException(
        'Requested amount must be greater than zero.',
      );
    }

    submission.submissionDescription =
      dto.description ?? submission.submissionDescription;
    submission.submissionAttachments =
      dto.proofAttachments ?? submission.submissionAttachments;
    submission.submissionLiveLinks =
      dto.liveLinks ?? submission.submissionLiveLinks;
    submission.requestedAmount = requested ?? submission;

    submission.status = 'pending';
    // submission.rejectionReason = null;
    submission.isClientApproved = false;

    await this.submissionRepo.save(submission);

    if (milestone.status !== 'in_review') {
      milestone.status = 'in_review';
      await this.milestoneRepo.save(milestone);
    }

    return {
      success: true,
      message: 'Submission updated and resent for review.',
      data: {
        submissionId: submission.id,
        status: submission.status,
        milestoneStatus: milestone.status,
        requestedAmount: submission.requestedAmount,
      },
    };
  }

  // ------------------------------------------------------------------
  // 2. Client: Review Submission (Approve/Decline with Report)
  // ------------------------------------------------------------------
  async clientReviewSubmission(
    userId: string,
    submissionId: string,
    dto: ReviewMilestoneDto,
  ) {
    const submission = await this.submissionRepo.findOne({
      where: { id: submissionId },
      relations: ['milestone', 'milestone.campaign'],
    });

    if (!submission) throw new NotFoundException('Submission not found');

    // 2. Auth Check
    const client = await this.getClientProfile(userId);
    if (submission.milestone.campaign.clientId !== client.id) {
      throw new ForbiddenException('Access Denied');
    }

    // A. Save Report/Comment History
    if (dto.report || dto.reason) {
      const report = this.reportRepo.create({
        submissionId: submission.id,
        authorId: userId,
        authorRole: 'client',
        content: dto.report || dto.reason,
        actionTaken: dto.action || 'comment',
      });
      await this.reportRepo.save(report);
    }

    // B. Handle Actions (If provided)
    if (dto.action === 'approve') {
      submission.status = 'client_approved'; // Admin এর জন্য রেডি
      submission.isClientApproved = true;
      submission.rejectionReason = null;
    } else if (dto.action === 'decline') {
      submission.status = 'declined';
      submission.isClientApproved = false;
      submission.rejectionReason = dto.reason || dto.report || null;
      // Milestone status also updates to reflect feedback needed
      submission.milestone.status = 'declined';
    }

    await this.submissionRepo.save(submission);
    if (dto.action === 'decline') {
      await this.milestoneRepo.save(submission.milestone);
    }
    return {
      success: true,
      message: dto.action ? `Submission ${dto.action}d.` : 'Comment added.',
      data: { status: submission.status },
    };
  }

  // Admin Review (Approve OR Decline)
  async adminReviewSubmission(submissionId: string, dto: ReviewMilestoneDto) {
    const submission = await this.submissionRepo.findOne({
      where: { id: submissionId },
      relations: ['milestone', 'milestone.campaign'],
    });

    if (!submission) throw new NotFoundException('Submission not found');

    // // A. Save Admin Report
    // if (dto.report || dto.reason) {
    //   await this.reportRepo.save({
    //     submissionId: submission.id,
    //     authorId: 'ADMIN', // Or specific admin ID
    //     authorRole: 'admin',
    //     content: dto.report || dto.reason,
    //     actionTaken: dto.action || 'comment',
    //   });
    // }

    // B. Handle Actions
    if (dto.action === 'decline') {
      submission.status = 'declined';
      submission.rejectionReason = `Admin: ${dto.reason}`;
      submission.milestone.status = 'declined';
    } else if (dto.action === 'approve') {
      submission.status = 'approved';
      submission.rejectionReason = null;
      // Campaign status update logic
      if (submission.milestone.campaign.status !== 'promoting') {
        submission.milestone.campaign.status = 'promoting';
        await this.campaignRepo.save(submission.milestone.campaign);
      }
    }

    await this.submissionRepo.save(submission);
    await this.milestoneRepo.save(submission.milestone); // Update milestone status

    return { success: true, message: `Admin action: ${dto.action}` };
  }

  // ------------------------------------------------------------------
  // 3. Admin: Review & Pay (Full/Partial)
  // ------------------------------------------------------------------
  async adminPaySubmission(submissionId: string, dto: AdminPayMilestoneDto) {
    const submission = await this.submissionRepo.findOne({
      where: { id: submissionId },
      relations: ['milestone'],
    });

    if (!submission) throw new NotFoundException('Submission not found');

    if (submission.status === 'declined') {
      throw new BadRequestException('Cannot pay for a declined submission.');
    }

    if (submission.status === 'completed') {
      throw new BadRequestException('Already paid/completed.');
    }

    submission.paidToAgencyAmount = dto.amount;
    submission.status = 'approved';
    submission.paymentStatus = 'paid';
    submission.adminFeedback = 'Payment Released';

    const requested = Number(submission.requestedAmount || 0);
    const paid = Number(dto.amount);
    const milestoneBudget = Number(submission.milestone.amount);

    if (paid < milestoneBudget) {
      submission.milestone.status = 'partial_paid';
    } else {
      submission.milestone.status = 'completed'; // Milestone Done
    }

    await this.submissionRepo.save(submission);
    await this.milestoneRepo.save(submission.milestone);

    return {
      success: true,
      message: `Payment of ${dto.amount} released for submission. Milestone status: ${submission.milestone.status}.`,
    };
  }

  // ------------------------------------------------------------------
  // 4. Admin: Decline Submission
  // ------------------------------------------------------------------
  async adminDeclineSubmission(submissionId: string, reason: string) {
    const submission = await this.submissionRepo.findOne({
      where: { id: submissionId },
      relations: ['milestone'],
    });

    if (!submission) throw new NotFoundException('Submission not found');

    submission.status = 'declined';
    submission.rejectionReason = `Admin: ${reason}`;

    submission.milestone.status = 'declined';

    await this.submissionRepo.save(submission);
    await this.milestoneRepo.save(submission.milestone);

    return { success: true, message: 'Submission declined by Admin.' };
  }

  // ==================================================================
  // GET: All Milestones for a Campaign
  // ==================================================================
  async getCampaignMilestones(campaignId: string, userId: string) {
    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId },
      relations: ['milestones', 'assignedAgencies', 'milestones.submissions'],
    });

    if (!campaign) throw new NotFoundException('Campaign not found');

    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['agencyProfile', 'clientProfile'],
    });

    let hasAccess = false;
    if (user?.role === UserRole.ADMIN) hasAccess = true;
    else if (
      user?.role === UserRole.CLIENT &&
      campaign.clientId === user.clientProfile?.id
    ) {
      hasAccess = true;
    } else if (user?.role === UserRole.AGENCY) {
      const isAssigned = campaign.assignedAgencies.some(
        (a) => a.id === user.agencyProfile?.id,
      );
      if (isAssigned) hasAccess = true;
    }

    if (!hasAccess)
      throw new ForbiddenException(
        'You do not have access to this campaign data.',
      );

    const sanitizedMilestones = campaign.milestones
      .sort((a, b) => a.order - b.order)
      .map((m) => {
        const cleanSubmissions = m.submissions
          ? m.submissions
              .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
              .map((s) => ({
                id: s.id,
                status: s.status,
                requestedAmount: s.requestedAmount,
                paidAmount: s.paidToAgencyAmount,
                createdAt: s.createdAt,
              }))
          : [];

        return {
          id: m.id,
          contentTitle: m.contentTitle,
          platform: m.platform,
          contentQuantity: m.contentQuantity,
          amount: m.amount,
          status: m.status,
          order: m.order,
          submissions: cleanSubmissions,
        };
      });

    return {
      success: true,
      data: sanitizedMilestones,
    };
  }

  // ==================================================================
  // GET: Single Milestone Details
  // ==================================================================
  async getMilestoneById(milestoneId: string, userId: string) {
    const milestone = await this.milestoneRepo.findOne({
      where: { id: milestoneId },
      relations: ['campaign', 'submissions', 'campaign.assignedAgencies'],
    });

    if (!milestone) throw new NotFoundException('Milestone not found');

    // --- Auth Check ---
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['agencyProfile', 'clientProfile'],
    });

    let hasAccess = false;
    if (user?.role === UserRole.ADMIN) hasAccess = true;
    else if (
      user?.role === UserRole.CLIENT &&
      milestone.campaign.clientId === user.clientProfile?.id
    ) {
      hasAccess = true;
    } else if (user?.role === UserRole.AGENCY) {
      const isAssigned = milestone.campaign.assignedAgencies.some(
        (a) => a.id === user.agencyProfile?.id,
      );
      if (isAssigned) hasAccess = true;
    }

    if (!hasAccess) throw new ForbiddenException('You do not have access.');

    // --- Data Sanitization ---
    const { campaign, ...milestoneData } = milestone;

    const sortedSubmissions = milestone.submissions
      ? milestone.submissions.sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
        )
      : [];

    return {
      success: true,
      data: {
        ...milestoneData,
        submissions: sortedSubmissions,
      },
    };
  }

  // ==================================================================
  // GET: Single Submission Details
  // ==================================================================
  async getSubmissionById(submissionId: string, userId: string) {
    const submission = await this.submissionRepo.findOne({
      where: { id: submissionId },
      relations: [
        'milestone',
        'milestone.campaign',
        'milestone.campaign.assignedAgencies',
      ],
    });

    if (!submission) throw new NotFoundException('Submission not found');

    // --- Auth Check ---
    const campaign = submission.milestone.campaign;
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['agencyProfile', 'clientProfile'],
    });

    let hasAccess = false;
    if (user?.role === UserRole.ADMIN) hasAccess = true;
    else if (
      user?.role === UserRole.CLIENT &&
      campaign.clientId === user.clientProfile?.id
    ) {
      hasAccess = true;
    } else if (user?.role === UserRole.AGENCY) {
      const isAssigned = campaign.assignedAgencies.some(
        (a) => a.id === user.agencyProfile?.id,
      );
      if (isAssigned) hasAccess = true;
    }

    if (!hasAccess) throw new ForbiddenException('You do not have access.');

    // --- Data Sanitization ---
    const { milestone, ...submissionData } = submission;

    return {
      success: true,
      data: {
        ...submissionData,
        milestoneId: milestone.id,
        milestoneTitle: milestone.contentTitle,
      },
    };
  }

  // ==================================================================
  // 1. UPDATE SUBMISSION RESULTS (Agency updates metrics for a specific work)
  // ==================================================================
  async updateSubmissionResults(
    submissionId: string,
    userId: string,
    dto: UpdateMilestoneResultDto,
  ) {
    const submission = await this.submissionRepo.findOne({
      where: { id: submissionId },
      relations: ['milestone', 'milestone.campaign'],
    });

    if (!submission) throw new NotFoundException('Submission not found');

    const milestone = submission.milestone;
    const campaign = milestone.campaign;

    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['agencyProfile'],
    });

    if (user?.role === UserRole.ADMIN) {
      // Admin allowed
    } else if (user?.role === UserRole.AGENCY) {
      if (campaign.selectedAgencyId !== user.agencyProfile?.id) {
        throw new ForbiddenException(
          'You are not the selected agency for this campaign.',
        );
      }
    } else {
      throw new ForbiddenException('Access Denied');
    }

    submission.achievedViews = dto.achievedViews ?? submission.achievedViews;
    submission.achievedReach = dto.achievedReach ?? submission.achievedReach;
    submission.achievedLikes = dto.achievedLikes ?? submission.achievedLikes;
    // submission.achievedComments = dto.achievedComments ?? submission.achievedComments;

    await this.submissionRepo.save(submission);

    return {
      success: true,
      message: 'Submission metrics updated successfully.',
      data: {
        submissionId: submission.id,
      },
    };
  }
  // ==================================================================
  // 2. PAY BONUS (Client pays for overflow)
  // ==================================================================
  async clientPayBonus(milestoneId: string, userId: string, dto: PayBonusDto) {
    const milestone = await this.milestoneRepo.findOne({
      where: { id: milestoneId },
      relations: ['campaign', 'submissions'],
    });
    if (!milestone) throw new NotFoundException('Milestone not found');

    const client = await this.getClientProfile(userId);
    if (milestone.campaign.clientId !== client.id)
      throw new ForbiddenException();

    const totalViews = milestone.submissions.reduce(
      (sum, sub) => sum + (sub.achievedViews || 0),
      0,
    );
    const expectedViews = milestone.expectedViews || 0;

    // if traget not exceeded
    if (totalViews <= expectedViews) {
      throw new BadRequestException(
        `Target not exceeded. Total: ${totalViews}, Expected: ${expectedViews}`,
      );
    }

    milestone.bonusAmount = (Number(milestone.bonusAmount) || 0) + dto.amount;
    milestone.bonusStatus = 'paid';

    milestone.campaign.paidAmount =
      Number(milestone.campaign.paidAmount) + dto.amount;
    milestone.campaign.totalBudget =
      Number(milestone.campaign.totalBudget) + dto.amount;

    await this.milestoneRepo.save(milestone);
    await this.campaignRepo.save(milestone.campaign);

    return {
      success: true,
      message: `Bonus of ${dto.amount} added. Total Views Achieved: ${totalViews}`,
    };
  }

  // ==================================================================
  // 3. RATE AGENCY (Client rates after campaign completion)
  // ==================================================================
  async rateAgency(campaignId: string, userId: string, dto: RateCampaignDto) {
    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId },
      relations: ['assignedAgencies'],
    });

    if (!campaign) throw new NotFoundException('Campaign not found');

    const client = await this.getClientProfile(userId);
    if (campaign.clientId !== client.id) throw new ForbiddenException();

    if (campaign.paymentStatus !== 'full') {
      // campaign.status !== 'COMPLETED'
      throw new BadRequestException('Campaign is not fully completed yet.');
    }

    if (campaign.isRated) {
      throw new BadRequestException('You have already rated this campaign.');
    }

    const agencyId = campaign.selectedAgencyId;
    const agency = await this.agencyRepo.findOne({ where: { id: agencyId } });

    if (agency) {
      // Rating Formula: New Avg = ((Old Avg * Old Count) + New Rating) / (Old Count + 1)
      const currentTotalScore =
        Number(agency.averageRating) * agency.totalReviews;
      const newTotalReviews = agency.totalReviews + 1;
      const newAverage = (currentTotalScore + dto.rating) / newTotalReviews;

      agency.averageRating = Number(newAverage.toFixed(1));
      agency.totalReviews = newTotalReviews;

      await this.agencyRepo.save(agency);
    }

    campaign.isRated = true;
    campaign.rating = dto.rating;
    // campaign.clientReview = dto.review;

    await this.campaignRepo.save(campaign);

    return { success: true, message: 'Rating submitted successfully.' };
  }

  // ==================================================================
  // 4. NEW FEATURE: Campaign Analytics (Performance & Budget)
  // ==================================================================
  async getCampaignAnalytics(campaignId: string, userId: string) {
    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId },
      relations: ['milestones', 'milestones.submissions'],
    });

    if (!campaign) throw new NotFoundException('Campaign not found');

    // Basic aggregation
    let totalAchievedViews = 0;
    let totalAchievedReach = 0;
    let totalPaid = 0;
    let completedMilestones = 0;

    campaign.milestones.forEach((m) => {
      if (m.status === 'completed' || m.status === 'paid')
        completedMilestones++;

      // Summing up metrics from submissions
      m.submissions.forEach((s) => {
        totalAchievedViews += s.achievedViews || 0;
        totalAchievedReach += s.achievedReach || 0;
        totalPaid += Number(s.paidToAgencyAmount || 0);
      });
    });

    return {
      success: true,
      data: {
        campaignId: campaign.id,
        status: campaign.status,
        financials: {
          totalBudget: campaign.totalBudget,
          spent: totalPaid,
          remaining: Number(campaign.totalBudget) - totalPaid,
        },
        performance: {
          totalViews: totalAchievedViews,
          totalReach: totalAchievedReach,
          milestonesCompleted: `${completedMilestones}/${campaign.milestones.length}`,
        },
      },
    };
  }

  // ==================================================================
  // 5. NEW FEATURE: Report / Submission History (Communication Log)
  // ==================================================================
  async getSubmissionHistory(submissionId: string) {
    const history = await this.reportRepo.find({
      where: { submissionId },
      order: { createdAt: 'DESC' },
      select: ['id', 'content', 'authorRole', 'actionTaken', 'createdAt'], // Minimal Select
    });

    return {
      success: true,
      data: history,
    };
  }
}
