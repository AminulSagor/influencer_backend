import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('b2b_profiles')
export class B2BProfileEntity {
  @PrimaryGeneratedColumn('uuid')
  businessId: string;

  @Column()
  name: string;

  @Column()
  businessType: string;

  @Column({ nullable: true })
  businessDescription: string;

  @Column({ nullable: true })
  registrationNumber: string;

  @Column({ nullable: true })
  taxId: string;

  @Column({ nullable: true })
  establishedDate: string;

  @Column()
  status: string;

  @Column()
  primaryIndustry: string;

  @Column()
  niche: string;

  @Column()
  subNiche: string;

  // Service Overview
  @Column('jsonb', { nullable: true })
  serviceOverview: Array<{
    serviceName: string;
    category: string;
    subCategory: string;
    serviceDescription: string;
    pricingModel: string;
    rate: string;
    currency: string;
    serviceAvailability: string;
    onlineService: string;
  }>;

  // location
  @Column({ nullable: true })
  street: string;

  @Column({ nullable: true })
  subCity: string;

  @Column()
  city: string;

  @Column()
  state: string;

  @Column({ nullable: true })
  postalCode: string;

  @Column()
  country: string;

  // contact info
  @Column({ type: 'varchar', nullable: true })
  businessPhone: string | null;

  @Column({ type: 'varchar', nullable: true })
  secondaryPhone: string | null;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ type: 'varchar', nullable: true })
  supportEmail: string | null;

  @Column({ type: 'varchar', nullable: true })
  website: string | null;

  // keyContacts stored as JSON array, max 5
  @Column({ type: 'json', nullable: true })
  keyContacts: Array<{
    name?: string | null;
    position?: string | null;
    department?: string | null;
    phone?: string | null;
    email?: string | null;
    linkedIn?: string | null;
  }>;

  // online presence
  @Column({ type: 'varchar', nullable: true })
  opFacebook: string | null;

  @Column({ type: 'varchar', nullable: true })
  opInstagram: string | null;

  @Column({ type: 'varchar', nullable: true })
  opLinkedin: string | null;

  @Column({ type: 'varchar', nullable: true })
  opTwitter: string | null;

  @Column({ type: 'varchar', nullable: true })
  opYoutube: string | null;

  @Column({ type: 'varchar', nullable: true })
  opTiktok: string | null;

  @Column({ type: 'varchar', nullable: true })
  opGoogleBusiness: string | null;

  @Column({ nullable: true })
  opDirectoryListings: string;

  // operations
  @Column({ nullable: true })
  operationsOpeningHours: string;

  @Column({ nullable: true })
  operationsTimeZone: string;

  @Column({ nullable: true })
  operationsEmployees: string;

  @Column({ nullable: true })
  operationsTools: string;

  @Column({ nullable: true })
  operationsCertifications: string;

  // financials
  @Column({ nullable: true })
  fnPaymentMethods: string;

  @Column({ nullable: true })
  fnBillingAddress: string;

  @Column({ nullable: true })
  fnInvoiceContact: string;

  @Column({ nullable: true })
  fnPrimaryCurrency: string;

  @Column({ nullable: true })
  fnPaymentTerms: string;

  // legal
  @Column({ nullable: true })
  legalLicenses: string;

  @Column({ nullable: true })
  legalPermits: string;

  @Column({ nullable: true })
  legalInsurance: string;

  @Column({ nullable: true })
  legalComplianceCertificates: string;

  // marketing
  @Column({ nullable: true })
  marketingTargetAudience: string;

  @Column({ nullable: true })
  marketingValueProposition: string;

  @Column({ nullable: true })
  marketingMainCompetitors: string;

  @Column({ nullable: true })
  marketingKeywords: string;

  // meta
  @Column({ nullable: true })
  metaTags: string; // we'll store tags as comma-separated string, or use json if preferred

  @Column({ nullable: true, type: 'text' })
  metaNotes: string;

  @Column({ nullable: true })
  metaDateAdded: string;

  @Column({ nullable: true })
  metaLastUpdated: string;

  @Column({ nullable: true })
  companyImgUrl?: string;

  @CreateDateColumn()
  createdAt: Date;
}
