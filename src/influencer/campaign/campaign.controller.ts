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
  BadRequestException,
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
  SubmitMilestoneDto,
} from './dto/campaign-assignment.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UserRole } from '../user/entities/user.entity';
import { AgencySearchCampaignDto } from './dto/agency-campaign.dto';
import {
  AgencyQuoteActionDto,
  AgencyRequoteDto,
  AssignAgencyDto,
  SelectAgencyDto,
} from './dto/admin-agency.dto';
import { PayBonusDto, PayDueDto } from './dto/payment.dto';
import {
  AdminPayMilestoneDto,
  ApproveMilestoneDto,
  ReviewMilestoneDto,
  UpdateMilestoneAmountDto,
  UpdateMilestoneResultDto,
} from './dto/campaign-milestone.dto';
import { RateCampaignDto } from './dto/rate-campaign.dto';

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
  deleteAsset(
    @Param('assetId', ParseUUIDPipe) assetId: string,
    @Request() req,
  ) {
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
  clientGetNegotiations(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
  ) {
    return this.campaignService.getNegotiationHistory(
      id,
      req.user.sub,
      'client',
    );
  }

  // --- Get Campaign Assignments (Client - View Own Campaign Assignments) ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.CLIENT)
  @Get(':id/assignments')
  clientGetCampaignAssignments(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
  ) {
    return this.campaignService.getCampaignAssignmentsForClient(
      id,
      req.user.sub,
    );
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
    return this.campaignService.getNegotiationHistory(
      id,
      req.user.sub,
      'admin',
    );
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
    return this.campaignService.assignCampaignToInfluencers(
      req.user.userId,
      dto,
    );
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
  getJobDetails(@Param('jobId', ParseUUIDPipe) jobId: string, @Request() req) {
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
  startJob(@Param('jobId', ParseUUIDPipe) jobId: string, @Request() req) {
    return this.campaignService.startJob(jobId, req.user.sub);
  }

  // --- Complete Job (active → completed) ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.INFLUENCER)
  @Post('influencer/job/:jobId/complete')
  completeJob(@Param('jobId', ParseUUIDPipe) jobId: string, @Request() req) {
    return this.campaignService.completeJob(jobId, req.user.sub);
  }

  // ============================================
  // ADMIN-AGENCY ROUTES
  // ============================================

  // --- 1. Assign Agency (Modal in Admin Dashboard) ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/assign-agency')
  assignAgency(@Request() req, @Body() dto: AssignAgencyDto) {
    return this.campaignService.assignCampaignToAgencies(req.user.sub, dto);
  }

  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('milestone/:id/amount')
  async updateMilestoneAmount(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMilestoneAmountDto,
  ) {
    return await this.campaignService.updateMilestoneAmount(id, dto);
  }

  //  Admin Assigns Agencies ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/assign-agencies')
  assignAgencies(@Request() req, @Body() dto: AssignAgencyDto) {
    return this.campaignService.assignCampaignToAgencies(req.user.sub, dto);
  }

  // ---  Client: Get Agency Bids (Comparison View) ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.CLIENT)
  @Get('client/bids/:campaignId')
  async getAgencyBids(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Request() req,
  ) {
    return await this.campaignService.getCampaignAgencyBids(
      campaignId,
      req.user.sub,
    );
  }

  // --- Client Picks Winner ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.CLIENT)
  @Post('client/select-agency')
  selectWinner(@Request() req, @Body() dto: SelectAgencyDto) {
    return this.campaignService.clientSelectAgency(req.user.sub, dto);
  }

  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.CLIENT)
  @Get('client/details/:campaignId')
  async getCampaignDetails(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Request() req,
  ) {
    const userId = req.user.userId;
    return await this.campaignService.getClientCampaignDetails(
      campaignId,
      userId,
    );
  }

  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.CLIENT)
  @Post('client/pay-due')
  async payDue(@Request() req, @Body() dto: PayDueDto) {
    const userId = req.user.userId;
    return await this.campaignService.payDueAmount(
      userId,
      dto.campaignId,
      dto.amount,
    );
  }

  // @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  // @Roles(UserRole.CLIENT)
  // @Post('client/milestone/approve')
  // async approveMilestone(@Request() req, @Body() dto: ApproveMilestoneDto) {
  //   return await this.campaignService.clientApproveMilestone(
  //     req.user.userId,
  //     dto,
  //   );
  // }

  // --- Admin/Client: View agencies assigned to a specific campaign ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CLIENT)
  @Get('admin/:id/assigned-agencies')
  getAssignedAgencies(@Param('id', ParseUUIDPipe) id: string) {
    return this.campaignService.getCampaignAssignedAgencies(id);
  }

  // --- Admin: View all campaigns assigned to agencies globally ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/agency-assignments/all')
  getAllAgencyJobs(@Query() query: AgencySearchCampaignDto) {
    return this.campaignService.getAllAgencyAssignments(query);
  }

  // --- Admin: Update Agency Assignment ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('admin/agency-assignment/:id')
  updateAgencyAssignment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AgencyQuoteActionDto,
  ) {
    return this.campaignService.updateAgencyAssignment(id, dto);
  }

  // --- Admin: Cancel Agency Assignment ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete('admin/agency-assignment/:id')
  cancelAgencyAssignment(@Param('id', ParseUUIDPipe) id: string) {
    return this.campaignService.cancelAgencyAssignment(id);
  }

  // --- 2. Accept Agency Requote ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/agency-quote/accept')
  acceptAgencyQuote(@Request() req, @Body() dto: AgencyQuoteActionDto) {
    return this.campaignService.adminManageAgencyQuote(
      req.user.sub,
      dto,
      'accept',
    );
  }

  // --- 3. Reject Agency Requote ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/agency-quote/reject')
  rejectAgencyQuote(@Request() req, @Body() dto: AgencyQuoteActionDto) {
    return this.campaignService.adminManageAgencyQuote(
      req.user.sub,
      dto,
      'reject',
    );
  }

  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.CLIENT)
  @Post('client/submission/:submissionId/review') // Changed URL to be specific
  async clientReview(
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Request() req,
    @Body() dto: ReviewMilestoneDto,
  ) {
    return await this.campaignService.clientReviewSubmission(
      req.user.userId,
      submissionId,
      dto,
    );
  }

  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/submission/:submissionId/review')
  async adminReview(
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Body() dto: ReviewMilestoneDto,
  ) {
    return await this.campaignService.adminReviewSubmission(submissionId, dto);
  }

  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/submission/:submissionId/pay')
  async adminPay(
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Body() dto: AdminPayMilestoneDto,
  ) {
    return await this.campaignService.adminPaySubmission(submissionId, dto);
  }

  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/submission/:submissionId/decline')
  async adminDecline(
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Body('reason') reason: string,
  ) {
    return await this.campaignService.adminDeclineSubmission(
      submissionId,
      reason,
    );
  }

  // ============================================
  // AGENCY ROUTES (New Section)
  // ============================================

  // --- Agency: Dashboard Stats ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.AGENCY)
  @Get('agency/stats')
  agencyStats(@Request() req) {
    return this.campaignService.getAgencyDashboardStats(req.user.sub);
  }

  // --- Agency: List Campaigns ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.AGENCY)
  @Get('agency/list')
  agencyList(@Request() req, @Query() query: AgencySearchCampaignDto) {
    return this.campaignService.getAgencyCampaigns(req.user.sub, query);
  }

  // --- Agency: Get Single Campaign ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.AGENCY)
  @Get('agency/:id')
  agencyGetCampaign(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.campaignService.getAgencyCampaignById(id, req.user.sub);
  }

  // --- Agency: Accept Invite ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.AGENCY)
  @Post('agency/:id/accept')
  agencyAccept(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.campaignService.agencyAcceptInvite(id, req.user.sub);
  }

  //  Agency Submits Requote ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.AGENCY)
  @Post('agency/:id/requote')
  async agencyRequote(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: AgencyRequoteDto,
  ) {
    const userId = req.user.userId;

    if (!userId) {
      throw new BadRequestException('User ID not found in token payload');
    }

    return this.campaignService.agencyRequote(id, userId, dto);
  }

  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.AGENCY)
  @Get('agency/milestones/:campaignId')
  async getAgencyMilestones(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Request() req,
  ) {
    const userId = req.user.userId;
    return await this.campaignService.getAgencyMilestones(campaignId, userId);
  }

  // --- Agency: Submit Milestone ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.AGENCY)
  @Post('agency/milestone/:milestoneId/submit')
  async agencySubmitMilestone(
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
    @Request() req,
    @Body() dto: SubmitMilestoneDto,
  ) {
    return await this.campaignService.agencySubmitMilestone(
      milestoneId,
      req.user.userId,
      dto,
    );
  }

  // -----------------------------------------------------------
  // AGENCY: Resubmit / Edit a Declined Submission
  // -----------------------------------------------------------
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.AGENCY)
  @Patch('agency/submission/:submissionId/resubmit')
  async agencyResubmit(
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Request() req,
    @Body() dto: SubmitMilestoneDto,
  ) {
    return await this.campaignService.agencyResubmitSubmission(
      submissionId,
      req.user.userId,
      dto,
    );
  }

  // -----------------------------------------------------------
  // SHARED: Get All Milestones for a Campaign
  // -----------------------------------------------------------
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.AGENCY, UserRole.CLIENT, UserRole.ADMIN)
  @Get('milestones/:campaignId') // URL: /campaign/milestones/{campaignId}
  async getMilestones(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Request() req,
  ) {
    return await this.campaignService.getCampaignMilestones(
      campaignId,
      req.user.userId,
    );
  }

  // -----------------------------------------------------------
  // SHARED: Get Single Milestone Details (includes Submission list)
  // -----------------------------------------------------------
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.AGENCY, UserRole.CLIENT, UserRole.ADMIN)
  @Get('milestone/:milestoneId') // URL: /campaign/milestone/{milestoneId}
  async getMilestone(
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
    @Request() req,
  ) {
    return await this.campaignService.getMilestoneById(
      milestoneId,
      req.user.userId,
    );
  }

  // -----------------------------------------------------------
  // SHARED: Get Single Submission Details
  // -----------------------------------------------------------
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.AGENCY, UserRole.CLIENT, UserRole.ADMIN)
  @Get('submission/:submissionId') // URL: /campaign/submission/{submissionId}
  async getSubmission(
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Request() req,
  ) {
    return await this.campaignService.getSubmissionById(
      submissionId,
      req.user.userId,
    );
  }

  // -----------------------------------------------------------
  // AGENCY: Update Milestone Results (Metrics)
  // -----------------------------------------------------------
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.AGENCY)
  @Patch('agency/submission/:id/results')
  async updateResults(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Body() dto: UpdateMilestoneResultDto,
  ) {
    return await this.campaignService.updateSubmissionResults(
      id,
      req.user.userId,
      dto,
    );
  }

  // -----------------------------------------------------------
  // CLIENT: Pay Bonus for Overflow
  // -----------------------------------------------------------
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.CLIENT)
  @Post('client/milestone/:id/bonus')
  async payBonus(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: PayBonusDto,
  ) {
    return await this.campaignService.clientPayBonus(id, req.user.userId, dto);
  }

  // -----------------------------------------------------------
  // CLIENT: Rate Agency (After Completion)
  // -----------------------------------------------------------
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.CLIENT)
  @Post('client/campaign/:id/rate')
  async rateAgency(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: RateCampaignDto,
  ) {
    return await this.campaignService.rateAgency(id, req.user.userId, dto);
  }

  // -----------------------------------------------------------
  // ANALYTICS: Get Campaign Stats
  // -----------------------------------------------------------
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @Get(':id/analytics')
  async getAnalytics(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return await this.campaignService.getCampaignAnalytics(id, req.user.userId);
  }

  // -----------------------------------------------------------
  // REPORT: Get Submission Conversation History
  // -----------------------------------------------------------
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Get('submission/:id/report')
  async getReport(@Param('id', ParseUUIDPipe) id: string) {
    return await this.campaignService.getSubmissionHistory(id);
  }
}
