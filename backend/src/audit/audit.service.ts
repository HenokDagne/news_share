import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditCategory, AuditSeverity } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditCryptoService, IntegrityVerificationReport } from './audit-crypto.service';
import { AlertService } from './alert.service';
import { ALERT_TYPES, AUDIT_ACTIONS, AUDIT_CONSTANTS, ESCALATION_TIERS } from './audit.constants';

export interface LogEventParams {
  category?: AuditCategory;
  action: string;
  severity?: AuditSeverity;
  userId?: string | null;
  username?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  resource?: string | null;
  httpMethod?: string | null;
  statusCode?: number | null;
  durationMs?: number | null;
  payload?: any;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: AuditCryptoService,
    private readonly alertService: AlertService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Core append-only log writer with cryptographic chaining & encryption (Sections 2.1, 2.2, 2.3)
   */
  async log(params: LogEventParams) {
    const category = params.category || AuditCategory.USER_ACTIVITY;
    const severity = params.severity || AuditSeverity.INFO;

    // 1. Encrypt payload and compute dataHash (Section 2.3: Encrypt stored logs)
    const { encryptedData, dataHash } = params.payload
      ? this.crypto.encryptPayload(params.payload)
      : { encryptedData: null, dataHash: null };

    // 2. Fetch the latest record in the tamper-evident chain to retrieve previousHash
    const latestRecord = await this.prisma.auditLog.findFirst({
      orderBy: { sequenceNumber: 'desc' },
      select: { recordHash: true, sequenceNumber: true },
    });

    const previousHash = latestRecord ? latestRecord.recordHash : AUDIT_CONSTANTS.GENESIS_HASH;
    const nextSequenceNumber = latestRecord ? latestRecord.sequenceNumber + BigInt(1) : BigInt(1);
    const timestamp = new Date();

    // 3. Compute cryptographic recordHash for tamper-evident verification
    const recordHash = this.crypto.computeRecordHash({
      sequenceNumber: nextSequenceNumber,
      timestamp,
      category,
      action: params.action,
      username: params.username,
      ipAddress: params.ipAddress,
      resource: params.resource,
      statusCode: params.statusCode,
      dataHash,
      previousHash,
    });

    // 4. Append to database (ensure userId is a valid UUID to prevent Postgres type syntax errors)
    const isUuid = (val?: string | null): boolean =>
      Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

    const auditRecord = await this.prisma.auditLog.create({
      data: {
        timestamp,
        category,
        action: params.action,
        severity,
        userId: isUuid(params.userId) ? params.userId : null,
        username: params.username || null,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
        resource: params.resource || null,
        httpMethod: params.httpMethod || null,
        statusCode: params.statusCode || null,
        durationMs: params.durationMs || null,
        encryptedData,
        dataHash,
        previousHash,
        recordHash,
      },
    });

    // 5. Centralized SIEM Structured Logging (Section 2.4)
    const siemLog = {
      '@timestamp': timestamp.toISOString(),
      category,
      action: params.action,
      severity,
      user: {
        id: params.userId,
        name: params.username,
      },
      client: {
        ip: params.ipAddress,
        user_agent: params.userAgent,
      },
      http: {
        method: params.httpMethod,
        route: params.resource,
        status_code: params.statusCode,
      },
      duration_ms: params.durationMs,
      integrity: {
        sequence: nextSequenceNumber.toString(),
        hash: recordHash,
      },
    };
    this.logger.log(`[AUDIT_TRAIL] ${JSON.stringify(siemLog)}`);

    // 6. Check for anomaly alerts if action is failure or violation
    if (params.action === AUDIT_ACTIONS.AUTH_LOGIN_FAILURE) {
      void this.alertService.registerFailedLogin({
        ipAddress: params.ipAddress || undefined,
        username: params.username || undefined,
        userId: params.userId || undefined,
      });
    } else if (
      params.action === AUDIT_ACTIONS.AUTHZ_ACCESS_DENIED ||
      params.statusCode === 403 ||
      params.statusCode === 401
    ) {
      void this.alertService.registerAuthFailure(params.ipAddress || undefined, params.resource || undefined);
    }

    return auditRecord;
  }

