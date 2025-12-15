import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { NegotiationAction } from '../entities/campaign-negotiation.entity';

// ============================================
// Create Negotiation Entry DTO (Admin sends quote)
// ============================================
export class CreateNegotiationDto {
  @IsUUID()
  campaignId: string;

  @IsEnum(NegotiationAction)
  action: NegotiationAction;

  @IsString()
  @IsOptional()
  message?: string;

  // The quoted price for the campaign
  @IsNumber()
  @Min(0)
  @IsOptional()
  proposedBaseBudget?: number;
}

// ============================================
// Accept Negotiation DTO
// ============================================
export class AcceptNegotiationDto {
  @IsUUID()
  campaignId: string;

  @IsString()
  @IsOptional()
  message?: string;
}

// ============================================
// Reject Campaign DTO
// ============================================
export class RejectCampaignDto {
  @IsUUID()
  campaignId: string;

  @IsString()
  reason: string;
}

// ============================================
// Mark Negotiation as Read DTO
// ============================================
export class MarkNegotiationReadDto {
  @IsUUID()
  negotiationId: string;
}

// ============================================
// Get Negotiation History DTO
// ============================================
export class GetNegotiationHistoryDto {
  @IsUUID()
  campaignId: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}
