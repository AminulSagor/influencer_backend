import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('b2c_profiles')
export class B2CEntity {
  @PrimaryGeneratedColumn()
  id: number;

  // Personal
  @Column()
  fullName: string;
  @Column({ nullable: true })
  nickname?: string;
  @Column()
  nationality: string;
  @Column({ nullable: true })
  dob?: string;
  @Column()
  gender: string;

  // Contact
  @Column({ nullable: true })
  primaryEmail?: string;
  @Column({ nullable: true })
  secondaryEmail?: string;
  @Column({ nullable: true })
  primaryPhone?: string;
  @Column({ nullable: true })
  secondaryPhone?: string;
  @Column({ nullable: true })
  whatsapp?: string;
  @Column({ nullable: true })
  telegram?: string;
  @Column({ nullable: true })
  wechat?: string;
  @Column({ nullable: true })
  prefferedContactMethod?: string;

  // Location
  @Column()
  country: string;
  @Column({ nullable: true })
  state?: string;
  @Column({ nullable: true })
  city?: string;
  @Column({ nullable: true })
  subCity?: string;
  @Column({ nullable: true })
  cityCorporation?: string;
  @Column({ nullable: true })
  street?: string;
  @Column({ nullable: true })
  postalCode?: string;
  @Column({ nullable: true })
  timeZone?: string;

  // Professional
  @Column({ nullable: true })
  currentJobTitle?: string;
  @Column({ nullable: true })
  company?: string;
  @Column({ nullable: true })
  workType?: string;
  @Column({ nullable: true })
  workModel?: string;
  @Column()
  primaryIndustry: string;
  @Column()
  industrySubsector: string;
  @Column({ nullable: true })
  coreResponsibilities?: string;
  @Column({ nullable: true })
  keyTools?: string;

  // Skills
  @Column()
  primarySkills: string;
  @Column({ nullable: true })
  secondarySkills: string;
  @Column({ nullable: true })
  technicalTools?: string;
  @Column({ nullable: true })
  topSoftSkills?: string;
  @Column({ nullable: true })
  professionalCertifications?: string;
  @Column({ nullable: true })
  licenses?: string;
  @Column({ nullable: true })
  credentials?: string;

  // Career
  @Column()
  totalExperience: string;
  @Column({ nullable: true })
  careerHighlight?: string;

  // Education
  @Column()
  highestDegree: string;

  @Column({ nullable: true })
  degreesEarned?: string;

  @Column({ nullable: true })
  institutions?: string;

  @Column({ nullable: true })
  fieldsOfStudy?: string;

  @Column({ nullable: true })
  graduationDates?: string;

  @Column({ nullable: true })
  gpa?: string;

  @Column({ nullable: true })
  academicHonors?: string;

  @Column({ nullable: true })
  publications?: string;

  @Column({ nullable: true })
  researchAreas?: string;

  @Column({ nullable: true })
  thesisTitle?: string;

  @Column({ nullable: true })
  academicIds?: string;

  // Web Presence (Merged)
  @Column({ nullable: true })
  personalWebsite?: string;

  @Column({ nullable: true })
  portfolio?: string;

  @Column({ nullable: true })
  blog?: string;

  @Column({ nullable: true })
  onlineResume?: string;

  @Column('text', { array: true, nullable: true })
  others: string[];

  //   Multi-Select Hobbies
  @Column('text', { array: true })
  interests: string[];

  @Column({ nullable: true })
  lifestylePreferences?: string;

  // SOCIAL / CIVIC
  @Column()
  organizations: string;

  @Column({ nullable: true })
  role?: string;

  @Column({ nullable: true })
  activities?: string;

  @Column({ nullable: true })
  civicEngagement?: string;

  @Column({ nullable: true })
  policyInterests?: string;

  // Family
  @Column()
  maritalStatus: string;

  @Column({ nullable: true })
  partnerSpouse?: string;

  @Column({ nullable: true })
  childrenDependents?: string;

  @Column({ nullable: true })
  householdSize?: string;

  @Column()
  householdIncome: string;

  @Column({ nullable: true })
  familyMedicalHistory?: string;

  @Column({ nullable: true })
  guardianshipStatus?: string;

  // Health
  @Column({ nullable: true })
  heightWeightBMI?: string;

  @Column({ nullable: true })
  allergies?: string;

  @Column({ nullable: true })
  chronicIllnesses?: string;

  @Column({ nullable: true })
  disabilities?: string;

  @Column({ nullable: true })
  diagnoses?: string;

  @Column({ nullable: true })
  medications?: string;

  @Column({ nullable: true })
  surgeries?: string;

  @Column({ nullable: true })
  vaccinationRecords?: string;

  @Column({ nullable: true })
  medicalDevices?: string;

  @Column({ nullable: true })
  healthInsurance?: string;

  //   Financial
  @Column()
  salary: string;

  @Column({ nullable: true })
  totalIncome?: string;

  @Column({ nullable: true })
  incomeHistory?: string;

  @Column({ nullable: true })
  savings?: string;

  @Column({ nullable: true })
  investments?: string;

  @Column({ nullable: true })
  cryptocurrency?: string;

  @Column({ nullable: true })
  loans?: string;

  @Column({ nullable: true })
  debts?: string;

  @Column({ nullable: true })
  bankAccounts?: string;

  @Column({ nullable: true })
  creditScore?: string;

  @Column({ nullable: true })
  transactionHistory?: string;

  @Column({ nullable: true })
  insurancePolicies?: string;

  @Column({ nullable: true })
  assets?: string;

  // Legal
  @Column({ nullable: true })
  nationalId?: string;

  @Column({ nullable: true })
  passport?: string;

  @Column({ nullable: true })
  driversLicense?: string;

  @Column({ nullable: true })
  visaWorkPermit?: string;

  @Column({ nullable: true })
  criminalBackground?: string;

  @Column({ nullable: true })
  courtRecords?: string;

  @Column({ nullable: true })
  contractsSigned?: string;

  @Column({ nullable: true })
  consentRecords?: string;

  @Column({ nullable: true })
  taxIdentificationNumber?: string;

  //Membership
  @Column({ nullable: true })
  clubs?: string;

  @Column({ nullable: true })
  alumniGroups?: string;

  @Column({ nullable: true })
  professionalAssociations?: string;

  @Column({ nullable: true })
  nonprofits?: string;

  @Column({ nullable: true })
  loyaltyPrograms?: string;

  @Column({ nullable: true })
  volunteerActivities?: string;

  // Timestamps
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
