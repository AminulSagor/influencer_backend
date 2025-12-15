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
import { ClientService } from './client.service';
import {
  CreateClientDto,
  VerifyClientOtpDto,
  ResendClientOtpDto,
} from './dto/create-client.dto';
import {
  UpdateClientDto,
  UpdateClientAddressDto,
  UpdateClientSocialDto,
  UpdateClientNidDto,
  UpdateClientTradeLicenseDto,
  ClientOnboardingDto,
} from './dto/update-client.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UserRole } from '../user/entities/user.entity';

@Controller('client')
export class ClientController {
  constructor(private readonly clientService: ClientService) {}

  // ============================================
  // PUBLIC ROUTES (No Auth Required)
  // ============================================

  // --- 1. Client Signup ---
  @Post('signup')
  signup(@Body() createClientDto: CreateClientDto) {
    return this.clientService.signup(createClientDto);
  }

  // --- 2. Verify OTP ---
  @Post('verify-otp')
  verifyOtp(@Body() verifyOtpDto: VerifyClientOtpDto) {
    return this.clientService.verifyOtp(verifyOtpDto);
  }

  // --- 3. Resend OTP ---
  @Post('resend-otp')
  resendOtp(@Body() resendOtpDto: ResendClientOtpDto) {
    return this.clientService.resendOtp(resendOtpDto);
  }

  // ============================================
  // PROTECTED ROUTES (Auth Required)
  // ============================================

  // --- 4. Get My Profile ---
  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  getProfile(@Request() req) {
    return this.clientService.getProfile(req.user.sub);
  }

  // --- 5. Update Address (After Phone Verification) ---
  @UseGuards(AuthGuard('jwt'))
  @Patch('profile/address')
  updateAddress(@Request() req, @Body() dto: UpdateClientAddressDto) {
    return this.clientService.updateAddress(req.user.sub, dto);
  }

  // --- 6. Update Social Links & Website ---
  @UseGuards(AuthGuard('jwt'))
  @Patch('profile/social')
  updateSocialLinks(@Request() req, @Body() dto: UpdateClientSocialDto) {
    return this.clientService.updateSocialLinks(req.user.sub, dto);
  }

  // --- 7. Update NID Information ---
  @UseGuards(AuthGuard('jwt'))
  @Patch('profile/nid')
  updateNid(@Request() req, @Body() dto: UpdateClientNidDto) {
    return this.clientService.updateNid(req.user.sub, dto);
  }

  // --- 8. Update Trade License ---
  @UseGuards(AuthGuard('jwt'))
  @Patch('profile/trade-license')
  updateTradeLicense(@Request() req, @Body() dto: UpdateClientTradeLicenseDto) {
    return this.clientService.updateTradeLicense(req.user.sub, dto);
  }

  // --- 9. Complete Onboarding (Combined Update) ---
  @UseGuards(AuthGuard('jwt'))
  @Patch('profile/onboarding')
  completeOnboarding(@Request() req, @Body() dto: ClientOnboardingDto) {
    return this.clientService.completeOnboarding(req.user.sub, dto);
  }

  // --- 10. Update Profile (General) ---
  @UseGuards(AuthGuard('jwt'))
  @Patch('profile')
  updateProfile(@Request() req, @Body() dto: UpdateClientDto) {
    return this.clientService.updateProfile(req.user.sub, dto);
  }

  // ============================================
  // ADMIN ROUTES
  // ============================================

  // --- 11. Get All Clients (Admin) ---
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get()
  findAll(@Query('page') page = 1, @Query('limit') limit = 10) {
    return this.clientService.findAll(+page, +limit);
  }

  // --- 12. Get Client by ID (Admin) ---
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientService.findOne(id);
  }

  // --- 13. Delete Client (Admin) ---
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientService.remove(id);
  }
}
