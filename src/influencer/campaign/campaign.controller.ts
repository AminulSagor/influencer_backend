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
  CreateNegotiationDto,
  AcceptNegotiationDto,
  RejectCampaignDto,
} from './dto/campaign-negotiation.dto';
import {
  AssignCampaignDto,
  UpdateAssignmentDto,
  RespondAssignmentDto,
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
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.CLIENT)
  @Post()
  createCampaign(@Request() req, @Body() dto: CreateCampaignStep1Dto) {
    return this.campaignService.createCampaign(req.user.sub, dto);
  }

  // --- Step 2: Update Targeting & Preferences ---
  @UseGuards(AuthGuard('jwt'), RolesGuard)
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
  @UseGuards(AuthGuard('jwt'), RolesGuard)
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
  @UseGuards(AuthGuard('jwt'), RolesGuard)
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
  @UseGuards(AuthGuard('jwt'), RolesGuard)
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
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.CLIENT)
  @Post(':id/place')
  placeCampaign(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.campaignService.placeCampaign(id, req.user.sub);
  }

  // --- Get My Campaigns (Client) ---
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.CLIENT)
  @Get('my-campaigns')
  getClientCampaigns(@Request() req, @Query() query: SearchCampaignDto) {
    return this.campaignService.getClientCampaigns(req.user.sub, query);
  }

  // --- Get Single Campaign (Client) ---
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.CLIENT)
  @Get(':id')
  getCampaign(@Param('id', ParseUUIDPipe) id: string) {
    return this.campaignService.getCampaignById(id);
  }

  // --- Delete Campaign (Draft only) ---
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.CLIENT)
  @Delete(':id')
  deleteCampaign(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.campaignService.deleteCampaign(id, req.user.sub);
  }

  // --- Delete Asset ---
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.CLIENT)
  @Delete('asset/:assetId')
  deleteAsset(@Param('assetId', ParseUUIDPipe) assetId: string, @Request() req) {
    return this.campaignService.deleteAsset(assetId, req.user.sub);
  }

  // --- Budget Preview ---
  @UseGuards(AuthGuard('jwt'))
  @Get('budget/preview')
  getBudgetPreview(@Query('baseBudget') baseBudget: number) {
    return this.campaignService.getBudgetPreview(Number(baseBudget));
  }

  // ============================================
  // NEGOTIATION ROUTES (Client)
  // ============================================

  // --- Client: Send Negotiation/Counter-offer ---
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.CLIENT)
  @Post('negotiation/respond')
  clientNegotiation(@Request() req, @Body() dto: CreateNegotiationDto) {
    return this.campaignService.createNegotiation(req.user.sub, 'client', dto);
  }

  // --- Client: Accept Terms ---
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.CLIENT)
  @Post('negotiation/accept')
  clientAccept(@Request() req, @Body() dto: AcceptNegotiationDto) {
    return this.campaignService.acceptNegotiation(req.user.sub, 'client', dto);
  }

  // --- Client: Reject/Cancel ---
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.CLIENT)
  @Post('negotiation/reject')
  clientReject(@Request() req, @Body() dto: RejectCampaignDto) {
    return this.campaignService.rejectCampaign(req.user.sub, 'client', dto);
  }

  // --- Get Negotiation History ---
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.CLIENT)
  @Get(':id/negotiations')
  clientGetNegotiations(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.campaignService.getNegotiationHistory(id, req.user.sub, 'client');
  }

  // ============================================
  // ADMIN ROUTES
  // ============================================

  // --- Admin: Get All Campaigns ---
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/all')
  adminGetAllCampaigns(@Query() query: SearchCampaignDto) {
    return this.campaignService.getAllCampaigns(query);
  }

  // --- Admin: Get Single Campaign ---
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/:id')
  adminGetCampaign(@Param('id', ParseUUIDPipe) id: string) {
    return this.campaignService.getCampaignById(id);
  }

  // --- Admin: Update Campaign Status ---
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('admin/:id/status')
  adminUpdateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCampaignStatusDto,
  ) {
    return this.campaignService.updateCampaignStatus(id, dto);
  }

  // --- Admin: Send Negotiation/Request ---
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/negotiation/request')
  adminNegotiation(@Request() req, @Body() dto: CreateNegotiationDto) {
    return this.campaignService.createNegotiation(req.user.sub, 'admin', dto);
  }

  // --- Admin: Accept Campaign ---
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/negotiation/accept')
  adminAccept(@Request() req, @Body() dto: AcceptNegotiationDto) {
    return this.campaignService.acceptNegotiation(req.user.sub, 'admin', dto);
  }

  // --- Admin: Reject Campaign ---
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/negotiation/reject')
  adminReject(@Request() req, @Body() dto: RejectCampaignDto) {
    return this.campaignService.rejectCampaign(req.user.sub, 'admin', dto);
  }

  // --- Admin: Get Negotiation History ---
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/:id/negotiations')
  adminGetNegotiations(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.campaignService.getNegotiationHistory(id, req.user.sub, 'admin');
  }

  // --- Mark Negotiation as Read ---
  @UseGuards(AuthGuard('jwt'))
  @Patch('negotiation/:negotiationId/read')
  markAsRead(@Param('negotiationId', ParseUUIDPipe) negotiationId: string) {
    return this.campaignService.markNegotiationRead(negotiationId);
  }

  // ============================================
  // ADMIN: CAMPAIGN ASSIGNMENT ROUTES
  // ============================================

  // --- Admin: Assign Campaign to Influencers ---
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/assign')
  assignCampaign(@Request() req, @Body() dto: AssignCampaignDto) {
    return this.campaignService.assignCampaignToInfluencers(req.user.sub, dto);
  }

  // --- Admin: Get Campaign Assignments ---
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/:id/assignments')
  getCampaignAssignments(@Param('id', ParseUUIDPipe) id: string) {
    return this.campaignService.getCampaignAssignments(id);
  }

  // --- Admin: Get All Assignments ---
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/assignments/all')
  getAllAssignments(@Query() query: SearchAssignmentDto) {
    return this.campaignService.getAllAssignments(query);
  }

  // --- Admin: Update Assignment ---
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('admin/assignment/:assignmentId')
  updateAssignment(
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() dto: UpdateAssignmentDto,
  ) {
    return this.campaignService.updateAssignment(assignmentId, dto);
  }

  // --- Admin: Cancel Assignment ---
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete('admin/assignment/:assignmentId')
  cancelAssignment(@Param('assignmentId', ParseUUIDPipe) assignmentId: string) {
    return this.campaignService.cancelAssignment(assignmentId);
  }

  // ============================================
  // INFLUENCER: ASSIGNMENT ROUTES
  // ============================================

  // --- Influencer: Get My Assignments ---
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.INFLUENCER)
  @Get('influencer/assignments')
  getInfluencerAssignments(@Request() req, @Query() query: SearchAssignmentDto) {
    return this.campaignService.getInfluencerAssignments(req.user.sub, query);
  }

  // --- Influencer: Get Assignment Details ---
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.INFLUENCER)
  @Get('influencer/assignment/:assignmentId')
  getAssignmentDetails(
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Request() req,
  ) {
    return this.campaignService.getAssignmentDetails(assignmentId, req.user.sub);
  }

  // --- Influencer: Respond to Assignment (Accept/Reject) ---
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.INFLUENCER)
  @Post('influencer/assignment/:assignmentId/respond')
  respondToAssignment(
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Request() req,
    @Body() dto: RespondAssignmentDto,
  ) {
    return this.campaignService.respondToAssignment(assignmentId, req.user.sub, dto);
  }
}
