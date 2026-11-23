import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  ChangeRequestStatus,
  ChangeRiskLevel,
  ComplianceStatus,
  IncidentSeverity,
  IncidentStatus,
  PolicyStatus,
  PrivacyRequestStatus,
  PrivacyRequestType,
  RiskImpact,
  RiskLikelihood,
  RiskStatus,
} from '@prisma/client';

// ===================== LEGAL & COMPLIANCE =====================

export class CreateLegalObligationDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  regulation!: string;

  @IsString()
  @IsOptional()
  jurisdiction?: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsEnum(ComplianceStatus)
  @IsOptional()
  complianceStatus?: ComplianceStatus;

  @IsString()
  @IsNotEmpty()
  responsiblePerson!: string;

  @IsInt()
  @Min(1)
  @Max(60)
  @IsOptional()
  reviewCycleMonths?: number;

  @IsString()
  @IsNotEmpty()
  nextReviewAt!: string; // ISO string

  @IsString()
  @IsOptional()
  evidenceNotes?: string;
}

export class UpdateLegalObligationDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  regulation?: string;

  @IsString()
  @IsOptional()
  jurisdiction?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(ComplianceStatus)
  @IsOptional()
  complianceStatus?: ComplianceStatus;

  @IsString()
  @IsOptional()
  responsiblePerson?: string;

  @IsInt()
  @Min(1)
  @Max(60)
  @IsOptional()
  reviewCycleMonths?: number;

  @IsString()
  @IsOptional()
  nextReviewAt?: string;

  @IsString()
  @IsOptional()
  evidenceNotes?: string;
}

// ===================== SECURITY POLICIES =====================

export class CreateSecurityPolicyDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  code!: string; // e.g. "POL-AUP-001"

  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsString()
  @IsNotEmpty()
  summary!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsString()
  @IsNotEmpty()
  nextReviewDate!: string;

  @IsEnum(PolicyStatus)
  @IsOptional()
  status?: PolicyStatus;
}

export class UpdateSecurityPolicyDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  summary?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  nextReviewDate?: string;

  @IsEnum(PolicyStatus)
  @IsOptional()
  status?: PolicyStatus;
}

export class PublishPolicyVersionDto {
  @IsString()
  @IsNotEmpty()
  versionNumber!: string; // e.g. "1.1.0"

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsString()
  @IsNotEmpty()
  changeSummary!: string;
}

// ===================== PRIVACY & DATA PROTECTION =====================

export class CreatePrivacyRequestDto {
  @IsEnum(PrivacyRequestType)
  requestType!: PrivacyRequestType;

  @IsString()
  @IsOptional()
  details?: string;
}

export class ResolvePrivacyRequestDto {
  @IsEnum(PrivacyRequestStatus)
  status!: PrivacyRequestStatus;

  @IsString()
  @IsOptional()
  rejectionReason?: string;

  @IsString()
  @IsOptional()
  exportFileUrl?: string;
}

export class CreateConsentRecordDto {
  @IsString()
  @IsNotEmpty()
  consentType!: string;

  @IsBoolean()
  isGranted!: boolean;

  @IsString()
  @IsOptional()
  policyVersion?: string;
}

export class CreateDataBreachDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsOptional()
  incidentRef?: string;

  @IsEnum(IncidentSeverity)
  @IsOptional()
  severity?: IncidentSeverity;

  @IsArray()
  @IsString({ each: true })
  dataCategories!: string[];

  @IsInt()
  @Min(0)
  @IsOptional()
  estimatedUsersHit?: number;

  @IsString()
  @IsNotEmpty()
  detectedAt!: string;

  @IsString()
  @IsOptional()
  containedAt?: string;

  @IsBoolean()
  @IsOptional()
  authorityNotified?: boolean;

  @IsString()
  @IsOptional()
  authorityNotifiedAt?: string;

  @IsBoolean()
  @IsOptional()
  usersNotified?: boolean;

  @IsString()
  @IsNotEmpty()
  remediationSummary!: string;
}

// ===================== SECURITY REVIEWS & AUDITS =====================

