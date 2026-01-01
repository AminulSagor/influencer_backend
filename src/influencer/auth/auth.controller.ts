import {
  Body,
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  Request,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  SignupDto,
  VerifyOtpDto,
  ResendOtpDto,
  CreateAdminDto,
} from './dto/auth.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password.dto';

@Controller('influencer/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  async signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() dto: VerifyOtpDto, @Request() req) {
    return this.authService.verifyOtp(dto, req);
  }

  // ===========================================================
  // FALLBACK OTP VERIFICATION (DEV/TEST ONLY)
  // ===========================================================
  @Post('verify-otp-fallback')
  async verifyOtpFallback(
    @Body() body: { phone: string; otp: string },
    @Request() req, // Inject Request object here
  ) {
    return this.authService.verifyOtpFallback(body.phone, body.otp, req);
  }

  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  async resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Request() req) {
    return this.authService.login(dto, req);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('create-admin')
  @HttpCode(HttpStatus.CREATED)
  async createAdmin(@Body() dto: CreateAdminDto) {
    return this.authService.createAdmin(dto);
  }
}
