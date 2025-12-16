import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  UpdateItemStatusDto,
  UpdateNidStatusDto,
  UpdatePayoutStatusDto,
  UpdateClientNidStatusDto,
  UpdateClientTradeLicenseStatusDto,
  UpdateClientSocialStatusDto,
  GetCampaignsQueryDto,
} from './dto/admin.dto';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { AuthGuard } from '@nestjs/passport';
import { AdminService } from './admin.service';
import { UserRole } from '../user/entities/user.entity';
import { Roles } from 'src/common/decorators/roles.decorator';

@UseGuards(AuthGuard('jwt-brandguru'), RolesGuard) // 1. Apply Guards
@Roles(UserRole.ADMIN)
@Controller('influencer/admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // // --- ADMIN AUTH ---
  // @Post('auth/login')
  // @HttpCode(HttpStatus.OK)
  // async login(@Body() dto: AdminLoginDto) {
  //   return this.adminService.login(dto);
  // }

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
}
