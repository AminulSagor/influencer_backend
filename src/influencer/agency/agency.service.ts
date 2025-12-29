import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgencyProfileEntity } from './entities/agency-profile.entity';
import {
  UpdateAgencyBasicDto,
  UpdateAgencyAddressDto,
  UpdateAgencySocialsDto,
  AddAgencyPayoutDto,
  DeleteAgencyItemDto,
  UpdateAgencyBinDto,
  UpdateAgencyTinDto,
  UpdateAgencyTradeLicenseDto,
  UpdateAgencyNidDto,
} from './dto/update-agency.dto';
import { AgencyOnboardingDto } from './dto/create-agency.dto';
import { GetAgenciesDto } from './dto/get-agencies.dto';
import { MilestoneSubmissionEntity } from '../campaign/entities/milestone-submission.entity';
import { ReportFilterDto } from '../campaign/dto/report-filter.dto';

@Injectable()
export class AgencyService {
  constructor(
    @InjectRepository(AgencyProfileEntity)
    private readonly agencyRepo: Repository<AgencyProfileEntity>,
    @InjectRepository(MilestoneSubmissionEntity)
    private readonly submissionRepo: Repository<MilestoneSubmissionEntity>,
  ) {}

  async updateOnboarding(userId: string, dto: AgencyOnboardingDto) {
    const profile = await this.getProfile(userId);

    // 1. Update Address (if provided)
    if (dto.addressLine || dto.city || dto.country) {
      profile.address = {
        addressLine: dto.addressLine || profile.address?.addressLine || '',
        city: dto.city || profile.address?.city || '',
        country: dto.country || profile.address?.country || '',
      };
    }

    // 2. Update Socials (if provided)
    if (dto.socialLinks) {
      profile.socialLinks = dto.socialLinks.map((link) => ({
        ...link,
        status: 'pending',
      }));
    }
    if (dto.website) profile.website = dto.website;

    // 3. Update NID (if provided)
    if (dto.nidNumber) profile.nidNumber = dto.nidNumber;
    if (dto.nidFrontImg) profile.nidFrontImg = dto.nidFrontImg;
    if (dto.nidBackImg) profile.nidBackImg = dto.nidBackImg;

    // Trigger verification status pending if NID docs changed
    if (dto.nidFrontImg || dto.nidNumber) {
      profile.nidVerification = { nidStatus: 'pending', nidRejectReason: '' };
    }

    return this.agencyRepo.save(profile);
  }

  // --- GET PROFILE ---
  async getProfile(userId: string): Promise<AgencyProfileEntity> {
    const profile = await this.agencyRepo.findOne({ where: { userId } });
    if (!profile) throw new NotFoundException('Agency profile not found');
    return profile;
  }

