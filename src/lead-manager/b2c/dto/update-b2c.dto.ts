import { PartialType } from '@nestjs/mapped-types';
import { CreateB2CDto } from './create-b2c.dto';

export class UpdateB2CDto extends PartialType(CreateB2CDto) {}
