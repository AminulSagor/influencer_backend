import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';

import { CampaignEntity, CampaignStatus } from './entities/campaign.entity';
import { CampaignMilestoneEntity } from './entities/campaign-milestone.entity';
import { CampaignAssetEntity } from './entities/campaign-asset.entity';
import {
  CampaignNegotiationEntity,
  NegotiationSender,
  NegotiationAction,
} from './entities/campaign-negotiation.entity';
import {
  CampaignAssignmentEntity,
  AssignmentStatus,
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
  CreateNegotiationDto,
  AcceptNegotiationDto,
  RejectCampaignDto,
} from './dto/campaign-negotiation.dto';
import {
  AssignCampaignDto,
  UpdateAssignmentDto,
  RespondAssignmentDto,
  SearchAssignmentDto,
} from './dto/campaign-assignment.dto';

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
    @InjectRepository(ClientProfileEntity)
    private readonly clientRepo: Repository<ClientProfileEntity>,
    @InjectRepository(InfluencerProfileEntity)
    private readonly influencerRepo: Repository<InfluencerProfileEntity>,
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
      status: CampaignStatus.NEEDS_QUOTE,
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
  // STEP 2: Targeting & Preferences
  // ============================================
  async updateStep2(
    campaignId: string,
    userId: string,
    dto: UpdateCampaignStep2Dto,
  ) {
    const campaign = await this.verifyCampaignOwnership(campaignId, userId);

    // Validate no overlap
    if (dto.preferredInfluencerIds && dto.notPreferableInfluencerIds) {
      const overlap = dto.preferredInfluencerIds.filter((id) =>
        dto.notPreferableInfluencerIds!.includes(id),
      );
      if (overlap.length > 0) {
        throw new BadRequestException(
          'Preferred and Not Preferable influencers cannot overlap',
        );
      }
    }

    // Update fields
    campaign.productType = dto.productType;
    campaign.campaignNiche = dto.campaignNiche;
    campaign.currentStep = Math.max(campaign.currentStep, 2);

    // Handle influencer relationships
    if (dto.preferredInfluencerIds?.length) {
      campaign.preferredInfluencers = await this.influencerRepo.find({
        where: { id: In(dto.preferredInfluencerIds) },
      });
    }

    if (dto.notPreferableInfluencerIds?.length) {
      campaign.notPreferableInfluencers = await this.influencerRepo.find({
        where: { id: In(dto.notPreferableInfluencerIds) },
      });
    }

    await this.campaignRepo.save(campaign);

    return {
      success: true,
      message: 'Targeting preferences saved',
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

    // Calculate budget (backend is source of truth)
    const budget = this.calculateBudget(dto.baseBudget);

    campaign.baseBudget = budget.baseBudget;
    campaign.vatAmount = budget.vatAmount;
    campaign.totalBudget = budget.totalBudget;
    campaign.netPayableAmount = budget.netPayableAmount;
    campaign.currentStep = Math.max(campaign.currentStep, 4);

    await this.campaignRepo.save(campaign);

    // Replace milestones
    await this.milestoneRepo.delete({ campaignId });
    const milestones = dto.milestones.map((m, i) =>
      this.milestoneRepo.create({ ...m, campaignId, order: m.order ?? i }),
    );
    await this.milestoneRepo.save(milestones);

    return {
      success: true,
      message: 'Budget and milestones saved',
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

    let assetsCount = 0;
    if (dto.assets?.length) {
      const assets = dto.assets.map((a) =>
        this.assetRepo.create({ ...a, campaignId }),
      );
      await this.assetRepo.save(assets);
      assetsCount = assets.length;
    }

    // Return summary for final step
    const summary = await this.getCampaignSummary(campaignId);

    return {
      success: true,
      message: 'Assets uploaded. Campaign ready to place.',
      data: {
        id: campaign.id,
        currentStep: 5,
        assetsUploaded: assetsCount,
        readyToPlace: true,
        summary,
      },
    };
  }

  // ============================================
  // PLACE CAMPAIGN (Submit for Quote)
  // ============================================
  async placeCampaign(campaignId: string, userId: string) {
    const campaign = await this.verifyCampaignOwnership(campaignId, userId);

    // Validate completeness
    this.validateCampaignForPlacement(campaign);

    campaign.status = CampaignStatus.NEEDS_QUOTE;
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

    if (!campaign.campaignName) errors.push('Campaign name is required');
    if (!campaign.campaignType) errors.push('Campaign type is required');
    if (!campaign.productType) errors.push('Product type is required');
    if (!campaign.campaignNiche) errors.push('Campaign niche is required');
    if (!campaign.campaignGoals) errors.push('Campaign goals are required');
    if (!campaign.productServiceDetails)
      errors.push('Product/Service details are required');
    if (!campaign.startingDate) errors.push('Starting date is required');
    if (!campaign.duration || campaign.duration < 1)
      errors.push('Duration must be at least 1 day');
    if (!campaign.baseBudget || campaign.baseBudget <= 0)
      errors.push('Budget is required');

    if (errors.length > 0) {
      throw new BadRequestException({ message: 'Validation failed', errors });
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
      ],
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

    if (campaign.status !== CampaignStatus.NEEDS_QUOTE) {
      throw new BadRequestException('Only campaigns awaiting quote can be deleted');
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
  // NEGOTIATION: Create Entry
  // ============================================
  async createNegotiation(
    userId: string,
    role: 'client' | 'admin',
    dto: CreateNegotiationDto,
  ) {
    const campaign = await this.campaignRepo.findOne({
      where: { id: dto.campaignId },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    // Validate access for client
    if (role === 'client') {
      const client = await this.getClientProfile(userId);
      if (campaign.clientId !== client.id) {
        throw new ForbiddenException('Access denied');
      }
    }

    // Check turn
    if (campaign.negotiationTurn && campaign.negotiationTurn !== role) {
      throw new BadRequestException(`It's not your turn to respond`);
    }

    // Calculate proposed budget if provided
    let proposedBudget: ReturnType<typeof this.calculateBudget> | null = null;
    if (dto.proposedBaseBudget) {
      proposedBudget = this.calculateBudget(dto.proposedBaseBudget);
    }

    const negotiation = this.negotiationRepo.create({
      campaignId: dto.campaignId,
      sender: role === 'client' ? NegotiationSender.CLIENT : NegotiationSender.ADMIN,
      action: dto.action,
      message: dto.message,
      proposedBaseBudget: proposedBudget?.baseBudget,
      proposedVatAmount: proposedBudget?.vatAmount,
      proposedTotalBudget: proposedBudget?.totalBudget,
      senderId: userId,
    });

    await this.negotiationRepo.save(negotiation);

    // Update campaign
    if (
      [NegotiationAction.REQUEST, NegotiationAction.COUNTER_OFFER].includes(
        dto.action as NegotiationAction,
      )
    ) {
      campaign.status = CampaignStatus.ACTIVE;
      campaign.negotiationTurn = role === 'client' ? 'admin' : 'client';
      await this.campaignRepo.save(campaign);
    }

    return {
      success: true,
      message: 'Response sent',
      data: {
        negotiationId: negotiation.id,
        campaignId: campaign.id,
        status: campaign.status,
        yourTurn: false,
        waitingFor: campaign.negotiationTurn,
      },
    };
  }

  // ============================================
  // NEGOTIATION: Accept
  // ============================================
  async acceptNegotiation(
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
          role === 'client' ? NegotiationSender.CLIENT : NegotiationSender.ADMIN,
        action: NegotiationAction.ACCEPT,
        message: dto.message || 'Quote accepted',
        senderId: userId,
      }),
    );

    campaign.status = CampaignStatus.ACTIVE;
    campaign.negotiationTurn = null;
    await this.campaignRepo.save(campaign);

    return {
      success: true,
      message: 'Quote accepted',
      data: {
        campaignId: campaign.id,
        status: campaign.status,
        finalBudget: {
          baseBudget: campaign.baseBudget,
          totalBudget: campaign.totalBudget,
        },
      },
    };
  }

  // ============================================
  // NEGOTIATION: Reject
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
          role === 'client' ? NegotiationSender.CLIENT : NegotiationSender.ADMIN,
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
  // CAMPAIGN ASSIGNMENT METHODS
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

  // --- Admin: Assign Campaign to Influencers ---
  async assignCampaignToInfluencers(adminId: string, dto: AssignCampaignDto) {
    // Verify campaign exists and is active
    const campaign = await this.campaignRepo.findOne({
      where: { id: dto.campaignId },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (campaign.status !== CampaignStatus.ACTIVE) {
      throw new BadRequestException(
        'Campaign must be active before assigning to influencers',
      );
    }

    // Validate all influencer IDs exist
    const influencerIds = dto.assignments.map((a) => a.influencerId);
    const influencers = await this.influencerRepo.find({
      where: { id: In(influencerIds) },
    });

    if (influencers.length !== influencerIds.length) {
      throw new BadRequestException('One or more influencer IDs are invalid');
    }

    // Check for duplicate assignments
    const existingAssignments = await this.assignmentRepo.find({
      where: {
        campaignId: dto.campaignId,
        influencerId: In(influencerIds),
        status: In([AssignmentStatus.PENDING, AssignmentStatus.ACCEPTED, AssignmentStatus.IN_PROGRESS]),
      },
    });

    if (existingAssignments.length > 0) {
      const duplicateIds = existingAssignments.map((a) => a.influencerId);
      throw new BadRequestException(
        `Influencers already assigned: ${duplicateIds.join(', ')}`,
      );
    }

    // Create assignments
    const assignments: CampaignAssignmentEntity[] = [];

    for (const assignment of dto.assignments) {
      const budgetCalc = this.calculateAssignmentBudget(assignment.offeredAmount);

      const newAssignment = this.assignmentRepo.create({
        campaignId: dto.campaignId,
        influencerId: assignment.influencerId,
        assignedBy: adminId,
        offeredAmount: budgetCalc.offeredAmount,
        vatAmount: budgetCalc.vatAmount,
        totalAmount: budgetCalc.totalAmount,
        offerMessage: assignment.offerMessage || dto.globalOfferMessage,
        offerTerms: assignment.offerTerms,
        assignedMilestones: assignment.assignedMilestones,
        offerExpiresAt: assignment.offerExpiresAt,
        status: AssignmentStatus.PENDING,
        totalMilestones: assignment.assignedMilestones?.length || 0,
      });

      assignments.push(newAssignment);
    }

    const savedAssignments = await this.assignmentRepo.save(assignments);

    // Update campaign status to pending_invitation when assignments created
    if (campaign.status === CampaignStatus.ACTIVE) {
      campaign.status = CampaignStatus.PENDING_INVITATION;
      await this.campaignRepo.save(campaign);
    }

    return {
      success: true,
      message: `Campaign assigned to ${savedAssignments.length} influencer(s)`,
      data: savedAssignments.map((a) => ({
        id: a.id,
        influencerId: a.influencerId,
        totalAmount: a.totalAmount,
        status: a.status,
      })),
    };
  }

  // --- Admin: Get Campaign Assignments ---
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
        totalAmount: a.totalAmount,
        status: a.status,
        respondedAt: a.respondedAt,
      })),
    };
  }

  // --- Admin: Update Assignment ---
  async updateAssignment(assignmentId: string, dto: UpdateAssignmentDto) {
    const assignment = await this.assignmentRepo.findOne({
      where: { id: assignmentId },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    if (assignment.status !== AssignmentStatus.PENDING) {
      throw new BadRequestException('Can only update pending assignments');
    }

    if (dto.offeredAmount !== undefined) {
      const budgetCalc = this.calculateAssignmentBudget(dto.offeredAmount);
      assignment.offeredAmount = budgetCalc.offeredAmount;
      assignment.vatAmount = budgetCalc.vatAmount;
      assignment.totalAmount = budgetCalc.totalAmount;
    }

    if (dto.offerMessage !== undefined) assignment.offerMessage = dto.offerMessage;
    if (dto.offerTerms !== undefined) assignment.offerTerms = dto.offerTerms;
    if (dto.assignedMilestones !== undefined) {
      assignment.assignedMilestones = dto.assignedMilestones;
      assignment.totalMilestones = dto.assignedMilestones.length;
    }
    if (dto.offerExpiresAt !== undefined) assignment.offerExpiresAt = dto.offerExpiresAt;

    await this.assignmentRepo.save(assignment);

    return {
      success: true,
      message: 'Assignment updated',
    };
  }

  // --- Admin: Cancel Assignment ---
  async cancelAssignment(assignmentId: string) {
    const assignment = await this.assignmentRepo.findOne({
      where: { id: assignmentId },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    if (![AssignmentStatus.PENDING, AssignmentStatus.ACCEPTED].includes(assignment.status as AssignmentStatus)) {
      throw new BadRequestException('Cannot cancel this assignment');
    }

    assignment.status = AssignmentStatus.CANCELLED;
    await this.assignmentRepo.save(assignment);

    return {
      success: true,
      message: 'Assignment cancelled',
    };
  }

  // --- Influencer: Get My Assignments ---
  async getInfluencerAssignments(userId: string, query: SearchAssignmentDto) {
    const influencer = await this.influencerRepo.findOne({
      where: { userId },
    });

    if (!influencer) {
      throw new NotFoundException('Influencer profile not found');
    }

    const queryBuilder = this.assignmentRepo
      .createQueryBuilder('assignment')
      .leftJoinAndSelect('assignment.campaign', 'campaign')
      .leftJoinAndSelect('campaign.client', 'client')
      .where('assignment.influencerId = :influencerId', { influencerId: influencer.id });

    if (query.status) {
      queryBuilder.andWhere('assignment.status = :status', { status: query.status });
    }

    if (query.campaignId) {
      queryBuilder.andWhere('assignment.campaignId = :campaignId', { campaignId: query.campaignId });
    }

    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    queryBuilder.orderBy('assignment.createdAt', 'DESC').skip(skip).take(limit);

    const [assignments, total] = await queryBuilder.getManyAndCount();

    return {
      success: true,
      data: assignments.map((a) => ({
        id: a.id,
        campaignId: a.campaign.id,
        campaignName: a.campaign.campaignName,
        totalAmount: a.totalAmount,
        status: a.status,
        offerExpiresAt: a.offerExpiresAt,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // --- Influencer: Get Assignment Details ---
  async getAssignmentDetails(assignmentId: string, userId: string) {
    const influencer = await this.influencerRepo.findOne({
      where: { userId },
    });

    if (!influencer) {
      throw new NotFoundException('Influencer profile not found');
    }

    const assignment = await this.assignmentRepo.findOne({
      where: { id: assignmentId, influencerId: influencer.id },
      relations: ['campaign', 'campaign.client', 'campaign.assets'],
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    return {
      success: true,
      data: {
        id: assignment.id,
        campaignName: assignment.campaign.campaignName,
        campaignGoals: assignment.campaign.campaignGoals,
        productServiceDetails: assignment.campaign.productServiceDetails,
        startingDate: assignment.campaign.startingDate,
        duration: assignment.campaign.duration,
        totalAmount: assignment.totalAmount,
        offerMessage: assignment.offerMessage,
        offerTerms: assignment.offerTerms,
        assignedMilestones: assignment.assignedMilestones,
        status: assignment.status,
        offerExpiresAt: assignment.offerExpiresAt,
      },
    };
  }

  // --- Influencer: Respond to Assignment ---
  async respondToAssignment(
    assignmentId: string,
    userId: string,
    dto: RespondAssignmentDto,
  ) {
    const influencer = await this.influencerRepo.findOne({
      where: { userId },
    });

    if (!influencer) {
      throw new NotFoundException('Influencer profile not found');
    }

    const assignment = await this.assignmentRepo.findOne({
      where: { id: assignmentId, influencerId: influencer.id },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    if (assignment.status !== AssignmentStatus.PENDING) {
      throw new BadRequestException('This assignment has already been responded to');
    }

    // Check if offer has expired
    if (assignment.offerExpiresAt && new Date() > new Date(assignment.offerExpiresAt)) {
      assignment.status = AssignmentStatus.EXPIRED;
      await this.assignmentRepo.save(assignment);
      throw new BadRequestException('This offer has expired');
    }

    assignment.status = dto.response;
    assignment.respondedAt = new Date();
    if (dto.responseMessage) {
      assignment.responseMessage = dto.responseMessage;
    }

    if (dto.response === AssignmentStatus.REJECTED && dto.rejectionReason) {
      assignment.rejectionReason = dto.rejectionReason;
    }

    if (dto.response === AssignmentStatus.ACCEPTED) {
      assignment.status = AssignmentStatus.IN_PROGRESS;
      assignment.startedAt = new Date();
    }

    await this.assignmentRepo.save(assignment);

    return {
      success: true,
      message: dto.response === AssignmentStatus.ACCEPTED
        ? 'Offer accepted successfully'
        : 'Offer declined',
    };
  }

  // --- Admin: Get All Assignments (with filters) ---
  async getAllAssignments(query: SearchAssignmentDto) {
    const queryBuilder = this.assignmentRepo
      .createQueryBuilder('assignment')
      .leftJoinAndSelect('assignment.campaign', 'campaign')
      .leftJoinAndSelect('assignment.influencer', 'influencer');

    if (query.status) {
      queryBuilder.andWhere('assignment.status = :status', { status: query.status });
    }

    if (query.campaignId) {
      queryBuilder.andWhere('assignment.campaignId = :campaignId', { campaignId: query.campaignId });
    }

    if (query.influencerId) {
      queryBuilder.andWhere('assignment.influencerId = :influencerId', { influencerId: query.influencerId });
    }

    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    queryBuilder.orderBy('assignment.createdAt', 'DESC').skip(skip).take(limit);

    const [assignments, total] = await queryBuilder.getManyAndCount();

    return {
      success: true,
      data: assignments.map((a) => ({
        id: a.id,
        campaignName: a.campaign.campaignName,
        influencerName: `${a.influencer.firstName} ${a.influencer.lastName}`,
        totalAmount: a.totalAmount,
        status: a.status,
        respondedAt: a.respondedAt,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
