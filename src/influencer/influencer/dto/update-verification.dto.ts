import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsArray,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

// --- Skills & Niches ---
export class AddNichesDto {
  @IsArray()
  @IsString({ each: true })
  niches: string[]; // User sends ["Fashion", "Tech"]
}

export class AddSkillsDto {
  @IsArray()
  @IsString({ each: true })
  skills: string[]; // User sends ["Video Editing", "Modeling"]
}

export class AddLocationDto {
  @IsOptional()
  @IsObject()
  addresses: {
    addressName: string;
    thana: string;
    zilla: string;
    fullAddress: string;
  };
}

// --- Payouts ---
export class BankAccountDto {
  @IsNotEmpty() @IsString() bankName: string;
  @IsNotEmpty() @IsString() bankAccHolderName: string;
  @IsNotEmpty() @IsString() bankAccNo: string;
  @IsNotEmpty() @IsString() bankBranchName: string;
  @IsNotEmpty() @IsString() bankRoutingNo: string;
}

export class MobileBankingDto {
  @IsNotEmpty() @IsString() accountNo: string;
  @IsNotEmpty() @IsString() accountHolderName: string;
  @IsNotEmpty() @IsString() accountType: string; // Bkash, Nagad, etc.
}

export class AddPayoutDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => BankAccountDto)
  bank?: BankAccountDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MobileBankingDto)
  mobileBanking?: MobileBankingDto;
}
