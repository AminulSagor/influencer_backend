import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import {
  UserEntity,
  UserRole,
} from '../../influencer/user/entities/user.entity';
import { ClientProfileEntity } from '../../influencer/client/entities/client-profile.entity';
import { AgencyProfileEntity } from '../../influencer/agency/entities/agency-profile.entity';
import { InfluencerProfileEntity } from '../../influencer/influencer/entities/influencer-profile.entity';

@Injectable()
export class SeederService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(ClientProfileEntity)
    private readonly clientRepo: Repository<ClientProfileEntity>,
    @InjectRepository(AgencyProfileEntity)
    private readonly agencyRepo: Repository<AgencyProfileEntity>,
    @InjectRepository(InfluencerProfileEntity)
    private readonly influencerRepo: Repository<InfluencerProfileEntity>,
  ) {}

  async seedDatabase() {
    console.log('🌱 Starting Database Seeding...');
    const salt = await bcrypt.genSalt();
    const password = await bcrypt.hash('12345678', salt); // Common password

    // --------------------------------------------------------
    // 1. Create 1 ADMIN
    // --------------------------------------------------------
    const adminCheck = await this.userRepo.findOne({
      where: { email: 'admin@brandguru.com' },
    });
    if (!adminCheck) {
      const admin = this.userRepo.create({
        // firstName: 'Super',
        // lastName: 'Admin',
        email: 'admin@brandguru.com',
        phone: '+8801900000000',
        password: password,
        role: UserRole.ADMIN,
        isPhoneVerified: true,
        isEmailVerified: true,
      });
      await this.userRepo.save(admin);
      console.log('✅ Admin Created');
    }

    // --------------------------------------------------------
    // 2. Create 10 CLIENTS
    // --------------------------------------------------------
    for (let i = 1; i <= 10; i++) {
      const email = `client${i}@test.com`;
      const exists = await this.userRepo.findOne({ where: { email } });
      if (!exists) {
        const user = await this.userRepo.save({
          firstName: `Client`,
          lastName: `${i}`,
          email: email,
          phone: `+88017000000${i.toString().padStart(2, '0')}`, // e.g. 01700000001
          password: password,
          role: UserRole.CLIENT,
          isPhoneVerified: true,
        });

        await this.clientRepo.save({
          user: user,
          brandName: `Brand ${i}`,
          firstName: `Client`,
          lastName: `${i}`,
          phone: user.phone,
          email: user.email,
          userId: user.id,
          isOnboardingComplete: true,
        });
      }
    }
    console.log('✅ 10 Clients Created');

    // --------------------------------------------------------
    // 3. Create 10 AGENCIES
    // --------------------------------------------------------
    for (let i = 1; i <= 10; i++) {
      const email = `agency${i}@test.com`;
      const exists = await this.userRepo.findOne({ where: { email } });
      if (!exists) {
        const user = await this.userRepo.save({
          firstName: `Agency`,
          lastName: `${i}`,
          email: email,
          phone: `+88018000000${i.toString().padStart(2, '0')}`,
          password: password,
          role: UserRole.AGENCY,
          isPhoneVerified: true,
        });

        await this.agencyRepo.save({
          user: user,
          agencyName: `Creative Agency ${i}`,
          firstName: `AgencyOwner`,
          lastName: `${i}`,
          userId: user.id,
          averageRating: 4.5,
          totalReviews: 10,
        });
      }
    }
    console.log('✅ 10 Agencies Created');

    // --------------------------------------------------------
    // 4. Create 10 INFLUENCERS
    // --------------------------------------------------------
    for (let i = 1; i <= 10; i++) {
      const email = `influencer${i}@test.com`;
      const exists = await this.userRepo.findOne({ where: { email } });
      if (!exists) {
        const user = await this.userRepo.save({
          firstName: `Influencer`,
          lastName: `${i}`,
          email: email,
          phone: `+88016000000${i.toString().padStart(2, '0')}`,
          password: password,
          role: UserRole.INFLUENCER, // Assuming distinct role
          isPhoneVerified: true,
        });

        await this.influencerRepo.save({
          user: user,
          firstName: `Star`,
          lastName: `Influencer ${i}`,
          displayName: `Influencer ${i}`,
          userId: user.id,
          averageRating: 4.8,
          platform: 'instagram',
        });
      }
    }
    console.log('✅ 10 Influencers Created');

    return { message: 'Database seeded successfully!' };
  }
}
