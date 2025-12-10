import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsArray,
  IsEmail,
  IsObject,
} from 'class-validator';

export class CreateB2CDto {
  // ------------------------
  // PERSONAL
  // ------------------------
  @IsNotEmpty()
  @IsString()
  fullName: string;

  @IsOptional()
  @IsString()
  nickname?: string;

  @IsNotEmpty()
  @IsString()
  nationality: string;

  @IsOptional()
  @IsString()
  dob?: string;

  @IsNotEmpty()
  @IsString()
  gender: string;

  // ------------------------
  // CONTACT
  // ------------------------
  @IsOptional()
  @IsEmail()
  primaryEmail?: string;

  @IsOptional()
  @IsEmail()
  secondaryEmail?: string;

  @IsOptional()
  @IsString()
  primaryPhone?: string;

  @IsOptional()
  @IsString()
  secondaryPhone?: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsString()
  telegram?: string;

  @IsOptional()
  @IsString()
  wechat?: string;

  @IsOptional()
  @IsString()
  prefferedContactMethod?: string;

  // ------------------------
  // LOCATION
  // ------------------------
  @IsNotEmpty()
  @IsString()
  country: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  subCity?: string;

  @IsOptional()
  @IsString()
  cityCorporation?: string;

  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  timeZone?: string;

  // ------------------------
  // PROFESSIONAL
  // ------------------------
  @IsOptional()
  @IsString()
  currentJobTitle?: string;

  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsString()
  workType?: string;

  @IsOptional()
  @IsString()
  workModel?: string;

  @IsNotEmpty()
  @IsString()
  primaryIndustry: string;

  @IsNotEmpty()
  @IsString()
  industrySubsector: string;

  @IsOptional()
  @IsString()
  coreResponsibilities?: string;

  @IsOptional()
  @IsString()
  keyTools?: string;

  // ------------------------
  // SKILLS
  // ------------------------
  @IsNotEmpty()
  @IsString()
  primarySkills: string;

  @IsOptional()
  @IsString()
  secondarySkills?: string;

  @IsOptional()
  @IsString()
  technicalTools?: string;

  @IsOptional()
  @IsString()
  topSoftSkills?: string;

  @IsOptional()
  @IsString()
  professionalCertifications?: string;

  @IsOptional()
  @IsString()
  licenses?: string;

  @IsOptional()
  @IsString()
  credentials?: string;

  // ------------------------
  // CAREER
  // ------------------------
  @IsNotEmpty()
  @IsString()
  totalExperience: string;

  @IsOptional()
  @IsString()
  careerHighlight?: string;

  // ------------------------
  // EDUCATION
  // ------------------------
  @IsNotEmpty()
  @IsString()
  highestDegree: string;

  @IsOptional()
  @IsString()
  degreesEarned?: string;

  @IsOptional()
  @IsString()
  institutions?: string;

  @IsOptional()
  @IsString()
  fieldsOfStudy?: string;

  @IsOptional()
  @IsString()
  graduationDates?: string;

  @IsOptional()
  @IsString()
  gpa?: string;

  @IsOptional()
  @IsString()
  academicHonors?: string;

  @IsOptional()
  @IsString()
  publications?: string;

  @IsOptional()
  @IsString()
  researchAreas?: string;

  @IsOptional()
  @IsString()
  thesisTitle?: string;

  @IsOptional()
  @IsString()
  academicIds?: string;

  // ------------------------
  // WEB PRESENCE
  // ------------------------
  @IsOptional()
  @IsString()
  personalWebsite?: string;

  @IsOptional()
  @IsString()
  portfolio?: string;

  @IsOptional()
  @IsString()
  blog?: string;

  @IsOptional()
  @IsString()
  onlineResume?: string;

  // Arrays
  @IsOptional()
  @IsArray()
  others?: string[];

  @IsArray()
  interests: string[];

  @IsOptional()
  @IsString()
  lifestylePreferences?: string;