export class CreateSecurityReviewDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  reviewType!: string;

  @IsString()
  @IsNotEmpty()
  scope!: string;

  @IsString()
  @IsNotEmpty()
  leadAuditor!: string;

  @IsString()
  @IsNotEmpty()
  scheduledDate!: string;

  @IsString()
  @IsOptional()
  summaryFindings?: string;
}

export class UpdateSecurityReviewDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  scope?: string;

  @IsString()
  @IsOptional()
  leadAuditor?: string;

  @IsString()
  @IsOptional()
  scheduledDate?: string;

  @IsString()
  @IsOptional()
  completedDate?: string;

  @IsString()
  @IsOptional()
  summaryFindings?: string;
}

export class CreateSecurityFindingDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsOptional()
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsString()
  @IsNotEmpty()
  remediationPlan!: string;

  @IsUUID()
  assignedToId!: string;

  @IsString()
  @IsNotEmpty()
  deadline!: string;
}

export class UpdateSecurityFindingDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  remediationPlan?: string;

  @IsUUID()
  @IsOptional()
  assignedToId?: string;

  @IsString()
  @IsOptional()
  deadline?: string;

  @IsString()
  @IsOptional()
  status?: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED';

  @IsString()
  @IsOptional()
  resolvedAt?: string;
}

// ===================== RISK REGISTER =====================

export class CreateRiskDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsEnum(RiskLikelihood)
  likelihood!: RiskLikelihood;

  @IsEnum(RiskImpact)
  impact!: RiskImpact;

  @IsEnum(RiskStatus)
  @IsOptional()
  status?: RiskStatus;

  @IsString()
  @IsNotEmpty()
  mitigationPlan!: string;

  @IsUUID()
  ownerId!: string;

  @IsString()
  @IsNotEmpty()
  targetDate!: string;

  @IsInt()
  @IsOptional()
  residualScore?: number;
}

export class UpdateRiskDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(RiskLikelihood)
  @IsOptional()
  likelihood?: RiskLikelihood;

  @IsEnum(RiskImpact)
  @IsOptional()
  impact?: RiskImpact;

  @IsEnum(RiskStatus)
  @IsOptional()
  status?: RiskStatus;

  @IsString()
  @IsOptional()
  mitigationPlan?: string;

  @IsUUID()
  @IsOptional()
  ownerId?: string;

  @IsString()
  @IsOptional()
  targetDate?: string;

  @IsInt()
  @IsOptional()
  residualScore?: number;
}

// ===================== INCIDENT MANAGEMENT =====================

export class CreateIncidentDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsEnum(IncidentSeverity)
  @IsOptional()
  severity?: IncidentSeverity;

  @IsEnum(IncidentStatus)
  @IsOptional()
  status?: IncidentStatus;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsString()
  @IsOptional()
  containment?: string;

  @IsString()
  @IsOptional()
  rootCause?: string;

  @IsUUID()
  @IsOptional()
  leadInvestigatorId?: string;
}

export class UpdateIncidentDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsEnum(IncidentSeverity)
  @IsOptional()
  severity?: IncidentSeverity;

  @IsEnum(IncidentStatus)
  @IsOptional()
  status?: IncidentStatus;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  containment?: string;

  @IsString()
  @IsOptional()
  rootCause?: string;

  @IsUUID()
  @IsOptional()
  leadInvestigatorId?: string;

  @IsString()
  @IsOptional()
  resolvedAt?: string;
}

// ===================== CHANGE MANAGEMENT =====================

export class CreateChangeRequestDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsEnum(ChangeRiskLevel)
  riskLevel!: ChangeRiskLevel;

  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsString()
  @IsNotEmpty()
  planDetails!: string;

  @IsString()
  @IsNotEmpty()
  rollbackPlan!: string;
}

export class ReviewChangeRequestDto {
  @IsEnum(ChangeRequestStatus)
  status!: ChangeRequestStatus; // APPROVED or REJECTED

  @IsString()
  @IsOptional()
  rejectionReason?: string;
}

export class ImplementChangeRequestDto {
  @IsEnum(ChangeRequestStatus)
  status!: ChangeRequestStatus; // IMPLEMENTED or ROLLED_BACK
}

// ===================== USER BLOCKING =====================

export class BlockUserDto {
  @IsUUID()
  targetUserId!: string;

  @IsString()
  @IsOptional()
  reason?: string;
}
