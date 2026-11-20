import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AlertStatus, AuditSeverity } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { ALERT_TYPES, AUDIT_CONSTANTS, ESCALATION_TIERS } from './audit.constants';

interface FailureRecord {
  timestamp: number;
  ipAddress?: string;
  username?: string;
}

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);

  // Sliding window memory trackers for rapid anomaly detection
  private failedLoginsByIp = new Map<string, FailureRecord[]>();
  private failedLoginsByUser = new Map<string, FailureRecord[]>();
  private unauthorizedSpikesByIp = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  /**
   * Tracks a failed login attempt and detects brute-force anomalies (Section 2.5)
   */
  async registerFailedLogin(params: {
    ipAddress?: string;
    username?: string;
    userId?: string;
  }) {
    const now = Date.now();
    const windowMs = AUDIT_CONSTANTS.BRUTE_FORCE_WINDOW_MS;
    const threshold = AUDIT_CONSTANTS.BRUTE_FORCE_THRESHOLD;

    // 1. IP-based sliding window
    if (params.ipAddress) {
      const records = this.failedLoginsByIp.get(params.ipAddress) || [];
      const valid = records.filter((r) => now - r.timestamp <= windowMs);
      valid.push({ timestamp: now, ipAddress: params.ipAddress, username: params.username });
      this.failedLoginsByIp.set(params.ipAddress, valid);

      if (valid.length >= threshold) {
        await this.triggerAlert({
          alertType: ALERT_TYPES.BRUTE_FORCE_ATTACK,
          severity: AuditSeverity.HIGH,
          title: `Brute Force Attack Detected from IP ${params.ipAddress}`,
          description: `Detected ${valid.length} failed login attempts within 5 minutes from IP address: ${params.ipAddress}.`,
          ipAddress: params.ipAddress,
          userId: params.userId,
          username: params.username,
          escalationTier: ESCALATION_TIERS.TIER_3,
          metadata: {
            attemptCount: valid.length,
            timeWindowMinutes: 5,
            targetUsername: params.username,
          },
        });
      }
    }

    // 2. Username/Email-based sliding window
    if (params.username) {
      const records = this.failedLoginsByUser.get(params.username) || [];
      const valid = records.filter((r) => now - r.timestamp <= windowMs);
      valid.push({ timestamp: now, ipAddress: params.ipAddress, username: params.username });
      this.failedLoginsByUser.set(params.username, valid);

      if (valid.length >= threshold) {
        await this.triggerAlert({
          alertType: ALERT_TYPES.BRUTE_FORCE_ATTACK,
          severity: AuditSeverity.HIGH,
          title: `Brute Force Attack Targeted at User ${params.username}`,
          description: `Detected ${valid.length} failed login attempts within 5 minutes targeting account: ${params.username}.`,
          ipAddress: params.ipAddress,
          userId: params.userId,
          username: params.username,
          escalationTier: ESCALATION_TIERS.TIER_3,
          metadata: {
            attemptCount: valid.length,
            timeWindowMinutes: 5,
            ipAddress: params.ipAddress,
          },
        });
      }
    }
  }

  /**
   * Tracks authorization failures (401 / 403) to detect scanning or enumeration anomalies
   */
  async registerAuthFailure(ipAddress?: string, resource?: string) {
    if (!ipAddress) return;
    const now = Date.now();
    const windowMs = AUDIT_CONSTANTS.ANOMALOUS_ACCESS_WINDOW_MS;
    const threshold = AUDIT_CONSTANTS.ANOMALOUS_ACCESS_THRESHOLD;

    const timestamps = this.unauthorizedSpikesByIp.get(ipAddress) || [];
    const valid = timestamps.filter((t) => now - t <= windowMs);
    valid.push(now);
    this.unauthorizedSpikesByIp.set(ipAddress, valid);

    if (valid.length >= threshold) {
      await this.triggerAlert({
        alertType: ALERT_TYPES.UNUSUAL_ACCESS_SPIKE,
        severity: AuditSeverity.MEDIUM,
        title: `Unusual Authorization Failure Spike from IP ${ipAddress}`,
        description: `IP ${ipAddress} triggered ${valid.length} access-denied responses within 1 minute. Possible probe or directory traversal attack.`,
        ipAddress,
        escalationTier: ESCALATION_TIERS.TIER_2,
        metadata: {
          failureCount: valid.length,
          lastResource: resource,
        },
      });
    }
  }

  /**
   * Triggers a security alert and routes according to escalation tier (Section 2.5)
   */
  async triggerAlert(params: {
    alertType: string;
    severity: AuditSeverity;
    title: string;
    description: string;
    ipAddress?: string;
    userId?: string;
    username?: string;
    escalationTier?: string;
    metadata?: Record<string, any>;
  }) {
    const tier = params.escalationTier || ESCALATION_TIERS.TIER_1;
    const securityEmail =
      this.config.get<string>('SECURITY_ALERT_EMAIL') ||
      this.config.get<string>('MAIL_FROM') ||
      'security-alerts@news-share.com';

    this.logger.warn(`[SECURITY ALERT] [${params.severity}] ${params.title} - ${params.description}`);

    // Create persistent SecurityAlert record in DB
    const alert = await this.prisma.securityAlert.create({
      data: {
        alertType: params.alertType,
        severity: params.severity,
        status: AlertStatus.OPEN,
        title: params.title,
        description: params.description,
        ipAddress: params.ipAddress || null,
        userId: params.userId || null,
        username: params.username || null,
        metadata: params.metadata || {},
        escalationTier: tier,
        routedTo: securityEmail,
        notificationSent: false,
      },
    });

    // Escalation routing (Section 2.5)
    if (tier === ESCALATION_TIERS.TIER_3 || params.severity === AuditSeverity.CRITICAL) {
      // Send urgent alert email
      try {
        await this.mail.sendSecurityNotice(
          securityEmail,
          `CRITICAL SECURITY ALERT: ${params.title}\n\nDetails: ${params.description}\nSeverity: ${params.severity}\nIP: ${params.ipAddress || 'N/A'}\nUser: ${params.username || 'N/A'}\nTime: ${new Date().toISOString()}`,
        );

        await this.prisma.securityAlert.update({
          where: { id: alert.id },
          data: { notificationSent: true },
        });
      } catch (err: any) {
        this.logger.error(`Failed to send alert email: ${err.message}`);
      }
    }

    return alert;
  }

  /**
   * Retrieves security alerts with status/severity filters
   */
  async getAlerts(query: {
    status?: AlertStatus;
    severity?: AuditSeverity;
    alertType?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.severity) where.severity = query.severity;
    if (query.alertType) where.alertType = query.alertType;

    const [items, total] = await Promise.all([
      this.prisma.securityAlert.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: query.limit || 50,
        skip: query.offset || 0,
      }),
      this.prisma.securityAlert.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * Acknowledges an open alert
   */
  async acknowledgeAlert(id: string, actorUsername?: string) {
    return this.prisma.securityAlert.update({
      where: { id },
      data: {
        status: AlertStatus.ACKNOWLEDGED,
        resolvedBy: actorUsername || 'admin',
      },
    });
  }

  /**
   * Resolves a security alert with resolution notes (Section 2.5: Escalation procedures)
   */
  async resolveAlert(id: string, resolutionNotes: string, resolvedBy: string) {
    return this.prisma.securityAlert.update({
      where: { id },
      data: {
        status: AlertStatus.RESOLVED,
        resolvedAt: new Date(),
        resolvedBy,
        resolutionNotes,
      },
    });
  }
}
