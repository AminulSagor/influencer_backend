import {
  IsUUID,
  IsOptional,
  IsNumber,
  Min,
  IsString,
  IsArray,
} from 'class-validator';

export class AssignAgencyDto {
  @IsUUID()
  campaignId: string;

  @IsArray()
  @IsUUID('all', { each: true })
  agencyIds: string[];

  @IsString()
  assignedServiceFeePercent: string;
}

// ✅ Fix: Add this class back so the controller/service can find it
export class AgencyQuoteActionDto {
  @IsUUID()
  @IsOptional()
  campaignId?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  approvedBudget?: number;
}

export class AgencyRequoteDto {
  @IsNumber()
  proposedServiceFeePercent: number; // Design 2: e.g., 15

  // @IsNumber()
  // @Min(1)
  // proposedTotalBudget: number;

  @IsString()
  @IsOptional()
  message?: string;
}

export class SelectAgencyDto {
  @IsUUID()
  campaignId: string;

  @IsUUID()
  agencyId: string;

  @IsNumber()
  @Min(1)
  paymentAmount: number;
}
