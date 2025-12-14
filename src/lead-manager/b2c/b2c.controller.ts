import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { CreateB2CDto } from './dto/create-b2c.dto';
import { B2CEntity } from './entities/b2c.entity';
import { B2cService } from './b2c.service';
import { UpdateB2CDto } from './dto/update-b2c.dto';
import { SearchB2CDto } from './dto/search-b2c.dto';
import { exportToExcel } from 'src/common/helpers/excel-export.helper';

@UseGuards(AuthGuard('jwt'))
@Controller('b2c')
export class B2cController {
  constructor(private readonly b2cservice: B2cService) {}

  @Post('create')
  async create(@Body() dto: CreateB2CDto): Promise<B2CEntity> {
    return this.b2cservice.create(dto);
  }

  @Post('/bulk-create')
  async bulkCreate(@Body() body: any[]) {
    if (!body || !Array.isArray(body) || body.length === 0) {
      return {
        success: false,
        message:
          'No data provided. Ensure request body is a JSON Array [{},{}]',
      };
    }
    return this.b2cservice.bulkCreate(body);
  }

  @Get()
  async findAll(@Query('page') page = 1, @Query('limit') limit = 10) {
    return this.b2cservice.findAll(Number(page), Number(limit));
  }

  @Get('search')
  search(
    @Query() filters: SearchB2CDto,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    return this.b2cservice.search(filters, Number(page), Number(limit));
  }

  @Get('export')
  async exportToExcel(@Query() filters: SearchB2CDto, @Res() res: Response) {
    const data = await this.b2cservice.getForExport(filters);
    return exportToExcel(res, data, 'b2c-export-data');
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.b2cservice.findById(id);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateB2CDto) {
    return this.b2cservice.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.b2cservice.remove(id);
  }
}
