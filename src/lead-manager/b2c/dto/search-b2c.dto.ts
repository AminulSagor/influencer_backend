import { IsObject, IsOptional, IsString, IsArray } from 'class-validator';

export class SearchB2CDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  nationality?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  subSector?: string;

  @IsOptional()
  @IsString()
  skills?: string;

  @IsOptional()
  @IsString()
  highestDegree?: string;

  @IsOptional()
  @IsArray()
  interests?: string[]; // Fix: hobbies field mapped to interests as an array

  @IsOptional()
  @IsString()
  company?: string; // Fix: organizations field mapped to company

  @IsOptional()
  @IsString()
  maritalStatus?: string;

  @IsOptional()
  @IsObject()
  salary?: string; // Fix: salary should be an object with `salaryCurrency` and `salaryAmount`

  @IsOptional()
  @IsObject()
  totalIncome?: string; // Fix: totalIncome should be an object with `totalCurrency` and `totalAmount`
}
