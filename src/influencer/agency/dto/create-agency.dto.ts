import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { SocialLinkItemDto } from './update-agency.dto';
import { Type } from 'class-transformer';

export class AgencyOnboardingDto {
  // Address Section
  @IsOptional() @IsString() addressLine?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() country?: string;

  // Socials Section
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SocialLinkItemDto)
  socialLinks?: SocialLinkItemDto[];

  @IsOptional() @IsString() website?: string;

  // Verification Section (NID)
  @IsOptional() @IsString() nidNumber?: string;
  @IsOptional() @IsString() nidFrontImg?: string;
  @IsOptional() @IsString() nidBackImg?: string;
}
