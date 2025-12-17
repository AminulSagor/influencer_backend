import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

// --- 1. Basic Info DTO ---
export class UpdateAgencyBasicDto {
  @IsOptional() @IsString() agencyName?: string;
  @IsOptional() @IsString() ownerFirstName?: string;
  @IsOptional() @IsString() ownerLastName?: string;
  @IsOptional() @IsString() secondaryPhone?: string;
  @IsOptional() @IsString() agencyBio?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() logo?: string;
}

// --- 2. Address DTO ---
export class AgencyAddressDto {
  @IsNotEmpty() @IsString() addressLine: string;
  @IsNotEmpty() @IsString() city: string;
  @IsNotEmpty() @IsString() country: string;
}

export class UpdateAgencyAddressDto {
  @IsNotEmpty()
  @IsObject()
  @ValidateNested()
  @Type(() => AgencyAddressDto)
  address: AgencyAddressDto;
}

// --- 3. Social Links DTO ---
export class SocialLinkItemDto {
  @IsNotEmpty() @IsString() platform: string;
  @IsNotEmpty() @IsString() url: string;
}

export class UpdateAgencySocialsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SocialLinkItemDto)
  socialLinks: SocialLinkItemDto[];
}

// --- 4. Verification DTO (NID, Trade License, TIN, BIN) ---
export class UpdateAgencyVerificationDto {
  // NID
  @IsOptional() @IsString() nidNumber?: string;
  @IsOptional() @IsString() nidFrontImg?: string;
  @IsOptional() @IsString() nidBackImg?: string;

  // Trade License
  @IsOptional() @IsString() tradeLicenseNumber?: string;
  @IsOptional() @IsString() tradeLicenseImage?: string;

  // TIN
  @IsOptional() @IsString() tinNumber?: string;
  @IsOptional() @IsString() tinImage?: string;

  // BIN
  @IsOptional() @IsString() binNumber?: string;
}

// --- 5. Payout DTOs (Bank & Mobile) ---
class BankAccountDto {
  @IsNotEmpty() @IsString() bankName: string;
  @IsNotEmpty() @IsString() bankAccHolderName: string;
  @IsNotEmpty() @IsString() bankAccNo: string;
  @IsNotEmpty() @IsString() bankBranchName: string;
  @IsNotEmpty() @IsString() bankRoutingNo: string;
}

class MobileAccountDto {
  @IsNotEmpty() @IsString() accountNo: string;
  @IsNotEmpty() @IsString() accountHolderName: string;
  @IsNotEmpty() @IsString() accountType: string; // e.g. Bkash, Nagad
}

export class AddAgencyPayoutDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => BankAccountDto)
  bank?: BankAccountDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MobileAccountDto)
  mobileBanking?: MobileAccountDto;
}

// --- 6. Delete Item DTO (For Payouts) ---
export class DeleteAgencyItemDto {
  @IsNotEmpty() @IsString() type: 'bank' | 'mobile';
  @IsNotEmpty() @IsString() identifier: string; // Account No
}
