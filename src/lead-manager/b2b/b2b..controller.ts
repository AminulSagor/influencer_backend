import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { B2bService } from './b2b.service';
import { CreateB2BDto } from './dto/create-b2b.dto';
import { AuthGuard } from '@nestjs/passport';

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
  async search(@Query('q') keyword: string) {
    return this.b2bservice.search(keyword);
  }
}
