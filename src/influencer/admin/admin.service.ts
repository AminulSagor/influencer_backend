import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import {
  AdminLoginDto,
  ApprovalStatus,
  UpdateItemStatusDto,
  UpdateNidStatusDto,
  UpdatePayoutStatusDto,
  UpdateSectionStatusDto,
  UpdateClientNidStatusDto,
  UpdateClientTradeLicenseStatusDto,
  UpdateClientSocialStatusDto,
} from './dto/admin.dto';
// import { UserEntity } from '../user/entities/user.entity';
import { InfluencerProfileEntity } from '../influencer/entities/influencer-profile.entity';
import { ClientProfileEntity } from '../client/entities/client-profile.entity';
import { NotificationService } from '../notification/notification.service';
import { UserRole } from '../user/entities/user.entity';

@Injectable()
export class AdminService {
  constructor(
    // @InjectRepository(UserEntity)
    // private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(InfluencerProfileEntity)
    private readonly profileRepo: Repository<InfluencerProfileEntity>,
    @InjectRepository(ClientProfileEntity)
    private readonly clientProfileRepo: Repository<ClientProfileEntity>,
    private readonly notificationService: NotificationService,
  ) {}

  // Helper to send rejection notification
  private async notifyIfRejected(
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
      // Optional: Notify on approval too?
      // await this.notificationService.createNotification(userId, UserRole.INFLUENCER, `${item} Approved`, `Your ${item} has been verified.`);
    }
  }

  // 1. Get Pending Profiles
  async getPendingProfiles(page = 1, limit = 10) {
    const [data, total] = await this.profileRepo.findAndCount({
      take: limit,
      skip: (page - 1) * limit,
      relations: ['user'], // To show Name/Email
      // You can add a `where` clause here to filter by 'unverified' status if needed
      order: { updatedAt: 'DESC' },
    });

    return {
      data,
      meta: { total, page, limit },
    };
  }

  // 2. Get Single Profile Details
  async getProfileDetails(userId: string): Promise<InfluencerProfileEntity> {
    const profile = await this.profileRepo.findOne({
      where: { userId },
      relations: ['user'],
    });
    if (!profile) throw new NotFoundException('Profile not found');
    return profile;
  }

  // 3. Approve/Reject Niche
  async updateNicheStatus(
    userId: string,
    dto: UpdateItemStatusDto,
  ): Promise<InfluencerProfileEntity> {
    const profile = await this.getProfileDetails(userId);

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
    return this.profileRepo.save(profile);
  }

  // 4. Approve/Reject Skill
  async updateSkillStatus(
    userId: string,
    dto: UpdateItemStatusDto,
  ): Promise<InfluencerProfileEntity> {
    const profile = await this.getProfileDetails(userId);

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
    return this.profileRepo.save(profile);
  }

  // 5. Approve/Reject Social Link
  async updateSocialStatus(
    userId: string,
    dto: UpdateItemStatusDto,
  ): Promise<InfluencerProfileEntity> {
    const profile = await this.getProfileDetails(userId);

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

    // Auto-update the master "Social Profile" step status
    // const sectionStatus = this.calculateSectionStatus(profile.socialLinks);
    // profile.verificationSteps = {
    //   ...profile.verificationSteps,
    //   socialProfile: sectionStatus,
    // };

    return this.profileRepo.save(profile);
  }

  // 6. Approve/Reject Payout (Bank)
  async updateBankStatus(
    userId: string,
    dto: UpdatePayoutStatusDto,
  ): Promise<InfluencerProfileEntity> {
    const profile = await this.getProfileDetails(userId);

    if (profile.payouts && profile.payouts.bank) {
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
    return this.profileRepo.save(profile);
  }

  // 7. Approve/Reject Payout (Mobile)
  async updateMobileStatus(
    userId: string,
    dto: UpdatePayoutStatusDto,
  ): Promise<InfluencerProfileEntity> {
    const profile = await this.getProfileDetails(userId);

    if (profile.payouts && profile.payouts.mobileBanking) {
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
    return this.profileRepo.save(profile);
  }

  // 8. Approve/Reject NID
  async updateNidStatus(userId: string, dto: UpdateNidStatusDto) {
    const profile = await this.getProfileDetails(userId);

    if (!profile.nidVerification) {
      profile.nidVerification = { nidStatus: 'pending', nidRejectReason: '' };
    }

    profile.nidVerification.nidStatus = dto.nidStatus;
    if (dto.nidStatus === ApprovalStatus.REJECTED) {
      profile.nidVerification.nidRejectReason =
        dto.rejectReason || 'No reason specified';
    } else {
      profile.nidVerification.nidRejectReason = ''; // Clear reason if approved/pending
    }

    // // Update verificationSteps
    // profile.verificationSteps = { ...profile.verificationSteps, nid: dto.status };

    await this.notifyIfRejected(
      userId,
      'NID Document',
      dto.nidStatus,
      dto.rejectReason,
    );
    return this.profileRepo.save(profile);
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
}
