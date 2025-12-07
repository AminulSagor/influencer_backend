import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { B2cController } from './b2c.controller';
import { B2CEntity } from './entities/b2c.entity';
import { B2cService } from './b2c.service';

@Module({
  imports: [TypeOrmModule.forFeature([B2CEntity])],
  providers: [B2cService],
  controllers: [B2cController],
  exports: [B2cService],
})
export class B2CModule {}
