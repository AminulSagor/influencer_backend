import {
  IsString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  Matches,
} from 'class-validator';

// Initial signup DTO for Client - Profile Details
export class CreateClientDto {
  @IsString()
  @IsNotEmpty()
  brandName: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^(\+88)?01[3-9]\d{8}$/, {
    message: 'Phone number must be a valid Bangladeshi number',
  })
  phone: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

// DTO for verifying OTP sent to client's phone
export class VerifyClientOtpDto {
  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  otp: string;
}

// DTO for resending OTP
export class ResendClientOtpDto {
  @IsString()
  @IsNotEmpty()
  phone: string;
}
