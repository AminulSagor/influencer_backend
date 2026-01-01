import { Controller, Post } from '@nestjs/common';
import { SeederService } from './services/seeder.service';

@Controller('seeder')
export class SeederController {
  constructor(private readonly seederService: SeederService) {}

  @Post('run')
  async runSeeder() {
    return await this.seederService.seedDatabase();
  }
}
