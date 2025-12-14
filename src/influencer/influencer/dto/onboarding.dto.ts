import { IsArray, IsObject, IsOptional, IsString } from 'class-validator';

export class OnboardingDto {
  // Screen 05: Address
  @IsOptional()
  @IsString()
  thana?: string;

  @IsOptional()
  @IsString()
  zilla?: string;

  @IsOptional()
  @IsString()
  fullAddress?: string;

  // Screen 06: Socials
  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsArray()
  socialLinks?: { platform: string; url: string; status: string }[];

  // Screen 07: NID / Documents
  @IsOptional()
  @IsString()
  nidNumber?: string;

  @IsOptional()
  @IsString()
  nidFrontImg?: string;

  @IsOptional()
  @IsString()
  nidBackImg?: string;

  // Any other profile updates (Bio, etc)
  @IsOptional()
  @IsString()
  bio?: string;
}
