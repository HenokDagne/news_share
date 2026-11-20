import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditCategory, AuditSeverity, TokenType } from '@prisma/client';

export enum DataClassification {
  PUBLIC = 'PUBLIC',
  INTERNAL = 'INTERNAL',
  CONFIDENTIAL = 'CONFIDENTIAL',
  RESTRICTED = 'RESTRICTED',
}

export interface FieldClassificationPolicy {
  field: string;
  classification: DataClassification;
  atRestControl: string;
  inTransitControl: string;
  nonProductionHandling: string;
}

export interface RetentionPolicyReport {
  timestamp: string;
  sessionsPurged: number;
  tokensPurged: number;
  usersPermanentlyShredded: number;
  status: 'COMPLIANT_EXECUTED';
}

@Injectable()
export class DataProtectionService {
  private readonly logger = new Logger(DataProtectionService.name);
  private readonly pseudonymizationSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {
    this.pseudonymizationSecret =
      this.config.get<string>('PSEUDONYMIZATION_SECRET') ||
      this.config.get<string>('JWT_ACCESS_SECRET') ||
      'news-share-pseudonymization-master-secret-256!';
  }

  // ==========================================
  // 1. DATA CLASSIFICATION CATALOGUE (Section 4.4)
  // ==========================================

  getDataClassificationCatalogue(): Record<string, FieldClassificationPolicy[]> {
    return {
      User: [
        {
          field: 'passwordHash',
          classification: DataClassification.RESTRICTED,
          atRestControl: 'Argon2id Salted Hash',
          inTransitControl: 'Never transmitted / TLS 1.3',
          nonProductionHandling: 'Excluded entirely or replaced with dummy hash',
        },
        {
          field: 'email',
          classification: DataClassification.CONFIDENTIAL,
          atRestControl: 'Database column / Restricted query',
          inTransitControl: 'TLS 1.2+ / HTTPS',
          nonProductionHandling: 'Masked (e.g. u***r@news-share.test)',
        },
        {
          field: 'id',
          classification: DataClassification.CONFIDENTIAL,
          atRestControl: 'UUIDv4 Primary Key',
          inTransitControl: 'TLS 1.2+ / HTTPS',
          nonProductionHandling: 'Pseudonymized HMAC-SHA256 Token',
        },
        {
          field: 'role / status',
          classification: DataClassification.INTERNAL,
          atRestControl: 'Database enum',
          inTransitControl: 'TLS 1.2+ / HTTPS',
          nonProductionHandling: 'Preserved for role-testing',
        },
      ],
      Profile: [
        {
          field: 'fullName / bio',
          classification: DataClassification.CONFIDENTIAL,
          atRestControl: 'Encrypted or restricted access',
          inTransitControl: 'TLS 1.2+ / HTTPS',
          nonProductionHandling: 'Masked or synthetic replacement',
        },
        {
          field: 'username / avatarUrl',
          classification: DataClassification.PUBLIC,
          atRestControl: 'Indexed text / CDN URL',
          inTransitControl: 'TLS 1.2+ / HTTPS',
          nonProductionHandling: 'Preserved or synthetic placeholders',
        },
      ],
      AuditAndSession: [
        {
          field: 'tokenHash / sessionToken',
          classification: DataClassification.RESTRICTED,
          atRestControl: 'SHA-256 Hash / AES-256-GCM',
          inTransitControl: 'HttpOnly Secure SameSite Cookie / TLS',
          nonProductionHandling: 'Purged',
        },
        {
          field: 'ipAddress / userAgent',
          classification: DataClassification.CONFIDENTIAL,
          atRestControl: 'Encrypted payload / Anonymized storage',
          inTransitControl: 'TLS 1.2+ / HTTPS',
          nonProductionHandling: 'Subnet masked (e.g. 192.168.***.***)',
        },
        {
          field: 'auditLogs.encryptedData',
          classification: DataClassification.RESTRICTED,
          atRestControl: 'AES-256-GCM Authenticated Encryption',
          inTransitControl: 'TLS 1.2+ / HTTPS',
          nonProductionHandling: 'Encrypted with dev key or omitted',
        },
      ],
      PostsAndComments: [
        {
          field: 'title / content',
          classification: DataClassification.PUBLIC,
          atRestControl: 'UTF-8 Text with XSS output encoding',
          inTransitControl: 'TLS 1.2+ / HTTPS',
          nonProductionHandling: 'Publicly readable news content',
        },
      ],
    };
  }

  // ==========================================
  // 2. MASKING & PSEUDONYMIZATION (Section 4.4)
  // ==========================================

  /**
   * Masks email address (e.g. "john.doe@example.com" -> "j***e@example.com")
   */
  maskEmail(email: string): string {
    if (!email || !email.includes('@')) return '***@***.***';
    const [local, domain] = email.split('@');
    if (local.length <= 2) {
      return `${local[0]}***@${domain}`;
    }
    return `${local[0]}***${local[local.length - 1]}@${domain}`;
  }

