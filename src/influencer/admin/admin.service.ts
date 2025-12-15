import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ApprovalStatus,
  UpdateItemStatusDto,
  UpdateNidStatusDto,
  UpdatePayoutStatusDto,
  UpdateSectionStatusDto,
  UpdateClientNidStatusDto,
  UpdateClientTradeLicenseStatusDto,
  UpdateClientSocialStatusDto,
} from './dto/admin.dto';
import { InfluencerProfileEntity } from '../influencer/entities/influencer-profile.entity';
import { ClientProfileEntity } from '../client/entities/client-profile.entity';
import { NotificationService } from '../notification/notification.service';
import { UserEntity, UserRole } from '../user/entities/user.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(InfluencerProfileEntity)
    private readonly profileRepo: Repository<InfluencerProfileEntity>,
    @InjectRepository(InfluencerProfileEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(ClientProfileEntity)
    private readonly clientProfileRepo: Repository<ClientProfileEntity>,
    private readonly notificationService: NotificationService,
  ) {}

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
    const [profiles, total] = await this.profileRepo.findAndCount({
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
        email: p.user.email,
        isVerified: p.user.isVerified,
        pendingItemsCount: pendingCount, // <--- The Count you wanted
        niches: p.niches?.map((n) => n.niche) || [], // Just names
      };
    });

    return { data, meta: { total, page, limit } };
  }

  async getProfileDetails(userId: string) {
    const profile = await this.profileRepo.findOne({
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

  async updateNicheStatus(userId: string, dto: UpdateItemStatusDto) {
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

    await this.profileRepo.save(profile);
    await this.notifyUser(
      userId,
      `Niche (${dto.identifier})`,
      dto.status,
      dto.rejectReason,
    );
    await this.checkAndToggleUserVerification(profile); // Check Progress

    return { success: true, message: `Niche ${dto.status}` };
  }

  // 4. Approve/Reject Skill
  async updateSkillStatus(userId: string, dto: UpdateItemStatusDto) {
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

    await this.profileRepo.save(profile);
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

    await this.profileRepo.save(profile);
    await this.notifyUser(userId, 'Social Link', dto.status, dto.rejectReason);
    await this.checkAndToggleUserVerification(profile);

    return { success: true, message: `Social Link ${dto.status}` };
  }

  // 6. Approve/Reject Payout (Bank)
  async updateBankStatus(userId: string, dto: UpdatePayoutStatusDto) {
    const profile = await this.getProfileDetails(userId);

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

    await this.profileRepo.save(profile);
    await this.notifyUser(userId, 'Bank Account', dto.status, dto.rejectReason);
    await this.checkAndToggleUserVerification(profile);

    return { success: true, message: `Bank Account ${dto.status}` };
  }

  async updateMobileStatus(userId: string, dto: UpdatePayoutStatusDto) {
    const profile = await this.getProfileDetails(userId);

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

    await this.profileRepo.save(profile);
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
    const profile = await this.getRawProfile(userId);

    if (!profile.nidVerification)
      profile.nidVerification = { nidStatus: 'pending', nidRejectReason: '' };

    profile.nidVerification.nidStatus = dto.nidStatus;
    profile.nidVerification.nidRejectReason =
      dto.nidStatus === ApprovalStatus.REJECTED
        ? dto.rejectReason || 'No reason'
        : '';

    await this.profileRepo.save(profile);
    await this.notifyUser(
      userId,
      'NID Document',
      dto.nidStatus,
      dto.rejectReason,
    );
    await this.checkAndToggleUserVerification(profile);

    return { success: true, message: `NID ${dto.nidStatus}` };
  }

  // Internal Helper to get full profile for updates
  private async getRawProfile(userId: string) {
    const profile = await this.profileRepo.findOne({
      where: { userId },
      relations: ['user'],
    });
    if (!profile) throw new NotFoundException('Profile not found');
    return profile;
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
}