  /**
   * Log writer that executes inside an existing Prisma transaction.
   * Ensures admin actions, moderation decisions, and audit entries commit or rollback atomically.
   */
  async logInTx(tx: any, params: LogEventParams) {
    const category = params.category || AuditCategory.ADMIN_ACTION;
    const severity = params.severity || AuditSeverity.INFO;

    const { encryptedData, dataHash } = params.payload
      ? this.crypto.encryptPayload(params.payload)
      : { encryptedData: null, dataHash: null };

    const latestRecord = await tx.auditLog.findFirst({
      orderBy: { sequenceNumber: 'desc' },
      select: { recordHash: true, sequenceNumber: true },
    });

    const previousHash = latestRecord ? latestRecord.recordHash : AUDIT_CONSTANTS.GENESIS_HASH;
    const nextSequenceNumber = latestRecord ? latestRecord.sequenceNumber + BigInt(1) : BigInt(1);
    const timestamp = new Date();

    const recordHash = this.crypto.computeRecordHash({
      sequenceNumber: nextSequenceNumber,
      timestamp,
      category,
      action: params.action,
      username: params.username,
      ipAddress: params.ipAddress,
      resource: params.resource,
      statusCode: params.statusCode,
      dataHash,
      previousHash,
    });

    return tx.auditLog.create({
      data: {
        timestamp,
        category,
        action: params.action,
        severity,
        userId: params.userId || null,
        username: params.username || null,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
        resource: params.resource || null,
        httpMethod: params.httpMethod || null,
        statusCode: params.statusCode || null,
        durationMs: params.durationMs || null,
        encryptedData,
        dataHash,
        previousHash,
        recordHash,
      },
    });
  }

  // ===================== HIGH-LEVEL CONVENIENCE LOGGERS (2.1 & 2.2) =====================

  async logUserActivity(action: string, params: Omit<LogEventParams, 'action' | 'category'>) {
    return this.log({ ...params, action, category: AuditCategory.USER_ACTIVITY });
  }

  async logAuthentication(action: string, params: Omit<LogEventParams, 'action' | 'category'>) {
    return this.log({
      ...params,
      action,
      category: AuditCategory.AUTHENTICATION,
      severity: action.includes('FAILURE') ? AuditSeverity.HIGH : AuditSeverity.INFO,
    });
  }

  async logAuthorization(action: string, params: Omit<LogEventParams, 'action' | 'category'>) {
    return this.log({
      ...params,
      action,
      category: AuditCategory.AUTHORIZATION,
      severity: action.includes('DENIED') || action.includes('VIOLATION') ? AuditSeverity.HIGH : AuditSeverity.INFO,
    });
  }

  async logDataChange(action: string, params: Omit<LogEventParams, 'action' | 'category'>) {
    return this.log({ ...params, action, category: AuditCategory.DATA_CHANGE });
  }

  async logSensitiveResource(action: string, params: Omit<LogEventParams, 'action' | 'category'>) {
    return this.log({
      ...params,
      action,
      category: AuditCategory.SENSITIVE_RESOURCE,
      severity: AuditSeverity.MEDIUM,
    });
  }

  async logAdminAction(action: string, params: Omit<LogEventParams, 'action' | 'category'>) {
    return this.log({
      ...params,
      action,
      category: AuditCategory.ADMIN_ACTION,
      severity: AuditSeverity.HIGH,
    });
  }

  async logSystemEvent(
    action: string,
    params: Omit<LogEventParams, 'action' | 'category'> & { severity?: AuditSeverity },
  ) {
    return this.log({
      ...params,
      action,
      category: AuditCategory.SYSTEM_EVENT,
      severity: params.severity || AuditSeverity.INFO,
    });
  }

  // ===================== TAMPER-EVIDENT INTEGRITY VERIFICATION (2.3) =====================

