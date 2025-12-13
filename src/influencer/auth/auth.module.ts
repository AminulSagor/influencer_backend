import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';

// Entities
import { UserEntity } from '../user/entities/user.entity';
import { InfluencerProfileEntity } from '../influencer/entities/influencer-profile.entity';

@Module({
  imports: [
    // Register Entities for this module
    TypeOrmModule.forFeature([UserEntity, InfluencerProfileEntity]),
    PassportModule,
    JwtModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('BRANDGURU_JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('BRANDGURU_JWT_EXPIRE') as any,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
