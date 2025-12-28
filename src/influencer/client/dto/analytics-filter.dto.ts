import { IsOptional, IsEnum, IsInt, Min, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class AnalyticsFilterDto {
  @IsOptional()
  @IsString()
  search?: string; // Search by Campaign Name

  @IsOptional()
  @IsEnum(['low_to_high', 'high_to_low'])
  sortOrder?: 'low_to_high' | 'high_to_low'; // For Transaction Amount

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}