  /**
   * Cryptographically verifies the entire audit log hash chain (Section 2.3: Tamper-evident logging)
   * If any record has been modified, deleted, inserted, or reordered, this method detects it!
   */
  async verifyLogIntegrity(): Promise<IntegrityVerificationReport> {
    const records = await this.prisma.auditLog.findMany({
      orderBy: { sequenceNumber: 'asc' },
    });

    const report: IntegrityVerificationReport = {
      isValid: true,
      totalRecordsVerified: records.length,
      genesisHash: AUDIT_CONSTANTS.GENESIS_HASH,
      chainHeadHash: records.length > 0 ? records[records.length - 1].recordHash : null,
      verifiedAt: new Date().toISOString(),
    };

    if (records.length === 0) {
      return report;
    }

    let expectedPreviousHash: string = AUDIT_CONSTANTS.GENESIS_HASH;

    for (let i = 0; i < records.length; i++) {
      const record = records[i];

      // 1. Verify previous hash chaining
      if (record.previousHash !== expectedPreviousHash) {
        report.isValid = false;
        report.tamperedRecord = {
          sequenceNumber: record.sequenceNumber.toString(),
          id: record.id,
          timestamp: record.timestamp.toISOString(),
          action: record.action,
          expectedHash: expectedPreviousHash,
          actualHash: record.previousHash,
          reason: `Chain broken at sequence ${record.sequenceNumber}: previousHash mismatch. Possible record insertion, deletion, or reordering.`,
        };
        break;
      }

      // 2. Recompute expected recordHash from fields
      const computedHash = this.crypto.computeRecordHash({
        sequenceNumber: record.sequenceNumber,
        timestamp: record.timestamp,
        category: record.category,
        action: record.action,
        username: record.username,
        ipAddress: record.ipAddress,
        resource: record.resource,
        statusCode: record.statusCode,
        dataHash: record.dataHash,
        previousHash: record.previousHash,
      });

      if (computedHash !== record.recordHash) {
        report.isValid = false;
        report.tamperedRecord = {
          sequenceNumber: record.sequenceNumber.toString(),
          id: record.id,
          timestamp: record.timestamp.toISOString(),
          action: record.action,
          expectedHash: computedHash,
          actualHash: record.recordHash,
          reason: `Content tampering detected at sequence ${record.sequenceNumber}: recordHash does not match payload components.`,
        };
        break;
      }

      expectedPreviousHash = record.recordHash;
    }

    // If tampering detected, automatically trigger a CRITICAL Security Alert (Section 2.5)
    if (!report.isValid && report.tamperedRecord) {
      await this.alertService.triggerAlert({
        alertType: ALERT_TYPES.LOG_TAMPERING_DETECTED,
        severity: AuditSeverity.CRITICAL,
        title: 'CRITICAL: Audit Log Tampering Detected!',
        description: report.tamperedRecord.reason,
        escalationTier: ESCALATION_TIERS.TIER_3,
        metadata: report.tamperedRecord,
      });
    }

    return report;
  }

  // ===================== QUERYING & DASHBOARD (2.4) =====================

