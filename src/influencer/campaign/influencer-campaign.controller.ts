import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Patch,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UserRole } from '../user/entities/user.entity';
import { InfluencerCampaignService } from './influencer-campaign.service';
import {
  AddDeliveryAddressDto,
  InfluencerDeclineDto,
  InfluencerSearchCampaignDto,
  WithdrawalRequestDto,
} from './dto/influencer-campaign.dto';
import { SubmitMilestoneDto } from './dto/execution.dto';

@Controller('influencer/campaign')
@UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
@Roles(UserRole.INFLUENCER)
export class InfluencerCampaignController {
  constructor(private readonly influencerService: InfluencerCampaignService) {}

  // --- Dashboard Stats ---
  @Get('stats')
  getStats(@Request() req) {
    return this.influencerService.getDashboardStats(req.user.sub);
  }

  // --- List Campaigns ---
  @Get('list')
  findAll(@Request() req, @Query() query: InfluencerSearchCampaignDto) {
    return this.influencerService.findAll(req.user.sub, query);
  }

  // --- Campaign Details ---
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.influencerService.findOne(id, req.user.sub);
  }

  // --- Accept Offer ---
  @Post(':id/accept')
  acceptOffer(@Param('id') id: string, @Request() req) {
    return this.influencerService.acceptOffer(id, req.user.sub);
  }

  // --- Decline Offer ---
  // Endpoint to decline a new campaign offer with a reason
  @Post(':id/decline')
  declineOffer(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: InfluencerDeclineDto,
  ) {
    return this.influencerService.declineOffer(id, req.user.sub, dto);
  }

  // --- Product Delivery ---
  @Patch(':id/address')
  addAddress(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: AddDeliveryAddressDto,
  ) {
    return this.influencerService.addDeliveryAddress(id, req.user.sub, dto);
  }

  // --- Get Specific Milestone Details ---
  @Get('milestone/:id')
  getMilestoneDetails(@Param('id') id: string, @Request() req) {
    return this.influencerService.getMilestoneDetails(id, req.user.sub);
  }

  // --- Submit / Resubmit Milestone ---
  @Post('milestone/:id/submit')
  submitMilestone(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: SubmitMilestoneDto,
  ) {
    return this.influencerService.submitMilestone(id, req.user.sub, dto);
  }

  // --- Financials ---
  @Post('withdrawal')
  requestWithdrawal(@Request() req, @Body() dto: WithdrawalRequestDto) {
    return this.influencerService.requestWithdrawal(req.user.sub, dto);
  }
}
