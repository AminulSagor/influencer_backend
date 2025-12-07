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

  @Column('text', { array: true, nullable: true })
  serviceName: string;

  @Column()
  category: string;

  @Column({ nullable: true })
  subCategory: string;

  @Column({ nullable: true })
  serviceDescription: string;

  @Column()
  pricingModel: string;

  @Column()
  rate: string;

  @Column()
  currency: string;

  @Column()
  serviceAvailability: string;

  @Column()
  onlineService: string;

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
  @Column({ nullable: true })
  businessPhone: string;

  @Column({ nullable: true })
  secondaryPhone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  supportEmail: string;

  @Column({ nullable: true })
  website: string;

  // keyContacts stored as JSON array, max 5
  @Column({ type: 'json', nullable: true })
  keyContacts: Array<{
    name?: string;
    position?: string;
    department?: string;
    phone?: string;
    email?: string;
    linkedIn?: string;
  }>;

  // online presence
  @Column({ nullable: true })
  opFacebook: string;

  @Column({ nullable: true })
  opInstagram: string;

  @Column({ nullable: true })
  opLinkedin: string;

  @Column({ nullable: true })
  opTwitter: string;

  @Column({ nullable: true })
  opYoutube: string;

  @Column({ nullable: true })
  opTiktok: string;

  @Column({ nullable: true })
  opGoogleBusiness: string;

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

  @CreateDateColumn()
  createdAt: Date;
}
