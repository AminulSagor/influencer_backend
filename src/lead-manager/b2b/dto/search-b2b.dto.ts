import { IsOptional, IsString } from 'class-validator';

export class SearchB2BDto {
  @IsOptional()
  @IsString()
  businessType?: string;

  @IsOptional()
  @IsString()
  primaryIndustry?: string;

  @IsOptional()
  @IsString()
  niche?: string;

  @IsOptional()
  @IsString()
  serviceName?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  city?: string;
}
