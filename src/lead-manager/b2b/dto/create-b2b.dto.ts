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
import { Transform, Type } from 'class-transformer';
import { EmptyToNull } from 'src/common/decorators/empty-to-null.decorator';

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
  @EmptyToNull()
  @Matches(phoneRegex, { message: 'Enter a valid phone number' })
  keyContactPhone?: string | null;

  @IsOptional()
  @EmptyToNull()
  @IsEmail({}, { message: 'Invalid support email format' })
  keyContactEmail?: string | null;

  @IsOptional()
  @EmptyToNull()
  @Matches(/^http/, { message: 'LinkedIn URL must start with http/https' })
  keyContactLinkedIn?: string | null;
}

class ServiceOverviewDto {
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

  @IsNotEmpty()
  @IsString()
  pricingModel: string;

  @IsNotEmpty()
  @IsString()
  rate: string;

  @IsNotEmpty()
  @IsString()
  currency: string;

  @IsNotEmpty()
  @IsString()
  serviceAvailability: string;

  @IsNotEmpty()
  @IsString()
  onlineService: string;
}

export class CreateB2BDto {
  @IsOptional()
  @IsString()
  businessId?: string;

  // required
  @IsNotEmpty()
  @IsString()
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

  @IsOptional()
  @IsString()
  subNiche?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMaxSize(10, { message: 'Max 10 services allowed' })
  @Type(() => ServiceOverviewDto)
  serviceOverview: ServiceOverviewDto[];

  // location
  @IsOptional() @IsString() street?: string;
  @IsOptional() @IsString() subCity?: string;
  @IsNotEmpty() @IsString() city: string;
  @IsNotEmpty() @IsString() state: string;
  @IsOptional() @IsString() postalCode?: string;
  @IsNotEmpty() @IsString() country: string;

  // contact info
  @IsOptional()
  @EmptyToNull()
  @Matches(phoneRegex, { message: 'Enter a valid phone number' })
  businessPhone?: string;

  @IsOptional()
  @EmptyToNull()
  @Matches(phoneRegex, { message: 'Enter a valid phone number' })
  secondaryPhone?: string;

  @IsOptional()
  @EmptyToNull()
  @IsEmail({}, { message: 'Invalid support email format' })
  email?: string | null;

  @IsOptional()
  @EmptyToNull()
  @IsEmail({}, { message: 'Invalid support email format' })
  supportEmail?: string | null;

  @IsOptional()
  @EmptyToNull()
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
  @IsOptional()
  @EmptyToNull()
  @Matches(/^http/, { each: false })
  opFacebook?: string | null;
  @IsOptional()
  @EmptyToNull()
  @Matches(/^http/, { each: false })
  opInstagram?: string | null;
  @IsOptional()
  @EmptyToNull()
  @Matches(/^http/, { each: false })
  opLinkedin?: string | null;
  @IsOptional()
  @EmptyToNull()
  @Matches(/^http/, { each: false })
  opTwitter?: string | null;
  @IsOptional()
  @EmptyToNull()
  @Matches(/^http/, { each: false })
  opYoutube?: string | null;
  @IsOptional()
  @EmptyToNull()
  @Matches(/^http/, { each: false })
  opTiktok?: string | null;
  @IsOptional()
  @EmptyToNull()
  @Matches(/^http/, { each: false })
  opGoogleBusiness?: string | null;
  // @IsOptional() @IsString() opFacebook?: string;
  // @IsOptional() @IsString() opInstagram?: string;
  // @IsOptional() @IsString() opLinkedin?: string;
  // @IsOptional() @IsString() opTwitter?: string;
  // @IsOptional() @IsString() opYoutube?: string;
  // @IsOptional() @IsString() opTiktok?: string;
  // @IsOptional() @IsString() opGoogleBusiness?: string;
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
  @Transform(({ value }) => {
    if (!value) return []; // empty → return empty array
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);
    }
    return [];
  })
  @IsArray()
  // @MaxLength(10, { each: false, message: 'Max 10 tags allowed' })
  metaTags?: string[];

  @IsOptional() @IsString() metaNotes?: string;
  @IsOptional() @IsString() metaDateAdded?: string;
  @IsOptional() @IsString() metaLastUpdated?: string;
  @IsOptional() @IsString() companyLogoUrl?: string;
}