  async getAllAgencies(dto: GetAgenciesDto) {
    const { page = 1, limit = 10, search, niche, location, minRating } = dto;
    const skip = (page - 1) * limit;

    const query = this.agencyRepo
      .createQueryBuilder('agency')
      .leftJoinAndSelect('agency.user', 'au')
      .select([
        'agency.id',
        'agency.agencyName',
        'agency.logo',
        'agency.niches',
        'agency.socialLinks',
        'agency.averageRating',
        'agency.totalReviews',
        'agency.firstName',
        'agency.lastName',
        'au.email',
      ]);

    if (search) {
      query.andWhere(
        '(agency.agencyName ILIKE :search OR agency.firstName ILIKE :search OR agency.lastName ILIKE :search OR au.email ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (niche) {
      query.andWhere('agency.niches::text ILIKE :niche', {
        niche: `%${niche}%`,
      });
    }

    if (location) {
      query.andWhere('agency.address::text ILIKE :location', {
        location: `%${location}%`,
      });
    }

    if (minRating) {
      query.andWhere('agency.averageRating >= :minRating', { minRating });
    }

    query.orderBy('agency.averageRating', 'DESC');

    const [data, total] = await query.skip(skip).take(limit).getManyAndCount();

    const formattedData = data.map((agency) => ({
      ...agency,
      fullName: `${agency.firstName} ${agency.lastName}`.trim(),
    }));

    return {
      success: true,
      data: formattedData,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // --- UPDATE BASIC INFO ---
  async updateBasicProfile(
    userId: string,
    dto: UpdateAgencyBasicDto,
  ): Promise<AgencyProfileEntity> {
    const profile = await this.getProfile(userId);

    if (dto.agencyName) profile.agencyName = dto.agencyName;
    if (dto.firstName) profile.firstName = dto.firstName;
    if (dto.lastName) profile.lastName = dto.lastName;
    if (dto.secondaryPhone) profile.secondaryPhone = dto.secondaryPhone;
    if (dto.agencyBio) profile.agencyBio = dto.agencyBio;
    if (dto.website) profile.website = dto.website;
    if (dto.logo) profile.logo = dto.logo;

    return this.agencyRepo.save(profile);
  }

  // --- UPDATE ADDRESS ---
  async updateAddress(
    userId: string,
    dto: UpdateAgencyAddressDto,
  ): Promise<AgencyProfileEntity> {
    const profile = await this.getProfile(userId);
    profile.address = dto.address;
    return this.agencyRepo.save(profile);
  }

  // --- UPDATE SOCIAL LINKS ---
  async updateSocialLinks(
    userId: string,
    dto: UpdateAgencySocialsDto,
  ): Promise<AgencyProfileEntity> {
    const profile = await this.getProfile(userId);

    // Map input to entity structure (adding status: 'pending' or 'unverified')
    profile.socialLinks = dto.socialLinks.map((link) => ({
      ...link,
      status: 'pending', // Default status for admin approval
    }));

    return this.agencyRepo.save(profile);
  }

  // --- UPDATE VERIFICATION DOCS (NID, TIN, Trade License) ---
  // --- Verification Updates ---
  async updateNid(userId: string, dto: UpdateAgencyNidDto) {
    const profile = await this.getProfile(userId);
    profile.nidNumber = dto.nidNumber;
    profile.nidFrontImg = dto.nidFrontImg;
    profile.nidBackImg = dto.nidBackImg;
    profile.nidVerification = { nidStatus: 'pending', nidRejectReason: '' };
    return this.agencyRepo.save(profile);
  }

  async updateTradeLicense(userId: string, dto: UpdateAgencyTradeLicenseDto) {
    const profile = await this.getProfile(userId);
    profile.tradeLicenseNumber = dto.tradeLicenseNumber;
    profile.tradeLicenseImage = dto.tradeLicenseImage;
    profile.tradeLicenseStatus = 'pending';
    return this.agencyRepo.save(profile);
  }

  async updateTin(userId: string, dto: UpdateAgencyTinDto) {
    const profile = await this.getProfile(userId);
    profile.tinNumber = dto.tinNumber;
    profile.tinImage = dto.tinImage;
    profile.tinStatus = 'pending';
    return this.agencyRepo.save(profile);
  }

  async updateBin(userId: string, dto: UpdateAgencyBinDto) {
    const profile = await this.getProfile(userId);
    profile.binNumber = dto.binNumber;
    profile.binStatus = 'pending';
    return this.agencyRepo.save(profile);
  }

  async addNiches(
    userId: string,
    niches: string[],
  ): Promise<AgencyProfileEntity> {
    const profile = await this.getProfile(userId);

    // Transform string array to Object with Status
    const newNiches = niches.map((n) => ({ niche: n, status: 'unverified' }));

    // Replace or Append? Usually replace for tags, or append if distinct.
    // Here we strictly replace the list based on the UI allowing "Save Changes"
    profile.niches = newNiches;

    return this.agencyRepo.save(profile);
  }

  // --- ADD PAYOUT METHOD ---
  async addPayout(
    userId: string,
    dto: AddAgencyPayoutDto,
  ): Promise<AgencyProfileEntity> {
    const profile = await this.getProfile(userId);

    if (!profile.payouts) {
      profile.payouts = { bank: [], mobileBanking: [] };
    }

    if (dto.bank) {
      profile.payouts.bank.push({ ...dto.bank, accStatus: 'pending' });
    }

    if (dto.mobileBanking) {
      profile.payouts.mobileBanking.push({
        ...dto.mobileBanking,
        accStatus: 'pending',
      });
    }

    return this.agencyRepo.save(profile);
  }

  // --- DELETE PAYOUT METHOD ---
  async deletePayout(
    userId: string,
    dto: DeleteAgencyItemDto,
  ): Promise<AgencyProfileEntity> {
    const profile = await this.getProfile(userId);

    if (!profile.payouts) return profile;

    if (dto.type === 'bank') {
      profile.payouts.bank = profile.payouts.bank.filter(
        (b) => b.bankAccNo !== dto.identifier,
      );
    } else if (dto.type === 'mobile') {
      profile.payouts.mobileBanking = profile.payouts.mobileBanking.filter(
        (m) => m.accountNo !== dto.identifier,
      );
    } else {
      throw new BadRequestException('Type must be "bank" or "mobile"');
    }

    return this.agencyRepo.save(profile);
  }

  // ==================================================================
  // AGENCY REPORT API: Issues & Status Tracker
  // ==================================================================
  async getAgencyReports(userId: string, dto: ReportFilterDto) {
    const agency = await this.getProfile(userId);
    const { page = 1, limit = 10, search } = dto;
    const skip = (page - 1) * limit;

    const query = this.submissionRepo
      .createQueryBuilder('submission')
      .leftJoinAndSelect('submission.milestone', 'milestone')
      .leftJoinAndSelect('milestone.campaign', 'campaign')
      .leftJoinAndSelect('submission.reports', 'reports')
      .where('campaign.selectedAgencyId = :agencyId', { agencyId: agency.id });

    if (search) {
      query.andWhere('campaign.campaignName ILIKE :search', {
        search: `%${search}%`,
      });
    }

    // query.andWhere('submission.status IN (:...statuses)', { statuses: ['declined', 'in_review', 'pending'] });

    query.addSelect(
      `CASE 
      WHEN submission.status = 'declined' THEN 1 
      WHEN submission.status = 'pending' OR submission.status = 'in_review' THEN 2 
      ELSE 3 
    END`,
      'status_rank',
    ); // 'status_rank' is our new alias

    query
      .orderBy('status_rank', 'ASC')
      .addOrderBy('submission.createdAt', 'DESC');

    const [submissions, total] = await query
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const formattedReports = submissions.map((sub) => {
      // Logic Mapping
      let reportStatus = 'Resolved';
      let priority = 'Low';

      if (sub.status === 'declined') {
        reportStatus = 'Flagged';
        priority = 'High';
      } else if (['pending', 'in_review'].includes(sub.status)) {
        reportStatus = 'Pending';
        priority = 'Medium';
      }

      const latestReport =
        sub.reports?.length > 0
          ? sub.reports.sort(
              (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
            )[0]
          : null;

      return {
        reportId: sub.id,
        campaignName: sub.milestone.campaign.campaignName,
        milestoneTitle: sub.milestone.contentTitle,
        submissionDescription: sub.submissionDescription,

        // Mapped Status
        status: reportStatus, // Flagged, Pending, Resolved
        submissionStatus: sub.status, // Real DB Status
        priority: priority,

        // Issue Details
        issueSummary:
          sub.rejectionReason ||
          latestReport?.content ||
          'No specific issue logged',

        // Navigation Helper
        campaignId: sub.milestone.campaign.id,
        milestoneId: sub.milestone.id,
      };
    });

    return {
      success: true,
      data: formattedReports,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
