import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('system_settings')
export class SystemSettingEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'decimal', default: 0 })
  platformFee: number;

  @Column({ type: 'decimal', default: 0 })
  vatTax: number;
}