  /**
   * Masks IPv4 or IPv6 address (e.g. "192.168.1.100" -> "192.168.***.***")
   */
  maskIpAddress(ip: string): string {
    if (!ip) return '***.***.***.***';
    if (ip.includes('.')) {
      const parts = ip.split('.');
      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.***.***`;
      }
    }
    if (ip.includes(':')) {
      const parts = ip.split(':');
      return `${parts.slice(0, 2).join(':')}:****:****`;
    }
    return '***.***.***.***';
  }

  /**
   * Masks full name (e.g. "Jane Doe" -> "J*** D***")
   */
  maskFullName(name: string): string {
    if (!name) return '***';
    return name
      .split(/\s+/)
      .map((part) => (part.length > 0 ? `${part[0]}***` : '***'))
      .join(' ');
  }

  /**
   * Generates a deterministic HMAC-SHA256 pseudonymized token for safe analytics across non-prod systems
   */
  pseudonymizeId(id: string): string {
    if (!id) return '';
    return createHmac('sha256', this.pseudonymizationSecret)
      .update(id)
      .digest('hex')
      .substring(0, 32);
  }

  /**
   * Transforms a sensitive dataset into a masked, non-production compliant format
   */
  exportAnonymizedDataset(records: any[]): any[] {
    return records.map((record) => {
      const copy = { ...record };
      if (copy.email) copy.email = this.maskEmail(copy.email);
      if (copy.fullName) copy.fullName = this.maskFullName(copy.fullName);
      if (copy.ipAddress) copy.ipAddress = this.maskIpAddress(copy.ipAddress);
      if (copy.passwordHash) copy.passwordHash = '[REDACTED_RESTRICTED]';
      if (copy.tokenHash) copy.tokenHash = '[REDACTED_RESTRICTED]';
      if (copy.id) copy.pseudonymizedId = this.pseudonymizeId(copy.id);
      return copy;
    });
  }

  // ==========================================
  // 3. DATA RETENTION & SECURE DELETION POLICIES (Section 4.4)
  // ==========================================

  /**
   * Executes automated data retention policy enforcement:
   * - Purges sessions expired > 30 days ago
   * - Purges one-time tokens used/expired > 7 days ago
   * - Permanently shreds users who have been soft-deleted past the 30-day grace period
   */
  async enforceDataRetention(): Promise<RetentionPolicyReport> {
    const now = new Date();
    const sessionCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days
    const tokenCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days
    const userDeletionCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days grace period

    // 1. Purge stale sessions
    const sessionResult = await this.prisma.session.deleteMany({
      where: {
        expiresAt: { lt: sessionCutoff },
      },
    });

    // 2. Purge expired one-time tokens
    const tokenResult = await this.prisma.oneTimeToken.deleteMany({
      where: {
        expiresAt: { lt: tokenCutoff },
      },
    });

    // 3. Find soft-deleted users past 30-day grace period for permanent cryptographic shredding
    const expiredDeletedUsers = await this.prisma.user.findMany({
      where: {
        status: 'DELETED',
        deletedAt: { lt: userDeletionCutoff },
      },
      select: { id: true, email: true },
    });

    let usersPermanentlyShredded = 0;
    for (const u of expiredDeletedUsers) {
      await this.secureWipeUser(u.id);
      usersPermanentlyShredded++;
    }

    // 4. Record audit trail for retention policy enforcement
    await this.audit.log({
      category: AuditCategory.ADMIN_ACTION,
      action: 'DATA_RETENTION_POLICY_ENFORCED',
      severity: AuditSeverity.INFO,
      resource: 'data-protection/retention',
      payload: {
        sessionsPurged: sessionResult.count,
        tokensPurged: tokenResult.count,
        usersPermanentlyShredded,
        executedAt: now.toISOString(),
      },
    });

    return {
      timestamp: now.toISOString(),
      sessionsPurged: sessionResult.count,
      tokensPurged: tokenResult.count,
      usersPermanentlyShredded,
      status: 'COMPLIANT_EXECUTED',
    };
  }

  /**
   * Performs cryptographic wipe and PII anonymization of a user account upon end of grace period
   */
  async secureWipeUser(userId: string): Promise<boolean> {
    const tombstone = `shredded_${createHash('sha256').update(userId + randomBytes(16)).digest('hex').substring(0, 16)}@deleted.local`;
    const randomPasswordHash = `$argon2id$v=19$m=65536,t=3,p=4$${randomBytes(32).toString('base64')}`;

    await this.prisma.$transaction([
      this.prisma.profile.updateMany({
        where: { id: userId },
        data: {
          fullName: 'Deleted User',
          bio: null,
          avatarUrl: null,
          avatarPublicId: null,
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          email: tombstone,
          passwordHash: randomPasswordHash,
          emailVerified: false,
          deletedAt: new Date(),
        },
      }),
      this.prisma.session.deleteMany({ where: { userId } }),
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
      this.prisma.oneTimeToken.deleteMany({ where: { userId } }),
    ]);

    this.logger.log(`Cryptographic wipe completed for user ${userId}`);
    return true;
  }
}
