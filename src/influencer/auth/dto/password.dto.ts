import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class ForgotPasswordDto {
  @IsNotEmpty()
  @IsString()
  identifier: string; // User enters Email OR Phone to identify account
}

export class ResetPasswordDto {
  @IsNotEmpty()
  @IsString()
  identifier: string; // User enters Email OR Phone to identify account

  @IsNotEmpty()
  @IsString()
  otp: string;

  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  newPassword: string;
}
