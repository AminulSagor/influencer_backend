import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { ClientProfileEntity } from './entities/client-profile.entity';
import { UserEntity, UserRole } from '../user/entities/user.entity';
import {
  UpdateClientDto,
  UpdateClientAddressDto,
  UpdateClientSocialDto,
  UpdateClientNidDto,
  UpdateClientTradeLicenseDto,
  ClientOnboardingDto,
} from './dto/update-client.dto';
import { AgencyService } from '../agency/agency.service';
import { GetAgenciesDto } from '../agency/dto/get-agencies.dto';
import { AnalyticsFilterDto } from './dto/analytics-filter.dto';
import { CampaignEntity } from '../campaign/entities/campaign.entity';
import { ReportFilterDto } from '../campaign/dto/report-filter.dto';
import { MilestoneSubmissionEntity } from '../campaign/entities/milestone-submission.entity';
import { ClientDashboardFilterDto } from './dto/client-dashboard.dto';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class ClientService {
  constructor(
    @InjectRepository(ClientProfileEntity)
    private readonly clientProfileRepo: Repository<ClientProfileEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(CampaignEntity)
    private readonly campaignRepo: Repository<CampaignEntity>,
    @InjectRepository(MilestoneSubmissionEntity)
    private readonly submissionRepo: Repository<MilestoneSubmissionEntity>,
    private readonly agencyService: AgencyService,
    private readonly notificationService: NotificationService,
  ) {}

  // --- 1. GET PROFILE ---
  async getProfile(userId: string) {
    const profile = await this.clientProfileRepo.findOne({
      where: { userId },
    });

    if (!profile) throw new NotFoundException('Client profile not found');

    return profile;
  }
  async updateAddress(userId: string, dto: UpdateClientAddressDto) {
    const profile = await this.getProfileWithVerificationCheck(userId);

    // Update address fields
    if (dto.thana) profile.thana = dto.thana;
    if (dto.zila) profile.zila = dto.zila;
    if (dto.fullAddress) profile.fullAddress = dto.fullAddress;

    // Update verification step if all address fields are filled
    if (profile.thana && profile.zila && profile.fullAddress) {
      profile.verificationSteps.addressDetails = 'verified';
    }

    await this.clientProfileRepo.save(profile);
    return { message: 'Address updated successfully', profile };
  }

  // --- 5. UPDATE SOCIAL LINKS ---
  async updateSocialLinks(userId: string, dto: UpdateClientSocialDto) {
    const profile = await this.getProfileWithVerificationCheck(userId);

    if (dto.website !== undefined) profile.website = dto.website;
    if (dto.socialLinks) profile.socialLinks = dto.socialLinks;

    // Mark social links as verified if at least one link is added
    if (profile.socialLinks && profile.socialLinks.length > 0) {
      profile.verificationSteps.socialLinks = 'verified';
    }

    await this.clientProfileRepo.save(profile);
    return { message: 'Social links updated successfully', profile };
  }

  // --- 6. UPDATE NID ---
  async updateNid(userId: string, dto: UpdateClientNidDto) {
    const profile = await this.getProfileWithVerificationCheck(userId);

    if (dto.nidNumber) profile.nidNumber = dto.nidNumber;
    if (dto.nidFrontImg) profile.nidFrontImg = dto.nidFrontImg;
    if (dto.nidBackImg) profile.nidBackImg = dto.nidBackImg;

    // Mark NID as pending verification if all fields are filled
    if (profile.nidNumber && profile.nidFrontImg && profile.nidBackImg) {
      profile.verificationSteps.nidVerification = 'pending';
      profile.nidStatus = 'pending';
    }

    await this.clientProfileRepo.save(profile);
    return { message: 'NID information updated successfully', profile };
  }

  // --- 7. UPDATE TRADE LICENSE ---
  async updateTradeLicense(userId: string, dto: UpdateClientTradeLicenseDto) {
    const profile = await this.getProfileWithVerificationCheck(userId);

    if (dto.tradeLicenseNumber)
      profile.tradeLicenseNumber = dto.tradeLicenseNumber;
    if (dto.tradeLicenseImg) profile.tradeLicenseImg = dto.tradeLicenseImg;

    // Mark trade license as pending verification if all fields are filled
    if (profile.tradeLicenseNumber && profile.tradeLicenseImg) {
      profile.verificationSteps.tradeLicense = 'pending';
      profile.tradeLicenseStatus = 'pending';
    }

    await this.clientProfileRepo.save(profile);
    return { message: 'Trade license updated successfully', profile };
  }

  // --- 8. COMPLETE ONBOARDING (Combined Update) ---
  async completeOnboarding(userId: string, dto: ClientOnboardingDto) {
    const profile = await this.getProfileWithVerificationCheck(userId);

    // Update Address
    if (dto.thana) profile.thana = dto.thana;
    if (dto.zila) profile.zila = dto.zila;
    if (dto.fullAddress) profile.fullAddress = dto.fullAddress;

    // Update Website & Social Links
    if (dto.website !== undefined) profile.website = dto.website;
    if (dto.socialLinks) profile.socialLinks = dto.socialLinks;

    // Update NID
    if (dto.nidNumber) profile.nidNumber = dto.nidNumber;
    if (dto.nidFrontImg) profile.nidFrontImg = dto.nidFrontImg;
    if (dto.nidBackImg) profile.nidBackImg = dto.nidBackImg;

    // Update Trade License
    if (dto.tradeLicenseNumber)
      profile.tradeLicenseNumber = dto.tradeLicenseNumber;
    if (dto.tradeLicenseImg) profile.tradeLicenseImg = dto.tradeLicenseImg;

    // Update verification steps
    if (profile.thana && profile.zila && profile.fullAddress) {
      profile.verificationSteps.addressDetails = 'verified';
    }

    if (profile.socialLinks && profile.socialLinks.length > 0) {
      profile.verificationSteps.socialLinks = 'verified';
    }

    if (profile.nidNumber && profile.nidFrontImg && profile.nidBackImg) {
      profile.verificationSteps.nidVerification = 'pending';
      profile.nidStatus = 'pending';
    }

    if (profile.tradeLicenseNumber && profile.tradeLicenseImg) {
      profile.verificationSteps.tradeLicense = 'pending';
      profile.tradeLicenseStatus = 'pending';
    }

    // Check if onboarding is complete
    profile.isOnboardingComplete = this.checkOnboardingComplete(profile);

    await this.clientProfileRepo.save(profile);
    return {
      message: 'Onboarding information saved successfully',
      profile,
      isOnboardingComplete: profile.isOnboardingComplete,
    };
  }

  // --- 10. UPDATE PROFILE (General) ---
  async updateProfile(userId: string, dto: UpdateClientDto) {
    const profile = await this.clientProfileRepo.findOne({
      where: { userId },
    });

    if (!profile) throw new NotFoundException('Client profile not found');

    // Update fields
    Object.assign(profile, dto);

    await this.clientProfileRepo.save(profile);
    return { message: 'Profile updated successfully', profile };
  }

  // --- 11. GET ALL CLIENTS (Admin) ---
  async findAll(page = 1, limit = 10) {
    const [clients, total] = await this.clientProfileRepo.findAndCount({
      relations: ['user'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    // Remove sensitive data
    clients.forEach((client) => {
      if (client.user) {
        delete (client.user as any).password;
        delete (client.user as any).otpCode;
        delete (client.user as any).otpExpires;
      }
    });

    return {
      data: clients,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // --- 12. GET CLIENT BY ID (Admin) ---
  async findOne(id: string) {
    const profile = await this.clientProfileRepo.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!profile) throw new NotFoundException('Client not found');

    if (profile.user) {
      delete (profile.user as any).password;
      delete (profile.user as any).otpCode;
      delete (profile.user as any).otpExpires;
    }

    return profile;
  }

  // --- 13. DELETE CLIENT (Admin) ---
  async remove(id: string) {
    const profile = await this.clientProfileRepo.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!profile) throw new NotFoundException('Client not found');

    // Delete user (will cascade to profile due to onDelete: 'CASCADE')
    if (profile.user) {
      await this.userRepo.remove(profile.user);
    }

    return { message: 'Client deleted successfully' };
  }

  // --- HELPER: Get profile with phone verification check ---
  private async getProfileWithVerificationCheck(
    userId: string,
  ): Promise<ClientProfileEntity> {
    const user = await this.userRepo.findOne({
      where: { id: userId, role: UserRole.CLIENT },
    });

    if (!user) throw new NotFoundException('Client not found');

    if (!user.isPhoneVerified) {
      throw new ForbiddenException(
        'Please verify your phone number first before updating profile',
      );
    }

    const profile = await this.clientProfileRepo.findOne({
      where: { userId },
    });

    if (!profile) throw new NotFoundException('Client profile not found');

    return profile;
  }

  // --- HELPER: Check if onboarding is complete ---
  private checkOnboardingComplete(profile: ClientProfileEntity): boolean {
    const steps = profile.verificationSteps;

    // Required steps for onboarding completion
    const requiredStepsCompleted =
      steps.profileDetails !== 'unverified' &&
      steps.phoneVerification === 'verified' &&
      steps.addressDetails === 'verified' &&
      steps.nidVerification !== 'unverified';

    return requiredStepsCompleted;
  }

  // Agency

  async getAllAgencies(dto: GetAgenciesDto) {
    return await this.agencyService.getAllAgencies(dto);
  }

  // ==================================================================
  // CLIENT REPORT API (My Campaign Reports)
  // ==================================================================
  async getClientReports(userId: string, dto: ReportFilterDto) {
    const client = await this.getProfile(userId);
    const { page = 1, limit = 10, search, status } = dto;
    const skip = (page - 1) * limit;

    const query = this.submissionRepo
      .createQueryBuilder('submission')
      .leftJoinAndSelect('submission.milestone', 'milestone')
      .leftJoinAndSelect('milestone.campaign', 'campaign')
      .where('campaign.clientId = :clientId', { clientId: client.id });

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

    const [submissions, total] = await query
      .orderBy('submission.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const formattedReports = submissions.map((sub) => ({
      reportId: sub.id,
      campaignName: sub.milestone.campaign.campaignName,
      milestoneTitle: sub.milestone.contentTitle,
      submissionDate: sub.createdAt,
      status: ['approved', 'paid'].includes(sub.status)
        ? 'Resolved'
        : 'Pending',
      details: sub.submissionDescription,
      amount: sub.requestedAmount,
    }));

    return {
      success: true,
      data: formattedReports,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ==================================================================
  // CLIENT ANALYTICS: Top Stats + Transactions List
  // ==================================================================
  async getClientAnalytics(userId: string, dto: AnalyticsFilterDto) {
    const client = await this.getProfile(userId);
    const { page = 1, limit = 10, search, sortOrder = 'high_to_low' } = dto;
    const skip = (page - 1) * limit;

    // ---------------------------------------------------------
    // A. HIGHLIGHTS (Top Campaign & Top Influencer)
    // ---------------------------------------------------------

    // 1. Top Campaign (Highest Budget)
    const topCampaign = await this.campaignRepo.findOne({
      where: { clientId: client.id },
      order: { totalBudget: 'DESC' },
      select: ['id', 'campaignName', 'totalBudget', 'status', 'createdAt'],
    });

    // 2. Top Influencer (Highest Earned from this Client)
    const topInfluencerRaw = await this.campaignRepo
      .createQueryBuilder('c')
      .select('c.selectedAgencyId', 'agencyId')
      .addSelect('SUM(c.paidAmount)', 'totalEarned')
      .where('c.clientId = :clientId', { clientId: client.id })
      .andWhere('c.selectedAgencyId IS NOT NULL')
      .groupBy('c.selectedAgencyId')
      .orderBy('"totalEarned"', 'DESC') // 'totalEarned' is alias
      .limit(1)
      .getRawOne();

    let topInfluencerData = null;
    // if (topInfluencerRaw?.agencyId) {
    //     const agency = await this.agencyRepo.findOne({
    //         where: { id: topInfluencerRaw.agencyId },
    //         select: ['id', 'firstName', 'lastName', 'agencyName', 'logo']
    //     });

    //     const displayName = agency.firstName && agency.lastName
    //         ? `${agency.firstName} ${agency.lastName}`
    //         : agency.agencyName;

    //     topInfluencerData = {
    //         id: agency.id,
    //         name: displayName,
    //         totalEarned: topInfluencerRaw.totalEarned,
    //         logo: agency.logo
    //     };
    // }

    // ---------------------------------------------------------
    // B. TRANSACTIONS LIST (From Submissions)
    // ---------------------------------------------------------
    const query = this.submissionRepo
      .createQueryBuilder('sub')
      .leftJoinAndSelect('sub.milestone', 'milestone')
      .leftJoinAndSelect('milestone.campaign', 'campaign')
      .leftJoinAndSelect('campaign.assignedAgencies', 'agency') // For Influencer Name in list
      .where('campaign.clientId = :clientId', { clientId: client.id })
      .andWhere('sub.paidToAgencyAmount > 0');

    // Filter: Search by Campaign Name
    if (search) {
      query.andWhere('campaign.campaignName ILIKE :search', {
        search: `%${search}%`,
      });
    }

    // Sort: Low to High / High to Low
    if (sortOrder === 'low_to_high') {
      query.orderBy('sub.paidToAgencyAmount', 'ASC');
    } else {
      query.orderBy('sub.paidToAgencyAmount', 'DESC');
    }

    // Add secondary sort by date
    query.addOrderBy('sub.createdAt', 'DESC');

    const [transactions, total] = await query
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    // Formatting Transactions
    const formattedTransactions = transactions.map((t) => {
      // Find the specific agency for this campaign
      // const agency = t.milestone.campaign.assignedAgencies?.find(
      //   (a) => a.id === t.milestone.campaign.selectedAgencyId,
      // );
      // const influencerName = agency
      //   ? agency.firstName
      //     ? `${agency.firstName} ${agency.lastName}`
      //     : agency.agencyName
      //   : 'Unknown Influencer';

      return {
        transactionId: t.id,
        campaignName: t.milestone.campaign.campaignName,
        // milestoneTitle: t.milestone.contentTitle,
        // influencerName: influencerName,
        amount: t.paidToAgencyAmount,
        date: t.createdAt, // Payment Date
        status: 'Success',
      };
    });

    return {
      success: true,
      data: {
        highlights: {
          topCampaign: topCampaign
            ? {
                id: topCampaign.id,
                title: topCampaign.campaignName,
                budget: topCampaign.totalBudget,
                date: topCampaign.createdAt,
              }
            : null,
          topInfluencer: topInfluencerData,
        },
        transactions: {
          data: formattedTransactions,
          meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        },
      },
    };
  }

  // ==================================================================
  // 1. ACTIVE JOBS (Specific Dashboard View)
  // ==================================================================
  async getActiveJobs(userId: string, dto: ClientDashboardFilterDto) {
    const client = await this.getClientProfile(userId);
    const { page = 1, limit = 3 } = dto;
    const skip = (page - 1) * limit;

    // Active Statuses definition
    const activeStatuses = [
      'promoting',
      'ongoing',
      'active',
      'agency_accepted',
    ];

    const [campaigns, total] = await this.campaignRepo.findAndCount({
      where: {
        clientId: client.id,
        status: In(activeStatuses),
      },
      select: {
        id: true,
        campaignName: true,
        totalBudget: true,
        createdAt: true,
        status: true,
        startingDate: true,
        duration: true,
      },
      take: limit,
      skip: skip,
      order: { createdAt: 'DESC' },
    });

    return {
      success: true,
      data: campaigns,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ==================================================================
  // 2. ACTION REQUIRED (Rejected Documents)
  // ==================================================================
  async getActionRequired(userId: string) {
    const client = await this.getClientProfile(userId);

    // ✅ FIX: Explicitly typed the array to avoid 'never' error
    const actions: {
      type: string;
      priority: string;
      title: string;
      description: string;
      actionLink: string;
    }[] = [];

    // Check 1: NID Status
    if (client.nidStatus === 'rejected') {
      actions.push({
        type: 'verification_fix',
        priority: 'High',
        title: 'NID Verification Rejected',
        description: 'Your NID was rejected. Please re-upload a clear copy.',
        actionLink: '/client/profile/verification?tab=nid',
      });
    }

    // Check 2: Trade License Status
    if (client.tradeLicenseStatus === 'rejected') {
      actions.push({
        type: 'verification_fix',
        priority: 'High',
        title: 'Trade License Rejected',
        description:
          'Trade license verification failed. Please check comments and re-submit.',
        actionLink: '/client/profile/verification?tab=trade_license',
      });
    }

    // Check 3: Rejected Campaigns
    const rejectedCampaigns = await this.campaignRepo.find({
      where: { clientId: client.id, status: 'rejected' },
      select: ['id', 'campaignName', 'createdAt'],
      take: 3,
    });

    rejectedCampaigns.forEach((camp) => {
      actions.push({
        type: 'campaign_fix',
        priority: 'Medium',
        title: `Fix Campaign: ${camp.campaignName}`,
        description:
          'This campaign was rejected by admin. Please edit and resubmit.',
        actionLink: `/client/campaign/${camp.id}/edit`,
      });
    });

    return {
      success: true,
      data: actions,
    };
  }

  // ==================================================================
  // 3. UPCOMING DEADLINES
  // ==================================================================
  async getUpcomingDeadlines(userId: string, dto: ClientDashboardFilterDto) {
    const client = await this.getClientProfile(userId);
    const { page = 1, limit = 5 } = dto;
    const skip = (page - 1) * limit;

    const query = this.campaignRepo
      .createQueryBuilder('c')
      .where('c.clientId = :clientId', { clientId: client.id })
      .andWhere('c.status IN (:...statuses)', {
        statuses: ['promoting', 'ongoing', 'active'],
      })
      .andWhere('c.startingDate IS NOT NULL')
      .andWhere('c.duration IS NOT NULL')
      // Postgres Date logic: deadline = startingDate + duration days
      .addSelect("c.startingDate + (c.duration * INTERVAL '1 day')", 'deadline')
      .andWhere(
        "c.startingDate + (c.duration * INTERVAL '1 day') >= CURRENT_DATE",
      )
      .orderBy('"deadline"', 'ASC'); // Closest deadline first

    const campaigns = await query.limit(limit).offset(skip).getRawMany();

    // Format Data
    const formatted = campaigns.map((c) => ({
      id: c.c_id,
      campaignName: c.c_campaignName,
      status: c.c_status,
      deadline: c.deadline,
      daysLeft: Math.ceil(
        (new Date(c.deadline).getTime() - Date.now()) / (1000 * 3600 * 24),
      ),
    }));

    return {
      success: true,
      data: formatted,
      meta: { page, limit },
    };
  }

  // ==================================================================
  // 4. LIFETIME SUMMARY & TOP INFLUENCER
  // ==================================================================
  async getLifetimeSummary(userId: string) {
    const client = await this.getClientProfile(userId);

    // A. Job Counts
    const stats = await this.campaignRepo
      .createQueryBuilder('c')
      .select("COUNT(CASE WHEN c.status = 'completed' THEN 1 END)", 'completed')
      .addSelect(
        "COUNT(CASE WHEN c.status IN ('cancelled', 'declined') THEN 1 END)",
        'declined',
      )
      .where('c.clientId = :clientId', { clientId: client.id })
      .getRawOne();

    // B. Top Influencer (Highest Paid)
    const topInfluencer = await this.campaignRepo
      .createQueryBuilder('c')
      .leftJoin('c.assignedAgencies', 'agency')
      .select('agency.id', 'id')
      .addSelect('agency.agencyName', 'name')
      .addSelect('agency.firstName', 'firstName')
      .addSelect('agency.lastName', 'lastName')
      .addSelect('agency.logo', 'logo')
      .addSelect('SUM(c.paidAmount)', 'totalEarned')
      .where('c.clientId = :clientId', { clientId: client.id })
      .andWhere('c.status = :status', { status: 'completed' })
      .andWhere('agency.id IS NOT NULL')
      .groupBy('agency.id')
      .addGroupBy('agency.agencyName')
      .addGroupBy('agency.firstName')
      .addGroupBy('agency.lastName')
      .addGroupBy('agency.logo')
      .orderBy('"totalEarned"', 'DESC')
      .limit(1)
      .getRawOne();

    // ✅ FIX: Explicitly typed to allow null assignment initially
    let influencerData: {
      name: string;
      totalEarned: number;
      logo: string;
    } | null = null;

    if (topInfluencer) {
      const displayName =
        topInfluencer.firstName && topInfluencer.lastName
          ? `${topInfluencer.firstName} ${topInfluencer.lastName}`
          : topInfluencer.name;

      influencerData = {
        name: displayName,
        totalEarned: topInfluencer.totalEarned,
        logo: topInfluencer.logo,
      };
    }

    return {
      success: true,
      data: {
        totalCompleted: Number(stats.completed || 0),
        totalDeclined: Number(stats.declined || 0),
        topInfluencer: influencerData,
      },
    };
  }

  // ==================================================================
  // 5. NOTIFICATIONS (New & Earlier)
  // ==================================================================
  async getClientNotifications(userId: string, dto: ClientDashboardFilterDto) {
    // Reusing the generic Notification Service
    const { page = 1, limit = 10 } = dto;

    // Fetch all with pagination
    const { data, meta } = await this.notificationService.getUserNotifications(
      userId,
      page,
      limit,
    );

    return {
      success: true,
      data: data.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        isRead: n.isRead,
        createdAt: n.createdAt,
        type: n.type,
      })),
      meta,
    };
  }

  // Helper
  private async getClientProfile(userId: string) {
    const profile = await this.clientProfileRepo.findOne({ where: { userId } });
    if (!profile) throw new Error('Client profile not found');
    return profile;
  }
}
