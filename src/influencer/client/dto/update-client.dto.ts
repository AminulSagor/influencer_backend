import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';

// Social Media Link DTO
export class SocialLinkDto {
  @IsString()
  platform: string; // e.g., 'facebook', 'instagram', 'linkedin', 'twitter', 'youtube', 'tiktok'

  @IsString()
  profileUrl: string;
}

// DTO for updating address after phone verification
export class UpdateClientAddressDto {
  @IsString()
  @IsOptional()
  thana?: string;

  @IsString()
  @IsOptional()
  zila?: string;

  @IsString()
  @IsOptional()
  fullAddress?: string;
}

// DTO for updating social links and website
export class UpdateClientSocialDto {
  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SocialLinkDto)
  socialLinks?: SocialLinkDto[];
}

// DTO for updating NID information
export class UpdateClientNidDto {
  @IsString()
  @IsOptional()
  nidNumber?: string;

  @IsString()
  @IsOptional()
  nidFrontImg?: string; // S3 URL

  @IsString()
  @IsOptional()
  nidBackImg?: string; // S3 URL
}

// DTO for updating Trade License information
export class UpdateClientTradeLicenseDto {
  @IsString()
  @IsOptional()
  tradeLicenseNumber?: string;

  @IsString()
  @IsOptional()
  tradeLicenseImg?: string; // S3 URL
}

// Combined Onboarding DTO (after phone verification)
export class ClientOnboardingDto {
  // Address
  @IsString()
  @IsOptional()
  thana?: string;

  @IsString()
  @IsOptional()
  zila?: string;

  @IsString()
  @IsOptional()
  fullAddress?: string;

  // Website (optional)
  @IsOptional()
  @IsString()
  website?: string;

  // Social Links
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SocialLinkDto)
  socialLinks?: SocialLinkDto[];

  // NID
  @IsString()
  @IsOptional()
  nidNumber?: string;

  @IsString()
  @IsOptional()
  nidFrontImg?: string;

  @IsString()
  @IsOptional()
  nidBackImg?: string;

  // Trade License
  @IsString()
  @IsOptional()
  tradeLicenseNumber?: string;

  @IsString()
  @IsOptional()
  tradeLicenseImg?: string;
}

// General update DTO
export class UpdateClientDto {
  @IsString()
  @IsOptional()
  brandName?: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  thana?: string;

  @IsString()
  @IsOptional()
  zila?: string;

  @IsString()
  @IsOptional()
  fullAddress?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SocialLinkDto)
  socialLinks?: SocialLinkDto[];

  @IsString()
  @IsOptional()
  nidNumber?: string;

  @IsString()
  @IsOptional()
  nidFrontImg?: string;

  @IsString()
  @IsOptional()
  nidBackImg?: string;

  @IsString()
  @IsOptional()
  tradeLicenseNumber?: string;

  @IsString()
  @IsOptional()
  tradeLicenseImg?: string;
}
