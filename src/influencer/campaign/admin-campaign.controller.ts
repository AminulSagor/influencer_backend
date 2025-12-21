import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Patch,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UserRole } from '../user/entities/user.entity';
import { AdminCampaignService } from './admin-campaign.service';
import {
  AdminSearchCampaignDto,
  AdminSendQuoteDto,
  AdminInviteAgencyDto,
  AdminInviteInfluencersDto,
  AdminSearchEntityDto,
  UpdatePlatformFeeDto,
  AdminReviewMilestoneDto,
} from './dto/admin-campaign.dto';

@Controller('admin/campaign')
@UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminCampaignController {
  constructor(private readonly adminService: AdminCampaignService) {}

  // --- 1. Dashboard List ---
  @Get('list')
  findAll(@Query() query: AdminSearchCampaignDto) {
    return this.adminService.findAll(query);
  }

  // --- 2. Campaign Details (Needs Quote/Active View) ---
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.adminService.findOne(id);
  }

  // --- 3. Send Budget Quote (Action) ---
  @Post(':id/quote')
  sendQuote(@Param('id') id: string, @Body() dto: AdminSendQuoteDto) {
    return this.adminService.sendQuote(id, dto);
  }

  // --- 4. Search Agencies (Popup) ---
  @Get('search/agencies')
  searchAgencies(@Query() query: AdminSearchEntityDto) {
    return this.adminService.searchAgencies(query);
  }

  // --- 5. Invite Agency (Action) ---
  @Post(':id/invite-agency')
  inviteAgency(@Param('id') id: string, @Body() dto: AdminInviteAgencyDto) {
    return this.adminService.inviteAgency(id, dto);
  }

  // --- Management: Update Platform Profit ---
  @Patch(':id/profit')
  updatePlatformFee(
    @Param('id') id: string,
    @Body() dto: UpdatePlatformFeeDto,
  ) {
    return this.adminService.updatePlatformFee(id, dto);
  }

  // --- 6. Search Influencers (Popup) ---
  @Get('search/influencers')
  searchInfluencers(@Query() query: AdminSearchEntityDto) {
    return this.adminService.searchInfluencers(query);
  }

  // --- 7. Invite Influencers (Action) ---
  @Post(':id/invite-influencers')
  assignInfluencers(
    @Param('id') id: string,
    @Body() dto: AdminInviteInfluencersDto,
  ) {
    return this.adminService.inviteInfluencers(id, dto);
  }

  // --- Execution: Review Milestone (Approve/Decline) ---
  @Patch('milestone/:id/review')
  reviewMilestone(
    @Param('id') id: string,
    @Body() dto: AdminReviewMilestoneDto,
  ) {
    return this.adminService.reviewMilestone(id, dto);
  }

  // --- Reports: View ---
  @Get(':id/reports')
  getReports(@Param('id') id: string) {
    return this.adminService.getCampaignReports(id);
  }

  @Post(':id/verify-payment')
  verifyPayment(@Param('id') id: string, @Body('amount') amount: number) {
    return this.adminService.manualVerifyPayment(id, amount);
  }
}
