import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  Like,
  Between,
  LessThanOrEqual,
  MoreThanOrEqual,
} from 'typeorm';
import {
  ApprovalStatus,
  UpdateItemStatusDto,
  UpdateNidStatusDto,
  UpdatePayoutStatusDto,
  UpdateSectionStatusDto,
  UpdateClientNidStatusDto,
  UpdateClientTradeLicenseStatusDto,
  UpdateClientSocialStatusDto,
  GetCampaignsQueryDto,
  AdminCampaignListItem,
  UpdateFeesDto,
  AddMasterDataDto,
  ChangePasswordDto,
  UpdateAgencyTinStatusDto,
  UpdateAgencyTradeLicenseStatusDto,
  UpdateAgencyNidStatusDto,
} from './dto/admin.dto';
import { InfluencerProfileEntity } from '../influencer/entities/influencer-profile.entity';
import { ClientProfileEntity } from '../client/entities/client-profile.entity';
import { NotificationService } from '../notification/notification.service';
import { UserEntity, UserRole } from '../user/entities/user.entity';
import { CampaignEntity } from '../campaign/entities/campaign.entity';
import { CampaignAssignmentEntity } from '../campaign/entities/campaign-assignment.entity';
import { SystemSettingEntity } from './entities/system-setting.entity';
import {
  MasterDataEntity,
  MasterDataType,
} from './entities/master-data.entity';
import { LoginLogEntity } from './entities/login-log.entity';
import * as bcrypt from 'bcrypt';
import * as geoip from 'geoip-lite';
import { UAParser } from 'ua-parser-js';
import * as requestIp from 'request-ip';
import { Request } from 'express';
import { GetInfluencersDto, UserStatusFilter } from './dto/admin-browsing.dto';
import { AgencyProfileEntity } from '../agency/entities/agency-profile.entity';
import { AgencyService } from '../agency/agency.service';
import { GetAgenciesDto } from '../agency/dto/get-agencies.dto';
import { AdminReportFilterDto } from '../campaign/dto/report-filter.dto';
import { MilestoneSubmissionEntity } from '../campaign/entities/milestone-submission.entity';
import {
  FinanceFilterDto,
  PaymentStatus,
  PayoutType,
} from './entities/finance-filter.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(InfluencerProfileEntity)
    private readonly influencerRepo: Repository<InfluencerProfileEntity>,
    @InjectRepository(AgencyProfileEntity)
    private readonly agencyRepo: Repository<AgencyProfileEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(ClientProfileEntity)
    private readonly clientProfileRepo: Repository<ClientProfileEntity>,
    @InjectRepository(CampaignEntity)
    private readonly campaignRepo: Repository<CampaignEntity>,
    @InjectRepository(CampaignAssignmentEntity)
    private readonly campaignAssignmentRepo: Repository<CampaignAssignmentEntity>,
    @InjectRepository(SystemSettingEntity)
    private readonly settingsRepo: Repository<SystemSettingEntity>,
    @InjectRepository(MasterDataEntity)
    private readonly masterDataRepo: Repository<MasterDataEntity>,
    @InjectRepository(LoginLogEntity)
    private readonly loginLogRepo: Repository<LoginLogEntity>,
    @InjectRepository(AgencyProfileEntity)
    private readonly agencyProfileRepo: Repository<AgencyProfileEntity>,
    @InjectRepository(MilestoneSubmissionEntity)
    private readonly submissionRepo: Repository<MilestoneSubmissionEntity>,
    private readonly notificationService: NotificationService,
    private readonly agencyService: AgencyService,
  ) {}

  private async getRawProfile(userId: string) {
    const profile = await this.influencerRepo.findOne({
      where: { userId },
      relations: ['user'],
    });
    if (!profile) throw new NotFoundException('Profile not found');
    return profile;
  }

  private async checkAndToggleUserVerification(
    profile: InfluencerProfileEntity,
  ) {
    // 1. Define Helper to check if an array of items are ALL approved
    const isListApproved = (list: any[]) =>
      Array.isArray(list) &&
      list.length > 0 &&
      list.every((i) => i.status === ApprovalStatus.APPROVED);

    // 2. Check Sections
    const nidOk =
      profile.nidVerification?.nidStatus === ApprovalStatus.APPROVED;
    const nichesOk = isListApproved(profile.niches);
    const skillsOk = isListApproved(profile.skills);
    const socialOk = isListApproved(profile.socialLinks);

    // 3. Check Payment (At least one method must be approved)
    const bankOk = profile.payouts?.bank?.some(
      (b) => b.accStatus === ApprovalStatus.APPROVED,
    );
    const mobileOk = profile.payouts?.mobileBanking?.some(
      (m) => m.accStatus === ApprovalStatus.APPROVED,
    );
    const paymentOk = bankOk || mobileOk;

    // 4. Determine Final Status
    // A user is verified ONLY if NID, Niches, Skills, Socials AND Payment are all green.
    const isFullyVerified =
      nidOk && nichesOk && skillsOk && socialOk && paymentOk;

    // 5. Update User Entity if status changed
    if (profile.user.isVerified !== isFullyVerified) {
      await this.userRepo.update(profile.user.id, {
        isVerified: isFullyVerified,
      });

      // Optional: Notify user of full verification
      if (isFullyVerified) {
        await this.notificationService.createNotification(
          profile.user.id,
          UserRole.INFLUENCER,
          'Profile Verified',
          'Congratulations! Your profile is now fully verified.',
          'system',
        );
      }
    }
  }

  // Helper: Count how many items are strictly 'pending'
  private countPendingItems(profile: InfluencerProfileEntity): number {
    let count = 0;
    if (profile.nidVerification?.nidStatus === ApprovalStatus.PENDING) count++;
    if (profile.niches)
      count += profile.niches.filter(
        (n) => n.status === ApprovalStatus.PENDING,
      ).length;
    if (profile.skills)
      count += profile.skills.filter(
        (s) => s.status === ApprovalStatus.PENDING,
      ).length;
    if (profile.socialLinks)
      count += profile.socialLinks.filter(
        (s) => s.status === ApprovalStatus.PENDING,
      ).length;
    if (profile.payouts?.bank)
      count += profile.payouts.bank.filter(
        (b) => b.accStatus === ApprovalStatus.PENDING,
      ).length;
    if (profile.payouts?.mobileBanking)
      count += profile.payouts.mobileBanking.filter(
        (m) => m.accStatus === ApprovalStatus.PENDING,
      ).length;
    return count;
  }

  private async notifyUser(
    userId: string,
    item: string,
    status: ApprovalStatus,
    reason?: string,
  ) {
    if (status === ApprovalStatus.REJECTED) {
      await this.notificationService.createNotification(
        userId,
        UserRole.INFLUENCER,
        `${item} Rejected`,
        `Your submission for ${item} was rejected. Reason: ${reason || 'Not specified'}`,
        'verification',
      );
    } else if (status === ApprovalStatus.APPROVED) {
      await this.notificationService.createNotification(
        userId,
        UserRole.INFLUENCER,
        `${item} Approved`,
        `Your ${item} has been successfully verified and approved.`,
        'verification',
      );
    }
  }

  async getPendingProfiles(page = 1, limit = 10) {
    const [profiles, total] = await this.influencerRepo.findAndCount({
      take: limit,
      skip: (page - 1) * limit,
      relations: ['user'],
      order: { updatedAt: 'DESC' },
    });

    // Map to minimal response
    const data = profiles.map((p) => {
      const pendingCount = this.countPendingItems(p);
      // Only return if there are pending items (Optional filter, removed for now to show all)
      return {
        userId: p.userId,
        fullName: `${p.firstName} ${p.lastName}`,
        isVerified: p.user.isVerified,
        pendingItemsCount: pendingCount, // <--- The Count you wanted
        niches: p.niches?.map((n) => n.niche) || [], // Just names
      };
    });

    return { data, meta: { total, page, limit } };
  }

  async getProfileDetails(userId: string) {
    const profile = await this.influencerRepo.findOne({
      where: { userId },
      relations: ['user'],
    });
    if (!profile) throw new NotFoundException('Profile not found');

    // Construct response containing ONLY pending items
    const response: any = {
      userId: profile.userId,
      fullName: `${profile.firstName} ${profile.lastName}`,
    };

    if (profile.nidVerification?.nidStatus === ApprovalStatus.PENDING) {
      response.nid = {
        number: profile.nidNumber,
        front: profile.nidFrontImg,
        back: profile.nidBackImg,
        status: 'pending',
      };
    }

    const pendingNiches = profile.niches?.filter(
      (n) => n.status === ApprovalStatus.PENDING,
    );
    if (pendingNiches?.length) response.niches = pendingNiches;

    const pendingSkills = profile.skills?.filter(
      (s) => s.status === ApprovalStatus.PENDING,
    );
    if (pendingSkills?.length) response.skills = pendingSkills;

    const pendingSocials = profile.socialLinks?.filter(
      (s) => s.status === ApprovalStatus.PENDING,
    );
    if (pendingSocials?.length) response.socialLinks = pendingSocials;

    const pendingBanks = profile.payouts?.bank?.filter(
      (b) => b.accStatus === ApprovalStatus.PENDING,
    );
    if (pendingBanks?.length) response.bankAccounts = pendingBanks;

    const pendingMobile = profile.payouts?.mobileBanking?.filter(
      (m) => m.accStatus === ApprovalStatus.PENDING,
    );
    if (pendingMobile?.length) response.mobileAccounts = pendingMobile;

    return response;
  }

  // --- FIX: Use getRawProfile() for updates to ensure we have the Entity ---

  async updateNicheStatus(userId: string, dto: UpdateItemStatusDto) {
    const profile = await this.getRawProfile(userId); // <--- FIXED

    if (profile.niches) {
      profile.niches = profile.niches.map((n) =>
        n.niche === dto.identifier
          ? {
              ...n,
              status: dto.status,
              rejectReason:
                dto.status === ApprovalStatus.REJECTED
                  ? dto.rejectReason
                  : undefined,
            }
          : n,
      );
    }

    await this.influencerRepo.save(profile);
    await this.notifyUser(
      userId,
      `Niche (${dto.identifier})`,
      dto.status,
      dto.rejectReason,
    );
    await this.checkAndToggleUserVerification(profile);

    return { success: true, message: `Niche ${dto.status}` };
  }

  async updateSkillStatus(userId: string, dto: UpdateItemStatusDto) {
    const profile = await this.getRawProfile(userId); // <--- FIXED

    if (profile.skills) {
      profile.skills = profile.skills.map((s) =>
        s.skill === dto.identifier
          ? {
              ...s,
              status: dto.status,
              rejectReason:
                dto.status === ApprovalStatus.REJECTED
                  ? dto.rejectReason
                  : undefined,
            }
          : s,
      );
    }

    await this.influencerRepo.save(profile);
    await this.notifyUser(
      userId,
      `Skill (${dto.identifier})`,
      dto.status,
      dto.rejectReason,
    );
    await this.checkAndToggleUserVerification(profile);

    return { success: true, message: `Skill ${dto.status}` };
  }

  async updateSocialStatus(userId: string, dto: UpdateItemStatusDto) {
    const profile = await this.getRawProfile(userId); // <--- FIXED

    if (profile.socialLinks) {
      profile.socialLinks = profile.socialLinks.map((s) =>
        s.url === dto.identifier
          ? {
              ...s,
              status: dto.status,
              rejectReason:
                dto.status === ApprovalStatus.REJECTED
                  ? dto.rejectReason
                  : undefined,
            }
          : s,
      );
    }

    await this.influencerRepo.save(profile);
    await this.notifyUser(userId, 'Social Link', dto.status, dto.rejectReason);
    await this.checkAndToggleUserVerification(profile);

    return { success: true, message: `Social Link ${dto.status}` };
  }

  async updateBankStatus(userId: string, dto: UpdatePayoutStatusDto) {
    const profile = await this.getRawProfile(userId); // <--- FIXED

    if (profile.payouts?.bank) {
      profile.payouts.bank = profile.payouts.bank.map((acc) =>
        acc.bankAccNo === dto.accountNo
          ? {
              ...acc,
              accStatus: dto.status,
              accRejectReason:
                dto.status === ApprovalStatus.REJECTED
                  ? dto.rejectReason
                  : undefined,
            }
          : acc,
      );
    }

    await this.influencerRepo.save(profile);
    await this.notifyUser(userId, 'Bank Account', dto.status, dto.rejectReason);
    await this.checkAndToggleUserVerification(profile);

    return { success: true, message: `Bank Account ${dto.status}` };
  }

  async updateMobileStatus(userId: string, dto: UpdatePayoutStatusDto) {
    const profile = await this.getRawProfile(userId); // <--- FIXED

    if (profile.payouts?.mobileBanking) {
      profile.payouts.mobileBanking = profile.payouts.mobileBanking.map(
        (acc) =>
          acc.accountNo === dto.accountNo
            ? {
                ...acc,
                accStatus: dto.status,
                accRejectReason:
                  dto.status === ApprovalStatus.REJECTED
                    ? dto.rejectReason
                    : undefined,
              }
            : acc,
      );
    }

    await this.influencerRepo.save(profile);
    await this.notifyUser(
      userId,
      'Mobile Banking',
      dto.status,
      dto.rejectReason,
    );
    await this.checkAndToggleUserVerification(profile);

    return { success: true, message: `Mobile Account ${dto.status}` };
  }

  async updateNidStatus(userId: string, dto: UpdateNidStatusDto) {
    const profile = await this.getRawProfile(userId); // Already Correct

    if (!profile.nidVerification)
      profile.nidVerification = { nidStatus: 'pending', nidRejectReason: '' };

    profile.nidVerification.nidStatus = dto.nidStatus;
    profile.nidVerification.nidRejectReason =
      dto.nidStatus === ApprovalStatus.REJECTED
        ? dto.rejectReason || 'No reason'
        : '';

    await this.influencerRepo.save(profile);
    await this.notifyUser(
      userId,
      'NID Document',
      dto.nidStatus,
      dto.rejectReason,
    );
    await this.checkAndToggleUserVerification(profile);

    return { success: true, message: `NID ${dto.nidStatus}` };
  }

  // FORCE APPROVE USER (Manual Override)
  async forceApproveUser(userId: string) {
    const profile = await this.getRawProfile(userId);

    // 1. Force update the User Entity
    await this.userRepo.update(profile.user.id, { isVerified: true });

    // 2. Notify the User
    await this.notificationService.createNotification(
      profile.user.id,
      UserRole.INFLUENCER,
      'Profile Verified',
      'Your profile has been manually verified by the administration.',
      'system',
    );

    return {
      success: true,
      message: 'User has been manually verified (Force Approved).',
      userId: userId,
      isVerified: true,
    };
  }

  // Endpoint to Revoke Verification manually
  async revokeVerification(userId: string) {
    const profile = await this.getRawProfile(userId);
    await this.userRepo.update(profile.user.id, { isVerified: false });

    return {
      success: true,
      message: 'User verification has been revoked.',
      userId: userId,
      isVerified: false,
    };
  }
  // =============================================
  // CLIENT VERIFICATION METHODS
  // =============================================

  // 9. Get All Client Profiles for Verification
  async getClientProfiles(page = 1, limit = 10) {
    const [data, total] = await this.clientProfileRepo.findAndCount({
      take: limit,
      skip: (page - 1) * limit,
      relations: ['user'],
      order: { updatedAt: 'DESC' },
    });

    return {
      data,
      meta: { total, page, limit },
    };
  }

  // 10. Get Clients Pending NID Verification
  async getClientsPendingNidVerification(page = 1, limit = 10) {
    const [data, total] = await this.clientProfileRepo.findAndCount({
      where: { nidStatus: 'pending' },
      take: limit,
      skip: (page - 1) * limit,
      relations: ['user'],
      order: { updatedAt: 'DESC' },
    });

    return {
      data,
      meta: { total, page, limit },
    };
  }

  // 11. Get Clients Pending Trade License Verification
  async getClientsPendingTradeLicenseVerification(page = 1, limit = 10) {
    const [data, total] = await this.clientProfileRepo.findAndCount({
      where: { tradeLicenseStatus: 'pending' },
      take: limit,
      skip: (page - 1) * limit,
      relations: ['user'],
      order: { updatedAt: 'DESC' },
    });

    return {
      data,
      meta: { total, page, limit },
    };
  }

  // 12. Get Single Client Profile Details
  async getClientProfileDetails(userId: string): Promise<ClientProfileEntity> {
    const profile = await this.clientProfileRepo.findOne({
      where: { userId },
      relations: ['user'],
    });
    if (!profile) throw new NotFoundException('Client profile not found');
    return profile;
  }

  // 13. Approve/Reject Client NID
  async updateClientNidStatus(
    userId: string,
    dto: UpdateClientNidStatusDto,
  ): Promise<ClientProfileEntity> {
    const profile = await this.getClientProfileDetails(userId);

    profile.nidStatus = dto.nidStatus;
    profile.verificationSteps = {
      ...profile.verificationSteps,
      nidVerification: dto.nidStatus,
    };

    return this.clientProfileRepo.save(profile);
  }

  // 14. Approve/Reject Client Trade License
  async updateClientTradeLicenseStatus(
    userId: string,
    dto: UpdateClientTradeLicenseStatusDto,
  ): Promise<ClientProfileEntity> {
    const profile = await this.getClientProfileDetails(userId);

    profile.tradeLicenseStatus = dto.tradeLicenseStatus;
    profile.verificationSteps = {
      ...profile.verificationSteps,
      tradeLicense: dto.tradeLicenseStatus,
    };

    return this.clientProfileRepo.save(profile);
  }

  // 15. Approve/Reject Client Social Link
  async updateClientSocialStatus(
    userId: string,
    dto: UpdateClientSocialStatusDto,
  ): Promise<ClientProfileEntity> {
    const profile = await this.getClientProfileDetails(userId);

    if (profile.socialLinks) {
      profile.socialLinks = profile.socialLinks.map((s) =>
        s.profileUrl === dto.profileUrl ? { ...s, status: dto.status } : s,
      );
    }

    // Update verification step if all social links are verified
    const allVerified = profile.socialLinks?.every(
      (s) => (s as any).status === 'approved',
    );
    if (allVerified) {
      profile.verificationSteps = {
        ...profile.verificationSteps,
        socialLinks: 'verified',
      };
    }

    return this.clientProfileRepo.save(profile);
  }

  // Helper: Determine section status based on items
  // private calculateSectionStatus(items: any[]): any {
  //   if (!items || items.length === 0) return 'unverified';
  //   if (items.some((i) => i.status === 'rejected')) return 'rejected';
  //   if (items.some((i) => i.status === 'pending')) return 'pending';
  //   return 'approved';
  // }

  // =============================================
  // CAMPAIGN MANAGEMENT
  // =============================================

  /**
   * Get all campaigns with filtering, pagination, and aggregated data
   * Optimized: Selective field loading, efficient joins, single query for count+data
   */
  async getAllCampaigns(query: GetCampaignsQueryDto) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 10, 100); // Cap at 100 for performance
    const { status, clientId, search, startDateFrom, startDateTo } = query;

    // Build optimized query with selective fields
    const queryBuilder = this.campaignRepo
      .createQueryBuilder('campaign')
      .select([
        'campaign.id',
        'campaign.campaignName',
        'campaign.campaignType',
        'campaign.campaignNiche',
        'campaign.startingDate',
        'campaign.duration',
        'campaign.baseBudget',
        'campaign.totalBudget',
        'campaign.status',
        'campaign.clientId',
        'campaign.createdAt',
        'campaign.updatedAt',
      ])
      .leftJoin('campaign.client', 'client')
      .addSelect([
        'client.id',
        'client.brandName',
        'client.firstName',
        'client.lastName',
      ])
      .leftJoin('campaign.assignments', 'assignments')
      .addSelect([
        'assignments.id',
        'assignments.influencerId',
        'assignments.status',
      ])
      .leftJoin('assignments.influencer', 'influencer')
      .addSelect([
        'influencer.id',
        'influencer.firstName',
        'influencer.lastName',
      ]);

    // Apply filters using parameter binding for security
    if (status) {
      queryBuilder.andWhere('campaign.status = :status', { status });
    }

    if (clientId) {
      queryBuilder.andWhere('campaign.clientId = :clientId', { clientId });
    }

    if (search?.trim()) {
      queryBuilder.andWhere('campaign.campaignName ILIKE :search', {
        search: `%${search.trim()}%`,
      });
    }

    if (startDateFrom) {
      queryBuilder.andWhere('campaign.startingDate >= :startDateFrom', {
        startDateFrom,
      });
    }

    if (startDateTo) {
      queryBuilder.andWhere('campaign.startingDate <= :startDateTo', {
        startDateTo,
      });
    }

    // Order and pagination
    queryBuilder
      .orderBy('campaign.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    // Execute query with count in parallel
    const [campaigns, total] = await queryBuilder.getManyAndCount();

    // Transform to response format using helper
    const data: AdminCampaignListItem[] = campaigns.map((campaign) =>
      this.transformCampaignToListItem(campaign),
    );

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Helper: Transform campaign entity to list item response
   */
  private transformCampaignToListItem(
    campaign: CampaignEntity,
  ): AdminCampaignListItem {
    // Calculate end date
    const endDate =
      campaign.startingDate && campaign.duration
        ? new Date(
            new Date(campaign.startingDate).getTime() +
              campaign.duration * 24 * 60 * 60 * 1000,
          )
        : null;

    // Map assigned influencers
    const influencers = (campaign.assignments || []).map((a) => ({
      id: a.influencer?.id || a.influencerId,
      name: a.influencer
        ? `${a.influencer.firstName || ''} ${a.influencer.lastName || ''}`.trim() ||
          'Unknown'
        : 'Unknown',
      status: a.status,
    }));

    return {
      id: campaign.id,
      campaignName: campaign.campaignName,
      campaignType: campaign.campaignType,
      campaignNiche: campaign.campaignNiche,
      client: {
        id: campaign.client?.id || campaign.clientId,
        brandName: campaign.client?.brandName || 'N/A',
        fullName: campaign.client
          ? `${campaign.client.firstName || ''} ${campaign.client.lastName || ''}`.trim() ||
            'N/A'
          : 'N/A',
      },
      timeline: {
        startingDate: campaign.startingDate,
        endDate,
        duration: campaign.duration,
      },
      financials: {
        clientBudget: campaign.baseBudget ? +campaign.baseBudget : null,
        finalQuoteAmount: campaign.totalBudget ? +campaign.totalBudget : null,
      },
      assignedPersonals: {
        count: influencers.length,
        influencers,
      },
      status: campaign.status,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
    };
  }

  /**
   * Get single campaign details by ID
   * Optimized: Query builder with selective fields for better performance
   */
  async getCampaignById(campaignId: string) {
    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(campaignId)) {
      throw new NotFoundException('Invalid campaign ID format');
    }

    const campaign = await this.campaignRepo
      .createQueryBuilder('campaign')
      .leftJoinAndSelect('campaign.client', 'client')
      .leftJoinAndSelect('campaign.assignments', 'assignments')
      .leftJoinAndSelect('assignments.influencer', 'influencer')
      .leftJoinAndSelect('campaign.milestones', 'milestones')
      .leftJoinAndSelect('campaign.assets', 'assets')
      .leftJoinAndSelect('campaign.negotiations', 'negotiations')
      .leftJoinAndSelect(
        'campaign.preferredInfluencers',
        'preferredInfluencers',
      )
      .leftJoinAndSelect(
        'campaign.notPreferableInfluencers',
        'notPreferableInfluencers',
      )
      .where('campaign.id = :campaignId', { campaignId })
      .getOne();

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    // Calculate end date efficiently
    const endDate =
      campaign.startingDate && campaign.duration
        ? new Date(
            new Date(campaign.startingDate).getTime() +
              campaign.duration * 24 * 60 * 60 * 1000,
          )
        : null;

    // Map assigned influencers with full details
    const assignedInfluencers = (campaign.assignments || []).map((a) => ({
      id: a.influencer?.id || a.influencerId,
      name: a.influencer
        ? `${a.influencer.firstName || ''} ${a.influencer.lastName || ''}`.trim() ||
          'Unknown'
        : 'Unknown',
      status: a.status,
      offeredAmount: a.offeredAmount ? +a.offeredAmount : null,
      message: a.message,
      acceptedAt: a.acceptedAt,
      startedAt: a.startedAt,
      completedAt: a.completedAt,
    }));

    return {
      id: campaign.id,
      // Campaign Info
      campaignName: campaign.campaignName,
      campaignType: campaign.campaignType,
      campaignNiche: campaign.campaignNiche,
      productType: campaign.productType,
      campaignGoals: campaign.campaignGoals,
      productServiceDetails: campaign.productServiceDetails,
      reportingRequirements: campaign.reportingRequirements,
      usageRights: campaign.usageRights,
      needSampleProduct: campaign.needSampleProduct,
      // Client Info
      client: {
        id: campaign.client?.id || campaign.clientId,
        brandName: campaign.client?.brandName || 'N/A',
        fullName: campaign.client
          ? `${campaign.client.firstName || ''} ${campaign.client.lastName || ''}`.trim()
          : 'N/A',
        email: campaign.client?.email,
        phone: campaign.client?.phone,
      },
      // Timeline
      timeline: {
        startingDate: campaign.startingDate,
        endDate,
        duration: campaign.duration,
      },
      // Financials
      financials: {
        clientBudget: campaign.baseBudget ? Number(campaign.baseBudget) : null,
        vatAmount: campaign.vatAmount ? Number(campaign.vatAmount) : null,
        totalBudget: campaign.totalBudget ? Number(campaign.totalBudget) : null,
        netPayableAmount: campaign.netPayableAmount
          ? Number(campaign.netPayableAmount)
          : null,
      },
      // Assigned Personals
      assignedPersonals: {
        count: assignedInfluencers.length,
        influencers: assignedInfluencers,
      },
      // Milestones
      milestones: campaign.milestones || [],
      // Assets
      assets: campaign.assets || [],
      // Negotiations
      negotiations: campaign.negotiations || [],
      negotiationTurn: campaign.negotiationTurn,
      // Preferred Influencers
      preferredInfluencers: (campaign.preferredInfluencers || []).map(
        (inf) => ({
          id: inf.id,
          name: `${inf.firstName || ''} ${inf.lastName || ''}`.trim(),
        }),
      ),
      // Not Preferable Influencers
      notPreferableInfluencers: (campaign.notPreferableInfluencers || []).map(
        (inf) => ({
          id: inf.id,
          name: `${inf.firstName || ''} ${inf.lastName || ''}`.trim(),
        }),
      ),
      // Status & Meta
      status: campaign.status,
      currentStep: campaign.currentStep,
      isPlaced: campaign.isPlaced,
      placedAt: campaign.placedAt,
      assignedAdminId: campaign.assignedAdminId,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
    };
  }

  /**
   * Get campaign statistics for admin dashboard
   * Optimized: Parallel queries and efficient aggregation
   */
  async getCampaignStats() {
    // Run all queries in parallel for better performance
    const [totalCampaigns, statusCounts, assignmentStats] = await Promise.all([
      // Total count
      this.campaignRepo.count(),

      // Status breakdown
      this.campaignRepo
        .createQueryBuilder('campaign')
        .select('campaign.status', 'status')
        .addSelect('COUNT(*)::int', 'count')
        .groupBy('campaign.status')
        .getRawMany(),

      // Assignment stats - optimized single query
      this.campaignRepo
        .createQueryBuilder('campaign')
        .leftJoin('campaign.assignments', 'assignments')
        .select('COUNT(DISTINCT campaign.id)::int', 'totalCampaigns')
        .addSelect(
          'COUNT(DISTINCT CASE WHEN assignments.id IS NOT NULL THEN campaign.id END)::int',
          'withAssignments',
        )
        .getRawOne(),
    ]);

    // Transform status counts to map
    const byStatus: Record<string, number> = {};
    for (const item of statusCounts) {
      byStatus[item.status] = item.count;
    }

    const withAssignments = assignmentStats?.withAssignments || 0;
    const withoutAssignments = totalCampaigns - withAssignments;

    return {
      total: totalCampaigns,
      byStatus,
      withAssignments,
      withoutAssignments,
    };
  }

  // ==========================================
  // GENERAL SETTINGS (Fees)
  // ==========================================

  async getSystemSettings() {
    // Get the first row, or create default if not exists
    let settings = await this.settingsRepo.findOne({ where: {} });
    if (!settings) {
      settings = this.settingsRepo.create({ platformFee: 0, vatTax: 0 });
      await this.settingsRepo.save(settings);
    }
    return { platformFee: settings.platformFee, vatTax: settings.vatTax };
  }

  async updateSystemFees(dto: UpdateFeesDto) {
    let settings = await this.settingsRepo.findOne({ where: {} });
    if (!settings) settings = this.settingsRepo.create();

    if (dto.platformFee !== undefined) settings.platformFee = dto.platformFee;
    if (dto.vatTax !== undefined) settings.vatTax = dto.vatTax;

    await this.settingsRepo.save(settings);
    return { success: true, message: 'Fees updated successfully' };
  }

  // ==========================================
  // MASTER DATA (Niches, Skills, Products)
  // ==========================================

  async getMasterDataList(type: MasterDataType) {
    // Minimal response: just id and name
    const list = await this.masterDataRepo.find({
      where: { type },
      select: ['id', 'name'],
      order: { name: 'ASC' },
    });
    return list;
  }

  async addMasterData(dto: AddMasterDataDto) {
    // Check duplicate
    const exists = await this.masterDataRepo.findOne({
      where: { type: dto.type, name: dto.name },
    });
    if (exists)
      throw new BadRequestException(
        `${dto.name} already exists in ${dto.type} list`,
      );

    const item = this.masterDataRepo.create(dto);
    const saved = await this.masterDataRepo.save(item);

    return { success: true, id: saved.id, message: 'Item added' };
  }

  async deleteMasterData(id: string) {
    const result = await this.masterDataRepo.delete(id);
    if (result.affected === 0) throw new NotFoundException('Item not found');
    return { success: true, message: 'Item deleted' };
  }

  // ==========================================
  // SECURITY & LOGS
  // ==========================================

  // Helper to extract log info
  private getLogDetails(req: Request) {
    // 1. Get IP
    const clientIp = requestIp.getClientIp(req) || '127.0.0.1';

    // 2. Parse User Agent (Device/Browser)
    const ua = UAParser(req.headers['user-agent']);
    const browser =
      `${ua.browser.name || 'Unknown'} ${ua.browser.version || ''}`.trim();
    const device = `${ua.os.name || 'Unknown'} ${ua.os.version || ''} - ${ua.device.type || 'Desktop'}`;

    // 3. Get Location from IP
    const geo = geoip.lookup(clientIp);
    const location = geo ? `${geo.city}, ${geo.country}` : 'Unknown Location';

    return { clientIp, browser, device, location };
  }

  async changeAdminPassword(
    userId: string,
    dto: ChangePasswordDto,
    req: Request,
  ) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'password', 'email', 'role'],
    });
    if (!user) throw new NotFoundException('User not found');

    // 1. Verify Old Password
    const isMatch = await bcrypt.compare(dto.oldPassword, user.password);
    if (!isMatch) throw new UnauthorizedException('Incorrect old password');

    // 2. Hash New Password
    const salt = await bcrypt.genSalt();
    user.password = await bcrypt.hash(dto.newPassword, salt);
    await this.userRepo.save(user);

    // Get Real Data
    const { clientIp, browser, device, location } = this.getLogDetails(req);

    // 3. Log the event with REAL data
    await this.loginLogRepo.save({
      user,
      status: 'password_changed',
      device: device, // e.g. "Windows 10 - Desktop"
      browser: browser, // e.g. "Chrome 120.0"
      location: location, // e.g. "Dhaka, BD"
      ip: clientIp,
    });

    return { success: true, message: 'Password updated successfully' };
  }

  async getLoginLogs(userId: string, page = 1, limit = 10) {
    // Fetch logs for the specific admin
    const [logs, total] = await this.loginLogRepo.findAndCount({
      where: { user: { id: userId } },
      order: { timestamp: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
      select: [
        'id',
        'device',
        'browser',
        'location',
        'ip',
        'status',
        'timestamp',
      ],
    });

    return {
      data: logs,
      meta: { total, page, limit },
    };
  }

  // =============================================
  // BROWSE INFLUENCERS (List/Grid View)
  // =============================================
  async getAllInfluencers(dto: GetInfluencersDto) {
    const { page, limit, search, status } = dto;
    const query = this.influencerRepo
      .createQueryBuilder('profile')
      .leftJoinAndSelect('profile.user', 'user')
      .orderBy('profile.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    // 1. Filter by Search (Name)
    if (search) {
      query.andWhere(
        '(LOWER(profile.firstName) LIKE :search OR LOWER(profile.lastName) LIKE :search)',
        { search: `%${search.toLowerCase()}%` },
      );
    }

    // 2. Filter by Status
    if (status === UserStatusFilter.BLOCKED) {
      query.andWhere('user.isBlocked = :isBlocked', { isBlocked: true });
    } else if (status === UserStatusFilter.ACTIVE) {
      query.andWhere('user.isBlocked = :isBlocked', { isBlocked: false });
    }

    const [profiles, total] = await query.getManyAndCount();

    const profileIds = profiles.map((p) => p.id);
    let statsMap = {};

    if (profileIds.length > 0) {
      const statsRaw = await this.campaignAssignmentRepo
        .createQueryBuilder('assign')
        .select('assign.influencerId', 'influencerId')
        .addSelect(
          `COUNT(CASE WHEN assign.status IN ('active', 'pending_invitation', 'needs_quote') THEN 1 END)`,
          'activeJob',
        )
        .addSelect(
          `COUNT(CASE WHEN assign.status = 'completed' THEN 1 END)`,
          'jobDone',
        )
        .addSelect(
          `SUM(CASE WHEN assign.status IN ('completed', 'paid') THEN assign.offeredAmount ELSE 0 END)`,
          'revenue',
        )
        .where('assign.influencerId IN (:...ids)', { ids: profileIds })
        .groupBy('assign.influencerId')
        .getRawMany();

      // Convert array to map for O(1) lookup
      statsMap = statsRaw.reduce((acc, curr) => {
        acc[curr.influencerId] = {
          activeJob: Number(curr.activeJob),
          jobDone: Number(curr.jobDone),
          revenue: Number(curr.revenue),
        };
        return acc;
      }, {});
    }

    // 3. Map to Response
    const data = profiles.map((p) => {
      // Logic to derive platforms from socialLinks
      const platforms =
        p.socialLinks?.map((link) => {
          if (link.url.includes('instagram')) return 'Instagram';
          if (link.url.includes('youtube')) return 'YouTube';
          if (link.url.includes('tiktok')) return 'TikTok';
          return 'Web';
        }) || [];

      const stats = statsMap[p.id] || { activeJob: 0, jobDone: 0, revenue: 0 };

      return {
        userId: p.userId,
        name: `${p.firstName} ${p.lastName}`,
        avatar: p.profileImg || null,
        niches: p.niches?.map((n) => n.niche) || [],
        rating: 0, // NOTE: Rating entity not found in codebase. Defaulting to 0.
        platforms: [...new Set(platforms)],
        stats: {
          activeJob: stats.activeJob,
          jobDone: stats.jobDone,
          revenue: stats.revenue,
        },
        status: p.user.isBlocked ? 'Blocked' : 'Approved',
        isVerified: p.user.isVerified,
      };
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Get SINGLE INFLUENCER DETAILS
  async getInfluencerFullDetails(userId: string) {
    const profile = await this.influencerRepo.findOne({
      where: { userId },
      relations: ['user'],
    });

    if (!profile) throw new NotFoundException('Influencer not found');

    // --- REAL DATA: Fetch Aggregated Stats ---
    const stats = await this.campaignAssignmentRepo
      .createQueryBuilder('assignment')
      .select([
        `COUNT(CASE WHEN assignment.status = 'completed' THEN 1 END) as "totalJobDone"`,
        `COUNT(CASE WHEN assignment.status IN ('active', 'pending_invitation', 'needs_quote') THEN 1 END) as "activeJob"`,
        `SUM(CASE WHEN assignment.status IN ('completed', 'paid') THEN assignment.offeredAmount ELSE 0 END) as "totalRevenue"`,
      ])
      .where('assignment.influencerId = :influencerId', {
        influencerId: profile.id,
      })
      .getRawOne();

    // Calculate Completion Score
    let completionScore = 20; // Base score
    if (profile.niches?.length) completionScore += 10;
    if (profile.skills?.length) completionScore += 10;
    if (profile.socialLinks?.length) completionScore += 10;
    if (profile.nidVerification?.nidStatus === 'approved')
      completionScore += 20;
    if (profile.payouts?.bank?.length || profile.payouts?.mobileBanking?.length)
      completionScore += 10;
    if (profile.profileImg) completionScore += 10;
    if (profile.bio) completionScore += 10;

    return {
      header: {
        userId: profile.userId,
        name: `${profile.firstName} ${profile.lastName}`,
        handle: `@${profile.firstName.toLowerCase().replace(/\s/g, '')}`,
        avatar: profile.profileImg,
        isVerified: profile.user.isVerified,
        socials: profile.socialLinks,
      },
      stats: {
        totalRevenue: stats.totalRevenue ? Number(stats.totalRevenue) : 0,
        totalJobDone: Number(stats.totalJobDone),
        activeJob: Number(stats.activeJob),
      },
      profileCompletion: Math.min(completionScore, 100),
      bio: profile.bio,
      niches: profile.niches,
      skills: profile.skills,
      payoutSettings: profile.payouts,
      personalDetails: {
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.user.email,
        phone: profile.user.phone,
      },
      nidInfo: profile.nidVerification,
      deliveryLocations: profile.addresses,
      isBlocked: profile.user.isBlocked || false,
    };
  }

  // INFLUENCER CAMPAIGNS (Tab View)
  async getInfluencerCampaigns(userId: string, statusFilter?: string) {
    // 1. Get Profile ID
    const profile = await this.influencerRepo.findOne({
      where: { userId },
      select: ['id'],
    });
    if (!profile) throw new NotFoundException('Influencer not found');

    // 2. Build Query
    const queryBuilder = this.campaignAssignmentRepo
      .createQueryBuilder('assign')
      .leftJoinAndSelect('assign.campaign', 'campaign')
      .leftJoinAndSelect('campaign.client', 'client') // Client details
      .where('assign.influencerId = :influencerId', {
        influencerId: profile.id,
      })
      .select([
        'assign.id',
        'assign.status',
        'assign.offeredAmount',
        'campaign.id',
        'campaign.campaignName',
        'campaign.campaignType',
        'campaign.startingDate',
        'campaign.duration',
        'campaign.baseBudget',
        'client.brandName',
        'client.profileImage',
      ])
      .orderBy('campaign.createdAt', 'DESC');

    // 3. Apply Status Filter
    if (statusFilter && statusFilter !== 'All') {
      // Map UI status to DB status if needed, or pass directly
      queryBuilder.andWhere('assign.status = :status', {
        status: statusFilter.toLowerCase(),
      });
    }

    const assignments = await queryBuilder.getMany();

    // 4. Map to UI format
    return assignments.map((a) => {
      const campaign = a.campaign;
      const endDate =
        campaign.startingDate && campaign.duration
          ? new Date(
              new Date(campaign.startingDate).getTime() +
                campaign.duration * 86400000,
            )
          : null;

      return {
        id: campaign.id,
        name: campaign.campaignName,
        type: campaign.campaignType,
        client: {
          name: campaign.client?.brandName || 'Unknown',
          avatar: campaign.client?.profileImg || null,
        },
        timeline: {
          start: campaign.startingDate,
          end: endDate,
        },
        financials: {
          budget: Number(campaign.baseBudget),
          finalQuote: a.offeredAmount ? Number(a.offeredAmount) : 0,
        },
        status: a.status, // e.g. 'active', 'completed'
      };
    });
  }

  // BLOCK / UNBLOCK (Danger Zone)
  async toggleBlockStatus(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Toggle status
    user.isBlocked = !user.isBlocked;
    // Assuming you have 'isBlocked' column in UserEntity.
    // If not, add: @Column({ default: false }) isBlocked: boolean;

    await this.userRepo.save(user);

    return {
      success: true,
      message: user.isBlocked
        ? 'User has been blocked'
        : 'User has been unblocked',
      isBlocked: user.isBlocked,
    };
  }

  // =============================================
  // 🏢 AGENCY VERIFICATION LOGIC
  // =============================================

  // Helper: Count Agency Pending Items
  private countAgencyPendingItems(profile: AgencyProfileEntity): number {
    let count = 0;
    if (profile.nidVerification?.nidStatus === ApprovalStatus.PENDING) count++;
    if (profile.tradeLicenseStatus === ApprovalStatus.PENDING) count++;
    if (profile.tinStatus === ApprovalStatus.PENDING) count++;
    if (profile.binStatus === ApprovalStatus.PENDING) count++;
    if (profile.niches)
      count += profile.niches.filter(
        (n) => n.status === ApprovalStatus.PENDING,
      ).length;

    if (profile.socialLinks) {
      count += profile.socialLinks.filter(
        (s) => s.status === ApprovalStatus.PENDING,
      ).length;
    }

    if (profile.payouts?.bank) {
      count += profile.payouts.bank.filter(
        (b) => b.accStatus === ApprovalStatus.PENDING,
      ).length;
    }

    if (profile.payouts?.mobileBanking) {
      count += profile.payouts.mobileBanking.filter(
        (m) => m.accStatus === ApprovalStatus.PENDING,
      ).length;
    }

    return count;
  }

  // Helper: Check and Toggle Verification Status
  private async checkAndToggleAgencyVerification(profile: AgencyProfileEntity) {
    const isListApproved = (list: any[]) =>
      Array.isArray(list) &&
      list.length > 0 &&
      list.every((i) => i.status === ApprovalStatus.APPROVED);

    // 1. Check Docs
    const nidOk =
      profile.nidVerification?.nidStatus === ApprovalStatus.APPROVED;
    const tradeLicenseOk =
      profile.tradeLicenseStatus === ApprovalStatus.APPROVED;
    const tinOk = profile.tinStatus === ApprovalStatus.APPROVED;
    const socialOk = isListApproved(profile.socialLinks);

    // 2. Check Payment (At least one)
    const bankOk = profile.payouts?.bank?.some(
      (b) => b.accStatus === ApprovalStatus.APPROVED,
    );
    const mobileOk = profile.payouts?.mobileBanking?.some(
      (m) => m.accStatus === ApprovalStatus.APPROVED,
    );
    const paymentOk = bankOk || mobileOk;

    // 3. Final Decision (All Docs + At least 1 Payment + Socials)
    const isFullyVerified =
      nidOk && tradeLicenseOk && tinOk && socialOk && paymentOk;

    if (profile.user.isVerified !== isFullyVerified) {
      await this.userRepo.update(profile.user.id, {
        isVerified: isFullyVerified,
      });

      if (isFullyVerified) {
        await this.notificationService.createNotification(
          profile.user.id,
          UserRole.AGENCY,
          'Agency Verified',
          'Your agency profile has been fully verified.',
          'system',
        );
      }
    }
  }

  // 1. List Agencies for Verification
  async getAgencyProfiles(page = 1, limit = 10) {
    const [agencies, total] = await this.agencyProfileRepo.findAndCount({
      take: limit,
      skip: (page - 1) * limit,
      relations: ['user'],
      order: { updatedAt: 'DESC' },
    });

    // Map to minimal response
    const data = agencies.map((p) => {
      const pendingCount = this.countAgencyPendingItems(p);
      return {
        userId: p.userId,
        agencyName: p.agencyName, // Agency Name is main identifier
        niches: p.niches?.map((n) => n.niche) || [],
        isVerified: p.user.isVerified,
        pendingItemsCount: pendingCount,
      };
    });

    return { data, meta: { total, page, limit } };
  }

  async getAllAgencies(dto: GetAgenciesDto) {
    return await this.agencyService.getAllAgencies(dto);
  }

  // 2. Get Single Agency Details (Full Entity for Admin View)
  async getAgencyProfileDetails(userId: string) {
    const profile = await this.agencyProfileRepo.findOne({
      where: { userId },
      relations: ['user'],
    });
    if (!profile) throw new NotFoundException('Agency profile not found');
    return profile;
  }

  async updateAgencyNicheStatus(userId: string, dto: UpdateItemStatusDto) {
    const profile = await this.getAgencyProfileDetails(userId);

    let isFound = false; // 1. Track if we found the item

    if (profile.niches) {
      profile.niches = profile.niches.map((n) => {
        if (n.niche === dto.identifier) {
          isFound = true; // Found it!
          return {
            ...n,
            status: dto.status,
            rejectReason:
              dto.status === ApprovalStatus.REJECTED
                ? dto.rejectReason
                : undefined,
          };
        }
        return n;
      });
    }

    // 2. Throw error if not found
    if (!isFound) {
      throw new NotFoundException(
        `Niche '${dto.identifier}' not found in user profile`,
      );
    }

    // 3. Use agencyProfileRepo, NOT profileRepo
    await this.agencyProfileRepo.save(profile);

    await this.notifyUser(
      userId,
      `Niche (${dto.identifier})`,
      dto.status,
      dto.rejectReason,
    );
    await this.checkAndToggleAgencyVerification(profile);

    return { success: true, message: `Niche ${dto.status}` };
  }

  // 3. Approve/Reject NID
  async updateAgencyNid(userId: string, dto: UpdateAgencyNidStatusDto) {
    const profile = await this.getAgencyProfileDetails(userId);

    if (!profile.nidVerification) {
      profile.nidVerification = { nidStatus: 'pending', nidRejectReason: '' };
    }

    profile.nidVerification.nidStatus = dto.nidStatus;
    profile.nidVerification.nidRejectReason =
      dto.nidStatus === ApprovalStatus.REJECTED ? dto.rejectReason || '' : '';

    await this.agencyProfileRepo.save(profile);
    await this.notifyUser(userId, 'NID', dto.nidStatus, dto.rejectReason);
    await this.checkAndToggleAgencyVerification(profile);

    return { success: true, message: `Agency NID ${dto.nidStatus}` };
  }

  // 4. Approve/Reject Trade License
  async updateAgencyTradeLicense(
    userId: string,
    dto: UpdateAgencyTradeLicenseStatusDto,
  ) {
    const profile = await this.getAgencyProfileDetails(userId);

    profile.tradeLicenseStatus = dto.tradeLicenseStatus;
    // If you add a rejectReason field to entity later, handle it here

    await this.agencyProfileRepo.save(profile);
    await this.notifyUser(
      userId,
      'Trade License',
      dto.tradeLicenseStatus,
      dto.rejectReason,
    );
    await this.checkAndToggleAgencyVerification(profile);

    return {
      success: true,
      message: `Trade License ${dto.tradeLicenseStatus}`,
    };
  }

  // 5. Approve/Reject TIN
  async updateAgencyTin(userId: string, dto: UpdateAgencyTinStatusDto) {
    const profile = await this.getAgencyProfileDetails(userId);

    profile.tinStatus = dto.tinStatus;

    await this.agencyProfileRepo.save(profile);
    await this.notifyUser(
      userId,
      'TIN Certificate',
      dto.tinStatus,
      dto.rejectReason,
    );
    await this.checkAndToggleAgencyVerification(profile);

    return { success: true, message: `TIN Certificate ${dto.tinStatus}` };
  }

  // 6. Approve/Reject Social Links
  async updateAgencySocial(userId: string, dto: UpdateItemStatusDto) {
    const profile = await this.getAgencyProfileDetails(userId);

    let isFound = false;

    if (profile.socialLinks) {
      profile.socialLinks = profile.socialLinks.map((s) => {
        if (s.url === dto.identifier) {
          isFound = true;
          return {
            ...s,
            status: dto.status,
            rejectReason:
              dto.status === ApprovalStatus.REJECTED
                ? dto.rejectReason
                : undefined,
          };
        }
        return s;
      });
    }

    if (!isFound) {
      throw new NotFoundException(`Social link '${dto.identifier}' not found`);
    }

    await this.agencyProfileRepo.save(profile);
    await this.checkAndToggleAgencyVerification(profile);

    return { success: true, message: `Social Link ${dto.status}` };
  }

  // 7. Approve/Reject Payout (Bank/Mobile)
  async updateAgencyPayout(
    userId: string,
    dto: UpdatePayoutStatusDto,
    type: 'bank' | 'mobile',
  ) {
    const profile = await this.getAgencyProfileDetails(userId);
    let isFound = false;

    if (type === 'bank' && profile.payouts?.bank) {
      profile.payouts.bank = profile.payouts.bank.map((acc) => {
        if (acc.bankAccNo === dto.accountNo) {
          isFound = true;
          return {
            ...acc,
            accStatus: dto.status,
            accRejectReason:
              dto.status === ApprovalStatus.REJECTED
                ? dto.rejectReason
                : undefined,
          };
        }
        return acc;
      });
    } else if (type === 'mobile' && profile.payouts?.mobileBanking) {
      profile.payouts.mobileBanking = profile.payouts.mobileBanking.map(
        (acc) => {
          if (acc.accountNo === dto.accountNo) {
            isFound = true;
            return {
              ...acc,
              accStatus: dto.status,
              accRejectReason:
                dto.status === ApprovalStatus.REJECTED
                  ? dto.rejectReason
                  : undefined,
            };
          }
          return acc;
        },
      );
    }

    if (!isFound) {
      throw new NotFoundException(
        `Payout account '${dto.accountNo}' not found`,
      );
    }

    await this.agencyProfileRepo.save(profile);
    await this.checkAndToggleAgencyVerification(profile);

    return { success: true, message: `Agency Payout ${dto.status}` };
  }

  // ==================================================================
  // ADMIN REPORT API (All Reports with User Filter)
  // ==================================================================
  async getAdminReports(dto: AdminReportFilterDto) {
    const { page = 1, limit = 10, search, status, userType } = dto;
    const skip = (page - 1) * limit;

    const query = this.submissionRepo
      .createQueryBuilder('submission')
      .leftJoinAndSelect('submission.milestone', 'milestone')
      .leftJoinAndSelect('milestone.campaign', 'campaign')
      .leftJoinAndSelect('campaign.client', 'client')
      .leftJoinAndSelect('campaign.assignedAgencies', 'agency');
    if (search) {
      query.andWhere('campaign.campaignName ILIKE :search', {
        search: `%${search}%`,
      });
    }

    if (status) {
      if (status === 'Resolved') {
        query.andWhere('submission.status IN (:...statuses)', {
          statuses: ['approved', 'paid'],
        });
      } else {
        query.andWhere('submission.status NOT IN (:...statuses)', {
          statuses: ['approved', 'paid'],
        });
      }
    }

    if (userType === 'AGENCY') {
      query.andWhere('campaign.selectedAgencyId IS NOT NULL');
    }
    // Client is always present in campaign, so no explicit filter needed unless searching by client name.

    const [submissions, total] = await query
      .orderBy('submission.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const formattedReports = submissions.map((sub) => {
      const agencyName =
        sub.milestone.campaign.assignedAgencies?.find(
          (a) => a.id === sub.milestone.campaign.selectedAgencyId,
        )?.agencyName || 'Unknown Agency';

      return {
        reportId: sub.id,
        campaignName: sub.milestone.campaign.campaignName,
        status: ['approved', 'paid'].includes(sub.status)
          ? 'Resolved'
          : 'Pending',

        relatedEntity:
          userType === 'CLIENT'
            ? { type: 'Client', name: sub.milestone.campaign.client?.brandName }
            : { type: 'Agency', name: agencyName },

        milestone: sub.milestone.contentTitle,
      };
    });

    return {
      success: true,
      data: formattedReports,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ==================================================================
  // ADMIN FINANCE: Payouts & Transactions
  // ==================================================================

  async getFinanceData(dto: FinanceFilterDto) {
    const {
      page = 1,
      limit = 10,
      search,
      tab,
      status,
      dateFrom,
      dateTo,
      amountSort,
    } = dto;
    const skip = (page - 1) * limit;

    let query;

    // ---------------------------------------------------------
    // A. Query Selection Based on Tab (Client vs Agency)
    // ---------------------------------------------------------
    if (tab === PayoutType.CLIENT) {
      query = this.campaignRepo
        .createQueryBuilder('c')
        .leftJoin('c.client', 'userProfile')
        .leftJoin('userProfile.user', 'user')

        // ✅ FIX: Use .select() instead of .addSelect() for the first selection
        // This prevents duplicate 'c.id' selection error
        .select([
          'c.id',
          'c.campaignName',
          'c.totalBudget',
          'c.paidAmount',
          'c.dueAmount',
          'c.createdAt',
          'c.updatedAt',
          'c.paymentStatus',
        ])

        // ✅ Continue using .addSelect() for joined tables
        .addSelect([
          'userProfile.brandName',
          'userProfile.firstName',
          'userProfile.lastName',
          'userProfile.userId',
        ])

        .addSelect(['user.email', 'user.phone']);

      // Status Filters
      if (status) {
        if (status === PaymentStatus.FULL)
          query.andWhere('c.paymentStatus = :ps', { ps: 'full' });
        else if (status === PaymentStatus.PARTIAL)
          query.andWhere('c.paymentStatus = :ps', { ps: 'partial' });
        else if (status === PaymentStatus.PENDING)
          query.andWhere('c.dueAmount > 0');
      }
    } else {
      // -------------------------------------------------------
      // Agency/Influencer Payouts
      // -------------------------------------------------------
      query = this.submissionRepo
        .createQueryBuilder('sub')
        .leftJoinAndSelect('sub.milestone', 'milestone')
        .leftJoinAndSelect('milestone.campaign', 'campaign')
        .leftJoinAndSelect('campaign.assignedAgencies', 'agency')
        .where('sub.paidAmount > 0 OR sub.requestedAmount > 0');

      if (status) {
        if (status === PaymentStatus.COMPLETED)
          query.andWhere('sub.paymentStatus = :ps', { ps: 'paid' });
        else if (status === PaymentStatus.PENDING)
          query.andWhere('sub.paymentStatus != :ps', { ps: 'paid' });
      }
    }

    // ---------------------------------------------------------
    // B. Global Filters (Search, Date, Sort)
    // ---------------------------------------------------------
    if (search) {
      const searchTerm = `%${search}%`;
      if (tab === PayoutType.CLIENT) {
        query.andWhere(
          '(c.campaignName ILIKE :s OR userProfile.brandName ILIKE :s OR userProfile.firstName ILIKE :s OR userProfile.lastName ILIKE :s OR user.email ILIKE :s OR user.phone ILIKE :s)',
          { s: searchTerm },
        );
      } else {
        // Agency Search
        query.andWhere(
          '(campaign.campaignName ILIKE :s OR agency.agencyName ILIKE :s OR agency.firstName ILIKE :s)',
          { s: searchTerm },
        );
      }
    }

    if (dateFrom && dateTo) {
      const dateColumn =
        tab === PayoutType.CLIENT ? 'c.updatedAt' : 'sub.updatedAt';
      query.andWhere(`${dateColumn} BETWEEN :from AND :to`, {
        from: dateFrom,
        to: dateTo,
      });
    }

    if (amountSort) {
      const amountCol =
        tab === PayoutType.CLIENT ? 'c.totalBudget' : 'sub.requestedAmount';
      query.orderBy(amountCol, amountSort === 'low_to_high' ? 'ASC' : 'DESC');
    } else {
      const dateCol =
        tab === PayoutType.CLIENT ? 'c.updatedAt' : 'sub.updatedAt';
      query.orderBy(dateCol, 'DESC');
    }

    const [results, total] = await query
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    // ---------------------------------------------------------
    // C. Data Formatting
    // ---------------------------------------------------------
    const formattedData = results.map((item) => {
      if (tab === PayoutType.CLIENT) {
        // Client Payout Logic
        const clientName = item.client?.brandName
          ? item.client.brandName
          : `${item.client?.firstName} ${item.client?.lastName}`;

        return {
          id: item.id,
          transactionType: 'Income (Client Payment)',
          entityName: clientName, // ✅ Brand Name or Full Name
          contact: item.client?.user?.email || item.client?.user?.phone,
          campaign: item.campaignName,
          amountTotal: item.totalBudget,
          amountPaid: item.paidAmount,
          amountDue: item.dueAmount,
          status: item.dueAmount > 0 ? 'Pending Clearance' : 'Completed',
          date: item.updatedAt,
          canNotify: Number(item.dueAmount) > 0,
          clientId: item.client?.userId,
        };
      } else {
        // Agency Payout Logic
        const agency = item.milestone.campaign.assignedAgencies?.[0];
        const agencyName = agency?.firstName
          ? `${agency.firstName} ${agency.lastName}`
          : agency?.agencyName || 'Unknown Agency';

        return {
          id: item.id,
          transactionType: 'Expense (Agency Payout)',
          entityName: agencyName,
          campaign: item.milestone.campaign.campaignName,
          milestone: item.milestone.contentTitle,
          amountRequested: item.requestedAmount,
          amountPaid: item.paidAmount,
          status:
            item.paymentStatus === 'paid' ? 'Completed' : 'Pending Clearance',
          date: item.updatedAt,
        };
      }
    });

    return {
      success: true,
      data: formattedData,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ==================================================================
  // ADMIN NOTIFICATION: Notify Client for Due Payment
  // ==================================================================
  async notifyClientForDue(clientId: string, campaignId: string) {
    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const due = Number(campaign.dueAmount);
    if (due <= 0) throw new BadRequestException('No due amount to notify for.');

    // FCM Notification Logic
    const message = `Reminder: You have a due balance of ${due} for campaign "${campaign.campaignName}". Please clear it to avoid service interruption.`;

    // Assuming you have a NotificationService injected
    await this.notificationService.sendToUser(clientId, {
      title: 'Payment Reminder',
      body: message,
      data: { campaignId: campaign.id, type: 'payment_due' },
    });

    return {
      success: true,
      data: message,
      message: 'Notification sent successfully.',
    };
  }

  // ==================================================================
  // ADMIN ANALYTICS: Overview Charts
  // ==================================================================
  async getAdminAnalytics() {
    // 1. Total Income (Client Paid)
    const { income } = await this.campaignRepo
      .createQueryBuilder('c')
      .select('SUM(c.paidAmount)', 'income')
      .getRawOne();

    // 2. Total Expense (Agency Paid)
    const { expense } = await this.submissionRepo
      .createQueryBuilder('s')
      .select('SUM(s.paidAmount)', 'expense')
      .getRawOne();

    const profit = (Number(income) || 0) - (Number(expense) || 0);

    return {
      success: true,
      data: {
        totalIncome: income || 0,
        totalPayouts: expense || 0,
        netProfit: profit,
        // You can add monthly breakdown logic here if needed
      },
    };
  }

  // ==================================================================
  // ADMIN DASHBOARD: Action Required (Unified Task List)
  // ==================================================================
  async getActionRequired() {
    // 1. Pending Agencies (NID or Trade License)
    // JSONB কুয়েরি করার জন্য createQueryBuilder ব্যবহার করা হলো
    const pendingAgencies = await this.agencyRepo
      .createQueryBuilder('agency')
      .where("agency.nidVerification ->> 'nidStatus' = :status", {
        status: 'pending',
      })
      .orWhere('agency.tradeLicenseStatus = :status', { status: 'pending' })
      .select([
        'agency.id',
        'agency.agencyName',
        'agency.nidVerification',
        'agency.tradeLicenseStatus',
        'agency.updatedAt',
      ])
      .orderBy('agency.updatedAt', 'DESC')
      .take(5)
      .getMany();

    // 2. Pending Influencers (NID Verification)
    // (Assuming InfluencerProfileEntity is injected as this.influencerRepo)
    const pendingInfluencers = await this.influencerRepo
      .createQueryBuilder('inf')
      .where("inf.nidVerification ->> 'nidStatus' = :status", {
        status: 'pending',
      })
      .select([
        'inf.id',
        'inf.firstName',
        'inf.lastName',
        'inf.nidVerification',
        'inf.updatedAt',
      ])
      .orderBy('inf.updatedAt', 'DESC')
      .take(5)
      .getMany();

    // 3. New Campaign Requests
    const pendingCampaigns = await this.campaignRepo.find({
      where: { status: 'pending' },
      relations: ['client'],
      select: {
        id: true,
        campaignName: true, // ✅ FIX: Changed from title to campaignName
        totalBudget: true,
        createdAt: true,
        client: { brandName: true, firstName: true, lastName: true },
      },
      take: 5,
      order: { createdAt: 'DESC' },
    });

    // 4. Payout Requests
    const pendingPayouts = await this.submissionRepo.find({
      where: { status: 'client_approved' },
      relations: ['milestone'],
      select: {
        id: true,
        requestedAmount: true,
        createdAt: true, // ✅ FIX: Used createdAt instead of updatedAt
        milestone: { id: true, contentTitle: true },
      },
      take: 5,
      order: { createdAt: 'DESC' },
    });

    // --- Data Merging & Formatting ---

    // ✅ FIX: Defined type explicitly to avoid 'never' error
    const actions: {
      id: string;
      type: string;
      priority: string;
      title: string;
      description: string;
      date: Date;
      actionLink: string;
    }[] = [];

    // A. Format Agencies
    pendingAgencies.forEach((agency) => {
      // Check which document is pending
      const isNidPending = agency.nidVerification?.nidStatus === 'pending';
      const doc = isNidPending ? 'NID' : 'Trade License';

      actions.push({
        id: agency.id,
        type: 'verification',
        priority: 'High',
        title: `Verify ${doc} for ${agency.agencyName}`,
        description: `${agency.agencyName} submitted ${doc} for verification.`,
        date: agency.updatedAt,
        actionLink: `/admin/agency/${agency.id}/verify`,
      });
    });

    // B. Format Influencers
    pendingInfluencers.forEach((inf) => {
      const name = `${inf.firstName} ${inf.lastName}`;
      actions.push({
        id: inf.id,
        type: 'verification',
        priority: 'High',
        title: `Verify NID for ${name}`,
        description: `${name} submitted NID for verification.`,
        date: inf.updatedAt,
        actionLink: `/admin/influencer/${inf.id}/verify`,
      });
    });

    // C. Format Campaigns
    pendingCampaigns.forEach((camp) => {
      const clientName = camp.client?.brandName || 'Client';
      actions.push({
        id: camp.id,
        type: 'campaign_approval',
        priority: 'Medium',
        title: `Approve Campaign: ${camp.campaignName}`, // ✅ FIX: campaignName
        description: `New request from ${clientName} ($${camp.totalBudget})`,
        date: camp.createdAt,
        actionLink: `/admin/campaign/${camp.id}/review`,
      });
    });

    // D. Format Payouts
    pendingPayouts.forEach((sub) => {
      actions.push({
        id: sub.id,
        type: 'payout',
        priority: 'High',
        title: `Release Payment: ${sub.milestone.contentTitle}`,
        description: `Amount: $${sub.requestedAmount}. Approved by client.`,
        date: sub.createdAt, // ✅ FIX: createdAt
        actionLink: `/admin/payout/${sub.id}`,
      });
    });

    // --- Final Sorting (Newest First) ---
    return {
      success: true,
      data: actions.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    };
  }

  // ==================================================================
  // ADMIN DASHBOARD: Recent Activity
  // ==================================================================
  async getRecentActivity() {
    const limit = 5;

    const campaigns = await this.campaignRepo.find({
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['client'],
      select: {
        id: true,
        campaignName: true,
        createdAt: true,
        client: { brandName: true },
      },
    });

    const submissions = await this.submissionRepo.find({
      order: { createdAt: 'DESC' },
      take: limit,
      relations: [
        'milestone',
        'milestone.campaign',
        'milestone.campaign.assignedAgencies',
      ],
      select: {
        id: true,
        createdAt: true,
        milestone: { id: true, contentTitle: true },
      },
    });

    const activities = [
      ...campaigns.map((c) => ({
        type: 'campaign',
        title: 'New Campaign Created',
        description: `"${c.campaignName}" by ${c.client?.brandName || 'Client'}.`,
        date: c.createdAt,
      })),
      ...submissions.map((s) => {
        const agency = s.milestone.campaign.assignedAgencies?.[0];
        const agencyName = agency?.agencyName || 'An Agency';
        return {
          type: 'submission',
          title: 'Milestone Submitted',
          description: `${agencyName} submitted work for "${s.milestone.contentTitle}".`,
          date: s.createdAt,
        };
      }),
    ];

    const sortedActivities = activities
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, limit);

    return {
      success: true,
      data: sortedActivities,
    };
  }

  // ==================================================================
  // ADMIN DASHBOARD: Campaign Chart Data (Accepted vs Declined)
  // ==================================================================
  async getCampaignChartStats() {
    const rawStats = await this.campaignRepo
      .createQueryBuilder('c')
      .select('c.status', 'status')
      .addSelect('COUNT(c.id)', 'count')
      .groupBy('c.status')
      .getRawMany();

    const acceptedStatuses = [
      'promoting',
      'ongoing',
      'completed',
      'agency_accepted',
      'approved',
      'placed',
    ];

    const declinedStatuses = ['declined', 'cancelled', 'rejected'];

    let acceptedCount = 0;
    let declinedCount = 0;

    rawStats.forEach((stat) => {
      const count = Number(stat.count); // Postgres count string
      if (acceptedStatuses.includes(stat.status)) {
        acceptedCount += count;
      } else if (declinedStatuses.includes(stat.status)) {
        declinedCount += count;
      }
    });

    return {
      success: true,
      data: [
        { label: 'Accepted', value: acceptedCount, color: '#10B981' }, // Green
        { label: 'Declined', value: declinedCount, color: '#EF4444' }, // Red
      ],
    };
  }
}
