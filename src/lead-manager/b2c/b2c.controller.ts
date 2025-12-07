import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CreateB2CDto } from './dto/create-b2c.dto';
import { B2CEntity } from './entities/b2c.entity';
import { B2cService } from './b2c.service';

@UseGuards(AuthGuard('jwt'))
@Controller('b2c')
export class B2cController {
  constructor(private readonly b2cservice: B2cService) {}

  @Post('create')
  async create(@Body() dto: CreateB2CDto): Promise<B2CEntity> {
    return this.b2cservice.create(dto);
  }

  @Get()
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ): Promise<{ data: B2CEntity[]; total: number }> {
    return this.b2cservice.findAll(Number(page), Number(limit));
  }

  @Get('search')
  async search(@Query('q') keyword: string): Promise<B2CEntity[]> {
    return this.b2cservice.search(keyword);
  }
}
