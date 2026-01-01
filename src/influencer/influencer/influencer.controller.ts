import {
  Controller,
  Patch,
  Body,
  UseGuards,
  Request,
  Get,
  Post,
  Delete,
  Param,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InfluencerService } from './influencer.service';
import { OnboardingDto } from './dto/onboarding.dto';
import {
  AddLocationDto,
  AddNichesDto,
  AddPayoutDto,
  AddSkillsDto,
} from './dto/update-verification.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from '../user/entities/user.entity';
import { RolesGuard } from 'src/common/guards/roles.guard';
import {
  DeleteItemDto,
  UpdateInfluencerDto,
} from './dto/update-influencer.dto';

@Controller('influencer/profile')
@UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
@Roles(UserRole.INFLUENCER)
export class InfluencerController {
  constructor(private readonly influencerService: InfluencerService) {}

  // --- Consolidated Onboarding API ---
  // Handles Screens 05 (Address), 06 (Socials), 07 (NID)
  @Patch('onboarding')
  async updateOnboarding(@Request() req, @Body() dto: OnboardingDto) {
    // 1. Prepare Data for Entity
    const updateData: any = {};

    // Map Address (If provided)
    if (dto.fullAddress || dto.thana || dto.zilla) {
      updateData.addresses = [
        {
          addressName: 'Primary',
          thana: dto.thana,
          zilla: dto.zilla,
          fullAddress: dto.fullAddress,
        },
      ];
    }

    // Map Socials (If provided)
    if (dto.socialLinks) updateData.socialLinks = dto.socialLinks;
    if (dto.website) updateData.website = dto.website;
    // if (dto.bio) updateData.bio = dto.bio;

    // Map NID (If provided)
    if (dto.nidNumber) updateData.nidNumber = dto.nidNumber;
    if (dto.nidFrontImg) {
      updateData.nidFrontImg = dto.nidFrontImg;
      updateData.nidVerification = {
        nidStatus: 'pending',
        nidRejectReason: '',
      }; // Auto-set status to pending
    }
    if (dto.nidBackImg) updateData.nidBackImg = dto.nidBackImg;

    // 2. Call Service
    return this.influencerService.completeOnboarding(
      req.user.userId,
      updateData,
    );
  }

  @Patch('niches')
  async updateNiches(@Request() req, @Body() dto: AddNichesDto) {
    return this.influencerService.addNiches(req.user.userId, dto.niches);
  }

  @Patch('skills')
  async updateSkills(@Request() req, @Body() dto: AddSkillsDto) {
    return this.influencerService.addSkills(req.user.userId, dto.skills);
  }

  @Post('payouts')
  async addPayout(@Request() req, @Body() dto: AddPayoutDto) {
    return this.influencerService.addPayout(req.user.userId, dto);
  }

  @Post('address')
  async addLocation(@Request() req, @Body() dto: AddLocationDto) {
    return this.influencerService.addLocations(req.user.userId, dto);
  }

  @Get()
  async getProfile(@Request() req) {
    return this.influencerService.getProfile(req.user.userId);
  }

  @Patch('basic-info')
  updateBasic(@Request() req, @Body() dto: UpdateInfluencerDto) {
    return this.influencerService.updateBasicProfile(req.user.userId, dto);
  }

  @Delete('profile-image')
  removeImage(@Request() req) {
    return this.influencerService.deleteProfileImage(req.user.userId);
  }

  @Delete('niche/:nicheName')
  removeNiche(@Request() req, @Param('nicheName') niche: string) {
    return this.influencerService.deleteNiche(req.user.userId, niche);
  }

  // For payouts, since we need type + id, we use Body or Query
  @Delete('payouts')
  removePayout(@Request() req, @Body() dto: DeleteItemDto) {
    return this.influencerService.deletePayout(req.user.userId, dto);
  }
}
