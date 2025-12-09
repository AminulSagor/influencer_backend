import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { B2BProfileEntity } from './entities/b2b.entity';
import { B2bService } from './b2b.service';
import { B2bController } from './b2b..controller';

@Module({
  imports: [TypeOrmModule.forFeature([B2BProfileEntity])],
  providers: [B2bService],
  controllers: [B2bController],
})
export class B2bModule {}
