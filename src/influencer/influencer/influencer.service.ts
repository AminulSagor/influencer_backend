import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InfluencerProfileEntity } from './entities/influencer-profile.entity';
import { Repository } from 'typeorm';
import { SignupDto } from '../auth/dto/auth.dto';
import { AddLocationDto, AddPayoutDto } from './dto/update-verification.dto';

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

  async updateProfile(
    userId: string,
    updateData: Partial<InfluencerProfileEntity>,
  ): Promise<InfluencerProfileEntity> {
    const profile = await this.influencerRepo.findOne({ where: { userId } });
    if (!profile) throw new NotFoundException('Profile not found');

    // Merge new data with existing data
    const updatedProfile = this.influencerRepo.merge(profile, updateData);

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
}
