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

@Injectable()
export class ClientService {
  constructor(
    @InjectRepository(ClientProfileEntity)
    private readonly clientProfileRepo: Repository<ClientProfileEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
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
}
