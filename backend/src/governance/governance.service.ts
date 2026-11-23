import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditCategory,
  AuditSeverity,
  ChangeRequestStatus,
  IncidentStatus,
  PolicyStatus,
  PrivacyRequestStatus,
  PrivacyRequestType,
  RiskImpact,
  RiskLikelihood,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  BlockUserDto,
  CreateChangeRequestDto,
  CreateConsentRecordDto,
  CreateDataBreachDto,
  CreateIncidentDto,
  CreateLegalObligationDto,
  CreatePrivacyRequestDto,
  CreateRiskDto,
  CreateSecurityFindingDto,
  CreateSecurityPolicyDto,
  CreateSecurityReviewDto,
  ImplementChangeRequestDto,
  PublishPolicyVersionDto,
  ResolvePrivacyRequestDto,
  ReviewChangeRequestDto,
  UpdateIncidentDto,
  UpdateLegalObligationDto,
  UpdateRiskDto,
  UpdateSecurityFindingDto,
  UpdateSecurityPolicyDto,
  UpdateSecurityReviewDto,
} from './dto/governance.dto';

const LIKELIHOOD_SCORE: Record<RiskLikelihood, number> = {
  VERY_LOW: 1,
  LOW: 2,
  MEDIUM: 3,
  HIGH: 4,
  VERY_HIGH: 5,
};

const IMPACT_SCORE: Record<RiskImpact, number> = {
  INSIGNIFICANT: 1,
  MINOR: 2,
  MODERATE: 3,
  MAJOR: 4,
  CRITICAL: 5,
};

