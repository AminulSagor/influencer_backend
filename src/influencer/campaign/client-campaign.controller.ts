import {
  Controller,
  Post,
  Patch,
  Body,
  Request,
  UseGuards,
  Param,
  Get,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UserRole } from '../user/entities/user.entity';
import { ClientCampaignService } from './client-campaign.service';
import {
  CreateCampaignStep1Dto,
  UpdateCampaignStep2Dto,
  UpdateCampaignStep3Dto,
  UpdateCampaignStep4Dto,
  UpdateCampaignStep5Dto,
  SearchCampaignDto,
  FundCampaignDto,
} from './dto/client-campaign.dto';
import {
  CreateReportDto,
  RateCampaignDto,
  ReviewMilestoneDto,
  SendBonusDto,
  SubmitMilestoneDto,
} from './dto/execution.dto';

@Controller('client/campaign')
@UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
@Roles(UserRole.CLIENT)
export class ClientCampaignController {
  constructor(private readonly campaignService: ClientCampaignService) {}

  @Post('create')
  createDraft(@Request() req, @Body() dto: CreateCampaignStep1Dto) {
    return this.campaignService.createDraft(req.user.sub, dto);
  }

  @Patch(':id/preferences')
  updateStep2(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: UpdateCampaignStep2Dto,
  ) {
    return this.campaignService.updateStep2(id, req.user.sub, dto);
  }

  @Patch(':id/details')
  updateStep3(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: UpdateCampaignStep3Dto,
  ) {
    return this.campaignService.updateStep3(id, req.user.sub, dto);
  }

  @Patch(':id/budget')
  updateStep4(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: UpdateCampaignStep4Dto,
  ) {
    return this.campaignService.updateStep4(id, req.user.sub, dto);
  }

  @Patch(':id/assets')
  updateStep5(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: UpdateCampaignStep5Dto,
  ) {
    return this.campaignService.updateStep5(id, req.user.sub, dto);
  }

  @Get(':id/review')
  getReview(@Param('id') id: string, @Request() req) {
    return this.campaignService.getReviewData(id, req.user.sub);
  }

  @Post(':id/place')
  placeCampaign(@Param('id') id: string, @Request() req) {
    return this.campaignService.placeCampaign(id, req.user.sub);
  }

  @Get('list')
  getCampaigns(@Request() req, @Query() query: SearchCampaignDto) {
    return this.campaignService.getClientCampaigns(req.user.sub, query);
  }

  // --- Get Dashboard Details (Single Campaign) ---
  @Get(':id/details')
  getDetails(@Param('id') id: string, @Request() req) {
    return this.campaignService.getCampaignDetails(id, req.user.sub);
  }
  // --- Requote (Counter Offer) ---
  @Post(':id/requote')
  requote(
    @Param('id') id: string,
    @Request() req,
    @Body('amount') amount: number,
  ) {
    return this.campaignService.requote(id, req.user.sub, amount);
  }

  // --- Confirm Budget ---
  @Post(':id/confirm-budget')
  confirmBudget(@Param('id') id: string, @Request() req) {
    return this.campaignService.confirmBudget(id, req.user.sub);
  }

  // ============================================
  // FUNDING ("Pay Dues")
  // ============================================
  @Post(':id/fund')
  fundCampaign(
    @Param('id') id: string,
    @Request() req,
    @Body('amount') amount: number,
  ) {
    return this.campaignService.fundCampaign(id, req.user.sub, amount);
  }

  // ============================================
  // EXECUTION
  // ============================================

  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.INFLUENCER, UserRole.AGENCY)
  @Post('milestone/:id/submit')
  submitMilestone(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: SubmitMilestoneDto,
  ) {
    return this.campaignService.submitMilestone(id, req.user.sub, dto);
  }

  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @Post('milestone/:id/review')
  reviewMilestone(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: ReviewMilestoneDto,
  ) {
    return this.campaignService.reviewMilestone(id, req.user.sub, dto);
  }

  // ============================================
  // POPUPS & EXTRAS
  // ============================================

  @Post('report')
  createReport(@Request() req, @Body() dto: CreateReportDto) {
    return this.campaignService.createReport(req.user.sub, dto);
  }

  @Post('bonus')
  sendBonus(@Request() req, @Body() dto: SendBonusDto) {
    return this.campaignService.sendBonus(req.user.sub, dto);
  }

  @Get(':id/target-overflow')
  getTargetOverflow(@Param('id') id: string) {
    return this.campaignService.getTargetOverflow(id);
  }

  @Post('rate')
  rateCampaign(@Request() req, @Body() dto: RateCampaignDto) {
    return this.campaignService.rateCampaign(req.user.sub, dto);
  }
}
