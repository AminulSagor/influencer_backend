import {
  IsArray,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
  ArrayMaxSize,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

const phoneRegex = /^\+?[0-9\s\-().]{7,20}$/;
const urlRegex = /^(https?:\/\/|www\.)/;

class KeyContactDto {
  @IsOptional()
  @IsString()
  keyContactName?: string;

  @IsOptional()
  @IsString()
  keyContactPosition?: string;

  @IsOptional()
  @IsString()
  keyContactDepartment?: string;

  @IsOptional()
  @Matches(phoneRegex, { message: 'Enter a valid phone number' })
  keyContactPhone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Enter a valid email address' })
  keyContactEmail?: string;

  @IsOptional()
  @Matches(/^http/, { message: 'LinkedIn URL must start with http/https' })
  keyContactLinkedIn?: string;
}

export class CreateB2BDto {
  // required
  @IsNotEmpty()
  @IsString()
  @MinLength(2, { message: 'Business name is required' })
  name: string;

  @IsNotEmpty()
  @IsString()
  businessType: string;

  @IsOptional()
  @IsString()
  businessDescription?: string;

  // ... other optional fields
  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsString()
  establishedDate?: string;

  @IsNotEmpty()
  @IsString()
  status: string;

  @IsNotEmpty()
  @IsString()
  primaryIndustry: string;

  @IsNotEmpty()
  @IsString()
  niche: string;

  @IsNotEmpty()
  @IsString()
  subNiche: string;

  @IsNotEmpty()
  @IsString()
  serviceName: string;

  @IsNotEmpty()
  @IsString()
  category: string;

  @IsOptional()
  @IsString()
  subCategory?: string;

  @IsOptional()
  @IsString()
  serviceDescription?: string;

  @IsIn(['Hourly', 'Fixed', 'Tiered', 'Subscription'])
  pricingModel: 'Hourly' | 'Fixed' | 'Tiered' | 'Subscription';

  @IsNotEmpty()
  @IsString()
  rate: string;

  @IsNotEmpty()
  @IsString()
  currency: string;

  @IsIn(['Online', 'On-Site', 'Hybrid'])
  serviceAvailability: 'Online' | 'On-Site' | 'Hybrid';

  @IsIn(['Yes', 'No'])
  onlineService: 'Yes' | 'No';

  // location
  @IsOptional() @IsString() street?: string;
  @IsOptional() @IsString() subCity?: string;
  @IsNotEmpty() @IsString() city: string;
  @IsNotEmpty() @IsString() state: string;
  @IsOptional() @IsString() postalCode?: string;
  @IsNotEmpty() @IsString() country: string;

  // contact info
  @IsOptional()
  @Matches(phoneRegex, { message: 'Enter a valid phone number' })
  businessPhone?: string;

  @IsOptional()
  @Matches(phoneRegex, { message: 'Enter a valid phone number' })
  secondaryPhone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Enter a valid email' })
  email?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Enter a valid support email' })
  supportEmail?: string;

  @IsOptional()
  @Matches(urlRegex, {
    message:
      'Enter a valid website (include http:// or https:// or start with www.)',
  })
  website?: string;

  // key contacts — max 5
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5, { message: 'Maximum 5 key contacts allowed' })
  @ValidateNested({ each: true })
  @Type(() => KeyContactDto)
  keyContacts?: KeyContactDto[];

  // online presence ... optional strings and url checks
  @IsOptional() @Matches(/^http/, { each: false }) opFacebook?: string;
  @IsOptional() @Matches(/^http/, { each: false }) opInstagram?: string;
  @IsOptional() @Matches(/^http/, { each: false }) opLinkedin?: string;
  @IsOptional() @Matches(/^http/, { each: false }) opTwitter?: string;
  @IsOptional() @Matches(/^http/, { each: false }) opYoutube?: string;
  @IsOptional() @Matches(/^http/, { each: false }) opTiktok?: string;
  @IsOptional() @Matches(/^http/, { each: false }) opGoogleBusiness?: string;
  @IsOptional() @IsString() opDirectoryListings?: string;

  // operations, financials, legal, marketing — optional strings
  @IsOptional() @IsString() operationsOpeningHours?: string;
  @IsOptional() @IsString() operationsTimeZone?: string;
  @IsOptional() @IsString() operationsEmployees?: string;
  @IsOptional() @IsString() operationsTools?: string;
  @IsOptional() @IsString() operationsCertifications?: string;

  @IsOptional() @IsString() fnPaymentMethods?: string;
  @IsOptional() @IsString() fnBillingAddress?: string;
  @IsOptional() @IsString() fnInvoiceContact?: string;
  @IsOptional() @IsString() fnPrimaryCurrency?: string;
  @IsOptional() @IsString() fnPaymentTerms?: string;

  @IsOptional() @IsString() legalLicenses?: string;
  @IsOptional() @IsString() legalPermits?: string;
  @IsOptional() @IsString() legalInsurance?: string;
  @IsOptional() @IsString() legalComplianceCertificates?: string;

  @IsOptional() @IsString() marketingTargetAudience?: string;
  @IsOptional() @IsString() marketingValueProposition?: string;
  @IsOptional() @IsString() marketingMainCompetitors?: string;
  @IsOptional() @IsString() marketingKeywords?: string;

  // meta
  // tags: frontend will send tag array; server ensures maximum 10 tags
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10, { message: 'Max 10 tags allowed' })
  @IsString({ each: true })
  metaTags?: string[];

  @IsOptional() @IsString() metaNotes?: string;
  @IsOptional() @IsString() metaDateAdded?: string;
  @IsOptional() @IsString() metaLastUpdated?: string;
}