@Injectable()
export class GovernanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ===================== DASHBOARD SUMMARY =====================

  async getSummary() {
    const now = new Date();
    const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const [
      outstandingRisks,
      unresolvedIncidents,
      pendingPrivacyRequests,
      upcomingReviews,
      overdueTasks,
      policiesReviewDue,
      pendingChanges,
      highSeverityRisks,
      breachesCount,
    ] = await Promise.all([
      this.prisma.riskRegister.count({
        where: { status: { in: ['IDENTIFIED', 'ASSESSING', 'MITIGATING'] } },
      }),
      this.prisma.securityIncident.count({
        where: { status: { in: ['REPORTED', 'INVESTIGATING', 'CONTAINED'] } },
      }),
      this.prisma.privacyRequest.count({
        where: { status: 'PENDING' },
      }),
      this.prisma.securityReview.count({
        where: { scheduledDate: { gte: now }, status: 'PENDING' },
      }),
      this.prisma.securityFinding.count({
        where: { deadline: { lt: now }, status: { not: 'RESOLVED' } },
      }),
      this.prisma.securityPolicy.count({
        where: { nextReviewDate: { lte: in30Days }, status: 'PUBLISHED' },
      }),
      this.prisma.changeRequest.count({
        where: { status: 'SUBMITTED' },
      }),
      this.prisma.riskRegister.count({
        where: {
          riskScore: { gte: 15 },
          status: { in: ['IDENTIFIED', 'ASSESSING', 'MITIGATING'] },
        },
      }),
      this.prisma.dataBreachRecord.count(),
    ]);

    return {
      outstandingRisks,
      highSeverityRisks,
      unresolvedIncidents,
      pendingPrivacyRequests,
      upcomingReviews,
      overdueTasks,
      policiesReviewDue,
      pendingChanges,
      breachesCount,
      timestamp: now.toISOString(),
    };
  }

  // ===================== LEGAL & COMPLIANCE =====================

  async listLegalObligations() {
    return this.prisma.legalObligation.findMany({
      orderBy: [{ nextReviewAt: 'asc' }, { title: 'asc' }],
      include: {
        createdBy: {
          select: { id: true, email: true, profile: { select: { username: true, fullName: true } } },
        },
      },
    });
  }

  async createLegalObligation(adminId: string, dto: CreateLegalObligationDto) {
    const record = await this.prisma.legalObligation.create({
      data: {
        title: dto.title,
        regulation: dto.regulation,
        jurisdiction: dto.jurisdiction || 'Ethiopia',
        description: dto.description,
        complianceStatus: dto.complianceStatus || 'UNDER_REVIEW',
        responsiblePerson: dto.responsiblePerson,
        reviewCycleMonths: dto.reviewCycleMonths ?? 12,
        nextReviewAt: new Date(dto.nextReviewAt),
        evidenceNotes: dto.evidenceNotes,
        createdById: adminId,
      },
    });

    await this.audit.log({
      category: AuditCategory.ADMIN_ACTION,
      action: 'LEGAL_OBLIGATION_CREATED',
      severity: AuditSeverity.MEDIUM,
      userId: adminId,
      resource: `LegalObligation:${record.id}`,
      payload: { title: record.title, regulation: record.regulation },
    });

    return record;
  }

  async updateLegalObligation(adminId: string, id: string, dto: UpdateLegalObligationDto) {
    const existing = await this.prisma.legalObligation.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Legal obligation not found');

    const updated = await this.prisma.legalObligation.update({
      where: { id },
      data: {
        title: dto.title,
        regulation: dto.regulation,
        jurisdiction: dto.jurisdiction,
        description: dto.description,
        complianceStatus: dto.complianceStatus,
        responsiblePerson: dto.responsiblePerson,
        reviewCycleMonths: dto.reviewCycleMonths,
        nextReviewAt: dto.nextReviewAt ? new Date(dto.nextReviewAt) : undefined,
        evidenceNotes: dto.evidenceNotes,
        lastReviewedAt: new Date(),
      },
    });

    await this.audit.log({
      category: AuditCategory.ADMIN_ACTION,
      action: 'LEGAL_OBLIGATION_UPDATED',
      severity: AuditSeverity.INFO,
      userId: adminId,
      resource: `LegalObligation:${id}`,
      payload: { previousStatus: existing.complianceStatus, newStatus: updated.complianceStatus },
    });

    return updated;
  }

  async deleteLegalObligation(adminId: string, id: string) {
    const existing = await this.prisma.legalObligation.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Legal obligation not found');

    await this.prisma.legalObligation.delete({ where: { id } });

    await this.audit.log({
      category: AuditCategory.SENSITIVE_RESOURCE,
      action: 'LEGAL_OBLIGATION_DELETED',
      severity: AuditSeverity.HIGH,
      userId: adminId,
      resource: `LegalObligation:${id}`,
      payload: { title: existing.title },
    });

    return { success: true };
  }

  // ===================== SECURITY POLICIES =====================

  async listPolicies(includeDrafts = true) {
    return this.prisma.securityPolicy.findMany({
      where: includeDrafts ? undefined : { status: 'PUBLISHED' },
      orderBy: [{ code: 'asc' }],
      include: {
        author: {
          select: { id: true, email: true, profile: { select: { username: true, fullName: true } } },
        },
        versions: {
          orderBy: { publishedAt: 'desc' },
          take: 5,
        },
      },
    });
  }

  async getActivePolicies() {
    return this.prisma.securityPolicy.findMany({
      where: { status: 'PUBLISHED' },
      select: {
        id: true,
        code: true,
        title: true,
        category: true,
        currentVersion: true,
        summary: true,
        content: true,
        publishedAt: true,
      },
    });
  }

  async createPolicy(adminId: string, dto: CreateSecurityPolicyDto) {
    const existing = await this.prisma.securityPolicy.findUnique({ where: { code: dto.code } });
    if (existing) throw new BadRequestException(`Policy code ${dto.code} already exists`);

    const policy = await this.prisma.securityPolicy.create({
      data: {
        title: dto.title,
        code: dto.code,
        category: dto.category,
        summary: dto.summary,
        content: dto.content,
        status: dto.status || 'DRAFT',
        currentVersion: '1.0.0',
        publishedAt: dto.status === 'PUBLISHED' ? new Date() : null,
        nextReviewDate: new Date(dto.nextReviewDate),
        authorId: adminId,
      },
    });

    // Create initial version 1.0.0
    await this.prisma.policyVersion.create({
      data: {
        policyId: policy.id,
        versionNumber: '1.0.0',
        content: dto.content,
        changeSummary: 'Initial policy draft/creation',
        approvedById: adminId,
      },
    });

    await this.audit.log({
      category: AuditCategory.ADMIN_ACTION,
      action: 'SECURITY_POLICY_CREATED',
      severity: AuditSeverity.MEDIUM,
      userId: adminId,
      resource: `SecurityPolicy:${policy.id}`,
      payload: { code: policy.code, title: policy.title },
    });

    return policy;
  }

  async updatePolicy(adminId: string, id: string, dto: UpdateSecurityPolicyDto) {
    const policy = await this.prisma.securityPolicy.findUnique({ where: { id } });
    if (!policy) throw new NotFoundException('Policy not found');

    const updated = await this.prisma.securityPolicy.update({
      where: { id },
      data: {
        title: dto.title,
        category: dto.category,
        summary: dto.summary,
        content: dto.content,
        nextReviewDate: dto.nextReviewDate ? new Date(dto.nextReviewDate) : undefined,
        status: dto.status,
        publishedAt: dto.status === 'PUBLISHED' && !policy.publishedAt ? new Date() : undefined,
      },
    });

    await this.audit.log({
      category: AuditCategory.ADMIN_ACTION,
      action: 'SECURITY_POLICY_UPDATED',
      severity: AuditSeverity.INFO,
      userId: adminId,
      resource: `SecurityPolicy:${id}`,
      payload: { title: updated.title, status: updated.status },
    });

    return updated;
  }

  async publishPolicyVersion(adminId: string, policyId: string, dto: PublishPolicyVersionDto) {
    const policy = await this.prisma.securityPolicy.findUnique({ where: { id: policyId } });
    if (!policy) throw new NotFoundException('Policy not found');

    const [version] = await this.prisma.$transaction([
      this.prisma.policyVersion.create({
        data: {
          policyId,
          versionNumber: dto.versionNumber,
          content: dto.content,
          changeSummary: dto.changeSummary,
          approvedById: adminId,
          publishedAt: new Date(),
        },
      }),
      this.prisma.securityPolicy.update({
        where: { id: policyId },
        data: {
          content: dto.content,
          currentVersion: dto.versionNumber,
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      }),
    ]);

    await this.audit.log({
      category: AuditCategory.ADMIN_ACTION,
      action: 'POLICY_VERSION_PUBLISHED',
      severity: AuditSeverity.MEDIUM,
      userId: adminId,
      resource: `SecurityPolicy:${policyId}`,
      payload: { version: dto.versionNumber, changeSummary: dto.changeSummary },
    });

    return version;
  }

  // ===================== PRIVACY & DATA PROTECTION =====================

  async listPrivacyRequests(status?: PrivacyRequestStatus) {
    return this.prisma.privacyRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: { select: { username: true, fullName: true } },
          },
        },
        resolvedBy: {
          select: { id: true, email: true, profile: { select: { username: true, fullName: true } } },
        },
      },
    });
  }

  async createUserPrivacyRequest(userId: string, dto: CreatePrivacyRequestDto) {
    const pending = await this.prisma.privacyRequest.findFirst({
      where: { userId, requestType: dto.requestType, status: 'PENDING' },
    });
    if (pending) {
      throw new BadRequestException('You already have a pending request of this type under review.');
    }

    const req = await this.prisma.privacyRequest.create({
      data: {
        userId,
        requestType: dto.requestType,
        details: dto.details,
      },
    });

    await this.audit.log({
      category: AuditCategory.USER_ACTIVITY,
      action: 'PRIVACY_REQUEST_SUBMITTED',
      severity: AuditSeverity.INFO,
      userId,
      resource: `PrivacyRequest:${req.id}`,
      payload: { requestType: req.requestType },
    });

    return req;
  }

  async getUserPrivacyRequests(userId: string) {
    return this.prisma.privacyRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async resolvePrivacyRequest(adminId: string, requestId: string, dto: ResolvePrivacyRequestDto) {
    const existing = await this.prisma.privacyRequest.findUnique({
      where: { id: requestId },
      include: { user: { include: { profile: true } } },
    });
    if (!existing) throw new NotFoundException('Privacy request not found');

    let exportUrl = dto.exportFileUrl;

    // Automated personal data export package if data access export is completed
    if (dto.status === 'COMPLETED' && existing.requestType === 'DATA_ACCESS_EXPORT' && !exportUrl) {
      exportUrl = `/api/me/privacy/export-data`;
    }

    const updated = await this.prisma.privacyRequest.update({
      where: { id: requestId },
      data: {
        status: dto.status,
        rejectionReason: dto.rejectionReason,
        exportFileUrl: exportUrl,
        resolvedById: adminId,
        resolvedAt: new Date(),
      },
    });

    await this.audit.log({
      category: AuditCategory.ADMIN_ACTION,
      action: 'PRIVACY_REQUEST_RESOLVED',
      severity: AuditSeverity.MEDIUM,
      userId: adminId,
      resource: `PrivacyRequest:${requestId}`,
      payload: {
        targetUserId: existing.userId,
        type: existing.requestType,
        outcome: dto.status,
      },
    });

    return updated;
  }

  async recordConsent(userId: string, dto: CreateConsentRecordDto, ipAddress?: string, userAgent?: string) {
    return this.prisma.consentRecord.create({
      data: {
        userId,
        consentType: dto.consentType,
        isGranted: dto.isGranted,
        policyVersion: dto.policyVersion,
        ipAddress,
        userAgent,
      },
    });
  }

  async getUserConsents(userId: string) {
    return this.prisma.consentRecord.findMany({
      where: { userId },
      orderBy: { grantedAt: 'desc' },
    });
  }

  async listDataBreaches() {
    return this.prisma.dataBreachRecord.findMany({
      orderBy: { detectedAt: 'desc' },
      include: {
        recordedBy: {
          select: { id: true, email: true, profile: { select: { username: true, fullName: true } } },
        },
      },
    });
  }

  async recordDataBreach(adminId: string, dto: CreateDataBreachDto) {
    const record = await this.prisma.dataBreachRecord.create({
      data: {
        title: dto.title,
        incidentRef: dto.incidentRef,
        severity: dto.severity || 'P2_HIGH',
        dataCategories: dto.dataCategories,
        estimatedUsersHit: dto.estimatedUsersHit ?? 0,
        detectedAt: new Date(dto.detectedAt),
        containedAt: dto.containedAt ? new Date(dto.containedAt) : null,
        authorityNotified: dto.authorityNotified ?? false,
        authorityNotifiedAt: dto.authorityNotifiedAt ? new Date(dto.authorityNotifiedAt) : null,
        usersNotified: dto.usersNotified ?? false,
        remediationSummary: dto.remediationSummary,
        recordedById: adminId,
      },
    });

    await this.audit.log({
      category: AuditCategory.SECURITY_ALERT,
      action: 'DATA_BREACH_LOGGED',
      severity: AuditSeverity.CRITICAL,
      userId: adminId,
      resource: `DataBreach:${record.id}`,
      payload: {
        title: record.title,
        categories: record.dataCategories,
        estimatedHit: record.estimatedUsersHit,
      },
    });

    return record;
  }

  // ===================== SECURITY REVIEWS & AUDITS =====================

  async listSecurityReviews() {
    return this.prisma.securityReview.findMany({
      orderBy: { scheduledDate: 'desc' },
      include: {
        findings: {
          include: {
            assignedTo: {
              select: { id: true, email: true, profile: { select: { username: true } } },
            },
          },
        },
      },
    });
  }

  async createSecurityReview(adminId: string, dto: CreateSecurityReviewDto) {
    const review = await this.prisma.securityReview.create({
      data: {
        title: dto.title,
        reviewType: dto.reviewType,
        scope: dto.scope,
        leadAuditor: dto.leadAuditor,
        scheduledDate: new Date(dto.scheduledDate),
        summaryFindings: dto.summaryFindings,
      },
    });

    await this.audit.log({
      category: AuditCategory.ADMIN_ACTION,
      action: 'SECURITY_REVIEW_SCHEDULED',
      severity: AuditSeverity.INFO,
      userId: adminId,
      resource: `SecurityReview:${review.id}`,
      payload: { title: review.title, reviewType: review.reviewType },
    });

    return review;
  }

  async updateSecurityReview(adminId: string, id: string, dto: UpdateSecurityReviewDto) {
    const updated = await this.prisma.securityReview.update({
      where: { id },
      data: {
        title: dto.title,
        scope: dto.scope,
        leadAuditor: dto.leadAuditor,
        scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : undefined,
        completedDate: dto.completedDate ? new Date(dto.completedDate) : undefined,
        summaryFindings: dto.summaryFindings,
        status: dto.completedDate ? 'RESOLVED' : undefined,
      },
    });

    await this.audit.log({
      category: AuditCategory.ADMIN_ACTION,
      action: 'SECURITY_REVIEW_UPDATED',
      severity: AuditSeverity.INFO,
      userId: adminId,
      resource: `SecurityReview:${id}`,
      payload: { status: updated.status },
    });

    return updated;
  }

  async addFindingToReview(adminId: string, reviewId: string, dto: CreateSecurityFindingDto) {
    const finding = await this.prisma.securityFinding.create({
      data: {
        reviewId,
        title: dto.title,
        severity: dto.severity || 'MEDIUM',
        description: dto.description,
        remediationPlan: dto.remediationPlan,
        assignedToId: dto.assignedToId,
        deadline: new Date(dto.deadline),
      },
    });

    await this.prisma.securityReview.update({
      where: { id: reviewId },
      data: { findingsCount: { increment: 1 } },
    });

    await this.audit.log({
      category: AuditCategory.ADMIN_ACTION,
      action: 'SECURITY_FINDING_RECORDED',
      severity: AuditSeverity.MEDIUM,
      userId: adminId,
      resource: `SecurityFinding:${finding.id}`,
      payload: { reviewId, title: finding.title, severity: finding.severity },
    });

    return finding;
  }

  async updateFinding(adminId: string, id: string, dto: UpdateSecurityFindingDto) {
    const updated = await this.prisma.securityFinding.update({
      where: { id },
      data: {
        title: dto.title,
        severity: dto.severity,
        description: dto.description,
        remediationPlan: dto.remediationPlan,
        assignedToId: dto.assignedToId,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        status: dto.status,
        resolvedAt: dto.status === 'RESOLVED' ? new Date() : undefined,
      },
    });

    await this.audit.log({
      category: AuditCategory.ADMIN_ACTION,
      action: 'SECURITY_FINDING_UPDATED',
      severity: AuditSeverity.INFO,
      userId: adminId,
      resource: `SecurityFinding:${id}`,
      payload: { status: updated.status },
    });

    return updated;
  }

  // ===================== RISK REGISTER =====================

  async listRisks() {
    return this.prisma.riskRegister.findMany({
      orderBy: [{ riskScore: 'desc' }, { targetDate: 'asc' }],
      include: {
        owner: {
          select: { id: true, email: true, profile: { select: { username: true, fullName: true } } },
        },
      },
    });
  }

  async createRisk(adminId: string, dto: CreateRiskDto) {
    const score = LIKELIHOOD_SCORE[dto.likelihood] * IMPACT_SCORE[dto.impact];

    const risk = await this.prisma.riskRegister.create({
      data: {
        title: dto.title,
        description: dto.description,
        likelihood: dto.likelihood,
        impact: dto.impact,
        riskScore: score,
        status: dto.status || 'IDENTIFIED',
        mitigationPlan: dto.mitigationPlan,
        ownerId: dto.ownerId,
        targetDate: new Date(dto.targetDate),
        residualScore: dto.residualScore,
      },
    });

    await this.audit.log({
      category: AuditCategory.ADMIN_ACTION,
      action: 'RISK_REGISTERED',
      severity: score >= 15 ? AuditSeverity.HIGH : AuditSeverity.MEDIUM,
      userId: adminId,
      resource: `RiskRegister:${risk.id}`,
      payload: { title: risk.title, riskScore: score, status: risk.status },
    });

    return risk;
  }

  async updateRisk(adminId: string, id: string, dto: UpdateRiskDto) {
    const existing = await this.prisma.riskRegister.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Risk entry not found');

    const likelihood = dto.likelihood || existing.likelihood;
    const impact = dto.impact || existing.impact;
    const score = LIKELIHOOD_SCORE[likelihood] * IMPACT_SCORE[impact];

    const updated = await this.prisma.riskRegister.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        likelihood: dto.likelihood,
        impact: dto.impact,
        riskScore: score,
        status: dto.status,
        mitigationPlan: dto.mitigationPlan,
        ownerId: dto.ownerId,
        targetDate: dto.targetDate ? new Date(dto.targetDate) : undefined,
        residualScore: dto.residualScore,
      },
    });

    await this.audit.log({
      category: AuditCategory.ADMIN_ACTION,
      action: 'RISK_UPDATED',
      severity: AuditSeverity.INFO,
      userId: adminId,
      resource: `RiskRegister:${id}`,
      payload: { previousScore: existing.riskScore, newScore: score, status: updated.status },
    });

    return updated;
  }

  // ===================== INCIDENT MANAGEMENT =====================

  async listIncidents() {
    return this.prisma.securityIncident.findMany({
      orderBy: { reportedAt: 'desc' },
      include: {
        leadInvestigator: {
          select: { id: true, email: true, profile: { select: { username: true, fullName: true } } },
        },
      },
    });
  }

  async createIncident(adminId: string, dto: CreateIncidentDto) {
    const count = await this.prisma.securityIncident.count();
    const year = new Date().getFullYear();
    const referenceNumber = `INC-${year}-${String(count + 1).padStart(4, '0')}`;

    const incident = await this.prisma.securityIncident.create({
      data: {
        referenceNumber,
        title: dto.title,
        category: dto.category,
        severity: dto.severity || 'P2_HIGH',
        status: dto.status || 'REPORTED',
        description: dto.description,
        containment: dto.containment,
        rootCause: dto.rootCause,
        leadInvestigatorId: dto.leadInvestigatorId || adminId,
      },
    });

    await this.audit.log({
      category: AuditCategory.SECURITY_ALERT,
      action: 'INCIDENT_RECORDED',
      severity: dto.severity === 'P1_CRITICAL' ? AuditSeverity.CRITICAL : AuditSeverity.HIGH,
      userId: adminId,
      resource: `SecurityIncident:${incident.id}`,
      payload: { ref: referenceNumber, category: incident.category, severity: incident.severity },
    });

    return incident;
  }

  async updateIncident(adminId: string, id: string, dto: UpdateIncidentDto) {
    const existing = await this.prisma.securityIncident.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Incident not found');

    const updated = await this.prisma.securityIncident.update({
      where: { id },
      data: {
        title: dto.title,
        category: dto.category,
        severity: dto.severity,
        status: dto.status,
        description: dto.description,
        containment: dto.containment,
        rootCause: dto.rootCause,
        leadInvestigatorId: dto.leadInvestigatorId,
        resolvedAt: dto.status === 'RESOLVED' && !existing.resolvedAt ? new Date() : undefined,
      },
    });

    await this.audit.log({
      category: AuditCategory.ADMIN_ACTION,
      action: 'INCIDENT_UPDATED',
      severity: AuditSeverity.MEDIUM,
      userId: adminId,
      resource: `SecurityIncident:${id}`,
      payload: { ref: existing.referenceNumber, previousStatus: existing.status, newStatus: updated.status },
    });

    return updated;
  }

  // ===================== CHANGE MANAGEMENT =====================

  async listChangeRequests() {
    return this.prisma.changeRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        requester: {
          select: { id: true, email: true, profile: { select: { username: true, fullName: true } } },
        },
        approvedBy: {
          select: { id: true, email: true, profile: { select: { username: true, fullName: true } } },
        },
      },
    });
  }

  async createChangeRequest(adminId: string, dto: CreateChangeRequestDto) {
    const rfc = await this.prisma.changeRequest.create({
      data: {
        title: dto.title,
        category: dto.category,
        riskLevel: dto.riskLevel,
        reason: dto.reason,
        planDetails: dto.planDetails,
        rollbackPlan: dto.rollbackPlan,
        status: 'SUBMITTED',
        requesterId: adminId,
      },
    });

    await this.audit.log({
      category: AuditCategory.ADMIN_ACTION,
      action: 'CHANGE_REQUEST_SUBMITTED',
      severity: AuditSeverity.MEDIUM,
      userId: adminId,
      resource: `ChangeRequest:${rfc.id}`,
      payload: { title: rfc.title, category: rfc.category, riskLevel: rfc.riskLevel },
    });

    return rfc;
  }

  async reviewChangeRequest(adminId: string, id: string, dto: ReviewChangeRequestDto) {
    const existing = await this.prisma.changeRequest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Change request not found');
    if (existing.status !== 'SUBMITTED') {
      throw new BadRequestException(`Cannot review RFC with status ${existing.status}`);
    }

    const updated = await this.prisma.changeRequest.update({
      where: { id },
      data: {
        status: dto.status,
        approvedById: adminId,
        approvedAt: new Date(),
      },
    });

    await this.audit.log({
      category: AuditCategory.ADMIN_ACTION,
      action: dto.status === 'APPROVED' ? 'CHANGE_REQUEST_APPROVED' : 'CHANGE_REQUEST_REJECTED',
      severity: AuditSeverity.HIGH,
      userId: adminId,
      resource: `ChangeRequest:${id}`,
      payload: { outcome: dto.status, rejectionReason: dto.rejectionReason },
    });

    return updated;
  }

  async implementChangeRequest(adminId: string, id: string, dto: ImplementChangeRequestDto) {
    const existing = await this.prisma.changeRequest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Change request not found');

    const updated = await this.prisma.changeRequest.update({
      where: { id },
      data: {
        status: dto.status,
        implementedAt: new Date(),
      },
    });

    await this.audit.log({
      category: AuditCategory.ADMIN_ACTION,
      action: dto.status === 'IMPLEMENTED' ? 'CHANGE_IMPLEMENTED' : 'CHANGE_ROLLED_BACK',
      severity: AuditSeverity.HIGH,
      userId: adminId,
      resource: `ChangeRequest:${id}`,
      payload: { outcome: dto.status },
    });

    return updated;
  }

  // ===================== USER BLOCKING & PRIVACY =====================

  async blockUser(userId: string, targetUserId: string, reason?: string) {
    if (userId === targetUserId) {
      throw new BadRequestException('You cannot block yourself');
    }

    const block = await this.prisma.userBlock.upsert({
      where: {
        blockerId_blockedId: { blockerId: userId, blockedId: targetUserId },
      },
      update: { reason },
      create: {
        blockerId: userId,
        blockedId: targetUserId,
        reason,
      },
    });

    await this.audit.log({
      category: AuditCategory.USER_ACTIVITY,
      action: 'USER_BLOCKED',
      severity: AuditSeverity.INFO,
      userId,
      resource: `User:${targetUserId}`,
      payload: { targetUserId, reason },
    });

    return block;
  }

  async unblockUser(userId: string, targetUserId: string) {
    await this.prisma.userBlock.deleteMany({
      where: { blockerId: userId, blockedId: targetUserId },
    });

    await this.audit.log({
      category: AuditCategory.USER_ACTIVITY,
      action: 'USER_UNBLOCKED',
      severity: AuditSeverity.INFO,
      userId,
      resource: `User:${targetUserId}`,
      payload: { targetUserId },
    });

    return { success: true };
  }

  async listBlockedUsers(userId: string) {
    return this.prisma.userBlock.findMany({
      where: { blockerId: userId },
      include: {
        blocked: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                username: true,
                fullName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async exportUserData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: {
          include: {
            posts: { take: 100, orderBy: { createdAt: 'desc' } },
          },
        },
        consents: true,
        privacyRequests: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const posts = user.profile?.posts || [];

    return {
      exportVersion: '1.0',
      exportedAt: new Date().toISOString(),
      legalGrounds: 'Personal Data Protection Proclamation No. 1321/2024 (Right of Access)',
      dataSubject: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
        profile: user.profile,
        postsCount: posts.length,
        posts: posts.map((p) => ({
          id: p.id,
          title: p.title,
          content: p.content,
          imageUrl: p.imageUrl,
          createdAt: p.createdAt,
        })),
        consents: user.consents,
        privacyRequests: user.privacyRequests,
      },
    };
  }
}
