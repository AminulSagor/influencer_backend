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
import { UpdateB2BDto } from './dto/update-b2b.dto';
import { ApiResponse } from 'src/common/interfaces/api-response.interface';
import { PaginatedResponse } from 'src/common/interfaces/paginated-response.interface';
import { SearchB2BDto } from './dto/search-b2b.dto';

export interface B2BListItem {
  businessId: string;
  name: string;
  businessType: string;
  primaryIndustry: string;
  niche: string;
  serviceName: string;
  country: string;
  city: string;
}

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
          name: k.name,
          position: k.position,
          department: k.department,
          phone: k.phone,
          email: k.email,
          linkedIn: k.linkedIn,
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
  async findAll(page = 1, limit = 10): Promise<PaginatedResponse<B2BListItem>> {
    const [data, total] = await this.b2bRepo.findAndCount({
      select: [
        'businessId',
        'name',
        'businessType',
        'primaryIndustry',
        'niche',
        'serviceName',
        'country',
        'city',
      ],
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
  }

  //   SEARCH
  async search(
    filters: SearchB2BDto,
    page = 1,
    limit = 10,
  ): Promise<PaginatedResponse<B2BListItem>> {
    // ✅ At least ONE filter must be provided
    if (!Object.values(filters).some(Boolean)) {
      throw new BadRequestException(
        'At least one search filter must be provided',
      );
    }

    const qb = this.b2bRepo.createQueryBuilder('b2b');

    qb.select([
      'b2b.businessId',
      'b2b.name',
      'b2b.businessType',
      'b2b.primaryIndustry',
      'b2b.niche',
      'b2b.serviceName',
      'b2b.country',
      'b2b.city',
    ]);

    // ✅ Dynamic filters
    if (filters.businessType) {
      qb.andWhere('b2b.businessType ILIKE :businessType', {
        businessType: `%${filters.businessType}%`,
      });
    }

    if (filters.primaryIndustry) {
      qb.andWhere('b2b.primaryIndustry ILIKE :primaryIndustry', {
        primaryIndustry: `%${filters.primaryIndustry}%`,
      });
    }

    if (filters.niche) {
      qb.andWhere('b2b.niche ILIKE :niche', {
        niche: `%${filters.niche}%`,
      });
    }

    if (filters.serviceName) {
      qb.andWhere('b2b.serviceName ILIKE :serviceName', {
        serviceName: `%${filters.serviceName}%`,
      });
    }

    if (filters.country) {
      qb.andWhere('b2b.country ILIKE :country', {
        country: `%${filters.country}%`,
      });
    }

    if (filters.city) {
      qb.andWhere('b2b.city ILIKE :city', {
        city: `%${filters.city}%`,
      });
    }

    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      success: true,
      message: 'Filtered B2B search results',
      data,
      meta: {
        total,
        page,
        limit,
      },
    };
  }

  async findById(id: string): Promise<ApiResponse<B2BProfileEntity>> {
    const data = await this.b2bRepo.findOne({ where: { businessId: id } });

    if (!data) {
      throw new NotFoundException('B2B profile not found');
    }

    return {
      success: true,
      message: 'B2B profile fetched successfully',
      data,
    };
  }

  async update(
    id: string,
    dto: UpdateB2BDto,
  ): Promise<ApiResponse<B2BProfileEntity>> {
    const existing = await this.b2bRepo.findOne({
      where: { businessId: id },
    });

    if (!existing) {
      throw new NotFoundException('B2B profile not found');
    }

    const updated = Object.assign(existing, dto);
    const saved = await this.b2bRepo.save(updated);

    return {
      success: true,
      message: 'B2B profile updated successfully',
      data: saved,
    };
  }

  async remove(id: string): Promise<ApiResponse<null>> {
    const existing = await this.b2bRepo.findOne({
      where: { businessId: id },
    });

    if (!existing) {
      throw new NotFoundException('B2B profile not found');
    }

    await this.b2bRepo.remove(existing);

    return {
      success: true,
      message: 'B2B profile deleted successfully',
    };
  }
}