  async getAuditLogs(query: {
    category?: AuditCategory;
    action?: string;
    severity?: AuditSeverity;
    username?: string;
    ipAddress?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
    decrypt?: boolean;
  }) {
    const where: any = {};
    if (query.category) where.category = query.category;
    if (query.action) where.action = { contains: query.action, mode: 'insensitive' };
    if (query.severity) where.severity = query.severity;
    if (query.username) where.username = { contains: query.username, mode: 'insensitive' };
    if (query.ipAddress) where.ipAddress = query.ipAddress;
    if (query.startDate || query.endDate) {
      where.timestamp = {};
      if (query.startDate) where.timestamp.gte = new Date(query.startDate);
      if (query.endDate) where.timestamp.lte = new Date(query.endDate);
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: query.limit || 50,
        skip: query.offset || 0,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    // Format BigInt sequence numbers and optionally decrypt payloads
    const items = logs.map((log) => {
      const formatted: any = {
        ...log,
        sequenceNumber: log.sequenceNumber.toString(),
      };
      if (query.decrypt && log.encryptedData) {
        formatted.decryptedPayload = this.crypto.decryptPayload(log.encryptedData);
      }
      return formatted;
    });

    return { items, total };
  }

  async getAuditLogById(id: string) {
    const log = await this.prisma.auditLog.findUnique({ where: { id } });
    if (!log) return null;

    return {
      ...log,
      sequenceNumber: log.sequenceNumber.toString(),
      decryptedPayload: this.crypto.decryptPayload(log.encryptedData),
    };
  }

  /**
   * Generates summary metrics, trends, and health statistics for the security dashboard (Section 2.4)
   */
  async getDashboardMetrics() {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalLogs,
      todayLogs,
      failedLogins24h,
      openAlerts,
      criticalAlerts,
      categoryCounts,
      severityCounts,
      recentLogs,
    ] = await Promise.all([
      this.prisma.auditLog.count(),
      this.prisma.auditLog.count({ where: { timestamp: { gte: oneDayAgo } } }),
      this.prisma.auditLog.count({
        where: {
          action: AUDIT_ACTIONS.AUTH_LOGIN_FAILURE,
          timestamp: { gte: oneDayAgo },
        },
      }),
      this.prisma.securityAlert.count({ where: { status: 'OPEN' } }),
      this.prisma.securityAlert.count({
        where: { severity: AuditSeverity.CRITICAL, status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
      }),
      this.prisma.auditLog.groupBy({
        by: ['category'],
        _count: { id: true },
      }),
      this.prisma.auditLog.groupBy({
        by: ['severity'],
        _count: { id: true },
      }),
      this.prisma.auditLog.findMany({
        orderBy: { timestamp: 'desc' },
        take: 10,
        select: {
          id: true,
          timestamp: true,
          category: true,
          action: true,
          severity: true,
          username: true,
          ipAddress: true,
          statusCode: true,
        },
      }),
    ]);

    // Top actions in last 7 days
    const topActions = await this.prisma.auditLog.groupBy({
      by: ['action'],
      where: { timestamp: { gte: sevenDaysAgo } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    // Top active IPs
    const topIps = await this.prisma.auditLog.groupBy({
      by: ['ipAddress'],
      where: { timestamp: { gte: sevenDaysAgo }, ipAddress: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    return {
      summary: {
        totalLogs,
        todayLogs,
        failedLogins24h,
        openAlerts,
        criticalAlerts,
      },
      distributions: {
        byCategory: categoryCounts.map((c) => ({ category: c.category, count: c._count.id })),
        bySeverity: severityCounts.map((s) => ({ severity: s.severity, count: s._count.id })),
      },
      topActions: topActions.map((a) => ({ action: a.action, count: a._count.id })),
      topIps: topIps.map((ip) => ({ ipAddress: ip.ipAddress, count: ip._count.id })),
      recentActivity: recentLogs,
    };
  }

  // ===================== RETENTION POLICY (2.4) =====================

  /**
   * Applies the automated log retention policy (Section 2.4: Log retention policies)
   * Safely purges logs older than retentionDays, while recording cryptographic audit proof.
   */
  async applyRetentionPolicy(retentionDays: number = AUDIT_CONSTANTS.DEFAULT_RETENTION_DAYS, purgedBy?: string) {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const recordsToPurge = await this.prisma.auditLog.findMany({
      where: { timestamp: { lt: cutoffDate } },
      orderBy: { sequenceNumber: 'asc' },
      select: { id: true, timestamp: true, recordHash: true },
    });

    if (recordsToPurge.length === 0) {
      return {
        recordsPurged: 0,
        retentionDays,
        cutoffDate: cutoffDate.toISOString(),
        message: 'No logs older than retention cutoff found.',
      };
    }

    const oldestRecord = recordsToPurge[0];
    const newestRecord = recordsToPurge[recordsToPurge.length - 1];

    // Purge records
    await this.prisma.auditLog.deleteMany({
      where: { timestamp: { lt: cutoffDate } },
    });

    // Record proof-of-retention in AuditPurgeLog
    const purgeRecord = await this.prisma.auditPurgeLog.create({
      data: {
        retentionDays,
        recordsPurged: recordsToPurge.length,
        oldestRecordPurgedAt: oldestRecord.timestamp,
        newestRecordPurgedAt: newestRecord.timestamp,
        genesisRecordHash: newestRecord.recordHash,
        purgedBy: purgedBy || 'automated_retention_policy',
      },
    });

    // Also write an audit log for the retention purge action itself
    await this.logAdminAction(AUDIT_ACTIONS.ADMIN_RETENTION_PURGE, {
      username: purgedBy || 'SYSTEM',
      resource: 'audit_logs/retention',
      payload: {
        retentionDays,
        recordsPurged: recordsToPurge.length,
        purgeRecordId: purgeRecord.id,
      },
    });

    return {
      recordsPurged: recordsToPurge.length,
      retentionDays,
      cutoffDate: cutoffDate.toISOString(),
      purgeRecordId: purgeRecord.id,
    };
  }

  // ===================== SIEM / CENTRALIZED LOG EXPORT (2.4) =====================

  /**
   * Exports logs formatted for SIEM tools (Splunk, Elastic, Datadog, ArcSight CEF) (Section 2.4)
   */
  async exportLogs(format: 'json' | 'cef' = 'json', limit = 100) {
    const logs = await this.prisma.auditLog.findMany({
      orderBy: { sequenceNumber: 'desc' },
      take: limit,
    });

    if (format === 'cef') {
      // ArcSight Common Event Format (CEF)
      return logs.map((log) => {
        return `CEF:0|NewsShare|NewsShareApp|1.0|${log.action}|${log.action}|${log.severity}|src=${log.ipAddress || '0.0.0.0'} suser=${log.username || 'unknown'} request=${log.resource || ''} cs1=${log.recordHash} cs1Label=RecordHash`;
      });
    }

    return logs.map((log) => ({
      ...log,
      sequenceNumber: log.sequenceNumber.toString(),
      decryptedPayload: this.crypto.decryptPayload(log.encryptedData),
    }));
  }
}