  // ------------------------
  // SOCIAL / CIVIC
  // ------------------------
  @IsOptional()
  @IsArray()
  civicActivities?: any[];

  @IsOptional()
  @IsString()
  civicEngagement?: string;

  @IsOptional()
  @IsString()
  policyInterests?: string;

  // ------------------------
  // FAMILY
  // ------------------------
  @IsNotEmpty()
  @IsString()
  maritalStatus: string;

  @IsOptional()
  @IsString()
  partnerSpouse?: string;

  @IsOptional()
  @IsString()
  childrenDependents?: string;

  @IsOptional()
  @IsString()
  householdSize?: string;

  @IsNotEmpty()
  @IsString()
  householdIncome: string;

  @IsOptional()
  @IsString()
  familyMedicalHistory?: string;

  @IsOptional()
  @IsString()
  guardianshipStatus?: string;

  // ------------------------
  // HEALTH
  // ------------------------
  @IsOptional()
  @IsString()
  heightWeightBMI?: string;

  @IsOptional()
  @IsString()
  allergies?: string;

  @IsOptional()
  @IsString()
  chronicIllnesses?: string;

  @IsOptional()
  @IsString()
  disabilities?: string;

  @IsOptional()
  @IsString()
  diagnoses?: string;

  @IsOptional()
  @IsString()
  medications?: string;

  @IsOptional()
  @IsString()
  surgeries?: string;

  @IsOptional()
  @IsString()
  vaccinationRecords?: string;

  @IsOptional()
  @IsString()
  medicalDevices?: string;

  @IsOptional()
  @IsString()
  healthInsurance?: string;

  // ------------------------
  // FINANCIAL
  // ------------------------
  @IsOptional()
  @IsObject()
  salary?: { salaryCurrency: string; salaryAmount: string };

  @IsOptional()
  @IsObject()
  totalIncome?: { totalCurrency: string; totalAmount: string };

  @IsOptional()
  @IsString()
  incomeHistory?: string;

  @IsOptional()
  @IsString()
  savings?: string;

  @IsOptional()
  @IsString()
  investments?: string;

  @IsOptional()
  @IsString()
  cryptocurrency?: string;

  @IsOptional()
  @IsString()
  loans?: string;

  @IsOptional()
  @IsString()
  debts?: string;

  @IsOptional()
  @IsString()
  bankAccounts?: string;

  @IsOptional()
  @IsString()
  creditScore?: string;

  @IsOptional()
  @IsString()
  transactionHistory?: string;

  @IsOptional()
  @IsString()
  insurancePolicies?: string;

  @IsOptional()
  @IsString()
  assets?: string;

  // ------------------------
  // LEGAL
  // ------------------------
  @IsOptional()
  @IsString()
  nationalId?: string;

  @IsOptional()
  @IsString()
  passport?: string;

  @IsOptional()
  @IsString()
  driversLicense?: string;

  @IsOptional()
  @IsString()
  visaWorkPermit?: string;

  @IsOptional()
  @IsString()
  criminalBackground?: string;

  @IsOptional()
  @IsString()
  courtRecords?: string;

  @IsOptional()
  @IsString()
  contractsSigned?: string;

  @IsOptional()
  @IsString()
  consentRecords?: string;

  @IsOptional()
  @IsString()
  taxIdentificationNumber?: string;

  // ------------------------
  // MEMBERSHIPS
  // ------------------------
  @IsOptional()
  @IsString()
  clubs?: string;

  @IsOptional()
  @IsString()
  alumniGroups?: string;

  @IsOptional()
  @IsString()
  professionalAssociations?: string;

  @IsOptional()
  @IsString()
  nonprofits?: string;

  @IsOptional()
  @IsString()
  loyaltyPrograms?: string;

  @IsOptional()
  @IsString()
  volunteerActivities?: string;

  //images
  @IsOptional() @IsString() companyLogoUrl?: string;
}
