import {
  Controller,
  Get,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  Body,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ClientService } from './client.service';
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
  // PROTECTED ROUTES (Client Auth Required)
  // Signup/Login via /influencer/auth/*
  // ============================================

  // --- Get My Profile ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.CLIENT)
  @Get('profile')
  getProfile(@Request() req) {
    return this.clientService.getProfile(req.user.userId);
  }

  // --- Update Address (After Phone Verification) ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.CLIENT)
  @Patch('profile/address')
  updateAddress(@Request() req, @Body() dto: UpdateClientAddressDto) {
    return this.clientService.updateAddress(req.user.userId, dto);
  }

  // --- Update Social Links & Website ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.CLIENT)
  @Patch('profile/social')
  updateSocialLinks(@Request() req, @Body() dto: UpdateClientSocialDto) {
    return this.clientService.updateSocialLinks(req.user.userId, dto);
  }

  // --- Update NID Information ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.CLIENT)
  @Patch('profile/nid')
  updateNid(@Request() req, @Body() dto: UpdateClientNidDto) {
    return this.clientService.updateNid(req.user.userId, dto);
  }

  // --- Update Trade License ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.CLIENT)
  @Patch('profile/trade-license')
  updateTradeLicense(@Request() req, @Body() dto: UpdateClientTradeLicenseDto) {
    return this.clientService.updateTradeLicense(req.user.userId, dto);
  }

  // --- Complete Onboarding (Combined Update) ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.CLIENT)
  @Patch('profile/onboarding')
  completeOnboarding(@Request() req, @Body() dto: ClientOnboardingDto) {
    return this.clientService.completeOnboarding(req.user.userId, dto);
  }

  // --- Update Profile (General) ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.CLIENT)
  @Patch('profile')
  updateProfile(@Request() req, @Body() dto: UpdateClientDto) {
    return this.clientService.updateProfile(req.user.userId, dto);
  }

  // ============================================
  // ADMIN ROUTES
  // ============================================

  // --- Get All Clients (Admin) ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get()
  findAll(@Query('page') page = 1, @Query('limit') limit = 10) {
    return this.clientService.findAll(+page, +limit);
  }

  // --- Get Client by ID (Admin) ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientService.findOne(id);
  }

  // --- Delete Client (Admin) ---
  @UseGuards(AuthGuard('jwt-brandguru'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientService.remove(id);
  }
}
