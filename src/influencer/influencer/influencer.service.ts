import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InfluencerProfileEntity } from './entities/influencer-profile.entity';
import { Repository } from 'typeorm';
import { SignupDto } from '../auth/dto/auth.dto';
import { AddLocationDto, AddPayoutDto } from './dto/update-verification.dto';
import {
  DeleteItemDto,
  UpdateInfluencerDto,
} from './dto/update-influencer.dto';
import { CampaignAssignmentEntity } from '../campaign/entities/campaign-assignment.entity';

@Injectable()
export class InfluencerService {
  constructor(
    @InjectRepository(InfluencerProfileEntity)
    private readonly influencerRepo: Repository<InfluencerProfileEntity>,
  ) {}

  async findById(id: string): Promise<InfluencerProfileEntity | null> {
    return this.influencerRepo.findOne({ where: { id } });
  }

  async createInfluencer(
    createDto: SignupDto,
  ): Promise<InfluencerProfileEntity> {
    return this.influencerRepo.save(createDto);
  }

  async getProfile(userId: string): Promise<InfluencerProfileEntity> {
    const profile = await this.influencerRepo.findOne({ where: { userId } });
    if (!profile) throw new NotFoundException('Profile not found');
    return profile;
  }

  async updateBasicProfile(
    userId: string,
    dto: UpdateInfluencerDto,
  ): Promise<InfluencerProfileEntity> {
    const profile = await this.getProfile(userId);

    // Merge only provided fields
    if (dto.firstName) profile.firstName = dto.firstName;
    if (dto.lastName) profile.lastName = dto.lastName;
    if (dto.bio) profile.bio = dto.bio;
    if (dto.profileImg) profile.profileImg = dto.profileImg;
    if (dto.website) profile.website = dto.website;

    return this.influencerRepo.save(profile);
  }

  async completeOnboarding(
    userId: string,
    updateData: Partial<InfluencerProfileEntity>,
  ): Promise<InfluencerProfileEntity> {
    const profile = await this.influencerRepo.findOne({ where: { userId } });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    // CHECK: Prevent if already onboarded
    if (profile.isOnboardingComplete) {
      throw new ForbiddenException(
        'Onboarding is already completed. Go to Edit Profile.',
      );
    }

    // Merge new data with existing data
    const updatedProfile = this.influencerRepo.merge(profile, updateData);

    updatedProfile.isOnboardingComplete = true;

    return this.influencerRepo.save(updatedProfile);
  }

  async addNiches(
    userId: string,
    niches: string[],
  ): Promise<InfluencerProfileEntity> {
    const profile = await this.getProfile(userId);

    // Transform string array to Object with Status
    const newNiches = niches.map((n) => ({ niche: n, status: 'unverified' }));

    // Replace or Append? Usually replace for tags, or append if distinct.
    // Here we strictly replace the list based on the UI allowing "Save Changes"
    profile.niches = newNiches;

    return this.influencerRepo.save(profile);
  }

  async addSkills(
    userId: string,
    skills: string[],
  ): Promise<InfluencerProfileEntity> {
    const profile = await this.getProfile(userId);

    const newSkills = skills.map((s) => ({ skill: s, status: 'unverified' }));
    profile.skills = newSkills;

    return this.influencerRepo.save(profile);
  }

  async addLocations(
    userId: string,
    dto: AddLocationDto,
  ): Promise<InfluencerProfileEntity> {
    const profile = await this.getProfile(userId);

    profile.addresses.push({ ...dto.addresses });

    return this.influencerRepo.save(profile);
  }

  async addPayout(
    userId: string,
    dto: AddPayoutDto,
  ): Promise<InfluencerProfileEntity> {
    const profile = await this.getProfile(userId);

    // Initialize if null
    if (!profile.payouts) {
      profile.payouts = { bank: [], mobileBanking: [] };
    }

    // Add Bank
    if (dto.bank) {
      profile.payouts.bank.push({
        ...dto.bank,
        accStatus: 'pending', // Pending Admin Approval
      });
    }

    // Add Mobile Banking
    if (dto.mobileBanking) {
      profile.payouts.mobileBanking.push({
        ...dto.mobileBanking,
        accStatus: 'pending', // Pending Admin Approval
      });
    }

    // Update master verification step status
    // profile.verificationSteps = {
    //   ...profile.verificationSteps,
    //   paymentSetup: 'pending',
    // };

    return this.influencerRepo.save(profile);
  }

  async deleteProfileImage(userId: string): Promise<InfluencerProfileEntity> {
    const profile = await this.getProfile(userId);
    profile.profileImg = '';
    return this.influencerRepo.save(profile);
  }

  async deleteWebsite(userId: string): Promise<InfluencerProfileEntity> {
    const profile = await this.getProfile(userId);
    profile.website = '';
    return this.influencerRepo.save(profile);
  }

  async deleteNid(userId: string): Promise<InfluencerProfileEntity> {
    const profile = await this.getProfile(userId);

    // Clear all NID related fields
    profile.nidNumber = '';
    profile.nidFrontImg = '';
    profile.nidBackImg = '';

    // Reset verification status
    if (profile.nidVerification) {
      profile.nidVerification = {
        nidStatus: 'unverified',
        nidRejectReason: '',
      };
    }

    return this.influencerRepo.save(profile);
  }

  async deleteNiche(
    userId: string,
    nicheName: string,
  ): Promise<InfluencerProfileEntity> {
    const profile = await this.getProfile(userId);
    if (profile.niches) {
      profile.niches = profile.niches.filter((n) => n.niche !== nicheName);
    }
    return this.influencerRepo.save(profile);
  }

  async deleteSkill(
    userId: string,
    skillName: string,
  ): Promise<InfluencerProfileEntity> {
    const profile = await this.getProfile(userId);
    if (profile.skills) {
      profile.skills = profile.skills.filter((s) => s.skill !== skillName);
    }
    return this.influencerRepo.save(profile);
  }

  async deleteSocialLink(
    userId: string,
    url: string,
  ): Promise<InfluencerProfileEntity> {
    const profile = await this.getProfile(userId);
    if (profile.socialLinks) {
      profile.socialLinks = profile.socialLinks.filter((s) => s.url !== url);
    }
    return this.influencerRepo.save(profile);
  }

  async deleteAddress(
    userId: string,
    addressName: string,
  ): Promise<InfluencerProfileEntity> {
    const profile = await this.getProfile(userId);
    if (profile.addresses) {
      // Assuming 'addressName' is unique enough, otherwise pass full object or index
      profile.addresses = profile.addresses.filter(
        (a) => a.addressName !== addressName,
      );
    }
    return this.influencerRepo.save(profile);
  }

  async deletePayout(
    userId: string,
    dto: DeleteItemDto,
  ): Promise<InfluencerProfileEntity> {
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

    return this.influencerRepo.save(profile);
  }
}
