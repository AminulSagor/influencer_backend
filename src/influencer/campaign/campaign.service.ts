import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, MoreThanOrEqual } from 'typeorm';

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

    // Handle influencer relationships - always update (including clearing if empty)
    if (dto.preferredInfluencerIds && dto.preferredInfluencerIds.length > 0) {
      const foundInfluencers = await this.influencerRepo.find({
        where: { id: In(dto.preferredInfluencerIds) },
      });
      
      if (foundInfluencers.length === 0) {
        throw new BadRequestException(
          `No valid influencers found for preferred IDs: ${dto.preferredInfluencerIds.join(', ')}`,
        );
      }
      
      campaign.preferredInfluencers = foundInfluencers;
    } else {
      campaign.preferredInfluencers = [];
    }

    if (dto.notPreferableInfluencerIds && dto.notPreferableInfluencerIds.length > 0) {
      const foundInfluencers = await this.influencerRepo.find({
        where: { id: In(dto.notPreferableInfluencerIds) },
      });
      
      if (foundInfluencers.length === 0) {
        throw new BadRequestException(
          `No valid influencers found for not-preferable IDs: ${dto.notPreferableInfluencerIds.join(', ')}`,
        );
      }
      
      campaign.notPreferableInfluencers = foundInfluencers;
    } else {
      campaign.notPreferableInfluencers = [];
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

    if (campaign.status !== CampaignStatus.RECEIVED) {
      throw new BadRequestException('Only campaigns in received status can be deleted');
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
      throw new ConflictException('Cannot send quote - waiting for client to respond first');
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
      throw new ConflictException('Cannot send counter-offer - waiting for admin to send quote first');
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
          role === 'client' ? NegotiationSender.CLIENT : NegotiationSender.ADMIN,
        action: NegotiationAction.ACCEPT,
        senderId: userId,
      }),
    );

    // Campaign is now PAID (ready for influencer assignment)
    campaign.status = CampaignStatus.PAID;
    campaign.negotiationTurn = null;
    await this.campaignRepo.save(campaign);

    return {
      success: true,
      message: 'Quote accepted - Campaign is now paid',
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
      throw new BadRequestException('Campaign must be paid before assigning influencers');
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
      where: { campaignId: dto.campaignId, influencerId: In(dto.influencerIds) },
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
    const amountPerInfluencer = Math.round((campaign.baseBudget / assignments.length) * 100) / 100;
    const vatAmount = Math.round(amountPerInfluencer * VAT_RATE * 100) / 100;
    const totalAmount = Math.round((amountPerInfluencer + vatAmount) * 100) / 100;

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
        address: a.status !== JobStatus.NEW_OFFER ? {
          addressName: a.influencerAddressName,
          street: a.influencerStreet,
          thana: a.influencerThana,
          zilla: a.influencerZilla,
          fullAddress: a.influencerFullAddress,
        } : null,
      })),
    };
  }

  // --- Get Campaign Assignments (Client - verify ownership) ---
  async getCampaignAssignmentsForClient(campaignId: string, clientUserId: string) {
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
      throw new BadRequestException('Can only update assignments with "new_offer" status');
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
      .where('job.influencerId = :influencerId', { influencerId: influencer.id });

    // Filter by status (maps to UI sections)
    if (query.status) {
      qb.andWhere('job.status = :status', { status: query.status });
    }

    if (query.campaignId) {
      qb.andWhere('job.campaignId = :campaignId', { campaignId: query.campaignId });
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
        address: job.status !== JobStatus.NEW_OFFER ? {
          addressName: job.influencerAddressName,
          street: job.influencerStreet,
          thana: job.influencerThana,
          zilla: job.influencerZilla,
          fullAddress: job.influencerFullAddress,
        } : null,
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
      .where('job.influencerId = :influencerId', { influencerId: influencer.id })
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
        address: job.status !== JobStatus.NEW_OFFER ? {
          addressName: job.influencerAddressName,
          street: job.influencerStreet,
          thana: job.influencerThana,
          zilla: job.influencerZilla,
          fullAddress: job.influencerFullAddress,
        } : null,
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
      throw new BadRequestException('Can only accept jobs with "new_offer" status');
    }

    // Resolve and save address
    const address = await this.resolveInfluencerAddress(influencer, dto?.addressId);

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
      throw new BadRequestException('Can only decline jobs with "new_offer" status');
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
      throw new BadRequestException('Can only start jobs with "pending" status');
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
      throw new BadRequestException('Can only complete jobs with "active" status');
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
      qb.andWhere('assignment.campaignId = :campaignId', { campaignId: query.campaignId });
    }

    if (query.influencerId) {
      qb.andWhere('assignment.influencerId = :influencerId', { influencerId: query.influencerId });
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
    const dailyBreakdown: { [key: string]: { amount: number; count: number } } = {};

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
}

