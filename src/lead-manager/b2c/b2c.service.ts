import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateB2CDto } from './dto/create-b2c.dto';
import { B2CEntity } from './entities/b2c.entity';
import { ApiResponse } from 'src/common/interfaces/api-response.interface';
import { UpdateB2CDto } from './dto/update-b2c.dto';
import { SearchB2CDto } from './dto/search-b2c.dto';
import { PaginatedResponse } from 'src/common/interfaces/paginated-response.interface';

export interface B2CListItem {
  id: number;
  name: string;
  gender: string;
  nationality: string;
  state?: string;
  industry: string;
  subSector: string;
  skills: string;
  highestDegree: string;
  interests: string[];
  company: string;
  maritalStatus: string;
  income: any;
  salary: any;
}

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

  async findAll(page = 1, limit = 10): Promise<PaginatedResponse<B2CListItem>> {
    const [data, total] = await this.repo
      .createQueryBuilder('b2c')
      .select([
        'b2c.id',
        'b2c.fullName',
        'b2c.gender',
        'b2c.nationality',
        'b2c.state',
        'b2c.primaryIndustry',
        'b2c.industrySubsector',
        'b2c.primarySkills',
        'b2c.highestDegree',
        'b2c.interests', // mapped as hobbies
        'b2c.company', // mapped as organizations
        'b2c.maritalStatus',
        'b2c.householdIncome',
        'b2c.salary',
      ])
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      success: true,
      message: 'B2C profiles fetched successfully',
      data: data.map((item) => ({
        id: item.id,
        name: item.fullName,
        gender: item.gender,
        nationality: item.nationality,
        state: item.state,
        industry: item.primaryIndustry,
        subSector: item.industrySubsector,
        skills: item.primarySkills,
        highestDegree: item.highestDegree,
        interests: item.interests || [], // Fix: ensure interests is always an array
        company: item.company || '', // Fix: ensure organizations (company) is included
        maritalStatus: item.maritalStatus,
        income: item.householdIncome,
        salary: item.salary,
      })),
      meta: {
        total,
        page,
        limit,
      },
    };
  }

  async search(
    filters: SearchB2CDto,
    page = 1,
    limit = 10,
  ): Promise<PaginatedResponse<B2CListItem>> {
    // ✅ At least one filter required
    if (!Object.values(filters).some(Boolean)) {
      throw new BadRequestException(
        'At least one search filter must be provided',
      );
    }

    const qb = this.repo.createQueryBuilder('b2c');

    qb.select([
      'b2c.id',
      'b2c.fullName',
      'b2c.gender',
      'b2c.nationality',
      'b2c.state',
      'b2c.primaryIndustry',
      'b2c.industrySubsector',
      'b2c.primarySkills',
      'b2c.highestDegree',
      'b2c.interests', // mapped as hobbies
      'b2c.company', // mapped as organizations
      'b2c.maritalStatus',
      'b2c.householdIncome',
      'b2c.salary',
    ]);

    // Filters
    if (filters.name) {
      qb.andWhere('b2c.fullName ILIKE :name', {
        name: `%${filters.name}%`,
      });
    }

    if (filters.gender) {
      qb.andWhere('b2c.gender ILIKE :gender', {
        gender: `%${filters.gender}%`,
      });
    }

    if (filters.nationality) {
      qb.andWhere('b2c.nationality ILIKE :nationality', {
        nationality: `%${filters.nationality}%`,
      });
    }

    if (filters.state) {
      qb.andWhere('b2c.state ILIKE :state', {
        state: `%${filters.state}%`,
      });
    }

    if (filters.industry) {
      qb.andWhere('b2c.primaryIndustry ILIKE :industry', {
        industry: `%${filters.industry}%`,
      });
    }

    if (filters.subSector) {
      qb.andWhere('b2c.industrySubsector ILIKE :subSector', {
        subSector: `%${filters.subSector}%`,
      });
    }

    if (filters.skills) {
      qb.andWhere('b2c.primarySkills ILIKE :skills', {
        skills: `%${filters.skills}%`,
      });
    }

    if (filters.highestDegree) {
      qb.andWhere('b2c.highestDegree ILIKE :highestDegree', {
        highestDegree: `%${filters.highestDegree}%`,
      });
    }

    if (filters.interests) {
      qb.andWhere(':hobbies = ANY(b2c.interests)', {
        hobbies: filters.interests,
      });
    }

    if (filters.company) {
      qb.andWhere('b2c.company ILIKE :organizations', {
        organizations: `%${filters.company}%`, // mapped as organizations
      });
    }

    if (filters.maritalStatus) {
      qb.andWhere('b2c.maritalStatus ILIKE :maritalStatus', {
        maritalStatus: `%${filters.maritalStatus}%`,
      });
    }

    if (filters.totalIncome) {
      qb.andWhere('b2c.householdIncome ILIKE :income', {
        income: `%${filters.totalIncome}%`,
      });
    }

    if (filters.salary) {
      qb.andWhere('b2c.salary ILIKE :salary', {
        salary: `%${filters.salary}%`,
      });
    }

    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      success: true,
      message: 'Filtered B2C search results',
      data: data.map((item) => ({
        id: item.id,
        name: item.fullName,
        gender: item.gender,
        nationality: item.nationality,
        state: item.state,
        industry: item.primaryIndustry,
        subSector: item.industrySubsector,
        skills: item.primarySkills,
        highestDegree: item.highestDegree,
        interests: item.interests || [], // Ensure interests is always an array
        company: item.company || '', // Ensure organizations is always included
        maritalStatus: item.maritalStatus,
        income: item.householdIncome,
        salary: item.salary,
      })),
      meta: {
        total,
        page,
        limit,
      },
    };
  }

  async findById(id: number): Promise<ApiResponse<B2CEntity>> {
    const data = await this.repo.findOne({ where: { id } });

    if (!data) {
      throw new NotFoundException('B2C profile not found');
    }

    return {
      success: true,
      message: 'B2C profile fetched successfully',
      data,
    };
  }

  async update(id: number, dto: UpdateB2CDto): Promise<ApiResponse<B2CEntity>> {
    const existing = await this.repo.findOne({ where: { id } });

    if (!existing) {
      throw new NotFoundException('B2C profile not found');
    }

    const updated = Object.assign(existing, dto);
    const saved = await this.repo.save(updated);

    return {
      success: true,
      message: 'B2C profile updated successfully',
      data: saved,
    };
  }

  async remove(id: number): Promise<ApiResponse<null>> {
    const existing = await this.repo.findOne({ where: { id } });

    if (!existing) {
      throw new NotFoundException('B2C profile not found');
    }

    await this.repo.remove(existing);

    return {
      success: true,
      message: 'B2C profile deleted successfully',
    };
  }
}
