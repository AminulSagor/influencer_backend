import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { UserRole } from 'src/influencer/user/entities/user.entity';

export class SignupDto {
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @IsNotEmpty()
  @IsString()
  lastName: string;

  @IsOptional()
  @IsString()
  brandName?: string;

  @IsNotEmpty()
  @Matches(/^\+?[0-9]{11,14}$/, {
    message: 'Enter a valid BD phone number e.g. +8801XXXXXXXXX',
  })
  phone: string;

  @IsEmail()
  email: string;

  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be 8 characters' })
  password: string;

  @IsNotEmpty()
  @IsEnum(UserRole)
  role: UserRole;
}

export class VerifyOtpDto {
  @IsNotEmpty()
  phone: string;

  @IsNotEmpty()
  @IsString()
  otp: string;
}

export class ResendOtpDto {
  @IsNotEmpty()
  @Matches(/^\+?[0-9]{11,14}$/, {
    message: 'Enter a valid BD phone number e.g. +8801XXXXXXXXX',
  })
  phone: string;
}

// --- Create Admin DTO ---
export class CreateAdminDto {
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @IsNotEmpty()
  @IsString()
  lastName: string;

  @IsNotEmpty()
  @Matches(/^\+?[0-9]{11,14}$/, {
    message: 'Enter a valid BD phone number e.g. +8801XXXXXXXXX',
  })
  phone: string;

  @IsEmail()
  email: string;

  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;
}
