import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserEntity, UserRole } from '../user/entities/user.entity';
import { InfluencerProfileEntity } from '../influencer/entities/influencer-profile.entity';
import { ClientProfileEntity } from '../client/entities/client-profile.entity';
import { SmsService } from 'src/common/services/sms.service';
import { InfluencerService } from '../influencer/influencer.service';
import {
  SignupDto,
  VerifyOtpDto,
  ResendOtpDto,
  CreateAdminDto,
} from './dto/auth.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password.dto';
import { Request } from 'express';
import * as geoip from 'geoip-lite';
import { UAParser } from 'ua-parser-js';
import * as requestIp from 'request-ip';
import { LoginLogEntity } from '../admin/entities/login-log.entity';
import { AgencyProfileEntity } from '../agency/entities/agency-profile.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(ClientProfileEntity)
    private readonly clientProfileRepo: Repository<ClientProfileEntity>,
    @InjectRepository(LoginLogEntity) // Inject Log Repo
    private readonly loginLogRepo: Repository<LoginLogEntity>,
    @InjectRepository(AgencyProfileEntity) // Inject Agency Repo
    private readonly agencyRepo: Repository<AgencyProfileEntity>,
    private dataSource: DataSource, // Required for Signup Transaction
    private influencerService: InfluencerService,
    private jwtService: JwtService,
    private smsService: SmsService,
  ) {}

  // --- 1. SIGNUP (Transactional) ---
  async signup(
    dto: SignupDto,
  ): Promise<{ message: string; phone: string; role: string }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      console.log('--- Starting Signup Process ---'); // Debug Log

      // A. Generate OTP
      const otp = Math.floor(1000 + Math.random() * 9000).toString();
      const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

      const salt = await bcrypt.genSalt();

      // B. Create User
      const user = new UserEntity();
      user.email = dto.email;
      user.phone = dto.phone;
      user.password = await bcrypt.hash(dto.password, salt);
      user.role = dto.role as UserRole; // Use the Role from DTO, not hardcoded
      user.otpCode = await bcrypt.hash(otp, 10);
      user.otpExpires = otpExpires;
      user.isPhoneVerified = false;

      // Debug: Log before saving user
      console.log('Saving UserEntity...');
      const savedUser = await queryRunner.manager.save(UserEntity, user);
      console.log('User saved with ID:', savedUser.id);

      // C. Dynamic Profile Creation based on Role
      if (dto.role === UserRole.INFLUENCER) {
        if (!dto.firstName || !dto.lastName)
          throw new BadRequestException('Name required for Influencers');

        const profile = new InfluencerProfileEntity();
        profile.userId = savedUser.id;
        profile.firstName = dto.firstName;
        profile.lastName = dto.lastName;

        console.log('Saving InfluencerProfileEntity...');
        await queryRunner.manager.save(InfluencerProfileEntity, profile);
      } else if (dto.role === UserRole.CLIENT) {
        if (!dto.firstName || !dto.lastName)
          throw new BadRequestException('Name required for Clients');

        const clientProfile = new ClientProfileEntity();
        clientProfile.userId = savedUser.id;
        clientProfile.firstName = dto.firstName;
        clientProfile.lastName = dto.lastName;
        clientProfile.email = dto.email;
        clientProfile.phone = dto.phone;
        clientProfile.brandName = dto.brandName || `${dto.firstName} ${dto.lastName}`;
        clientProfile.verificationSteps = {
          profileDetails: 'verified',
          phoneVerification: 'pending',
          addressDetails: 'unverified',
          socialLinks: 'unverified',
          nidVerification: 'unverified',
          tradeLicense: 'unverified',
        };

        console.log('Saving ClientProfileEntity...');
        await queryRunner.manager.save(ClientProfileEntity, clientProfile);
      }
      // else if (dto.role === UserRole.ADMIN) - No profile needed for admin
      else if (dto.role === UserRole.AGENCY) {
        if (!dto.agencyName) {
          throw new BadRequestException('Agency Name (agencyName) is required');
        }
        if (!dto.firstName || !dto.lastName) {
          throw new BadRequestException(
            'First and Last Name are required for Agency',
          );
        }

        const profile = new AgencyProfileEntity();
        profile.userId = savedUser.id;
        profile.agencyName = dto.agencyName;

        profile.firstName = dto.firstName;
        profile.lastName = dto.lastName;

        await queryRunner.manager.save(AgencyProfileEntity, profile);
      }
      // else if (dto.role === UserRole.BRAND) {
      //   if (!dto.companyName) throw new BadRequestException('Company Name required for Brands');

      //   const profile = new BrandProfileEntity();
      //   profile.userId = savedUser.id;
      //   profile.brandName = dto.companyName;
      //   profile.phone = dto.phone;

      //   await queryRunner.manager.save(BrandProfileEntity, profile);

      // }

      // D. Send SMS (Wrapped to identify if SMS is the cause of failure)
      console.log(`Attempting to send OTP: ${otp} to ${dto.phone}`);
      try {
        await this.smsService.sendOtp(dto.phone, otp);
      } catch (smsError) {
        console.error('SMS Service Failed:', smsError.message);
        // Note: We throw here to rollback user creation if SMS fails.
        // If you are testing offline, comment this throw out.
        throw new InternalServerErrorException('Failed to send SMS OTP');
      }

      await queryRunner.commitTransaction();
      console.log('Signup Transaction Committed');

      return {
        message: 'Signup successful. OTP sent to phone.',
        phone: dto.phone,
        role: dto.role,
      };
    } catch (error) {
      // 1. Rollback changes
      await queryRunner.rollbackTransaction();

      // 2. LOG THE ACTUAL ERROR (This fixes your debugging issue)
      console.error('------------------------------------------');
      console.error('SIGNUP ERROR DETAILS:', error);
      console.error('------------------------------------------');

      // 3. Handle specific DB errors (Duplicate entry)
      if (error.code === '23505') {
        throw new ConflictException('Email or Phone already exists');
      }

      // 4. Throw the actual error message so you see it in Postman
      throw new InternalServerErrorException(`Signup failed: ${error.message}`);
    } finally {
      await queryRunner.release();
    }
  }

  // --- 2. VERIFY SIGNUP OTP ---
  async verifyOtp(dto: VerifyOtpDto, req: Request) {
    // Find user by Phone
    const user = await this.userRepo.findOne({
      where: { phone: dto.phone },
      select: [
        'id',
        'email',
        'phone',
        'role',
        'otpCode',
        'otpExpires',
        'isPhoneVerified',
      ],
    });

    if (!user) throw new NotFoundException('User not found');

    if (user.isPhoneVerified) return this.generateToken(user, req);

    if (new Date() > user.otpExpires!)
      throw new BadRequestException('OTP Expired');

    const isMatch = await bcrypt.compare(dto.otp, user.otpCode);
    if (!isMatch) throw new BadRequestException('Invalid Code');

    // Update Verification Status
    user.isPhoneVerified = true;
    user.otpCode = null;
    user.otpExpires = null;

    await this.userRepo.save(user);

    return this.generateToken(user, req);
  }

  // --- 3. LOGIN ---
  async login(dto: LoginDto, req: Request) {
    // const userBase = await this.userRepo.findOne({
    //   where: { email: dto.email },
    //   select: ['id', 'password', 'role'],
    // });

    // if (!userBase) throw new UnauthorizedException('Invalid credentials');

    // let relations: string[] = [];
    // if (userBase.role === UserRole.INFLUENCER) relations = ['influencerProfile'];
    // // if (userBase.role === UserRole.CLIENT) relations = ['clientdProfile'];
    // // if (userBase.role === UserRole.AGENCY) relations = ['agencyProfile'];

    const user = await this.userRepo.findOne({
      where: { phone: dto.phone },
      select: ['id', 'email', 'phone', 'password', 'role', 'isPhoneVerified'],
      // relations: relations,
    });
    if (!user?.isPhoneVerified) {
      throw new UnauthorizedException(
        'Phone number is not verified. Please verify OTP first.',
      );
    }
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const isMatch = await bcrypt.compare(dto.password, user!.password);
    if (!isMatch) throw new UnauthorizedException('Invalid credentials');

    return this.generateToken(user, req);
  }

  // --- 4. FORGOT PASSWORD (Email OR Phone) ---
  async forgotPassword(dto: ForgotPasswordDto) {
    const identifier = dto.identifier;

    // Check if identifier is Email or Phone
    const isEmail = identifier.includes('@');

    // Find user by either email or phone
    const user = await this.userRepo.findOne({
      where: isEmail ? { email: identifier } : { phone: identifier },
    });

    if (!user) {
      // Return success to prevent user enumeration
      return {
        message: `If an account exists for ${identifier}, an OTP has been sent.`,
      };
    }

    // Generate OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const hash = await bcrypt.hash(otp, 10);

    // Save to User
    user.resetPasswordToken = hash;
    user.resetPasswordExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 mins
    await this.userRepo.save(user);

    // Send to appropriate channel
    if (isEmail) {
      // Mock Email Sending (Replace with actual Email Service)
      console.log(`[EMAIL MOCK] Sending OTP ${otp} to email ${user.email}`);
      // await this.emailService.sendResetEmail(user.email, otp);
    } else {
      // Send SMS
      if (user.phone) {
        await this.smsService.sendOtp(user.phone, otp);
      } else {
        throw new BadRequestException('No phone number found for this user');
      }
    }

    return {
      message: `OTP sent to your ${isEmail ? 'email' : 'phone number'}.`,
    };
  }

  // --- 5. RESET PASSWORD ---
  async resetPassword(dto: ResetPasswordDto) {
    const identifier = dto.identifier;
    const isEmail = identifier.includes('@');

    // Find user
    const user = await this.userRepo.findOne({
      where: isEmail ? { email: identifier } : { phone: identifier },
      select: ['id', 'password', 'resetPasswordToken', 'resetPasswordExpires'],
    });

    if (!user || !user.resetPasswordToken) {
      throw new BadRequestException('Invalid Request or User not found');
    }

    // Fixed Error 2322: Check against Date type
    if (user.resetPasswordExpires && new Date() > user.resetPasswordExpires) {
      throw new BadRequestException('OTP Expired');
    }

    const isMatch = await bcrypt.compare(dto.otp, user.resetPasswordToken);
    if (!isMatch) throw new BadRequestException('Invalid OTP');

    // Reset Password
    user.password = await bcrypt.hash(dto.newPassword, 10);

    // Fixed Error 2322: Assigning null
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;

    await this.userRepo.save(user);

    return { message: 'Password reset successful. Please login.' };
  }

  // --- 6. RESEND OTP ---
  async resendOtp(dto: ResendOtpDto): Promise<{ message: string }> {
    const user = await this.userRepo.findOne({
      where: { phone: dto.phone },
      select: ['id', 'phone', 'isPhoneVerified', 'otpExpires'],
    });

    if (!user) {
      throw new NotFoundException('User not found with this phone number');
    }

    if (user.isPhoneVerified) {
      throw new BadRequestException('Phone number is already verified');
    }

    // Check if the last OTP was sent within 1 minute (rate limiting)
    if (user.otpExpires) {
      const lastOtpSentAt = new Date(user.otpExpires.getTime() - 5 * 60 * 1000); // OTP expires in 5 mins, so sent time = expiry - 5 mins
      const timeSinceLastOtp = Date.now() - lastOtpSentAt.getTime();
      const oneMinute = 60 * 1000;

      if (timeSinceLastOtp < oneMinute) {
        const remainingSeconds = Math.ceil(
          (oneMinute - timeSinceLastOtp) / 1000,
        );
        throw new BadRequestException(
          `Please wait ${remainingSeconds} seconds before requesting a new OTP`,
        );
      }
    }

    // Generate new OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

    // Hash and save new OTP
    user.otpCode = await bcrypt.hash(otp, 10);
    user.otpExpires = otpExpires;

    await this.userRepo.save(user);

    // Send OTP via SMS
    await this.smsService.sendOtp(dto.phone, otp);

    return { message: 'New OTP has been sent to your phone number' };
  }

  private async generateToken(user: UserEntity, req: Request) {
    const payload = {
      sub: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
    };

    // LOGGING LOGIC FOR ADMIN ONLY
    if (user.role === UserRole.ADMIN) {
      // Pass req (even if it is undefined, the helper will handle it)
      await this.logAdminLogin(user, req);
    }

    return {
      accessToken: await this.jwtService.signAsync(payload),
      message: 'Successful',
    };
  }

  // Helper to save log
  private async logAdminLogin(user: UserEntity, req: Request) {
    try {
      // Default values in case req is missing
      let clientIp = '127.0.0.1';
      let browser = 'Unknown';
      let device = 'Unknown';
      let location = 'Unknown Location';

      // Only attempt extraction if 'req' exists
      if (req) {
        clientIp = requestIp.getClientIp(req) || '127.0.0.1';

        // Safe Header Access
        const userAgent = req.headers ? req.headers['user-agent'] : '';

        // Parse User Agent
        // Note: Make sure UAParser is imported correctly as: import UAParser from 'ua-parser-js';
        // OR if using the * as syntax: new UAParser.UAParser(userAgent); depending on version.
        // Assuming standard usage:
        const parser = new UAParser(userAgent);
        const ua = parser.getResult();

        browser =
          `${ua.browser.name || 'Unknown'} ${ua.browser.version || ''}`.trim();
        device = `${ua.os.name || 'Unknown'} ${ua.os.version || ''} - ${ua.device.type || 'Desktop'}`;

        // Geo Lookup
        const geo = geoip.lookup(clientIp);
        if (geo) {
          location = `${geo.city}, ${geo.country}`;
        }
      }

      await this.loginLogRepo.save({
        user,
        status: 'success',
        device,
        browser,
        location,
        ip: clientIp,
      });
    } catch (error) {
      console.error('Failed to log admin login:', error);
      // Don't block login if logging fails
    }
  }

  // --- 7. CREATE ADMIN (If not exists) ---
  async createAdmin(dto: CreateAdminDto) {
    // Normalize input
    const email = dto.email.toLowerCase().trim();
    const phone = dto.phone.trim();

    // Check for existing user with optimized query
    const existingUser = await this.userRepo
      .createQueryBuilder('user')
      .select(['user.id', 'user.role'])
      .where('user.email = :email OR user.phone = :phone', { email, phone })
      .getOne();

    if (existingUser) {
      const message =
        existingUser.role === UserRole.ADMIN
          ? 'Admin user already exists with this email or phone'
          : 'A user already exists with this email or phone';
      throw new ConflictException(message);
    }

    // Hash password with cost factor 10
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Create admin using query builder for atomic operation
    const result = await this.userRepo
      .createQueryBuilder()
      .insert()
      .into(UserEntity)
      .values({
        email,
        phone,
        password: hashedPassword,
        role: UserRole.ADMIN,
        isVerified: true,
        isPhoneVerified: true,
        isEmailVerified: true,
      })
      .returning(['id', 'email', 'phone', 'role', 'createdAt'])
      .execute();

    const savedAdmin = result.generatedMaps[0];

    return {
      message: 'Admin user created successfully',
      admin: {
        id: savedAdmin.id,
        email: savedAdmin.email,
        phone: savedAdmin.phone,
        role: savedAdmin.role,
        createdAt: savedAdmin.createdAt,
      },
    };
  }
}
