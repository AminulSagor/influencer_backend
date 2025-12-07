import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsArray,
  Matches,
  IsEmail,
} from 'class-validator';

export class CreateB2CDto {
  @IsNotEmpty()
  @IsString()
  fullName: string;

  @IsOptional()
  @IsString()
  nickname?: string;

  @IsNotEmpty()
  @IsString()
  nationality: string;

  @IsOptional()
  @IsString()
  dob?: string;

  @IsNotEmpty()
  @IsString()
  gender: string;

  @IsOptional()
  @IsEmail()
  primaryEmail?: string;

  @IsOptional()
  @IsEmail()
  secondaryEmail?: string;

  @IsOptional()
  @IsString()
  primaryPhone?: string;

  @IsOptional()
  @IsString()
  secondaryPhone?: string;

  @IsNotEmpty()
  @IsString()
  country: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsNotEmpty()
  @IsString()
  primaryIndustry: string;

  @IsNotEmpty()
  @IsString()
  industrySubsector: string;

  @IsNotEmpty()
  @IsString()
  primarySkills: string;

  @IsNotEmpty()
  @IsString()
  totalExperience: string;

  @IsNotEmpty()
  @IsString()
  highestDegree: string;

  @IsArray()
  interests: string[];

  @IsNotEmpty()
  @IsString()
  organizations: string;

  @IsNotEmpty()
  @IsString()
  maritalStatus: string;

  @IsNotEmpty()
  @IsString()
  householdIncome: string;

  @IsNotEmpty()
  @IsString()
  salary: string;

  // All other 40+ optional fields allowed dynamically
  [key: string]: any;
}
