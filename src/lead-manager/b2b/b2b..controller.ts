import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { B2bService } from './b2b.service';
import { CreateB2BDto } from './dto/create-b2b.dto';
import { AuthGuard } from '@nestjs/passport';
import { UpdateB2BDto } from './dto/update-b2b.dto';
import { SearchB2BDto } from './dto/search-b2b.dto';
import { exportToExcel } from 'src/common/helpers/excel-export.helper';

@UseGuards(AuthGuard('jwt'))
@Controller('b2b')
export class B2bController {
  constructor(private readonly b2bservice: B2bService) {}

  @Post('/create')
  async create(@Body() dto: CreateB2BDto) {
    return this.b2bservice.create(dto);
  }

  @Post('/bulk-create')
  async bulkCreate(@Body() body: { records: CreateB2BDto[] }) {
    return this.b2bservice.bulkCreate(body.records);
  }

  @Get()
  async findAll(@Query('page') page: number, @Query('limit') limit: number) {
    return this.b2bservice.findAll(page, limit);
  }

  @Get('search')
  search(
    @Query() filters: SearchB2BDto,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    return this.b2bservice.search(filters, Number(page), Number(limit));
  }

  @Get('export')
  async exportToExcel(@Query() filters: SearchB2BDto, @Res() res: Response) {
    const data = await this.b2bservice.getForExport(filters);
    return exportToExcel(res, data, 'b2b-export-data');
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.b2bservice.findById(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateB2BDto) {
    return this.b2bservice.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.b2bservice.remove(id);
  }
}
