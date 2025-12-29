import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  UpdateItemStatusDto,
  UpdateNidStatusDto,
  UpdatePayoutStatusDto,
  UpdateClientNidStatusDto,
  UpdateClientTradeLicenseStatusDto,
  UpdateClientSocialStatusDto,
  GetCampaignsQueryDto,
  UpdateFeesDto,
  ChangePasswordDto,
  UpdateAgencyTinStatusDto,
  UpdateAgencyTradeLicenseStatusDto,
  UpdateAgencyNidStatusDto,
} from './dto/admin.dto';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { AuthGuard } from '@nestjs/passport';
import { AdminService } from './admin.service';
import { UserRole } from '../user/entities/user.entity';
import { Roles } from 'src/common/decorators/roles.decorator';
import { MasterDataType } from './entities/master-data.entity';
import { GetInfluencersDto } from './dto/admin-browsing.dto';
import { GetAgenciesDto } from '../agency/dto/get-agencies.dto';
import { AdminReportFilterDto } from '../campaign/dto/report-filter.dto';
import { FinanceFilterDto } from './entities/finance-filter.dto';

@UseGuards(AuthGuard('jwt-brandguru'), RolesGuard) // 1. Apply Guards
@Roles(UserRole.ADMIN)
@Controller('influencer/admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // =============================================
  // INFLUENCER VERIFICATION
  // =============================================

  // List all profiles for verification
  @Get('verification/profiles')
  async getProfiles(
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    return this.adminService.getPendingProfiles(
      Number(page) || 1,
      Number(limit) || 10,
    );
  }

  // Get details of one profile
  @Get('verification/profile/:userId')
  async getProfile(@Param('userId') userId: string) {
    return this.adminService.getProfileDetails(userId);
  }

  // --- APPROVAL ACTIONS ---

  @Patch('verification/profile/:userId/niche')
  async updateNiche(
    @Param('userId') userId: string,
    @Body() dto: UpdateItemStatusDto,
  ) {
    return this.adminService.updateNicheStatus(userId, dto);
  }

  @Patch('verification/profile/:userId/skill')
  async updateSkill(
    @Param('userId') userId: string,
    @Body() dto: UpdateItemStatusDto,
  ) {
    return this.adminService.updateSkillStatus(userId, dto);
  }

  @Patch('verification/profile/:userId/social')
  async updateSocial(
    @Param('userId') userId: string,
    @Body() dto: UpdateItemStatusDto,
  ) {
    return this.adminService.updateSocialStatus(userId, dto);
  }

  @Patch('verification/profile/:userId/nid')
  async updateNid(
    @Param('userId') userId: string,
    @Body() dto: UpdateNidStatusDto,
  ) {
    return this.adminService.updateNidStatus(userId, dto);
  }

  @Patch('verification/profile/:userId/payout/bank')
  async updateBank(
    @Param('userId') userId: string,
    @Body() dto: UpdatePayoutStatusDto,
  ) {
    return this.adminService.updateBankStatus(userId, dto);
  }

  @Patch('verification/profile/:userId/payout/mobile')
  async updateMobile(
    @Param('userId') userId: string,
    @Body() dto: UpdatePayoutStatusDto,
  ) {
    return this.adminService.updateMobileStatus(userId, dto);
  }

  // FORCE APPROVE ENDPOINT
  @Patch('verification/profile/:userId/approve')
  async forceApprove(@Param('userId') userId: string) {
    return this.adminService.forceApproveUser(userId);
  }

  // REVOKE FORCE APPROVE ENDPOINT
  @Patch('verification/profile/:userId/revoke')
  async revokeApprove(@Param('userId') userId: string) {
    return this.adminService.revokeVerification(userId);
  }
  // =============================================
  // CLIENT VERIFICATION
  // =============================================

  // List all client profiles for verification
  @Get('verification/clients')
  async getClientProfiles(
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    return this.adminService.getClientProfiles(
      Number(page) || 1,
      Number(limit) || 10,
    );
  }

  // Get clients pending NID verification
  @Get('verification/clients/pending-nid')
  async getClientsPendingNid(
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    return this.adminService.getClientsPendingNidVerification(
      Number(page) || 1,
      Number(limit) || 10,
    );
  }

  // Get clients pending Trade License verification
  @Get('verification/clients/pending-trade-license')
  async getClientsPendingTradeLicense(
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    return this.adminService.getClientsPendingTradeLicenseVerification(
      Number(page) || 1,
      Number(limit) || 10,
    );
  }

  // Get details of one client profile
  @Get('verification/client/:userId')
  async getClientProfile(@Param('userId') userId: string) {
    return this.adminService.getClientProfileDetails(userId);
  }

  // Approve/Reject Client NID
  @Patch('verification/client/:userId/nid')
  async updateClientNid(
    @Param('userId') userId: string,
    @Body() dto: UpdateClientNidStatusDto,
  ) {
    return this.adminService.updateClientNidStatus(userId, dto);
  }

  // Approve/Reject Client Trade License
  @Patch('verification/client/:userId/trade-license')
  async updateClientTradeLicense(
    @Param('userId') userId: string,
    @Body() dto: UpdateClientTradeLicenseStatusDto,
  ) {
    return this.adminService.updateClientTradeLicenseStatus(userId, dto);
  }

  // Approve/Reject Client Social Link
  @Patch('verification/client/:userId/social')
  async updateClientSocial(
    @Param('userId') userId: string,
    @Body() dto: UpdateClientSocialStatusDto,
  ) {
    return this.adminService.updateClientSocialStatus(userId, dto);
  }

  // =============================================
  // CAMPAIGN MANAGEMENT
  // =============================================

  /**
   * Get all campaigns with filters and pagination
   * Query params: page, limit, status, clientId, search, startDateFrom, startDateTo
   */
  @Get('campaigns')
  async getAllCampaigns(@Query() query: GetCampaignsQueryDto) {
    return this.adminService.getAllCampaigns(query);
  }

  /**
   * Get campaign statistics for dashboard
   */
  @Get('campaigns/stats')
  async getCampaignStats() {
    return this.adminService.getCampaignStats();
  }

  /**
   * Get single campaign details by ID
   */
  @Get('campaigns/:campaignId')
  async getCampaignById(@Param('campaignId') campaignId: string) {
    return this.adminService.getCampaignById(campaignId);
  }

  // =============================================
  // SETTINGS: General (Fees)
  // =============================================

  @Get('settings/general')
  async getGeneralSettings() {
    return this.adminService.getSystemSettings();
  }

  @Patch('settings/general')
  async updateGeneralSettings(@Body() dto: UpdateFeesDto) {
    return this.adminService.updateSystemFees(dto);
  }

  // =============================================
  // SETTINGS: Lists (Niche, Skill, Product)
  // =============================================

  // --- Niches ---
  @Get('settings/niches')
  async getNiches() {
    return this.adminService.getMasterDataList(MasterDataType.NICHE);
  }

  @Post('settings/niches')
  async addNiche(@Body('name') name: string) {
    return this.adminService.addMasterData({
      type: MasterDataType.NICHE,
      name,
    });
  }

  // --- Skills ---
  @Get('settings/skills')
  async getSkills() {
    return this.adminService.getMasterDataList(MasterDataType.SKILL);
  }

  @Post('settings/skills')
  async addSkill(@Body('name') name: string) {
    return this.adminService.addMasterData({
      type: MasterDataType.SKILL,
      name,
    });
  }

  // --- Product Types ---
  @Get('settings/product-types')
  async getProductTypes() {
    return this.adminService.getMasterDataList(MasterDataType.PRODUCT_TYPE);
  }

  @Post('settings/product-types')
  async addProductType(@Body('name') name: string) {
    return this.adminService.addMasterData({
      type: MasterDataType.PRODUCT_TYPE,
      name,
    });
  }

  // --- Generic Delete (for any list item) ---
  @Delete('settings/list-item/:id')
  async deleteListItem(@Param('id') id: string) {
    return this.adminService.deleteMasterData(id);
  }

  // =============================================
  // SETTINGS: Security & Activity
  // =============================================

  @Patch('settings/security/password')
  async changePassword(@Request() req, @Body() dto: ChangePasswordDto) {
    // Pass 'req' as the 3rd argument
    return this.adminService.changeAdminPassword(req.user.userId, dto, req);
  }

  @Get('settings/security/activity-log')
  async getActivityLog(
    @Req() req,
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    return this.adminService.getLoginLogs(
      req.user.userId,
      Number(page) || 1,
      Number(limit) || 10,
    );
  }

  // =============================================
  // BROWSE USERS (Influencers)
  // =============================================

  // 1. Get List/Grid View Data
  @Get('browsing/influencers')
  async getInfluencersList(@Query() query: GetInfluencersDto) {
    return this.adminService.getAllInfluencers(query);
  }

  // 2. Get Single Influencer Details (Profile View)
  @Get('browsing/influencer/:userId')
  async getInfluencerDetails(@Param('userId') userId: string) {
    return this.adminService.getInfluencerFullDetails(userId);
  }

  // 3. Get Influencer Campaigns (Campaigns Tab)
  @Get('browsing/influencer/:userId/campaigns')
  async getInfluencerCampaigns(
    @Param('userId') userId: string,
    @Query('status') status: string,
  ) {
    return this.adminService.getInfluencerCampaigns(userId, status);
  }

  // 4. Block/Unblock Influencer (Danger Zone)
  @Patch('browsing/influencer/:userId/block')
  async blockInfluencer(@Param('userId') userId: string) {
    return this.adminService.toggleBlockStatus(userId);
  }

  // =============================================
  // 🏢 AGENCY VERIFICATION ENDPOINTS
  // =============================================

  @Get('verification/agencies')
  async getAgencies(
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    return this.adminService.getAgencyProfiles(
      Number(page) || 1,
      Number(limit) || 10,
    );
  }

  @Get('/agencies') // URL: admin/agencies?page=1&limit=10&search=tech&niche=gadget
  async getAllAgencies(@Query() dto: GetAgenciesDto) {
    return await this.adminService.getAllAgencies(dto);
  }

  @Get('verification/agency/:userId')
  async getAgencyProfile(@Param('userId') userId: string) {
    return this.adminService.getAgencyProfileDetails(userId);
  }

  @Patch('verification/agency/:userId/niche')
  async updateAgencyNiche(
    @Param('userId') userId: string,
    @Body() dto: UpdateItemStatusDto,
  ) {
    return this.adminService.updateAgencyNicheStatus(userId, dto);
  }

  @Patch('verification/agency/:userId/nid')
  async updateAgencyNid(
    @Param('userId') userId: string,
    @Body() dto: UpdateAgencyNidStatusDto,
  ) {
    return this.adminService.updateAgencyNid(userId, dto);
  }

  @Patch('verification/agency/:userId/trade-license')
  async updateAgencyTradeLicense(
    @Param('userId') userId: string,
    @Body() dto: UpdateAgencyTradeLicenseStatusDto,
  ) {
    return this.adminService.updateAgencyTradeLicense(userId, dto);
  }

  @Patch('verification/agency/:userId/tin')
  async updateAgencyTin(
    @Param('userId') userId: string,
    @Body() dto: UpdateAgencyTinStatusDto,
  ) {
    return this.adminService.updateAgencyTin(userId, dto);
  }

  @Patch('verification/agency/:userId/social')
  async updateAgencySocial(
    @Param('userId') userId: string,
    @Body() dto: UpdateItemStatusDto,
  ) {
    return this.adminService.updateAgencySocial(userId, dto);
  }

  @Patch('verification/agency/:userId/payout/bank')
  async updateAgencyBank(
    @Param('userId') userId: string,
    @Body() dto: UpdatePayoutStatusDto,
  ) {
    return this.adminService.updateAgencyPayout(userId, dto, 'bank');
  }

  @Patch('verification/agency/:userId/payout/mobile')
  async updateAgencyMobile(
    @Param('userId') userId: string,
    @Body() dto: UpdatePayoutStatusDto,
  ) {
    return this.adminService.updateAgencyPayout(userId, dto, 'mobile');
  }

  // -----------------------------------------------------------
  // ADMIN: Reports (With Tab Filter)
  // -----------------------------------------------------------
  @Get('reports')
  async getAdminReports(@Query() dto: AdminReportFilterDto) {
    return await this.adminService.getAdminReports(dto);
  }

  // -----------------------------------------------------------
  // FINANCE: List Transactions (Payouts & Income)
  // -----------------------------------------------------------

  @Get('finance/transactions')
  async getTransactions(@Query() dto: FinanceFilterDto) {
    return await this.adminService.getFinanceData(dto);
  }

  // -----------------------------------------------------------
  // ANALYTICS: High Level Stats
  // -----------------------------------------------------------

  @Get('finance/analytics')
  async getAnalytics() {
    return await this.adminService.getAdminAnalytics();
  }

  // -----------------------------------------------------------
  // ACTION: Notify Client
  // -----------------------------------------------------------

  @Post('finance/notify-due')
  async notifyClient(@Body() body: { clientId: string; campaignId: string }) {
    return await this.adminService.notifyClientForDue(
      body.clientId,
      body.campaignId,
    );
  }

  // ===========================================================
  // ADMIN DASHBOARD APIs
  // ===========================================================

  // -----------------------------------------------------------
  // DASHBOARD: Action Required (Verification, Payouts, Approvals)
  // -----------------------------------------------------------

  @Get('dashboard/actions')
  async getActionRequired() {
    return await this.adminService.getActionRequired();
  }

  // -----------------------------------------------------------
  // DASHBOARD: Recent Activity Stream
  // -----------------------------------------------------------

  @Get('dashboard/activity')
  async getRecentActivity() {
    return await this.adminService.getRecentActivity();
  }

  // -----------------------------------------------------------
  // DASHBOARD: Campaign Statistics (For Charts)
  // -----------------------------------------------------------

  @Get('dashboard/chart-stats')
  async getCampaignChartStats() {
    return await this.adminService.getCampaignChartStats();
  }
}
