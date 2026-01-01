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
  CampaignType,
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
import { PayBonusDto, PayCampaignDto } from './dto/payment.dto';
import { RateCampaignDto } from './dto/rate-campaign.dto';
import { SubmissionReportEntity } from './entities/submission-report.entity';
import {
  InfluencerResubmitSubmissionDto,
  InfluencerSubmitMilestoneDto,
  InfluencerUpdateSubmissionMetricsDto,
} from './dto/influencer-milestone.dto';

// VAT Rate constant
// const VAT_RATE = 0.15;

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
  // HELPER: Fetch VAT Rate
  // ============================================
  private async getVatRate(): Promise<number> {
    // Fetch the single row from settings
    const settings = await this.systemSettingRepo.findOne({ where: {} });

    // Check if settings exist and have a vatTax, otherwise default to 15% (0.15)
    if (settings && settings.vatTax) {
      // Assuming vatTax is stored as a percentage (e.g., 15 for 15%)
      return Number(settings.vatTax) / 100;
    }

    return 0.15; // Default fallback if DB is empty
  }

  // ============================================
  // HELPER: Budget Calculation
  // ============================================
  private async calculateBudget(baseBudget: number) {
    const vatRate = await this.getVatRate();

    const vatAmount = baseBudget * vatRate;
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
    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId, clientId: userId } as any, // Adjust based on your verify logic
      relations: [
        'preferredInfluencers',
        'notPreferableInfluencers',
        'assignedAgencies',
      ],
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found or access denied');
    }

    // 1. Update Core Required Fields
    // campaign.productType = dto.productType; // Mandatory in your DTO
    if (dto.productType) {
      campaign.productType = dto.productType;
    }
    campaign.campaignNiche = dto.campaignNiche; // Mandatory in your DTO
    campaign.currentStep = Math.max(campaign.currentStep, 2);

    // 2. Handle Selected Ad Agency
    // Note: Entity supports one agencyId. Mapping the first one from the DTO array.
    // FIX: Handle Multiple Selected Agencies
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
      message: 'Campaign niche and preferences saved successfully',
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
    const budget = await this.calculateBudget(dto.baseBudget);

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
        ...m, // Automatically picks up promotionGoal, expectedReach, etc.
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
        paymentStatus: true,
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
  async getBudgetPreview(baseBudget: number) {
    const data = await this.calculateBudget(baseBudget);

    return {
      success: true,
      data: data,
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
    const proposedBudget = await this.calculateBudget(dto.proposedBaseBudget);

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
    const proposedBudget = await this.calculateBudget(dto.proposedBaseBudget);

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
    // 1. Fetch Settings (For Platform Fee %)
    const settings = await this.systemSettingRepo.findOne({ where: {} });
    const PLATFORM_FEE_PERCENT = settings ? Number(settings.platformFee) : 2; // Default to 10% if not set
    const PLATFORM_FEE_RATE = PLATFORM_FEE_PERCENT / 100;

    // 2. Fetch Campaign
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
      const base = Number(lastNegotiation.proposedBaseBudget);
      const vat = Number(lastNegotiation.proposedVatAmount);
      const total = Number(lastNegotiation.proposedTotalBudget);

      // A. Standard Financials
      campaign.baseBudget = base;
      campaign.vatAmount = vat;
      campaign.totalBudget = total;
      campaign.netPayableAmount = total;
      campaign.dueAmount = total;

      // B. Calculate Platform Fee & Execution Budget
      // Logic: Platform Fee is taken from the Base Budget.
      // The rest is available for execution (whether by Agency or directly to Influencers)
      campaign.platformFeeAmount = base * PLATFORM_FEE_RATE;

      // CALCULATED & SAVED
      campaign.availableBudgetForExecution = base - campaign.platformFeeAmount;
    }

    campaign.paymentStatus = PaymentStatus.PENDING;

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

    const savedCampaign = await this.campaignRepo.save(campaign);

    return {
      success: true,
      message: 'Quote accepted. Budget calculated and finalized.',
      data: {
        campaignId: savedCampaign.id,
        status: savedCampaign.status,
        agreedBudget: savedCampaign.baseBudget,
        platformFee: savedCampaign.platformFeeAmount,
        availableForExecution: savedCampaign.availableBudgetForExecution,
        totalWithVat: savedCampaign.totalBudget,
        dueAmount: savedCampaign.dueAmount,
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
  private async calculateAssignmentBudget(offeredAmount: number) {
    const vatRate = await this.getVatRate();
    const vatAmount = offeredAmount * vatRate;
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
    const campaign = await this.campaignRepo.findOne({
      where: { id: dto.campaignId },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    if (
      campaign.status !== CampaignStatus.PAID &&
      campaign.status !== CampaignStatus.PROMOTING
    ) {
      throw new BadRequestException(
        'Campaign must be PAID before assigning influencers',
      );
    }

    // 1. Create Assignments as DRAFT
    // This allows the Admin to see them in the UI list without notifying the influencer yet.
    const newAssignments = dto.influencerIds.map((infId) =>
      this.assignmentRepo.create({
        campaignId: dto.campaignId,
        influencerId: infId,
        assignedBy: adminId,
        status: JobStatus.DRAFT, // ✅ Initial Status
      }),
    );

    await this.assignmentRepo.save(newAssignments);

    // 2. Calculate Budget (So Admin sees the split immediately)
    await this.recalculateCampaignBudgetSplit(dto.campaignId);

    // Update campaign status
    if (campaign.status === CampaignStatus.PAID) {
      campaign.status = CampaignStatus.PROMOTING;
      await this.campaignRepo.save(campaign);
    }

    return {
      success: true,
      message: `${newAssignments.length} influencers selected. Budget allocated. Ready to invite.`,
    };
  }

  // ============================================
  // STEP 2: Send Invitation (One by One)
  // ============================================
  async sendInfluencerInvitation(assignmentId: string, adminUserId: string) {
    const job = await this.assignmentRepo.findOne({
      where: { id: assignmentId },
      relations: ['influencer', 'campaign'],
    });

    if (!job) throw new NotFoundException('Assignment not found');

    // Only allow sending if it's currently a Draft
    if (job.status !== JobStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot invite. Current status is ${job.status}`,
      );
    }

    // 1. Change Status to NEW_OFFER
    // This makes it visible on the Influencer's Dashboard
    job.status = JobStatus.NEW_OFFER;
    job.invitedAt = new Date(); // Optional: Track when invite was sent

    await this.assignmentRepo.save(job);

    // 2. Trigger Notification (Stub)
    console.log(
      `Sending Push Notification to ${job.influencer.firstName}: You have a new offer for ${job.campaign.campaignName}`,
    );

    return {
      success: true,
      message: `Invitation sent to ${job.influencer.firstName} successfully.`,
      data: {
        assignmentId: job.id,
        status: job.status,
        offeredAmount: job.offeredAmount,
      },
    };
  }

  // ============================================
  // Helper: Recalculate budget split for all influencers
  // ============================================
  private async recalculateCampaignBudgetSplit(campaignId: string) {
    // 1. Get campaign with necessary fields
    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId },
      relations: ['milestones'], // We need milestones to update their split
    });

    // Validations
    if (!campaign) {
      throw new BadRequestException(`Campaign not found for recalculation`);
    }

    // Use the execution budget we calculated during Quote Acceptance
    // Fallback to baseBudget if execution budget is missing (legacy safety)
    const budgetPool = Number(campaign.availableBudgetForExecution);

    // Debug Log
    console.log(`[Recalc] Campaign: ${campaignId}, Budget Pool: ${budgetPool}`);

    if (budgetPool <= 0) return;

    // 2. Get all ACTIVE assignments (Count "seats" at the table)
    // We exclude DECLINED or COMPLETED (unless completed should still count for budget history, usually yes, but for dynamic split we focus on active pool)
    const assignments = await this.assignmentRepo.find({
      where: {
        campaignId,
        status: In([
          JobStatus.DRAFT,
          JobStatus.NEW_OFFER,
          JobStatus.PENDING,
          JobStatus.ACTIVE,
          JobStatus.TO_DO,
        ]),
      },
    });

    const activeCount = assignments.length;
    if (activeCount === 0) return;

    // 3. Calculate Splits
    const perInfluencerAmount = budgetPool / activeCount;
    const milestoneCount = campaign.milestones.length;
    const perMilestoneAmount =
      milestoneCount > 0 ? perInfluencerAmount / milestoneCount : 0;

    // Debug Log
    console.log(`[Recalc] Milestones Found: ${milestoneCount}`);

    // Formatting for clean 2 decimal places
    const cleanPerInfluencer = Math.floor(perInfluencerAmount * 100) / 100;
    const cleanPerMilestone = Math.floor(perMilestoneAmount * 100) / 100;

    // 4. Update Assignments (Influencer Totals)
    const percentage = Math.round((100 / activeCount) * 100) / 100;

    // We use a loop to update entities locally before saving
    for (const assignment of assignments) {
      assignment.percentage = percentage;
      assignment.offeredAmount = cleanPerInfluencer;
      // Note: VAT calculation might be specific per influencer depending on their status,
      // but here we are setting the base offer.
      assignment.totalAmount = cleanPerInfluencer; // + VAT logic if needed
    }
    await this.assignmentRepo.save(assignments);

    // 5. Update Milestones (Milestone Targets)
    // This ensures "Hania's milestone split is 7500" logic
    if (campaign.milestones && campaign.milestones.length > 0) {
      for (const milestone of campaign.milestones) {
        milestone.amount = cleanPerMilestone;
      }
      await this.milestoneRepo.save(campaign.milestones);
    }
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
      where: {
        campaignId,
        // Filter only for Accepted/Active/Completed jobs
        // This excludes 'draft', 'new_offer', and 'declined'
        status: In([
          JobStatus.PENDING, // Accepted but not started
          JobStatus.ACTIVE, // In progress
          JobStatus.TO_DO, // Working on milestones
          JobStatus.COMPLETED, // Finished jobs
        ]),
      },
      relations: ['influencer'],
      order: { createdAt: 'DESC' },
    });

    return {
      success: true,
      data: assignments.map((a) => ({
        id: a.id,
        influencerId: a.influencer.id,
        influencerName: `${a.influencer.firstName} ${a.influencer.lastName}`,
        profileImage: a.influencer.profileImg, // Ensure this matches your entity property
        offeredAmount: a.offeredAmount,
        totalAmount: a.totalAmount,
        status: a.status,
        acceptedAt: a.acceptedAt,
        startedAt: a.startedAt,
        completedAt: a.completedAt,
        createdAt: a.createdAt,
        // Address is always available here because status is accepted/active
        address: {
          addressName: a.influencerAddressName,
          street: a.influencerStreet,
          thana: a.influencerThana,
          zilla: a.influencerZilla,
          fullAddress: a.influencerFullAddress,
        },
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
      const budget = await this.calculateAssignmentBudget(dto.offeredAmount);
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

    if (assignment.status === JobStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel a completed assignment');
    }

    // Delete the assignment
    await this.assignmentRepo.remove(assignment);

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

    // 1. Update Status
    job.status = JobStatus.DECLINED;
    job.declinedAt = new Date();
    if (dto?.reason) {
      job.declineReason = dto.reason;
    }

    await this.assignmentRepo.save(job);

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

  private async requireInfluencerProfile(userId: string) {
    const influencer = await this.influencerRepo.findOne({ where: { userId } });
    if (!influencer)
      throw new NotFoundException('Influencer profile not found');
    return influencer;
  }

  private async requireInfluencerJobForCampaign(
    influencerId: string,
    campaignId: string,
  ) {
    const job = await this.assignmentRepo.findOne({
      where: { influencerId, campaignId },
      relations: ['campaign'],
    });

    if (!job)
      throw new ForbiddenException('You are not assigned to this campaign');
    return job;
  }

  private deriveUiStatusFromSubmission(
    submission: any,
    milestoneAmount?: number,
  ) {
    if (!submission) return 'to_do';

    if (submission.status === 'declined' || submission.status === 'rejected')
      return 'declined';

    const paidAmount = submission.paidAmount ?? 0;

    if ((submission.paymentStatus ?? 'unpaid') === 'paid') {
      const expected = submission.requestedAmount ?? milestoneAmount ?? 0;
      if (expected > 0 && paidAmount > 0 && paidAmount < expected)
        return 'partial_paid';
      return 'paid';
    }

    // pending / client_approved / approved but unpaid -> treat as in_review
    return 'in_review';
  }

  // 1) GET /campaign/influencer/job/:jobId/milestones
  async getInfluencerJobMilestones(jobId: string, userId: string) {
    const influencer = await this.requireInfluencerProfile(userId);

    const job = await this.assignmentRepo.findOne({
      where: { id: jobId, influencerId: influencer.id },
      relations: ['campaign'],
    });
    if (!job) throw new NotFoundException('Job not found');

    const milestones = await this.milestoneRepo.find({
      where: { campaignId: job.campaignId },
      order: { createdAt: 'ASC' as any },
    });

    const milestoneIds = milestones.map((m) => m.id);
    const latestByMilestone = new Map<string, any>();
    if (milestoneIds.length > 0) {
      const submissions = await this.submissionRepo.find({
        where: {
          milestone: { id: In(milestoneIds) },
          assignment: { id: job.id },
          submittedByRole: 'influencer',
        } as any,
        order: { createdAt: 'DESC' },
        relations: ['milestone'],
      });

      for (const s of submissions) {
        // Safe access to milestone ID
        const mId = s.milestone?.id || s.milestoneId;
        if (mId && !latestByMilestone.has(mId)) latestByMilestone.set(mId, s);
      }
    }

    const isJobAccepted = [
      JobStatus.PENDING,
      JobStatus.ACTIVE,
      JobStatus.TO_DO,
      JobStatus.INREVIEW,
      JobStatus.PARTIAL_PAID,
      JobStatus.PAID,
      JobStatus.COMPLETED,
    ].includes(job.status);

    const mapped = milestones.map((m) => {
      const last = latestByMilestone.get(m.id);

      // Status Logic
      let status = null;
      if (isJobAccepted) {
        status = last ? last.status : 'todo';
      }

      return {
        id: m.id,
        title: m.contentTitle,
        contentQuantity: m.contentQuantity,
        amount: m.amount,
        deliveryDays: m.deliveryDays,
        order: m.order,
        expectedLikes: m.expectedLikes,
        expectedComments: m.expectedComments,
        status: status, // ✅ Logic applied here
      };
    });

    return {
      success: true,
      data: { jobId: job.id, campaignId: job.campaignId, milestones: mapped },
    };
  }

  // 2) GET /campaign/influencer/milestone/:milestoneId
  async getInfluencerMilestoneDetails(milestoneId: string, userId: string) {
    const influencer = await this.requireInfluencerProfile(userId);

    const milestone = await this.milestoneRepo.findOne({
      where: { id: milestoneId },
      relations: ['campaign'],
    });
    if (!milestone) throw new NotFoundException('Milestone not found');

    const job = await this.requireInfluencerJobForCampaign(
      influencer.id,
      milestone.campaignId,
    );

    const submissions = await this.submissionRepo.find({
      where: {
        milestone: { id: milestoneId },
        assignment: { id: job.id },
        submittedByRole: 'influencer',
      } as any,
      order: { createdAt: 'DESC' },
      relations: ['milestone'],
    });

    const latest = submissions?.[0] ?? null;

    // Determine if the job has been accepted
    const isJobAccepted = [
      JobStatus.PENDING,
      JobStatus.ACTIVE,
      JobStatus.TO_DO,
      JobStatus.INREVIEW,
      JobStatus.PARTIAL_PAID,
      JobStatus.PAID,
      JobStatus.COMPLETED,
    ].includes(job.status);

    // Status Logic
    let status: string | null = null;
    if (isJobAccepted) {
      status = latest ? latest.status : 'todo';
    }

    return {
      success: true,
      data: {
        jobId: job.id,
        campaignId: milestone.campaignId,
        milestone: {
          id: milestone.id,
          contentTitle: milestone.contentTitle,
          platform: milestone.platform,
          contentQuantity: milestone.contentQuantity,
          deliveryDays: milestone.deliveryDays,
          expectedReach: milestone.expectedReach,
          expectedViews: milestone.expectedViews,
          expectedLikes: milestone.expectedLikes,
          expectedComments: milestone.expectedComments,
          promotionGoal: milestone.promotionGoal,
          amount: milestone.amount,
          bonusAmount: milestone.bonusAmount,
          bonusStatus: milestone.bonusStatus,
          order: milestone.order,
          createdAt: milestone.createdAt,
        },
        status: status, // ✅ Logic applied here
        latestSubmission: latest,
        submissions,
      },
    };
  }

  // 3) POST /campaign/influencer/milestone/:milestoneId/submit
  async submitInfluencerMilestone(
    milestoneId: string,
    userId: string,
    dto: InfluencerSubmitMilestoneDto,
  ) {
    const influencer = await this.requireInfluencerProfile(userId);

    const milestone: any = await this.milestoneRepo.findOne({
      where: { id: milestoneId },
      relations: ['campaign'],
    });

    if (!milestone) throw new NotFoundException('Milestone not found');

    const job = await this.requireInfluencerJobForCampaign(
      influencer.id,
      milestone.campaignId,
    );

    // optional status restriction
    if (job.status !== JobStatus.ACTIVE && job.status !== JobStatus.TO_DO) {
      throw new BadRequestException(
        'You must accept the job (Status: In Progress) before submitting work.',
      );
    }

    const last = await this.submissionRepo.findOne({
      where: {
        milestone: { id: milestoneId },
        assignment: { id: job.id },
        submittedByRole: 'influencer',
      },
      order: { createdAt: 'DESC' },
    });

    if (
      last &&
      last.status !== 'declined' &&
      last.status !== 'rejected' &&
      last.status !== 'changes_requested'
    ) {
      throw new BadRequestException(
        'You already have an active submission. Wait for review.',
      );
    }

    const submission = this.submissionRepo.create({
      milestone: { id: milestoneId } as any,
      assignment: { id: job.id } as any,
      submittedByRole: 'influencer',

      submissionDescription: dto.description ?? null,
      submissionLiveLinks: dto.liveLinks ?? [],
      submissionAttachments: dto.proofAttachments ?? [],

      achievedViews: dto.achievedViews ?? 0,
      achievedReach: dto.achievedReach ?? 0,
      achievedLikes: dto.achievedLikes ?? 0,
      achievedComments: dto.achievedComments ?? 0,

      status: 'pending',
      isClientApproved: false,
      paymentStatus: 'unpaid',
      paidAmount: 0,
    });

    await this.submissionRepo.save(submission);

    return {
      success: true,
      message: 'Milestone submitted successfully',
    };
  }

  // 4) PATCH /campaign/influencer/submission/:submissionId/resubmit
  async resubmitInfluencerSubmission(
    submissionId: string,
    userId: string,
    dto: InfluencerResubmitSubmissionDto,
  ) {
    const influencer = await this.requireInfluencerProfile(userId);

    const submission: any = await this.submissionRepo.findOne({
      where: { id: submissionId },
      relations: ['milestone', 'milestone.campaign', 'assignment'],
    });
    if (!submission) throw new NotFoundException('Submission not found');

    if (
      submission.submittedByRole !== 'influencer' ||
      submission.assignment?.influencerId !== influencer.id
    ) {
      throw new ForbiddenException('You cannot modify this submission');
    }

    // if (submission.status !== 'declined') {
    //   throw new BadRequestException(
    //     'Only declined submissions can be resubmitted',
    //   );
    // }

    // 4. Update Fields (Mapping DTO -> Entity)
    if (dto.description !== undefined) {
      submission.submissionDescription = dto.description;
    }
    if (dto.liveLinks !== undefined) {
      submission.submissionLiveLinks = dto.liveLinks;
    }
    if (dto.proofAttachments !== undefined) {
      submission.submissionAttachments = dto.proofAttachments;
    }
    if (dto.requestedAmount !== undefined) {
      submission.requestedAmount = dto.requestedAmount;
    }

    // 5. Update Metrics (Optional updates during resubmission)
    if (dto.achievedViews !== undefined)
      submission.achievedViews = dto.achievedViews;
    if (dto.achievedReach !== undefined)
      submission.achievedReach = dto.achievedReach;
    if (dto.achievedLikes !== undefined)
      submission.achievedLikes = dto.achievedLikes;
    if (dto.achievedComments !== undefined)
      submission.achievedComments = dto.achievedComments;

    // 6. Reset Status Flags
    submission.status = 'pending'; // Reset to pending for Admin review
    submission.isClientApproved = false;
    submission.paymentStatus = 'unpaid';
    submission.rejectionReason = null;
    submission.adminFeedback = null;

    await this.submissionRepo.save(submission);

    return {
      success: true,
      message: 'Resubmitted successfully',
      // data: submission,
    };
  }

  // 5) PATCH /campaign/influencer/submission/:submissionId/metrics
  async updateInfluencerSubmissionMetrics(
    submissionId: string,
    userId: string,
    dto: InfluencerUpdateSubmissionMetricsDto,
  ) {
    const influencer = await this.requireInfluencerProfile(userId);

    const submission: any = await this.submissionRepo.findOne({
      where: { id: submissionId },
    });
    if (!submission) throw new NotFoundException('Submission not found');

    if (
      submission.submittedByRole !== 'influencer' ||
      submission.assignment?.influencerId !== influencer.id
    ) {
      throw new ForbiddenException('Not allowed');
    }

    if (submission.status === 'declined' || submission.status === 'rejected') {
      throw new BadRequestException(
        'Cannot update metrics on a rejected submission. Please resubmit.',
      );
    }

    if (dto.achievedViews !== undefined)
      submission.achievedViews = dto.achievedViews;
    if (dto.achievedReach !== undefined)
      submission.achievedReach = dto.achievedReach;
    if (dto.achievedLikes !== undefined)
      submission.achievedLikes = dto.achievedLikes;
    if (dto.achievedComments !== undefined)
      submission.achievedComments = dto.achievedComments;

    if (dto.proofAttachments !== undefined) {
      submission.submissionAttachments = (dto as any).proofAttachments;
    }

    await this.submissionRepo.save(submission);

    return {
      success: true,
      message: 'Metrics updated',
      // data: submission
    };
  }

  async getInfluencerSubmissions(userId: string, status?: string) {
    const influencer = await this.requireInfluencerProfile(userId);

    const query = this.submissionRepo
      .createQueryBuilder('submission')
      .leftJoinAndSelect('submission.assignment', 'assignment')
      .leftJoinAndSelect('assignment.campaign', 'campaign')
      .leftJoinAndSelect('submission.milestone', 'milestone')
      .where('assignment.influencerId = :influencerId', {
        influencerId: influencer.id,
      })
      .orderBy('submission.createdAt', 'DESC');

    if (status) {
      query.andWhere('submission.status = :status', { status });
    }

    const submissions = await query.getMany();

    return {
      success: true,
      count: submissions.length,
      data: submissions.map((s) => ({
        id: s.id,
        campaignName: s.assignment.campaign.campaignName,
        milestoneTitle: s.milestone.contentTitle,
        amount: s.milestone.amount,
        status: s.status,
        paymentStatus: s.paymentStatus,
        submittedAt: s.createdAt,
        adminFeedback: s.adminFeedback,
      })),
    };
  }

  async getInfluencerSubmissionById(submissionId: string, userId: string) {
    const influencer = await this.requireInfluencerProfile(userId);

    const submission = await this.submissionRepo.findOne({
      where: { id: submissionId },
      relations: ['assignment', 'assignment.campaign', 'milestone'],
    });

    if (!submission) throw new NotFoundException('Submission not found');

    // 🔒 Security Check: Must belong to this influencer
    // Note: Use assignment relation as the source of truth
    if (submission.assignment.influencerId !== influencer.id) {
      throw new ForbiddenException(
        'You do not have permission to view this submission',
      );
    }

    return {
      success: true,
      data: {
        id: submission.id,
        campaignName: submission.assignment.campaign.campaignName,
        milestoneTitle: submission.milestone.contentTitle,
        amount: submission.milestone.amount,

        description: submission.submissionDescription,
        attachments: submission.submissionAttachments,
        liveLinks: submission.submissionLiveLinks,

        status: submission.status,
        paymentStatus: submission.paymentStatus,
        adminFeedback: submission.adminFeedback,
        rejectionReason: submission.rejectionReason,

        metrics: {
          views: submission.achievedViews,
          reach: submission.achievedReach,
          likes: submission.achievedLikes,
          comments: submission.achievedComments,
        },
        createdAt: submission.createdAt,
      },
    };
  }

  // ============================================
  // Client-Influencer
  // ============================================

  async getClientSubmissions(userId: string, status?: string) {
    const client = await this.getClientProfile(userId);

    const query = this.submissionRepo
      .createQueryBuilder('submission')
      .leftJoinAndSelect('submission.assignment', 'assignment')
      .leftJoinAndSelect('assignment.campaign', 'campaign')
      .leftJoinAndSelect('assignment.influencer', 'influencer')
      .leftJoinAndSelect('submission.milestone', 'milestone')
      // Filter: Must belong to a campaign owned by this Client
      .where('campaign.clientId = :clientId', { clientId: client.id })
      .orderBy('submission.createdAt', 'DESC');

    if (status) {
      query.andWhere('submission.status = :status', { status });
    }

    const submissions = await query.getMany();

    return {
      success: true,
      count: submissions.length,
      data: submissions.map((s) => ({
        id: s.id,
        campaignId: s.assignment.campaignId,
        campaignName: s.assignment.campaign.campaignName,
        influencerName: `${s.assignment.influencer.firstName} ${s.assignment.influencer.lastName}`,
        influencerImage: s.assignment.influencer.profileImg,
        milestoneTitle: s.milestone.contentTitle,
        attachments: s.submissionAttachments,
        liveLinks: s.submissionLiveLinks,
        status: s.status,
        isApproved: s.isClientApproved,
        submittedAt: s.createdAt,
      })),
    };
  }

  async getClientSubmissionById(submissionId: string, userId: string) {
    const client = await this.getClientProfile(userId);

    const submission = await this.submissionRepo.findOne({
      where: { id: submissionId },
      relations: [
        'assignment',
        'assignment.campaign',
        'assignment.influencer',
        'milestone',
      ],
    });

    if (!submission) throw new NotFoundException('Submission not found');

    // 🔒 Security Check: Must belong to a campaign owned by this client
    if (submission.assignment.campaign.clientId !== client.id) {
      throw new ForbiddenException(
        'You do not have permission to view this submission',
      );
    }

    return {
      success: true,
      data: {
        id: submission.id,
        campaignId: submission.assignment.campaignId,
        campaignName: submission.assignment.campaign.campaignName,

        influencer: {
          id: submission.assignment.influencerId,
          name: `${submission.assignment.influencer.firstName} ${submission.assignment.influencer.lastName}`,
          image: submission.assignment.influencer.profileImg,
        },

        milestone: {
          id: submission.milestoneId,
          title: submission.milestone.contentTitle,
          amount: submission.milestone.amount,
        },

        content: {
          description: submission.submissionDescription,
          attachments: submission.submissionAttachments,
          liveLinks: submission.submissionLiveLinks,
        },

        status: submission.status,
        isApproved: submission.isClientApproved,
        paymentStatus: submission.paymentStatus,
        createdAt: submission.createdAt,
      },
    };
  }

  // Pay Campaign (Handles Both Agency & Influencer flows)

  async clientPayCampaign(userId: string, dto: PayCampaignDto) {
    const campaign = await this.campaignRepo.findOne({
      where: { id: dto.campaignId, clientId: userId },
      relations: ['milestones'],
    });

    if (!campaign) throw new NotFoundException('Campaign not found');

    // ---------------------------------------------------------
    // 1. Validation Logic based on Campaign Type
    // ---------------------------------------------------------

    // Scenario A: Agency Campaign (Paid Ad)
    // Client must have selected an agency before paying.
    if (campaign.campaignType === CampaignType.PAID_AD) {
      if (!campaign.selectedAgencyId) {
        throw new BadRequestException(
          'This is an Agency campaign. Please select an agency before making a payment.',
        );
      }
    }

    // Scenario B: Influencer Campaign

    // Client pays the platform directly after accepting the Quote.
    // Ensure the negotiation is finished (Status should be QUOTED).
    // if (campaign.campaignType === CampaignType.INFLUENCER_PROMOTION) {
    //   if (campaign.status !== CampaignStatus.QUOTED && campaign.paymentStatus !== PaymentStatus.PARTIAL) {
    //      // Allow payment if it's 'QUOTED' or if they are adding more money to a 'PARTIAL' payment
    //      // throw new BadRequestException('Campaign is not ready for payment. Please complete negotiation/quote first.');
    //   }
    // }

    // ---------------------------------------------------------
    // 2. Financial Logic (Common for both)
    // ---------------------------------------------------------
    const totalAmount = Number(campaign.totalBudget);
    const incomingPayment = Number(dto.amount);
    const currentPaid = Number(campaign.paidAmount || 0);
    const newTotalPaid = currentPaid + incomingPayment;

    if (newTotalPaid > totalAmount) {
      throw new BadRequestException(
        `Payment exceeds total budget. Total: ${totalAmount}, Paid: ${currentPaid}, Attempting: ${incomingPayment}`,
      );
    }

    campaign.paidAmount = newTotalPaid;
    campaign.dueAmount = totalAmount - newTotalPaid;

    // Update Payment Status
    if (campaign.dueAmount <= 0) {
      campaign.paymentStatus = PaymentStatus.FULL;
    } else {
      campaign.paymentStatus = PaymentStatus.PARTIAL;
    }

    // ---------------------------------------------------------
    // 3. Status Transition Logic
    // ---------------------------------------------------------

    // Only change status if it's NOT already in a working state
    const isAlreadyActive = [
      CampaignStatus.PAID,
      CampaignStatus.PROMOTING,
      CampaignStatus.AGENCY_ACCEPTED,
    ].includes(campaign.status as CampaignStatus);

    if (!isAlreadyActive) {
      // BRANCH A: Agency Flow
      if (campaign.campaignType === CampaignType.PAID_AD) {
        campaign.status = CampaignStatus.AGENCY_ACCEPTED;

        // For Agencies, we often activate milestones immediately for them to start
        if (campaign.milestones) {
          campaign.milestones.forEach((m) => (m.status = 'todo'));
          await this.milestoneRepo.save(campaign.milestones);
        }
      }

      // BRANCH B: Influencer Flow
      else {
        // For Influencer campaigns, 'PAID' status tells Admin to start inviting influencers
        campaign.status = CampaignStatus.PAID;

        // Note: We do NOT set milestones to 'todo' yet.
        // Milestones in influencer campaigns are per-influencer assignment.
        // The "Master Milestones" remain as templates.
      }
    }

    await this.campaignRepo.save(campaign);

    return {
      success: true,
      message: 'Payment received successfully.',
      data: {
        campaignType: campaign.campaignType,
        status: campaign.status, // Will be 'paid' (Influencer) or 'agency_accepted' (Agency)
        paymentStatus: campaign.paymentStatus,
        totalBudget: campaign.totalBudget,
        paidAmount: campaign.paidAmount,
        dueAmount: campaign.dueAmount,
      },
    };
  }

  async clientReportSubmission(
    submissionId: string,
    userId: string,
    dto: ReviewMilestoneDto,
  ) {
    const client = await this.getClientProfile(userId);

    // Fetch submission with deep relations to verify ownership
    const submission = await this.submissionRepo.findOne({
      where: { id: submissionId },
      relations: ['assignment', 'assignment.campaign'],
    });

    if (!submission) throw new NotFoundException('Submission not found');

    // Validate Campaign Ownership
    if (submission.assignment?.campaign?.clientId !== client.id) {
      throw new ForbiddenException(
        'You do not have permission to report this submission',
      );
    }

    // Create Report
    const report = this.reportRepo.create({
      submissionId: submission.id,
      authorId: userId,
      authorRole: UserRole.CLIENT,
      content: dto.report || dto.reason,
      actionTaken: dto.action || 'comment',
    });
    await this.reportRepo.save(report);

    await this.reportRepo.save(report);

    return {
      success: true,
      message: 'Reported to admin successfully',
      data: report,
    };
  }

  async getClientInfluencersProgress(
    campaignId: string,
    userId: string,
    influencerId?: string,
  ) {
    const client = await this.getClientProfile(userId);

    // Verify Campaign Ownership
    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId, clientId: client.id },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    // 1. Get Assignments
    const assignmentQuery = this.assignmentRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.influencer', 'influencer')
      .where('a.campaignId = :campaignId', { campaignId });

    if (influencerId) {
      assignmentQuery.andWhere('a.influencerId = :influencerId', {
        influencerId,
      });
    }

    const assignments = await assignmentQuery.getMany();
    if (!assignments.length)
      return { success: true, data: { campaign, influencers: [] } };

    // 2. Get Milestones (Needed for calculation)
    const milestones = await this.milestoneRepo.find({
      where: { campaignId },
      order: { order: 'ASC' },
    });

    // 3. Get Submissions (Needed for calculation)
    const assignmentIds = assignments.map((a) => a.id);
    const submissions = await this.submissionRepo
      .createQueryBuilder('s')
      .where('s.assignmentId IN (:...ids)', { ids: assignmentIds })
      .orderBy('s.createdAt', 'DESC')
      .getMany();

    const submissionMap = new Map<string, MilestoneSubmissionEntity>();
    for (const sub of submissions) {
      const key = `${sub.assignmentId}_${sub.milestoneId}`;
      if (!submissionMap.has(key)) submissionMap.set(key, sub);
    }

    // 4. Build Data
    const influencersData = assignments.map((assignment) => {
      let completedMilestones = 0;

      // Loop through milestones only to calculate the count
      milestones.forEach((m) => {
        const sub = submissionMap.get(`${assignment.id}_${m.id}`);
        const status = this.deriveUiStatusFromSubmission(sub, m.amount);

        if (status === 'paid') {
          completedMilestones++;
        }
      });

      const progressPercent =
        milestones.length > 0
          ? Math.round((completedMilestones / milestones.length) * 100)
          : 0;

      // ✅ RETURN ONLY PROGRESS INFO (Influencer + Percent)
      return {
        assignmentId: assignment.id,
        influencer: {
          id: assignment.influencer.id,
          // name: `${assignment.influencer.firstName} ${assignment.influencer.lastName}`,
          // profileImg: assignment.influencer.profileImg,
        },
        status: assignment.status, // Useful context
        progressPercent, // ✅ The requested field
        // Removed: 'milestones' array
      };
    });

    return {
      success: true,
      data: {
        campaignName: campaign.campaignName,
        influencers: influencersData,
      },
    };
  }

  async clientRateInfluencer(
    campaignId: string,
    influencerId: string,
    userId: string,
    dto: RateCampaignDto,
  ) {
    const client = await this.getClientProfile(userId);

    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId, clientId: client.id },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    // Ensure influencer is assigned
    const assignment = await this.assignmentRepo.findOne({
      where: { campaignId, influencerId },
      relations: ['influencer'],
    });
    if (!assignment)
      throw new BadRequestException(
        'Influencer is not assigned to this campaign',
      );

    if (assignment.status !== JobStatus.COMPLETED) {
      throw new BadRequestException(
        'You can only rate after the job is completed',
      );
    }

    // if (assignment.rating) {
    //   throw new BadRequestException('You have already rated this influencer for this campaign');
    // }

    assignment.isRated = true;
    assignment.rating = dto.rating;
    // campaign.clientReview = dto.review; // Uncomment if you add this column to CampaignEntity

    await this.assignmentRepo.save(assignment);

    // 5. Recalculate Influencer's Average Rating
    const influencer = assignment.influencer;

    // Formula: New Average = ((Current Avg * Count) + New Rating) / (Count + 1)
    const currentAvg = Number(influencer.averageRating || 0);
    const currentCount = Number(influencer.totalReviews || 0);

    const newCount = currentCount + 1;
    const totalScore = currentAvg * currentCount + dto.rating;
    const newAverage = totalScore / newCount;

    // Update Profile
    influencer.averageRating = parseFloat(newAverage.toFixed(2)); // Round to 2 decimals
    influencer.totalReviews = newCount;

    await this.influencerRepo.save(influencer);

    // 6. Update Campaign Flag (Optional)
    // We mark the campaign as 'rated' to show the client has engaged at least once.
    // If you want to check if *all* influencers are rated, you would need an extra check here.
    campaign.isRated = true;
    await this.campaignRepo.save(campaign);

    return {
      success: true,
      message: `You rated ${influencer.firstName} ${dto.rating}/5 successfully.`,
      data: {
        assignmentId: assignment.id,
        rating: assignment.rating,
        influencerNewAverage: influencer.averageRating,
      },
    };
  }

  // 4. Get Ratings (From Assignments)
  async getClientInfluencerRatings(campaignId: string, userId: string) {
    const client = await this.getClientProfile(userId);

    // Query Campaigns that are rated and belong to this client
    // We join assignments to show who the influencer was
    const campaigns = await this.campaignRepo.find({
      where: {
        clientId: client.id,
        isRated: true,
        // Optional: Filter by specific campaignId if provided, or remove to get all
        ...(campaignId ? { id: campaignId } : {}),
      },
      relations: ['assignments', 'assignments.influencer'],
      select: {
        id: true,
        rating: true,
        // clientReview: true, // Uncomment if you added review to CampaignEntity
        assignments: {
          id: true,
          influencer: {
            id: true,
            firstName: true,
            lastName: true,
            profileImg: true,
          },
        },
      },
    });

    return { success: true, data: campaigns };
  }

  async clientPayBonusForSubmission(
    submissionId: string,
    userId: string,
    dto: PayBonusDto,
  ) {
    const client = await this.getClientProfile(userId);

    const submission = await this.submissionRepo.findOne({
      where: { id: submissionId },
      relations: ['milestone', 'milestone.campaign'],
    });

    if (!submission) throw new NotFoundException('Submission not found');

    // Check Ownership via Campaign
    const campaign = submission.milestone?.campaign;
    if (!campaign || campaign.clientId !== client.id) {
      throw new ForbiddenException('Not your campaign');
    }

    // ✅ FIX: Update MilestoneEntity (where bonus fields exist) instead of Submission
    const milestone = submission.milestone;

    milestone.bonusAmount =
      Number(milestone.bonusAmount || 0) + Number(dto.amount);
    milestone.bonusStatus = 'paid';

    await this.milestoneRepo.save(milestone);

    // Log Report
    await this.reportRepo.save({
      submissionId: submission.id,
      content: `Client paid bonus: ${dto.amount}`,
      authorRole: UserRole.CLIENT,
      authorId: client.userId,
      actionTaken: 'bonus_paid',
    });

    return {
      success: true,
      message: 'Bonus paid successfully',
      data: milestone,
    };
  }

  // ============================================
  // ADMIN-INFLUENCER
  // ============================================

  // 1. Get All Submissions (Review Queue)
  // Useful for a dashboard showing "10 Pending Reviews"
  async adminGetSubmissions(status?: string, campaignId?: string) {
    const query = this.submissionRepo
      .createQueryBuilder('submission')
      .leftJoinAndSelect('submission.assignment', 'assignment')
      .leftJoinAndSelect('assignment.influencer', 'influencer')
      .leftJoinAndSelect('assignment.campaign', 'campaign')
      .leftJoinAndSelect('submission.milestone', 'milestone')
      .orderBy('submission.createdAt', 'DESC');

    // Filter by Status (e.g., 'pending')
    if (status) {
      query.andWhere('submission.status = :status', { status });
    }

    // Filter by Campaign
    if (campaignId) {
      query.andWhere('assignment.campaignId = :campaignId', { campaignId });
    }

    // Only show submissions by influencers (ignore old agency test data if any)
    query.andWhere('submission.submittedByRole = :role', {
      role: 'influencer',
    });

    const submissions = await query.getMany();

    return {
      success: true,
      count: submissions.length,
      data: submissions.map((s) => ({
        submissionId: s.id,
        campaignName: s.assignment.campaign.campaignName,
        influencerName: `${s.assignment.influencer.firstName} ${s.assignment.influencer.lastName}`,
        milestoneTitle: s.milestone.contentTitle,
        submittedAt: s.createdAt,
        status: s.status,
        attachments: s.submissionAttachments,
        description: s.submissionDescription,
      })),
    };
  }

  // 2. Get Single Submission Details by ID
  async adminGetSubmissionById(submissionId: string) {
    const submission = await this.submissionRepo.findOne({
      where: { id: submissionId },
      relations: [
        'assignment',
        'assignment.influencer',
        'assignment.campaign',
        'milestone',
      ],
    });

    if (!submission) throw new NotFoundException('Submission not found');

    return {
      success: true,
      data: {
        id: submission.id,
        status: submission.status,
        paymentStatus: submission.paymentStatus,
        isClientApproved: submission.isClientApproved,

        // Campaign Context
        campaignId: submission.assignment.campaignId,
        campaignName: submission.assignment.campaign.campaignName,

        // Influencer Context
        influencerId: submission.assignment.influencerId,
        influencerName: `${submission.assignment.influencer.firstName} ${submission.assignment.influencer.lastName}`,
        influencerImage: submission.assignment.influencer.profileImg,

        // Milestone Context
        milestoneId: submission.milestoneId,
        milestoneTitle: submission.milestone.contentTitle,
        amount: submission.milestone.amount,

        // Submission Content
        description: submission.submissionDescription,
        attachments: submission.submissionAttachments,
        liveLinks: submission.submissionLiveLinks,

        // Metrics
        achievedViews: submission.achievedViews,
        achievedReach: submission.achievedReach,
        achievedLikes: submission.achievedLikes,
        achievedComments: submission.achievedComments,

        // Feedback
        adminFeedback: submission.adminFeedback,
        rejectionReason: submission.rejectionReason,
        createdAt: submission.createdAt,
      },
    };
  }

  async adminListInvitations(campaignId: string) {
    const jobs = await this.assignmentRepo.find({
      where: { campaignId },
      relations: ['influencer'],
      order: { createdAt: 'DESC' },
    });

    const data = jobs.map((j) => ({
      jobId: j.id,
      influencerName: `${j.influencer.firstName} ${j.influencer.lastName}`,
      status: j.status,
      sentAt: j.createdAt,
      respondedAt: j.acceptedAt || j.declinedAt,
    }));

    return { success: true, data };
  }

  // 7. Admin Cancel Invitation
  async adminCancelInvitation(jobId: string) {
    const job = await this.assignmentRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');

    if (
      job.status !== JobStatus.NEW_OFFER &&
      job.status !== JobStatus.PENDING
    ) {
      throw new BadRequestException(
        'Cannot cancel a job that has already started or been declined',
      );
    }

    await this.assignmentRepo.remove(job);
    return { success: true, message: 'Invitation cancelled and job removed' };
  }

  // 8. Admin Resend Invitation
  async adminResendInvitation(jobId: string) {
    const job = await this.assignmentRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');

    // Reset Job to initial state
    job.status = JobStatus.NEW_OFFER;
    job.acceptedAt = null;
    job.startedAt = null;
    job.completedAt = null;
    job.declinedAt = null;
    job.declineReason = null;
    job.createdAt = new Date(); // Update timestamp to show as new

    const saved = await this.assignmentRepo.save(job);
    return { success: true, message: 'Invitation resent', data: saved };
  }

  // 9. Admin View Influencer Milestones (Wrapper)
  async adminGetInfluencerMilestones(campaignId: string, influencerId: string) {
    const job = await this.assignmentRepo.findOne({
      where: { campaignId, influencerId },
      relations: ['influencer'],
    });

    if (!job)
      throw new NotFoundException(
        'Influencer is not assigned to this campaign',
      );

    // Reuse the logic we built for the influencer view
    // We need the UserID of the influencer to reuse that function
    const influencerUserId = job.influencer.userId;

    return this.getInfluencerJobMilestones(job.id, influencerUserId);
  }

  // 10. Admin Get Specific Milestone Details
  async adminGetInfluencerMilestoneDetails(
    campaignId: string,
    influencerId: string,
    milestoneId: string,
  ) {
    // 1. Find Job
    const job = await this.assignmentRepo.findOne({
      where: { campaignId, influencerId },
    });
    if (!job) throw new NotFoundException('Influencer assignment not found');

    // 2. Find Milestone
    const milestone = await this.milestoneRepo.findOne({
      where: { id: milestoneId, campaignId },
    });
    if (!milestone) throw new NotFoundException('Milestone not found');

    // 3. Find Submissions
    const history = await this.submissionRepo.find({
      where: {
        milestoneId,
        assignmentId: job.id,
      },
      order: { createdAt: 'DESC' },
    });

    const latest = history.length > 0 ? history[0] : null;

    return {
      success: true,
      data: {
        jobId: job.id,
        milestoneTitle: milestone.contentTitle,
        status: this.deriveUiStatusFromSubmission(latest, milestone.amount),
        latestSubmission: latest,
        submissionHistory: history,
      },
    };
  }

  // 11. Admin Force Status Change
  async adminSetInfluencerMilestoneStatus(
    milestoneId: string,
    assignmentId: string,
    adminUserId: string,
    dto: UpdateCampaignStatusDto, // Ensure this DTO is imported
  ) {
    const milestone = await this.milestoneRepo.findOne({
      where: { id: milestoneId },
    });
    if (!milestone) throw new NotFoundException('Milestone not found');

    const job = await this.assignmentRepo.findOne({
      where: { id: assignmentId },
    });
    if (!job) throw new NotFoundException('Job assignment not found');

    let latest = await this.submissionRepo.findOne({
      where: { milestoneId, assignmentId },
      order: { createdAt: 'DESC' },
    });

    if (!latest) {
      latest = this.submissionRepo.create({
        milestoneId,
        assignmentId,
        submittedByRole: 'admin',
        status: 'pending',
        paymentStatus: 'unpaid',
        paidAmount: 0,
      });
    }

    // Update Status
    if (dto.status === 'approved') {
      latest.status = 'client_approved';
      latest.isClientApproved = true;
    } else if (dto.status === 'declined') {
      latest.status = 'declined';
      latest.isClientApproved = false;
      latest.rejectionReason = dto.reason || 'Declined by Admin';
    } else {
      latest.status = dto.status;
    }

    if (dto.reason) {
      latest.rejectionReason = dto.reason;
    }

    const saved = await this.submissionRepo.save(latest);

    // Audit Log
    await this.reportRepo.save({
      submissionId: saved.id,
      content: `Admin changed status to "${dto.status}". Note: ${dto.reason}`,
      authorRole: UserRole.ADMIN,
      authorId: adminUserId,
      actionTaken: 'status_changed',
    });

    return { success: true, data: saved };
  }

  async adminPayInfluencerSubmission(
    submissionId: string,
    dto: AdminPayMilestoneDto, // { amount: number, note?: string }
  ) {
    // 1. Fetch Submission with Assignment & Milestone context
    const submission = await this.submissionRepo.findOne({
      where: { id: submissionId },
      relations: ['assignment', 'assignment.campaign', 'milestone'],
    });

    if (!submission) throw new NotFoundException('Submission not found');

    // 2. Strict Validation: Must be an Influencer Submission
    if (
      submission.submittedByRole !== 'influencer' &&
      submission.assignment?.campaign?.campaignType !== 'influencer_promotion'
    ) {
      throw new BadRequestException(
        'This API is for Influencer payments only.',
      );
    }

    if (submission.status === 'declined') {
      throw new BadRequestException('Cannot pay for a declined submission.');
    }

    // 3. Financial Calculations
    const currentPaid = Number(submission.paidAmount || 0);
    const incomingPayment = Number(dto.amount);
    const milestoneTarget = Number(submission.milestone.amount);

    const newTotalPaid = currentPaid + incomingPayment;

    // Safety Check: Prevent overpaying (Optional, but good practice)
    if (newTotalPaid > milestoneTarget) {
      throw new BadRequestException(
        `Payment exceeds milestone amount. Target: ${milestoneTarget}, Already Paid: ${currentPaid}, Attempting: ${incomingPayment}`,
      );
    }

    // 4. Update Submission State
    submission.paidAmount = newTotalPaid;

    // Logic: Is it fully paid now?
    if (newTotalPaid >= milestoneTarget) {
      submission.paymentStatus = 'paid';
      submission.status = 'approved'; // Mark work as fully done/approved
    } else {
      submission.paymentStatus = 'partial_paid';
      // We keep status as 'approved' (work is good) or 'pending_payment' depending on your UI preference.
      // Usually, if you pay *anything*, the work is implicitly "Approved".
      submission.status = 'approved';
    }

    submission.adminFeedback = 'Payment Processed';
    submission.isClientApproved = true;

    await this.submissionRepo.save(submission);

    return {
      success: true,
      message: `Payment of ${incomingPayment} released. Status: ${submission.paymentStatus}`,
      data: {
        submissionId: submission.id,
        milestoneAmount: milestoneTarget,
        totalPaid: newTotalPaid,
        remainingDue: milestoneTarget - newTotalPaid,
        paymentStatus: submission.paymentStatus,
      },
    };
  }

  // 12. List Reports
  async adminListReports(status?: string) {
    const whereCondition = status ? { actionTaken: status } : {};

    const reports = await this.reportRepo.find({
      where: whereCondition,
      order: { createdAt: 'DESC' },
    });

    return { success: true, data: reports };
  }

  // 13. Get Reports for Specific Submission
  async adminGetSubmissionReports(submissionId: string) {
    const reports = await this.reportRepo.find({
      where: { submissionId },
      order: { createdAt: 'DESC' },
    });

    return { success: true, data: reports };
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
    campaign.availableBudgetForExecution = base - campaign.platformFeeAmount;

    const milestoneCount = campaign.milestones.length;
    if (milestoneCount > 0) {
      const perMilestoneAmount =
        campaign.availableBudgetForExecution / milestoneCount;

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

    campaign.selectedAgencyId = dto.agencyId;
    campaign.proposedServiceFeePercent = finalPercent;

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
        campaignId: campaign.id,
        selectedAgency: selectedAgency.agencyName,
        finalServiceFeePercent: finalPercent,
        totalBudget: campaign.totalBudget,
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
      .select('SUM(c.availableBudgetForExecution)', 'totalEarnings')
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
        'c.availableBudgetForExecution',
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
    const netAvailable = Number(campaign.availableBudgetForExecution);

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
      availableBudgetForExecution,
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
        return sum + (Number(sub.paidAmount) || 0);
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
      return sum + (Number(sub.paidAmount) || 0);
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
      relations: ['assignment', 'assignment.campaign'],
    });

    if (!submission) throw new NotFoundException('Submission not found');

    // 2. Auth Check
    const client = await this.getClientProfile(userId);
    // if (submission.milestone.campaign.clientId !== client.id) {
    //   throw new ForbiddenException('Access Denied');
    // }

    // Validate Ownership
    if (submission.assignment?.campaign?.clientId !== client.id) {
      throw new ForbiddenException(
        'You do not have permission to review this submission',
      );
    }

    // 3. Logic based on Action
    if (dto.action === 'approve') {
      submission.isClientApproved = true;
      submission.status = 'client_approved';
      // Optional: Clear any previous rejection reasons
      submission.rejectionReason = null;

      // Optional: If you want to track who approved it
      submission.adminFeedback = dto.reason || 'Approved by Client';
    } else if (dto.action === 'decline') {
      if (!dto.reason) {
        throw new BadRequestException(
          'A reason is required when rejecting a submission.',
        );
      }
      submission.isClientApproved = false;
      submission.status = 'client_declined';
      submission.rejectionReason = dto.reason;
    }

    await this.submissionRepo.save(submission);

    if (dto.report) {
      await this.reportRepo.save({
        submissionId: submission.id,
        authorId: userId,
        authorRole: UserRole.CLIENT,
        content: dto.report,
        actionTaken: dto.action,
      });
    }

    return {
      success: true,
      message: `Submission ${dto.action === 'approve' ? 'client_approved' : 'returned for changes'} successfully`,
      data: {
        submissionId: submission.id,
        status: submission.status,
        isClientApproved: submission.isClientApproved,
      },
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

    submission.paidAmount = dto.amount;
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
                paidAmount: s.paidAmount,
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
        totalPaid += Number(s.paidAmount || 0);
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
