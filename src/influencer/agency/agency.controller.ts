import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from '../user/entities/user.entity';
import { AgencyService } from './agency.service';
import {
  UpdateAgencyBasicDto,
  UpdateAgencyAddressDto,
  UpdateAgencySocialsDto,
  UpdateAgencyVerificationDto,
  AddAgencyPayoutDto,
  DeleteAgencyItemDto,
} from './dto/update-agency.dto';

@Controller('agency/profile')
@UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
@Roles(UserRole.AGENCY)
export class AgencyController {
  constructor(private readonly agencyService: AgencyService) {}

  // 1. Get Full Profile
  @Get()
  async getProfile(@Request() req) {
    return this.agencyService.getProfile(req.user.userId);
  }

  // 2. Update Basic Info (Name, Bio, Logo, Website, Owner Info)
  @Patch('basic-info')
  async updateBasic(@Request() req, @Body() dto: UpdateAgencyBasicDto) {
    return this.agencyService.updateBasicProfile(req.user.userId, dto);
  }

  // 3. Update Address
  @Patch('address')
  async updateAddress(@Request() req, @Body() dto: UpdateAgencyAddressDto) {
    return this.agencyService.updateAddress(req.user.userId, dto);
  }

  // 4. Update Social Links
  @Patch('socials')
  async updateSocials(@Request() req, @Body() dto: UpdateAgencySocialsDto) {
    return this.agencyService.updateSocialLinks(req.user.userId, dto);
  }

  // 5. Update Verification Docs (NID, Trade License, TIN)
  @Patch('verification')
  async updateVerification(
    @Request() req,
    @Body() dto: UpdateAgencyVerificationDto,
  ) {
    return this.agencyService.updateVerification(req.user.userId, dto);
  }

  // 6. Add Payout Method
  @Post('payouts')
  async addPayout(@Request() req, @Body() dto: AddAgencyPayoutDto) {
    return this.agencyService.addPayout(req.user.userId, dto);
  }

  // 7. Delete Payout Method
  @Delete('payouts')
  async deletePayout(@Request() req, @Body() dto: DeleteAgencyItemDto) {
    return this.agencyService.deletePayout(req.user.userId, dto);
  }
}
