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

@Controller('agency/profile')
@UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
@Roles(UserRole.AGENCY)
export class AgencyController {
  constructor(private readonly agencyService: AgencyService) {}

  @Patch('onboarding')
  async updateOnboarding(@Request() req, @Body() dto: AgencyOnboardingDto) {
    return this.agencyService.updateOnboarding(req.user.userId, dto);
  }

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

  @Patch('verification/nid')
  async updateNid(@Request() req, @Body() dto: UpdateAgencyNidDto) {
    return this.agencyService.updateNid(req.user.userId, dto);
  }

  @Patch('verification/trade-license')
  async updateTradeLicense(
    @Request() req,
    @Body() dto: UpdateAgencyTradeLicenseDto,
  ) {
    return this.agencyService.updateTradeLicense(req.user.userId, dto);
  }

  @Patch('verification/tin')
  async updateTin(@Request() req, @Body() dto: UpdateAgencyTinDto) {
    return this.agencyService.updateTin(req.user.userId, dto);
  }

  @Patch('verification/bin')
  async updateBin(@Request() req, @Body() dto: UpdateAgencyBinDto) {
    return this.agencyService.updateBin(req.user.userId, dto);
  }

  @Patch('niches')
  async updateNiches(@Request() req, @Body() dto: AgencyNichesDto) {
    return this.agencyService.addNiches(req.user.userId, dto.niches);
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

  // -----------------------------------------------------------
  // AGENCY: Report / Issues Dashboard
  // -----------------------------------------------------------
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.AGENCY)
  @Get('reports')
  async getAgencyReports(@Request() req, @Query() dto: ReportFilterDto) {
    return await this.agencyService.getAgencyReports(req.user.userId, dto);
  }
}
