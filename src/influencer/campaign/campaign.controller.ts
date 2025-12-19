import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CampaignService } from './campaign.service';
import {
  CreateCampaignStep1Dto,
  UpdateCampaignStep2Dto,
  UpdateCampaignStep3Dto,
  UpdateCampaignStep4Dto,
  UpdateCampaignStep5Dto,
} from './dto/create-campaign.dto';
import {
  UpdateCampaignDto,
  UpdateCampaignStatusDto,
  SearchCampaignDto,
} from './dto/update-campaign.dto';
import {
  SendQuoteDto,
  CounterOfferDto,
  AcceptNegotiationDto,
  RejectCampaignDto,
} from './dto/campaign-negotiation.dto';
import {
  AssignCampaignDto,
  UpdateAssignmentDto,
  AcceptJobDto,
  DeclineJobDto,
  SearchAssignmentDto,
} from './dto/campaign-assignment.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UserRole } from '../user/entities/user.entity';

@Controller('campaign')
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  // ============================================
  // CLIENT ROUTES
  // ============================================

  // --- Step 1: Create Campaign (Basic Info) ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.CLIENT)
  @Post()
  createCampaign(@Request() req, @Body() dto: CreateCampaignStep1Dto) {
    return this.campaignService.createCampaign(req.user.sub, dto);
  }

  // --- Step 2: Update Targeting & Preferences ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.CLIENT)
  @Patch(':id/step-2')
  updateStep2(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Body() dto: UpdateCampaignStep2Dto,
  ) {
    return this.campaignService.updateStep2(id, req.user.sub, dto);
  }

  // --- Step 3: Update Campaign Details ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.CLIENT)
  @Patch(':id/step-3')
  updateStep3(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Body() dto: UpdateCampaignStep3Dto,
  ) {
    return this.campaignService.updateStep3(id, req.user.sub, dto);
  }

  // --- Step 4: Update Budget & Milestones ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.CLIENT)
  @Patch(':id/step-4')
  updateStep4(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Body() dto: UpdateCampaignStep4Dto,
  ) {
    return this.campaignService.updateStep4(id, req.user.sub, dto);
  }

  // --- Step 5: Update Assets & Final Setup ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.CLIENT)
  @Patch(':id/step-5')
  updateStep5(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Body() dto: UpdateCampaignStep5Dto,
  ) {
    return this.campaignService.updateStep5(id, req.user.sub, dto);
  }

  // --- Place Campaign (Finalize) ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.CLIENT)
  @Post(':id/place')
  placeCampaign(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.campaignService.placeCampaign(id, req.user.sub);
  }

  // --- Get My Campaigns (Client) ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.CLIENT)
  @Get('my-campaigns')
  getClientCampaigns(@Request() req, @Query() query: SearchCampaignDto) {
    return this.campaignService.getClientCampaigns(req.user.sub, query);
  }

  // --- Get Single Campaign (Client) ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.CLIENT)
  @Get(':id')
  getCampaign(@Param('id', ParseUUIDPipe) id: string) {
    return this.campaignService.getCampaignById(id);
  }

  // --- Delete Campaign (Draft only) ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.CLIENT)
  @Delete(':id')
  deleteCampaign(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.campaignService.deleteCampaign(id, req.user.sub);
  }

  // --- Delete Asset ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.CLIENT)
  @Delete('asset/:assetId')
  deleteAsset(@Param('assetId', ParseUUIDPipe) assetId: string, @Request() req) {
    return this.campaignService.deleteAsset(assetId, req.user.sub);
  }

  // --- Budget Preview ---
  @UseGuards(AuthGuard('jwt-brandguru'))
  @Get('budget/preview')
  getBudgetPreview(@Query('baseBudget') baseBudget: number) {
    return this.campaignService.getBudgetPreview(Number(baseBudget));
  }

  // ============================================
  // NEGOTIATION ROUTES (Client)
  // ============================================

  // --- Client: Send Counter-offer ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.CLIENT)
  @Post('negotiation/counter-offer')
  clientCounterOffer(@Request() req, @Body() dto: CounterOfferDto) {
    return this.campaignService.sendCounterOffer(req.user.sub, dto);
  }

  // --- Client: Accept Quote ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.CLIENT)
  @Post('negotiation/accept')
  clientAccept(@Request() req, @Body() dto: AcceptNegotiationDto) {
    return this.campaignService.acceptQuote(req.user.sub, 'client', dto);
  }

  // --- Client: Reject/Cancel ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.CLIENT)
  @Post('negotiation/reject')
  clientReject(@Request() req, @Body() dto: RejectCampaignDto) {
    return this.campaignService.rejectCampaign(req.user.sub, 'client', dto);
  }

  // --- Get Negotiation History ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.CLIENT)
  @Get(':id/negotiations')
  clientGetNegotiations(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.campaignService.getNegotiationHistory(id, req.user.sub, 'client');
  }

  // --- Get Campaign Assignments (Client - View Own Campaign Assignments) ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.CLIENT)
  @Get(':id/assignments')
  clientGetCampaignAssignments(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.campaignService.getCampaignAssignmentsForClient(id, req.user.sub);
  }

  // ============================================
  // ADMIN ROUTES
  // ============================================

  // --- Admin: Get All Campaigns ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/all')
  adminGetAllCampaigns(@Query() query: SearchCampaignDto) {
    return this.campaignService.getAllCampaigns(query);
  }

  // --- Admin: Get Single Campaign ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/:id')
  adminGetCampaign(@Param('id', ParseUUIDPipe) id: string) {
    return this.campaignService.getCampaignById(id);
  }

  // --- Admin: Update Campaign Status ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('admin/:id/status')
  adminUpdateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCampaignStatusDto,
  ) {
    return this.campaignService.updateCampaignStatus(id, dto);
  }

  // --- Admin: Send Quote ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/negotiation/send-quote')
  adminSendQuote(@Request() req, @Body() dto: SendQuoteDto) {
    return this.campaignService.sendQuote(req.user.sub, dto);
  }

  // --- Admin: Accept Client's Counter-offer ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/negotiation/accept')
  adminAccept(@Request() req, @Body() dto: AcceptNegotiationDto) {
    return this.campaignService.acceptQuote(req.user.sub, 'admin', dto);
  }

  // --- Admin: Reject Campaign ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/negotiation/reject')
  adminReject(@Request() req, @Body() dto: RejectCampaignDto) {
    return this.campaignService.rejectCampaign(req.user.sub, 'admin', dto);
  }

  // --- Admin: Get Negotiation History ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/:id/negotiations')
  adminGetNegotiations(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.campaignService.getNegotiationHistory(id, req.user.sub, 'admin');
  }

  // --- Admin: Reset Negotiation (to resend quote) ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/:id/reset-negotiation')
  resetNegotiation(@Param('id', ParseUUIDPipe) id: string) {
    return this.campaignService.resetNegotiation(id);
  }

  // --- Mark Negotiation as Read ---
  @UseGuards(AuthGuard('jwt-brandguru'))
  @Patch('negotiation/:negotiationId/read')
  markAsRead(@Param('negotiationId', ParseUUIDPipe) negotiationId: string) {
    return this.campaignService.markNegotiationRead(negotiationId);
  }

  // ============================================
  // ADMIN: CAMPAIGN ASSIGNMENT ROUTES
  // ============================================

  // --- Admin: Assign Campaign to Influencer ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/assign')
  assignCampaign(@Request() req, @Body() dto: AssignCampaignDto) {
    return this.campaignService.assignCampaignToInfluencers(req.user.userId, dto);
  }

  // --- Admin: Get Campaign Assignments ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/:id/assignments')
  getCampaignAssignments(@Param('id', ParseUUIDPipe) id: string) {
    return this.campaignService.getCampaignAssignments(id);
  }

  // --- Admin: Get All Assignments ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/assignments/all')
  getAllAssignments(@Query() query: SearchAssignmentDto) {
    return this.campaignService.getAllAssignments(query);
  }

  // --- Admin: Update Assignment ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('admin/assignment/:assignmentId')
  updateAssignment(
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() dto: UpdateAssignmentDto,
  ) {
    return this.campaignService.updateAssignment(assignmentId, dto);
  }

  // --- Admin: Cancel Assignment ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete('admin/assignment/:assignmentId')
  cancelAssignment(@Param('assignmentId', ParseUUIDPipe) assignmentId: string) {
    return this.campaignService.cancelAssignment(assignmentId);
  }

  // ============================================
  // INFLUENCER: JOB ROUTES (Simple 5-Stage Flow)
  // ============================================
  // Sections: New Offers → Pending → Active → Completed / Declined
  // ============================================

  // --- Get Influencer Dashboard Summary ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.INFLUENCER)
  @Get('influencer/dashboard/summary')
  getInfluencerDashboardSummary(@Request() req) {
    return this.campaignService.getInfluencerDashboardSummary(req.user.userId);
  }

  // --- Get Influencer Earnings Overview ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.INFLUENCER)
  @Get('influencer/dashboard/earnings-overview')
  getEarningsOverview(@Request() req, @Query('range') range: string = '7d') {
    return this.campaignService.getEarningsOverview(req.user.userId, range);
  }

  // --- Get Influencer's Available Addresses ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.INFLUENCER)
  @Get('influencer/addresses')
  getInfluencerAddresses(@Request() req) {
    return this.campaignService.getInfluencerAddresses(req.user.sub);
  }

  // --- Get My Jobs (filter by status for sections) ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.INFLUENCER)
  @Get('influencer/jobs')
  getInfluencerJobs(@Request() req, @Query() query: SearchAssignmentDto) {
    return this.campaignService.getInfluencerJobs(req.user.sub, query);
  }

  // --- Get Job Counts (for UI badges) ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.INFLUENCER)
  @Get('influencer/jobs/counts')
  getInfluencerJobCounts(@Request() req) {
    return this.campaignService.getInfluencerJobCounts(req.user.sub);
  }

  // --- Get Single Job Details ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.INFLUENCER)
  @Get('influencer/job/:jobId')
  getJobDetails(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Request() req,
  ) {
    return this.campaignService.getJobDetails(jobId, req.user.sub);
  }

  // --- Accept Job (new_offer → pending) ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.INFLUENCER)
  @Post('influencer/job/:jobId/accept')
  acceptJob(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Request() req,
    @Body() dto: AcceptJobDto,
  ) {
    return this.campaignService.acceptJob(jobId, req.user.sub, dto);
  }

  // --- Decline Job (new_offer → declined) ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.INFLUENCER)
  @Post('influencer/job/:jobId/decline')
  declineJob(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Request() req,
    @Body() dto: DeclineJobDto,
  ) {
    return this.campaignService.declineJob(jobId, req.user.sub, dto);
  }

  // --- Start Job (pending → active) ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.INFLUENCER)
  @Post('influencer/job/:jobId/start')
  startJob(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Request() req,
  ) {
    return this.campaignService.startJob(jobId, req.user.sub);
  }

  // --- Complete Job (active → completed) ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.INFLUENCER)
  @Post('influencer/job/:jobId/complete')
  completeJob(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Request() req,
  ) {
    return this.campaignService.completeJob(jobId, req.user.sub);
  }
}
