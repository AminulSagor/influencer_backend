import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { B2bService } from './b2b.service';
import { CreateB2BDto } from './dto/create-b2b.dto';
import { AuthGuard } from '@nestjs/passport';
import { UpdateB2BDto } from './dto/update-b2b.dto';
import { SearchB2BDto } from './dto/search-b2b.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('b2b')
export class B2bController {
  constructor(private readonly b2bservice: B2bService) {}

  @Post('/create')
  async create(@Body() dto: CreateB2BDto) {
    return this.b2bservice.create(dto);
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
