import { PartialType } from '@nestjs/mapped-types';
import { CreateB2BDto } from './create-b2b.dto';

export class UpdateB2BDto extends PartialType(CreateB2BDto) {}
