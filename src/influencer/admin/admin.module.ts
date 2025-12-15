import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { InfluencerProfileEntity } from '../influencer/entities/influencer-profile.entity';
import { UserEntity } from '../user/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([InfluencerProfileEntity, UserEntity]), // Register Repos
    PassportModule,
    // JwtModule.registerAsync({
    //   imports: [ConfigModule],
    //   useFactory: async (configService: ConfigService) => ({
    //     secret: configService.get<string>('BRANDGURU_JWT_SECRET'),
    //     signOptions: { expiresIn: '15d' }, // Admin token expiry
    //   }),
    //   inject: [ConfigService],
    // }),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
