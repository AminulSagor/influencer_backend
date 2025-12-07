import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateB2CDto } from './dto/create-b2c.dto';
import { B2CEntity } from './entities/b2c.entity';

@Injectable()
export class B2cService {
  constructor(
    @InjectRepository(B2CEntity)
    private readonly repo: Repository<B2CEntity>,
  ) {}

  async create(dto: CreateB2CDto): Promise<B2CEntity> {
    const data = this.repo.create(dto);
    return this.repo.save(data);
  }

  async findAll(
    page = 1,
    limit = 10,
  ): Promise<{ data: B2CEntity[]; total: number }> {
    const [data, total] = await this.repo.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total };
  }

  async search(keyword: string): Promise<B2CEntity[]> {
    return this.repo
      .createQueryBuilder('b2c')
      .where('b2c.fullName ILIKE :q', { q: `%${keyword}%` })
      .orWhere('b2c.primaryIndustry ILIKE :q', { q: `%${keyword}%` })
      .getMany();
  }
}
