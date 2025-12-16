import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum MasterDataType {
  NICHE = 'niche',
  SKILL = 'skill',
  PRODUCT_TYPE = 'product_type',
}

@Entity('master_data')
export class MasterDataEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: MasterDataType })
  type: MasterDataType;

  @Column()
  name: string; // The value (e.g., "Health & Wellness", "Public Speaking")

  @CreateDateColumn()
  createdAt: Date;
}
