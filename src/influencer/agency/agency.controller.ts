import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Query,
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
  AddAgencyPayoutDto,
  DeleteAgencyItemDto,
  UpdateAgencyNidDto,
  UpdateAgencyTradeLicenseDto,
  UpdateAgencyTinDto,
  UpdateAgencyBinDto,
  AgencyNichesDto,
} from './dto/update-agency.dto';
import { AgencyOnboardingDto } from './dto/create-agency.dto';
import { ReportFilterDto } from '../campaign/dto/report-filter.dto';

@Controller('agency')
@UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
@Roles(UserRole.AGENCY)
export class AgencyController {
  constructor(private readonly agencyService: AgencyService) {}

  @Patch('profile/onboarding')
  async updateOnboarding(@Request() req, @Body() dto: AgencyOnboardingDto) {
    return this.agencyService.updateOnboarding(req.user.userId, dto);
  }

  // 1. Get Full Profile
  @Get()
  async getProfile(@Request() req) {
    return this.agencyService.getProfile(req.user.userId);
  }

  // 2. Update Basic Info (Name, Bio, Logo, Website, Owner Info)
  @Patch('profile/basic-info')
  async updateBasic(@Request() req, @Body() dto: UpdateAgencyBasicDto) {
    return this.agencyService.updateBasicProfile(req.user.userId, dto);
  }

  // 3. Update Address
  @Patch('profile/address')
  async updateAddress(@Request() req, @Body() dto: UpdateAgencyAddressDto) {
    return this.agencyService.updateAddress(req.user.userId, dto);
  }

  // 4. Update Social Links
  @Patch('profile/socials')
  async updateSocials(@Request() req, @Body() dto: UpdateAgencySocialsDto) {
    return this.agencyService.updateSocialLinks(req.user.userId, dto);
  }

  // 5. Update Verification Docs (NID, Trade License, TIN)

  @Patch('profile/verification/nid')
  async updateNid(@Request() req, @Body() dto: UpdateAgencyNidDto) {
    return this.agencyService.updateNid(req.user.userId, dto);
  }

  @Patch('profile/verification/trade-license')
  async updateTradeLicense(
    @Request() req,
    @Body() dto: UpdateAgencyTradeLicenseDto,
  ) {
    return this.agencyService.updateTradeLicense(req.user.userId, dto);
  }

  @Patch('profile/verification/tin')
  async updateTin(@Request() req, @Body() dto: UpdateAgencyTinDto) {
    return this.agencyService.updateTin(req.user.userId, dto);
  }

  @Patch('profile/verification/bin')
  async updateBin(@Request() req, @Body() dto: UpdateAgencyBinDto) {
    return this.agencyService.updateBin(req.user.userId, dto);
  }

  @Patch('profile/niches')
  async updateNiches(@Request() req, @Body() dto: AgencyNichesDto) {
    return this.agencyService.addNiches(req.user.userId, dto.niches);
  }

  // 6. Add Payout Method
  @Post('profile/payouts')
  async addPayout(@Request() req, @Body() dto: AddAgencyPayoutDto) {
    return this.agencyService.addPayout(req.user.userId, dto);
  }

  // 7. Delete Payout Method
  @Delete('profile/payouts')
  async deletePayout(@Request() req, @Body() dto: DeleteAgencyItemDto) {
    return this.agencyService.deletePayout(req.user.userId, dto);
  }

  // -----------------------------------------------------------
  // AGENCY: Report / Issues Dashboard
  // -----------------------------------------------------------
  @Get('reports')
  async getAgencyReports(@Request() req, @Query() dto: ReportFilterDto) {
    return await this.agencyService.getAgencyReports(req.user.userId, dto);
  }
}
