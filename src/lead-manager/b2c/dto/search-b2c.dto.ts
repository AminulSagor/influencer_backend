import { Transform, Type } from 'class-transformer';
import {
  IsObject,
  IsOptional,
  IsString,
  IsArray,
  IsNumber,
  Min,
} from 'class-validator';

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

  // @IsOptional()
  // @IsArray()
  // interests?: string[]; // Fix: hobbies field mapped to interests as an array

  @IsOptional()
  @IsString()
  company?: string; // Fix: organizations field mapped to company

  @IsOptional()
  @IsString()
  maritalStatus?: string;

  // --- FIX 1: Change Object to String ---
  // Query params are strings (e.g. ?salary=5000)
  // Your service uses 'ILIKE', so this must be a string.
  @IsOptional()
  @IsString()
  salary?: string;

  @IsOptional()
  @IsString()
  totalIncome?: string;

  // --- FIX 2: Handle Array Transformation ---
  // If user sends "?interests=coding", this transforms it to ["coding"]
  // so validation passes.
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return [value];
    }
    return value;
  })
  @IsArray()
  @IsString({ each: true })
  interests?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;
}
