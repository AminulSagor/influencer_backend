import { IsEnum, IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum UserStatusFilter {
  ALL = 'all',
  ACTIVE = 'active',
  BLOCKED = 'blocked',
}

export class GetInfluencersDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  page: number = 1;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  limit: number = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(UserStatusFilter)
  status?: UserStatusFilter;

  @IsOptional()
  @IsString()
  dateRange?: string; // Format: "YYYY-MM-DD:YYYY-MM-DD"
}

export class BlockUserDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
