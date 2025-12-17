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
  UpdateAgencyVerificationDto,
  UpdateAgencyAddressDto,
  UpdateAgencySocialsDto,
  AddAgencyPayoutDto,
  DeleteAgencyItemDto,
} from './dto/update-agency.dto';

@Injectable()
export class AgencyService {
  constructor(
    @InjectRepository(AgencyProfileEntity)
    private readonly agencyRepo: Repository<AgencyProfileEntity>,
  ) {}

  // --- GET PROFILE ---
  async getProfile(userId: string): Promise<AgencyProfileEntity> {
    const profile = await this.agencyRepo.findOne({ where: { userId } });
    if (!profile) throw new NotFoundException('Agency profile not found');
    return profile;
  }

  // --- UPDATE BASIC INFO ---
  async updateBasicProfile(
    userId: string,
    dto: UpdateAgencyBasicDto,
  ): Promise<AgencyProfileEntity> {
    const profile = await this.getProfile(userId);

    if (dto.agencyName) profile.agencyName = dto.agencyName;
    if (dto.ownerFirstName) profile.ownerFirstName = dto.ownerFirstName;
    if (dto.ownerLastName) profile.ownerLastName = dto.ownerLastName;
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
  async updateVerification(
    userId: string,
    dto: UpdateAgencyVerificationDto,
  ): Promise<AgencyProfileEntity> {
    const profile = await this.getProfile(userId);

    // NID
    if (dto.nidNumber) profile.nidNumber = dto.nidNumber;
    if (dto.nidFrontImg) profile.nidFrontImg = dto.nidFrontImg;
    if (dto.nidBackImg) profile.nidBackImg = dto.nidBackImg;
    if (dto.nidNumber || dto.nidFrontImg) {
      profile.nidVerification = { nidStatus: 'pending', nidRejectReason: '' };
    }

    // Trade License
    if (dto.tradeLicenseNumber)
      profile.tradeLicenseNumber = dto.tradeLicenseNumber;
    if (dto.tradeLicenseImage)
      profile.tradeLicenseImage = dto.tradeLicenseImage;
    if (dto.tradeLicenseNumber || dto.tradeLicenseImage) {
      profile.tradeLicenseStatus = 'pending';
    }

    // TIN
    if (dto.tinNumber) profile.tinNumber = dto.tinNumber;
    if (dto.tinImage) profile.tinImage = dto.tinImage;
    if (dto.tinNumber || dto.tinImage) {
      profile.tinStatus = 'pending';
    }

    // BIN
    if (dto.binNumber) profile.binNumber = dto.binNumber;

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
}
