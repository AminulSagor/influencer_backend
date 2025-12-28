import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

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
      query.andWhere('campaign.title ILIKE :search', { search: `%${search}%` });
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
      .orderBy('submission.updatedAt', 'DESC')
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
      query.andWhere('campaign.title ILIKE :search', { search: `%${search}%` });
    }

    // Sort: Low to High / High to Low
    if (sortOrder === 'low_to_high') {
      query.orderBy('sub.paidToAgencyAmount', 'ASC');
    } else {
      query.orderBy('sub.paidToAgencyAmount', 'DESC');
    }

    // Add secondary sort by date
    query.addOrderBy('sub.updatedAt', 'DESC');

    const [transactions, total] = await query
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    // Formatting Transactions
    const formattedTransactions = transactions.map((t) => {
      // Find the specific agency for this campaign
      const agency = t.milestone.campaign.assignedAgencies?.find(
        (a) => a.id === t.milestone.campaign.selectedAgencyId,
      );
      const influencerName = agency
        ? agency.firstName
          ? `${agency.firstName} ${agency.lastName}`
          : agency.agencyName
        : 'Unknown Influencer';

      return {
        transactionId: t.id,
        campaignTitle: t.milestone.campaign.campaignName,
        milestoneTitle: t.milestone.contentTitle,
        influencerName: influencerName,
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
}
