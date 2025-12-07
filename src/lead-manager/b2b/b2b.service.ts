import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateB2BDto } from './dto/create-b2b.dto';
import { B2BProfileEntity } from './entities/b2b.entity';

@Injectable()
export class B2bService {
  constructor(
    @InjectRepository(B2BProfileEntity)
    private readonly b2bRepo: Repository<B2BProfileEntity>,
  ) {}

  async create(dto: CreateB2BDto): Promise<any> {
    try {
      //  service tag validation
      if (dto.metaTags?.length && dto.metaTags.length > 10) {
        throw new BadRequestException(
          'Service name tag limit exceeded (max 10)',
        );
      }

      // key contact max 5 (SAFE FIX  )
      if (dto.keyContacts?.length && dto.keyContacts.length > 5) {
        throw new BadRequestException('Key contact limit exceeded (max 5)');
      }

      //     FIXED: DTO → ENTITY TRANSFORMATION
      const payload: Partial<B2BProfileEntity> = {
        ...dto,

        //   KEY CONTACT MAPPING FIX
        keyContacts: dto.keyContacts?.map((k) => ({
          name: k.keyContactName,
          position: k.keyContactPosition,
          department: k.keyContactDepartment,
          phone: k.keyContactPhone,
          email: k.keyContactEmail,
          linkedIn: k.keyContactLinkedIn,
        })),

        //   META TAGS ARRAY → STRING (since entity uses string)
        metaTags: dto.metaTags?.join(','),
      };

      const data = this.b2bRepo.create(payload);
      const saved = await this.b2bRepo.save(data);

      return {
        success: true,
        message: 'B2B lead created successfully',
        data: saved,
      };
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  //   GET WITH PAGINATION
  async findAll(page = 1, limit = 10): Promise<any> {
    try {
      const [data, total] = await this.b2bRepo.findAndCount({
        skip: (page - 1) * limit,
        take: limit,
        order: { createdAt: 'DESC' },
      });

      return {
        success: true,
        message: 'B2B leads fetched successfully',
        data,
        meta: {
          total,
          page,
          limit,
        },
      };
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  //   SEARCH
  async search(keyword: string): Promise<any> {
    const result = await this.b2bRepo
      .createQueryBuilder('b2b')
      .where('b2b.name ILIKE :key', { key: `%${keyword}%` })
      .orWhere('b2b.primaryIndustry ILIKE :key', { key: `%${keyword}%` })
      .getMany();

    if (!result.length) {
      throw new NotFoundException('No matching B2B leads found');
    }

    return {
      success: true,
      message: 'Search results',
      data: result,
    };
  }
}
