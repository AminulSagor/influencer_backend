import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UserRole } from '../user/entities/user.entity';
import { AgencyCampaignService } from './agency-campaign.service';
import {
  AgencySearchCampaignDto,
  AgencyRequoteDto,
} from './dto/agency-campaign.dto';
import { SubmitMilestoneDto } from './dto/execution.dto';

@Controller('agency/campaign')
@UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
@Roles(UserRole.AGENCY)
export class AgencyCampaignController {
  constructor(private readonly agencyService: AgencyCampaignService) {}

  // --- Dashboard Overview ---
  @Get('stats')
  getStats(@Request() req) {
    return this.agencyService.getDashboardStats(req.user.sub);
  }

  // --- List Jobs (New, Active, etc.) ---
  @Get('list')
  findAll(@Request() req, @Query() query: AgencySearchCampaignDto) {
    return this.agencyService.findAll(req.user.sub, query);
  }

  // --- Job Details (Accept/Requote View) ---
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.agencyService.findOne(id, req.user.sub);
  }

  // --- Action: Accept Invite ---
  @Post(':id/accept')
  acceptInvite(@Param('id') id: string, @Request() req) {
    return this.agencyService.acceptInvite(id, req.user.sub);
  }

  // --- Action: Request Requote ---
  @Post(':id/requote')
  requote(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: AgencyRequoteDto,
  ) {
    return this.agencyService.requote(id, req.user.sub, dto);
  }

  // --- Get Specific Milestone Details ---
  @Get('milestone/:id')
  getMilestone(@Param('id') id: string, @Request() req) {
    return this.agencyService.getMilestone(id, req.user.sub);
  }

  // --- Submit / Resubmit Milestone ---
  @Post('milestone/:id/submit')
  submitMilestone(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: SubmitMilestoneDto,
  ) {
    return this.agencyService.submitMilestone(id, req.user.sub, dto);
  }
}
