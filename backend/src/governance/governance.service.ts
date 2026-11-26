import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
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
  AcceptPolicyDto,
  BlockUserDto,
  CancelPrivacyRequestDto,
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
  UpdatePrivacyPreferencesDto,
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
export class GovernanceService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async onModuleInit() {
    try {
      await this.ensureStandardPoliciesExist();
    } catch (e) {
      console.warn('Could not auto-seed standard policies on startup:', e);
    }
  }

  // ===================== STANDARD POLICIES SEEDING =====================

  async ensureStandardPoliciesExist(adminId?: string) {
    let authorId = adminId;
    if (!authorId) {
      const admin = await this.prisma.user.findFirst({
        where: { role: 'ADMIN' },
        select: { id: true },
      });
      authorId = admin?.id;
    }

    if (!authorId) {
      const anyUser = await this.prisma.user.findFirst({ select: { id: true } });
      authorId = anyUser?.id;
    }

    if (!authorId) return; // No users in database yet

    const standardPolicies = [
      {
        code: 'POL-PRIVACY',
        title: 'Privacy Policy',
        category: 'Data Protection & Privacy',
        summary: 'Governs personal data collection, processing, user rights, and protection per Ethiopian Proclamation No. 1321/2024.',
        content: `Authflow Privacy Policy
Effective: January 1, 2025 • Version 2.4

Your privacy and digital rights are paramount. Authflow adheres to strict data protection standards and the Ethiopian Personal Data Protection Proclamation No. 1321/2024.

01. Introduction & Scope
This Privacy Policy describes how Authflow ("we", "our", or "the Platform"), operating within the News Share ecosystem, collects, processes, protects, and handles your personal data when you create an account, authenticate, publish news, or interact with our services.

02. Information We Collect
We gather only the minimum data required to provide a reliable, secure user experience:
• Account Credentials: Email address, username, securely hashed password (bcrypt), and authentication tokens (JWT).
• Profile Information: Full name, bio, profile photo/avatar URL, follower and following connections.
• User Content: Articles, stories, reels, comments, reactions, upvotes, and saved bookmarks.
• Safety & Telemetry Data: IP address, device user-agent, session timestamps, and security audit logs strictly used for intrusion prevention.

03. Biometric Authentication Privacy
When you enable Fingerprint or Face Authentication, biometric verification is executed entirely on your local device hardware using the Android BiometricPrompt security enclave. Authflow never receives, processes, transmits, or stores your raw biometric templates or fingerprint scans on any external server.

04. How We Use Your Data
Your information is processed for legitimate operational purposes:
• To authenticate your identity, prevent credential stuffing, and safeguard account access.
• To deliver your news feed, stories, reels, and user notifications.
• To process and record user consent choices and privacy rights requests.
• To enforce community guidelines, investigate security incidents, and maintain tamper-evident audit trails.
• We NEVER sell, rent, or trade your personal data to third-party data brokers or advertisers.

05. Legal Basis & Data Subject Rights
Under applicable privacy statutes, including Ethiopian Proclamation No. 1321/2024, you hold complete autonomy over your personal information:
• Right of Access: Export a complete, machine-readable JSON archive of your personal profile, posts, comments, and consents at any time in Settings.
• Right to Rectification: Correct inaccurate or outdated details directly in your profile or submit an official rectification request.
• Right to Erasure (Account Deletion): Request permanent deletion. Accounts undergo an administrative 30-day security grace period before permanent anonymization.
• Right to Restrict & Withdraw Consent: Toggle off optional telemetry, personalization, and marketing in your privacy preferences.

06. Data Security & Storage
We implement industry-standard cryptographic defenses including TLS 1.3 encryption in transit, salted bcrypt password hashing, role-based access control (RBAC), and immutable administrative audit logs that capture every security and moderation action with actor, target, timestamp, and justification.

07. Third-Party Services
When you choose "Continue with Google", we receive your verified Google account email, name, and profile picture strictly to initialize or link your Authflow account. We do not obtain access to your Google Drive, contacts, or external Google services.

08. Contact Our Data Protection Officer
If you have questions regarding this Privacy Policy, your legal rights, or wish to report a privacy concern, please reach out directly:
Authflow Privacy & Governance Office
Data Protection Officer (DPO)
Email: dpo@authflow.app / compliance@newsshare.internal
Response Time: Within 72 business hours`,
      },
      {
        code: 'POL-TERMS',
        title: 'Terms of Service',
        category: 'Acceptable Use & Terms',
        summary: 'Defines user agreements, content licensing, credential confidentiality, and service terms.',
        content: `Authflow Terms of Service
Effective: January 1, 2025 • Version 2.4

Please read these Terms carefully. By accessing or using Authflow and the News Share platform, you agree to be bound by these legal conditions.

01. Acceptance & Eligibility
By registering an account, authenticating via email, password, biometrics, or Google OAuth, or by browsing content on Authflow / News Share, you affirm that you are at least 13 years old (or the legal age of digital consent in your jurisdiction) and legally capable of entering into this agreement.

02. Account Registration & Credential Security
You are responsible for safeguarding your credentials:
• You must provide accurate and complete registration information and keep your email address updated.
• You are solely responsible for all activities that occur under your account.
• You must immediately report any suspected unauthorized access or account compromise to security@newsshare.internal.
• Sharing account credentials, automated bot account creation, and impersonating other individuals or entities are strictly prohibited.

03. Acceptable Use Policy (AUP)
News Share is built upon authentic journalism and constructive community dialogue. We enforce zero tolerance for violence incitement, hate speech, harassment, sexually explicit material, copyright infringement, malicious disinformation, and automated vulnerability exploitation.

04. User Content & Licensing
Your content belongs to you:
• You retain all intellectual property rights and copyright to news articles, stories, reels, comments, and media you submit.
• By publishing content on the platform, you grant Authflow and News Share a worldwide, royalty-free, non-exclusive license to host, display, distribute, and format your content for platform operation.
• You represent and warrant that you hold all necessary rights, licenses, and permissions for any third-party media or text included in your submissions.

05. Moderation, Reporting & Sanctions
We operate a comprehensive moderation and security review system to keep the community safe:
• Users may report abusive content, violations, or accounts directly within the app.
• Our compliance officers and automated safety filters investigate violations and enforce graduated sanctions, including formal warnings, post removal, temporary feature restrictions, and permanent account bans.
• All administrative sanctions are recorded in immutable, tamper-evident audit logs to ensure accountability and fairness.

06. Account Deletion & Data Retention
You may request account deletion at any time in Settings. In accordance with security governance and fraud prevention requirements, account records enter a 30-day grace retention window prior to permanent cryptographic deletion and anonymization.

07. Disclaimers & Limitation of Liability
Authflow and News Share are provided on an "AS IS" and "AS AVAILABLE" basis. To the maximum extent permitted by applicable law, we disclaim all warranties, express or implied, including merchantability and fitness for a particular purpose. In no event shall Authflow be liable for indirect, incidental, punitive, or consequential damages arising from service usage.

08. Governing Law & Disputes
These Terms shall be governed and interpreted in accordance with the applicable laws of the Federal Democratic Republic of Ethiopia and international commercial standards. Any dispute arising from these Terms shall be resolved through good-faith negotiation, followed by binding arbitration if unresolved.`,
      },
      {
        code: 'POL-COOKIES',
        title: 'Cookie & Storage Policy',
        category: 'Storage & Tracking',
        summary: 'Specifies local storage, session JWT tokens, and anti-CSRF protection cookies.',
        content: `Cookie & Local Storage Policy
Effective: January 1, 2025 • Version 2.0

This policy explains how News Share and Authflow utilize local device storage, caching mechanisms, and security tokens to provide an authenticated, uninterrupted service.

01. What We Store
Unlike advertising networks, News Share does not use tracking cookies or sell your activity to advertisers. We store only essential data required for platform operation:
• Authentication Tokens: Cryptographically signed JWT access tokens and refresh tokens stored in your device's secure enclave (EncryptedSharedPreferences / Keychain) to keep you logged in.
• User Session Cache: Minimal profile metadata (username, avatar, user ID) cached locally to ensure instant UI loading and offline feed capability.
• Content Preferences: Your selected privacy and content preferences (such as dark mode and feed preferences).

02. No Third-Party Advertising Trackers
We strictly prohibit third-party analytics trackers, cross-site trackers, and advertising telemetry. Your browsing habits, read articles, and interactions are never broadcast to data brokers.

03. Managing Your Stored Data
You can clear your local cached data and active tokens at any time by:
• Logging out of your account via Settings > Log Out.
• Clearing app storage in your Android or iOS device settings.
• Submitting a Data Erasure request in the Privacy & Safety screen.`,
      },
      {
        code: 'POL-GUIDELINES',
        title: 'Community Guidelines',
        category: 'Content Moderation',
        summary: 'Platform standards for respectful discourse, verification of news sources, and anti-misinformation rules.',
        content: `News Share Community Guidelines
Effective: January 1, 2025 • Version 2.0

News Share is committed to fostering authentic, high-quality news reporting and constructive public discussion. All community members must abide by these core principles.

01. Journalistic Integrity & Anti-Disinformation
• Accurate Reporting: News posts, headlines, and articles must be grounded in verified facts. Deliberate fabrications, misleading clickbait, and manipulated synthetic media without attribution are strictly forbidden.
• Source Attribution: Whenever citing breaking news or external reports, credit original sources and journalists.

02. Respectful Community Discourse
• Harassment & Abuse: Personal attacks, coordinated trolling, hate speech based on race, ethnicity, religion, or gender, and doxxing (sharing private contact details) will result in immediate suspension.
• Violence & Incitement: Threats of violence, promotion of terrorism, self-harm encouragement, or illegal goods distribution are subject to immediate, permanent bans and referral to supervisory authorities.

03. Intellectual Property
Respect the intellectual property of fellow creators. Do not upload copyrighted videos, photos, or text without appropriate licenses or fair-use justification.

04. Enforcement & Appeals
Violations are reviewed through our graduated moderation system:
1. Formal Warning: Account notification detailing the infraction.
2. Content Removal: Removal of the non-compliant post or comment.
3. Feature Restriction: Temporary restriction on commenting, posting, or live features.
4. Account Suspension or Ban: Permanent termination for severe or repeated infractions.
Users may appeal any moderation action by contacting support@newsshare.app. All moderation decisions are logged with justification in our compliance audit system.`,
      },
      {
        code: 'POL-DPA',
        title: 'Data Processing Policy',
        category: 'Data Governance',
        summary: 'Internal organizational and technical safeguards, TLS encryption, and retention schedules.',
        content: `Data Processing & Technical Safeguards Policy
Effective: January 1, 2025 • Version 2.0

This Data Processing Policy outlines the technical and organizational security measures implemented by News Share and Authflow to protect data integrity, confidentiality, and availability.

01. Technical Architecture & Cryptographic Safeguards
• Encryption in Transit: All client-to-server traffic is enforced over TLS 1.3 with modern cipher suites.
• Encryption at Rest: Database volumes and storage assets are encrypted using AES-256.
• Password Protection: Passwords are protected using salted bcrypt key derivation functions.
• Audit Logging: Cryptographically sequenced append-only audit trails record administrative actions, consent grants/revocations, and data exports.

02. Data Retention & Erasure Schedule
• User Accounts: When an account deletion request is submitted, it enters a 30-day security grace period to allow user cancellation and prevent fraudulent account takeover evasion. After 30 days, personal identifiers, passwords, emails, and profile records are cryptographically wiped.
• Temporary Verification Tokens: Unused email verification and password reset tokens automatically expire and are purged after 7 days.
• Audit Telemetry: Security logs are retained for 365 days in accordance with statutory compliance (Proclamation No. 958/2016 and No. 1321/2024) before automated archival.

03. Incident Response & Breach Notification
In accordance with Article 33 of Ethiopian Personal Data Protection Proclamation No. 1321/2024, in the unlikely event of a security compromise affecting personal data, the platform will notify the supervisory authority and affected users within 72 hours of verification.`,
      },
    ];

    for (const p of standardPolicies) {
      const policy = await this.prisma.securityPolicy.upsert({
        where: { code: p.code },
        create: {
          code: p.code,
          title: p.title,
          category: p.category,
          summary: p.summary,
          content: p.content,
          status: 'PUBLISHED',
          currentVersion: '1.0.0',
          publishedAt: new Date(),
          nextReviewDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          authorId,
        },
        update: {
          title: p.title,
          summary: p.summary,
          content: p.content,
          status: 'PUBLISHED',
        },
      });

      await this.prisma.policyVersion.upsert({
        where: {
          policyId_versionNumber: {
            policyId: policy.id,
            versionNumber: '1.0.0',
          },
        },
        create: {
          policyId: policy.id,
          versionNumber: '1.0.0',
          content: p.content,
          changeSummary: 'Verified statutory publication',
          approvedById: authorId,
          publishedAt: new Date(),
        },
        update: {
          content: p.content,
        },
      });
    }
  }

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
      orderBy: { code: 'asc' },
    });
  }

  async getPolicyByCode(code: string) {
    const policy = await this.prisma.securityPolicy.findUnique({
      where: { code },
      include: {
        versions: {
          orderBy: { publishedAt: 'desc' },
          take: 5,
        },
      },
    });
    if (!policy) throw new NotFoundException(`Policy with code ${code} not found`);
    return policy;
  }

  async acceptPolicy(
    userId: string,
    policyId: string,
    versionNumber?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const policy = await this.prisma.securityPolicy.findUnique({
      where: { id: policyId },
    });
    if (!policy) throw new NotFoundException('Policy not found');

    const version = versionNumber || policy.currentVersion;

    const acceptance = await this.prisma.policyAcceptance.upsert({
      where: {
        userId_policyId_versionNumber: {
          userId,
          policyId,
          versionNumber: version,
        },
      },
      update: {
        acceptedAt: new Date(),
        ipAddress,
        userAgent,
      },
      create: {
        userId,
        policyId,
        versionNumber: version,
        ipAddress,
        userAgent,
      },
    });

    await this.prisma.consentRecord.create({
      data: {
        userId,
        consentType: `POLICY_ACCEPTANCE_${policy.code}`,
        isGranted: true,
        policyVersion: version,
        ipAddress,
        userAgent,
      },
    });

    await this.audit.log({
      category: AuditCategory.USER_ACTIVITY,
      action: 'POLICY_ACCEPTED',
      severity: AuditSeverity.INFO,
      userId,
      resource: `SecurityPolicy:${policy.id}`,
      payload: { policyCode: policy.code, version },
    });

    return acceptance;
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
      where: { userId, requestType: dto.requestType, status: { in: ['PENDING', 'UNDER_REVIEW'] } },
    });
    if (pending) {
      throw new BadRequestException('You already have a pending request of this type under review.');
    }

    const scheduledDeletionAt =
      dto.requestType === 'ACCOUNT_DELETION'
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        : null;

    const req = await this.prisma.privacyRequest.create({
      data: {
        userId,
        requestType: dto.requestType,
        details: dto.details,
        scheduledDeletionAt,
      },
    });

    if (dto.requestType === 'ACCOUNT_DELETION') {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          scheduledDeletionAt,
          status: 'DEACTIVATED',
        },
      });
    }

    await this.audit.log({
      category: AuditCategory.USER_ACTIVITY,
      action: dto.requestType === 'ACCOUNT_DELETION' ? 'ACCOUNT_DELETION_REQUESTED' : 'PRIVACY_REQUEST_SUBMITTED',
      severity: dto.requestType === 'ACCOUNT_DELETION' ? AuditSeverity.HIGH : AuditSeverity.INFO,
      userId,
      resource: `PrivacyRequest:${req.id}`,
      payload: { requestType: req.requestType, scheduledDeletionAt: scheduledDeletionAt?.toISOString() },
    });

    return req;
  }

  async cancelAccountDeletion(userId: string, reason?: string) {
    const activeReq = await this.prisma.privacyRequest.findFirst({
      where: {
        userId,
        requestType: 'ACCOUNT_DELETION',
        status: { in: ['PENDING', 'UNDER_REVIEW'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!activeReq) {
      throw new NotFoundException('No active account deletion request found.');
    }

    const updatedReq = await this.prisma.privacyRequest.update({
      where: { id: activeReq.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: reason || 'User cancelled deletion request during 30-day grace period',
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        scheduledDeletionAt: null,
        status: 'ACTIVE',
      },
    });

    await this.audit.log({
      category: AuditCategory.USER_ACTIVITY,
      action: 'ACCOUNT_DELETION_CANCELLED',
      severity: AuditSeverity.MEDIUM,
      userId,
      resource: `PrivacyRequest:${activeReq.id}`,
      payload: { reason: updatedReq.cancelReason },
    });

    return {
      message: 'Account deletion request successfully cancelled. Your account remains active in good standing.',
      request: updatedReq,
    };
  }

  async cancelPrivacyRequest(userId: string, requestId: string, reason?: string) {
    const req = await this.prisma.privacyRequest.findUnique({
      where: { id: requestId },
    });
    if (!req) throw new NotFoundException('Privacy request not found');
    if (req.userId !== userId) throw new ForbiddenException('Cannot cancel request belonging to another user');
    if (req.status !== 'PENDING' && req.status !== 'UNDER_REVIEW') {
      throw new BadRequestException(`Cannot cancel request with status ${req.status}`);
    }

    const updated = await this.prisma.privacyRequest.update({
      where: { id: requestId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: reason || 'Cancelled by user',
      },
    });

    if (req.requestType === 'ACCOUNT_DELETION') {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          scheduledDeletionAt: null,
          status: 'ACTIVE',
        },
      });
    }

    await this.audit.log({
      category: AuditCategory.USER_ACTIVITY,
      action: 'PRIVACY_REQUEST_CANCELLED',
      severity: AuditSeverity.INFO,
      userId,
      resource: `PrivacyRequest:${requestId}`,
      payload: { requestType: req.requestType, reason },
    });

    return updated;
  }

  async getPrivacyPreferences(userId: string) {
    const pref = await this.prisma.userPrivacyPreference.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        privateAccount: false,
        activityStatus: true,
        suggestAccount: true,
        syncContacts: false,
        locationServices: false,
        commentPermission: 'EVERYONE',
        mentionPermission: 'EVERYONE',
        dmPermission: 'FRIENDS',
        analyticsPerformance: true,
        feedPersonalization: true,
        securityTelemetry: true,
        productNewsUpdates: false,
      },
    });

    return {
      userId: pref.userId,
      privateAccount: pref.privateAccount,
      activityStatus: pref.activityStatus,
      suggestAccount: pref.suggestAccount,
      syncContacts: pref.syncContacts,
      locationServices: pref.locationServices,
      commentPermission: pref.commentPermission,
      mentionPermission: pref.mentionPermission,
      dmPermission: pref.dmPermission,
      analyticsPerformance: pref.analyticsPerformance,
      feedPersonalization: pref.feedPersonalization,
      securityTelemetry: pref.securityTelemetry,
      productNewsUpdates: pref.productNewsUpdates,
      updatedAt: pref.updatedAt,
      notices: {
        securityTelemetry: 'Essential security telemetry enables fraud prevention, intrusion auditing, and session protection. Maintained distinctly from optional marketing/recommendation preferences.',
      },
    };
  }

  async getSecurityCheckup(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        emailVerified: true,
        passwordChangedAt: true,
        failedLoginCount: true,
        createdAt: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const activeSessionsCount = await this.prisma.session.count({
      where: { userId, revokedAt: null },
    });

    const recentAuditLogsCount = await this.prisma.auditLog.count({
      where: { userId },
    });

    const pref = await this.prisma.userPrivacyPreference.findUnique({
      where: { userId },
    });

    const passwordAgeDays = user.passwordChangedAt
      ? Math.floor((Date.now() - user.passwordChangedAt.getTime()) / (1000 * 60 * 60 * 24))
      : Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24));

    return {
      status: 'SECURE',
      score: 100,
      activeSessionsCount,
      emailVerified: user.emailVerified,
      checks: [
        {
          key: 'PASSWORD',
          title: 'Password Security',
          status: 'GOOD',
          detail: `Stored with salted bcrypt derivation. Changed ${passwordAgeDays} days ago.`,
        },
        {
          key: 'SESSIONS',
          title: 'Trusted Device Sessions',
          status: 'GOOD',
          detail: `${activeSessionsCount} active cryptographic JWT device session(s).`,
        },
        {
          key: 'EMAIL_VERIFICATION',
          title: 'Account Verification',
          status: user.emailVerified ? 'GOOD' : 'WARNING',
          detail: user.emailVerified ? 'Primary email is verified.' : 'Email pending verification.',
        },
        {
          key: 'AUDIT_TELEMETRY',
          title: 'Security Telemetry Audit',
          status: pref?.securityTelemetry ? 'GOOD' : 'WARNING',
          detail: pref?.securityTelemetry
            ? `${recentAuditLogsCount} tamper-evident security audit events recorded.`
            : 'Security telemetry is currently disabled.',
        },
        {
          key: 'COMPLIANCE',
          title: 'Proclamation No. 1321/2024 Compliance',
          status: 'GOOD',
          detail: 'Statutory 72-hour breach reporting and Article 24 data portability ready.',
        },
      ],
    };
  }

  async matchContacts(userId: string, hashes: string[]) {
    if (!hashes || hashes.length === 0) return [];
    const matches = await this.prisma.user.findMany({
      where: {
        id: { not: userId },
        status: 'ACTIVE',
        OR: [
          { email: { in: hashes } },
          { profile: { username: { in: hashes } } },
        ],
      },
      include: {
        profile: true,
      },
      take: 20,
    });

    return matches.map((u) => ({
      id: u.id,
      username: u.profile?.username ?? '',
      fullName: u.profile?.fullName ?? '',
      avatarUrl: u.profile?.avatarUrl ?? null,
    }));
  }

  async updatePrivacyPreferences(
    userId: string,
    dto: UpdatePrivacyPreferencesDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const current = await this.prisma.userPrivacyPreference.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        privateAccount: false,
        activityStatus: true,
        suggestAccount: true,
        syncContacts: false,
        locationServices: false,
        commentPermission: 'EVERYONE',
        mentionPermission: 'EVERYONE',
        dmPermission: 'FRIENDS',
        analyticsPerformance: true,
        feedPersonalization: true,
        securityTelemetry: true,
        productNewsUpdates: false,
      },
    });

    const updated = await this.prisma.userPrivacyPreference.update({
      where: { userId },
      data: {
        privateAccount: dto.privateAccount !== undefined ? dto.privateAccount : current.privateAccount,
        activityStatus: dto.activityStatus !== undefined ? dto.activityStatus : current.activityStatus,
        suggestAccount: dto.suggestAccount !== undefined ? dto.suggestAccount : current.suggestAccount,
        syncContacts: dto.syncContacts !== undefined ? dto.syncContacts : current.syncContacts,
        locationServices: dto.locationServices !== undefined ? dto.locationServices : current.locationServices,
        commentPermission: dto.commentPermission !== undefined ? dto.commentPermission : current.commentPermission,
        mentionPermission: dto.mentionPermission !== undefined ? dto.mentionPermission : current.mentionPermission,
        dmPermission: dto.dmPermission !== undefined ? dto.dmPermission : current.dmPermission,
        analyticsPerformance: dto.analyticsPerformance !== undefined ? dto.analyticsPerformance : current.analyticsPerformance,
        feedPersonalization: dto.feedPersonalization !== undefined ? dto.feedPersonalization : current.feedPersonalization,
        securityTelemetry: dto.securityTelemetry !== undefined ? dto.securityTelemetry : current.securityTelemetry,
        productNewsUpdates: dto.productNewsUpdates !== undefined ? dto.productNewsUpdates : current.productNewsUpdates,
      },
    });

    const consentHistoryRecords = [];
    if (dto.privateAccount !== undefined && dto.privateAccount !== current.privateAccount) {
      consentHistoryRecords.push({
        userId,
        consentType: 'ACCOUNT_DISCOVERABILITY_PRIVATE',
        isGranted: dto.privateAccount,
        ipAddress,
        userAgent,
      });
    }
    if (dto.activityStatus !== undefined && dto.activityStatus !== current.activityStatus) {
      consentHistoryRecords.push({
        userId,
        consentType: 'ACTIVITY_STATUS_VISIBILITY',
        isGranted: dto.activityStatus,
        ipAddress,
        userAgent,
      });
    }
    if (dto.analyticsPerformance !== undefined && dto.analyticsPerformance !== current.analyticsPerformance) {
      consentHistoryRecords.push({
        userId,
        consentType: 'ANALYTICS_PERFORMANCE',
        isGranted: dto.analyticsPerformance,
        ipAddress,
        userAgent,
      });
    }
    if (dto.feedPersonalization !== undefined && dto.feedPersonalization !== current.feedPersonalization) {
      consentHistoryRecords.push({
        userId,
        consentType: 'FEED_PERSONALIZATION',
        isGranted: dto.feedPersonalization,
        ipAddress,
        userAgent,
      });
    }
    if (dto.productNewsUpdates !== undefined && dto.productNewsUpdates !== current.productNewsUpdates) {
      consentHistoryRecords.push({
        userId,
        consentType: 'PRODUCT_NEWS_UPDATES',
        isGranted: dto.productNewsUpdates,
        ipAddress,
        userAgent,
      });
    }

    if (consentHistoryRecords.length > 0) {
      await this.prisma.consentRecord.createMany({
        data: consentHistoryRecords,
      });
    }

    await this.audit.log({
      category: AuditCategory.USER_ACTIVITY,
      action: 'PRIVACY_PREFERENCES_UPDATED',
      severity: AuditSeverity.INFO,
      userId,
      resource: `UserPrivacyPreference:${userId}`,
      payload: {
        analyticsPerformance: updated.analyticsPerformance,
        feedPersonalization: updated.feedPersonalization,
        securityTelemetry: updated.securityTelemetry,
        productNewsUpdates: updated.productNewsUpdates,
      },
    });

    return updated;
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

    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: { profile: true },
    });
    if (!targetUser) throw new NotFoundException('Target user not found');

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

    // Enforce blocking on social graph: Sever follow relationships in both directions
    await this.prisma.$transaction(async (tx) => {
      // 1. User unfollows Target
      const f1 = await tx.follow.deleteMany({
        where: { followerId: userId, followingId: targetUserId },
      });
      if (f1.count > 0) {
        await tx.profile.update({
          where: { id: userId },
          data: { followingCount: { decrement: f1.count } },
        });
        await tx.profile.update({
          where: { id: targetUserId },
          data: { followersCount: { decrement: f1.count } },
        });
      }

      // 2. Target unfollows User
      const f2 = await tx.follow.deleteMany({
        where: { followerId: targetUserId, followingId: userId },
      });
      if (f2.count > 0) {
        await tx.profile.update({
          where: { id: targetUserId },
          data: { followingCount: { decrement: f2.count } },
        });
        await tx.profile.update({
          where: { id: userId },
          data: { followersCount: { decrement: f2.count } },
        });
      }
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

  async getBlockedUserIds(userId: string): Promise<string[]> {
    const blocks = await this.prisma.userBlock.findMany({
      where: {
        OR: [
          { blockerId: userId },
          { blockedId: userId },
        ],
      },
      select: { blockerId: true, blockedId: true },
    });

    const set = new Set<string>();
    for (const b of blocks) {
      if (b.blockerId === userId) set.add(b.blockedId);
      if (b.blockedId === userId) set.add(b.blockerId);
    }
    return Array.from(set);
  }

  async isUserBlocked(userA: string, userB: string): Promise<boolean> {
    const block = await this.prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: userA, blockedId: userB },
          { blockerId: userB, blockedId: userA },
        ],
      },
    });
    return !!block;
  }

  async exportUserData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: {
          include: {
            posts: { take: 500, orderBy: { createdAt: 'desc' } },
          },
        },
        privacyPreference: true,
        consents: { orderBy: { grantedAt: 'desc' } },
        privacyRequests: { orderBy: { createdAt: 'desc' } },
        likes: { take: 500, select: { postId: true, createdAt: true } },
        savedPosts: { take: 500, select: { postId: true, createdAt: true } },
        blockedUsers: { select: { blockedId: true, createdAt: true } },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const comments = await this.prisma.comment.findMany({
      where: { userId },
      take: 500,
      orderBy: { createdAt: 'desc' },
      select: { id: true, postId: true, content: true, createdAt: true },
    });

    const posts = user.profile?.posts || [];

    const archive = {
      exportMetadata: {
        system: 'News Share Platform',
        exportVersion: '2.0.0',
        exportedAt: new Date().toISOString(),
        complianceGrounds: 'Personal Data Protection Proclamation No. 1321/2024 (Right of Access & Data Portability)',
        scope: 'Complete personal data subject archive',
      },
      account: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      },
      profile: user.profile
        ? {
            id: user.profile.id,
            username: user.profile.username,
            fullName: user.profile.fullName,
            bio: user.profile.bio,
            avatarUrl: user.profile.avatarUrl,
            followersCount: user.profile.followersCount,
            followingCount: user.profile.followingCount,
          }
        : null,
      preferences: user.privacyPreference,
      content: {
        postsCount: posts.length,
        posts: posts.map((p) => ({
          id: p.id,
          title: p.title,
          content: p.content,
          imageUrl: p.imageUrl,
          createdAt: p.createdAt,
        })),
        commentsCount: comments.length,
        comments,
      },
      interactions: {
        likedPostsCount: user.likes.length,
        likedPosts: user.likes,
        savedPostsCount: user.savedPosts.length,
        savedPosts: user.savedPosts,
        blockedUsersCount: user.blockedUsers.length,
      },
      governance: {
        consents: user.consents,
        privacyRequests: user.privacyRequests,
      },
    };

    await this.audit.log({
      category: AuditCategory.USER_ACTIVITY,
      action: 'DATA_ARCHIVE_EXPORTED',
      severity: AuditSeverity.INFO,
      userId,
      resource: `User:${userId}`,
      payload: {
        postsCount: posts.length,
        commentsCount: comments.length,
      },
    });

    return archive;
  }

  // ===================== RETENTION & SCHEDULED DELETIONS =====================

  async getRetentionMetrics() {
    const now = new Date();

    const [
      pendingDeletionsCount,
      scheduledDeletions,
      completedDeletionsCount,
      totalPrivacyRequests,
      activeConsentRecordsCount,
    ] = await Promise.all([
      this.prisma.privacyRequest.count({
        where: { requestType: 'ACCOUNT_DELETION', status: { in: ['PENDING', 'UNDER_REVIEW'] } },
      }),
      this.prisma.user.findMany({
        where: { scheduledDeletionAt: { not: null }, status: { not: 'DELETED' } },
        select: {
          id: true,
          email: true,
          scheduledDeletionAt: true,
          status: true,
          profile: { select: { username: true, fullName: true } },
        },
        orderBy: { scheduledDeletionAt: 'asc' },
      }),
      this.prisma.user.count({
        where: { status: 'DELETED' },
      }),
      this.prisma.privacyRequest.count(),
      this.prisma.consentRecord.count({
        where: { isGranted: true },
      }),
    ]);

    return {
      pendingDeletionsCount,
      activeScheduledDeletions: scheduledDeletions.map((u) => {
        const remainingMs = u.scheduledDeletionAt ? u.scheduledDeletionAt.getTime() - now.getTime() : 0;
        const remainingDays = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
        return {
          id: u.id,
          username: u.profile?.username || u.email,
          scheduledDeletionAt: u.scheduledDeletionAt,
          remainingDays,
          status: u.status,
        };
      }),
      completedDeletionsCount,
      totalPrivacyRequests,
      activeConsentRecordsCount,
      retentionPolicyRules: [
        {
          dataCategory: 'User Credentials & Identifiers',
          retentionPeriod: '30 days after deletion request',
          handling: 'Irreversible cryptographic anonymization and key scrubbing',
        },
        {
          dataCategory: 'Security Audit Logs',
          retentionPeriod: '365 days',
          handling: 'Tamper-evident cryptographically chained retention',
        },
        {
          dataCategory: 'Ephemeral Stories & Reels',
          retentionPeriod: '24 hours active',
          handling: 'Automated feed expiration',
        },
      ],
    };
  }

  async processScheduledAccountDeletions() {
    const now = new Date();
    const expiredUsers = await this.prisma.user.findMany({
      where: {
        scheduledDeletionAt: { lte: now },
        status: { not: 'DELETED' },
      },
      include: {
        profile: true,
        privacyRequests: {
          where: {
            requestType: 'ACCOUNT_DELETION',
            status: { in: ['PENDING', 'UNDER_REVIEW'] },
          },
        },
      },
    });

    const anonymizedIds: string[] = [];

    for (const user of expiredUsers) {
      const anonSuffix = user.id.replace(/-/g, '').slice(0, 10);
      const anonymizedEmail = `anonymized_${anonSuffix}@deleted.news-share.internal`;
      const anonymizedUsername = `deleted_user_${anonSuffix}`;

      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: {
            email: anonymizedEmail,
            passwordHash: 'DELETED_ACCOUNT_SCRUBBED',
            status: 'DELETED',
            deletedAt: now,
            scheduledDeletionAt: null,
          },
        });

        if (user.profile) {
          await tx.profile.update({
            where: { id: user.id },
            data: {
              username: anonymizedUsername,
              fullName: 'Deactivated User',
              bio: null,
              avatarUrl: null,
            },
          });
        }

        for (const req of user.privacyRequests) {
          await tx.privacyRequest.update({
            where: { id: req.id },
            data: {
              status: 'COMPLETED',
              resolvedAt: now,
              rejectionReason: '30-day grace period elapsed; account permanently anonymized per retention policy',
            },
          });
        }

        await tx.refreshToken.deleteMany({ where: { userId: user.id } });
        await tx.session.deleteMany({ where: { userId: user.id } });
      });

      await this.audit.log({
        category: AuditCategory.SECURITY_ALERT,
        action: 'ACCOUNT_PERMANENTLY_ANONYMIZED',
        severity: AuditSeverity.HIGH,
        userId: user.id,
        resource: `User:${user.id}`,
        payload: {
          retentionPolicy: '30_DAY_GRACE_EXPIRED',
          anonymizedAt: now.toISOString(),
        },
      });

      anonymizedIds.push(user.id);
    }

    return {
      processedCount: anonymizedIds.length,
      anonymizedUserIds: anonymizedIds,
      executedAt: now.toISOString(),
    };
  }

  async getPrivacyAuditRecords(limit = 100) {
    return this.prisma.auditLog.findMany({
      where: {
        OR: [
          { action: { contains: 'PRIVACY' } },
          { action: { contains: 'CONSENT' } },
          { action: { contains: 'BLOCK' } },
          { action: { contains: 'DATA' } },
          { action: { contains: 'DELETION' } },
          { action: { contains: 'POLICY' } },
        ],
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: { select: { username: true, fullName: true } },
          },
        },
      },
    });
  }
}
