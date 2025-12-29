import {
  IsOptional,
  IsString,
  IsEnum,
  IsInt,
  Min,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum PayoutType {
  AGENCY = 'agency',
  INFLUENCER = 'influencer', // In your system agency = influencer usually
  CLIENT = 'client',
}

export enum PaymentStatus {
  PARTIAL = 'partial',
  FULL = 'full',
  PENDING = 'pending_clearance',
  COMPLETED = 'completed',
}

export class FinanceFilterDto {
  @IsOptional()
  @IsString()
  search?: string; // Search by Name, Phone, Email, Campaign Title

  @IsOptional()
  @IsEnum(PayoutType)
  tab?: PayoutType; // agency | influencer | client

  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @IsOptional()
  @IsString()
  dateFrom?: string; // YYYY-MM-DD

  @IsOptional()
  @IsString()
  dateTo?: string; // YYYY-MM-DD

  @IsOptional()
  @IsEnum(['low_to_high', 'high_to_low'])
  amountSort?: 'low_to_high' | 'high_to_low';

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
