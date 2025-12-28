import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { CampaignEntity } from './campaign.entity';

// Asset Types
// export enum AssetType {
//   BRAND_LOGO = 'brand_logo',
//   PRODUCT_DEMO_VIDEO = 'product_demo_video',
//   BRAND_GUIDELINES = 'brand_guidelines',
//   IMAGE = 'image',
//   VIDEO = 'video',
//   PDF = 'pdf',
//   OTHER = 'other',
// }

export enum AssetCategory {
  BRAND = 'brand',
  CONTENT = 'content',
}

@Entity('campaign_assets')
export class CampaignAssetEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: AssetCategory,
    default: AssetCategory.CONTENT,
  })
  category: AssetCategory; // ✅ Distinguishes Brand vs Content

  // Asset Type
  @Column({
    type: 'varchar',
    length: 50,
  })
  assetType: string;

  // File name (original)
  @Column()
  fileName: string;

  // S3 URL or file path
  @Column()
  fileUrl: string;

  // File size in bytes
  @Column({ type: 'bigint', nullable: true })
  fileSize: number;

  // MIME type
  @Column({ nullable: true })
  mimeType: string;

  // Optional description
  @Column({ type: 'text', nullable: true })
  description: string;

  // ============================================
  // Relationships
  // ============================================
  @Column({ type: 'uuid' })
  campaignId: string;

  @ManyToOne(() => CampaignEntity, (campaign) => campaign.assets, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'campaignId' })
  campaign: CampaignEntity;

  // ============================================
  // Timestamps
  // ============================================
  @CreateDateColumn()
  createdAt: Date;
}
