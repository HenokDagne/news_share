import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';
import { AuditService } from './audit.service';
import { AlertService } from './alert.service';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';
import { QueryAlertsDto } from './dto/query-alerts.dto';
import { ResolveAlertDto } from './dto/resolve-alert.dto';
import { RetentionPolicyDto } from './dto/retention-policy.dto';
import { AUDIT_ACTIONS } from './audit.constants';

@ApiTags('Audit Trails and Logging')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.AUDITOR)
@Controller('audit')
export class AuditController {
  constructor(
    private readonly audit: AuditService,
    private readonly alertService: AlertService,
  ) {}

  // ===================== 2.1 & 2.4 AUDIT TRAIL LOGS =====================

  @Get('logs')
  @ApiOperation({ summary: 'List and filter audit trail logs (Admins & Auditors only)' })
  async getAuditLogs(
    @Query() query: QueryAuditLogsDto,
    @CurrentUser('email') actorEmail: string,
  ) {
    // Audit the audit view itself (Section 2.1 & 2.3)
    await this.audit.logAdminAction(AUDIT_ACTIONS.ADMIN_AUDIT_LOG_VIEW, {
      username: actorEmail,
      resource: 'audit/logs',
      payload: { query },
    });

    return this.audit.getAuditLogs(query);
  }

  @Get('logs/:id')
  @ApiOperation({ summary: 'Get single audit log with decrypted payload' })
  async getAuditLogById(
    @Param('id') id: string,
    @CurrentUser('email') actorEmail: string,
  ) {
    const log = await this.audit.getAuditLogById(id);
    if (!log) {
      throw new NotFoundException(`Audit log record ${id} not found`);
    }

    await this.audit.logAdminAction(AUDIT_ACTIONS.ADMIN_AUDIT_LOG_VIEW, {
      username: actorEmail,
      resource: `audit/logs/${id}`,
    });

    return log;
  }

  // ===================== 2.4 MONITORING & DASHBOARD =====================

  @Get('dashboard')
  @ApiOperation({ summary: 'Security monitoring dashboard metrics & trends' })
  async getDashboardMetrics() {
    return this.audit.getDashboardMetrics();
  }

  // ===================== 2.3 LOG INTEGRITY & TAMPER-EVIDENCE =====================

  @Post('integrity/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cryptographically verify audit trail hash chain integrity (tamper detection)',
  })
  async verifyIntegrity(@CurrentUser('email') actorEmail: string) {
    const report = await this.audit.verifyLogIntegrity();

    await this.audit.logAdminAction(AUDIT_ACTIONS.ADMIN_INTEGRITY_VERIFIED, {
      username: actorEmail,
      resource: 'audit/integrity/verify',
      payload: {
        isValid: report.isValid,
        totalRecordsVerified: report.totalRecordsVerified,
      },
    });

    return report;
  }

  // ===================== 2.4 RETENTION POLICIES =====================

  @Post('retention/enforce')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Apply automated log retention policy and safe purge' })
  async enforceRetention(
    @Body() dto: RetentionPolicyDto,
    @CurrentUser('email') actorEmail: string,
  ) {
    return this.audit.applyRetentionPolicy(dto.retentionDays, actorEmail);
  }

  // ===================== 2.4 CENTRALIZED / SIEM EXPORT =====================

  @Get('export')
  @ApiOperation({ summary: 'Export audit logs formatted for SIEM ingestion (JSON or CEF)' })
  async exportLogs(
    @Query('format') format: 'json' | 'cef' = 'json',
    @Query('limit') limit = 100,
    @CurrentUser('email') actorEmail: string,
  ) {
    await this.audit.logAdminAction(AUDIT_ACTIONS.ADMIN_AUDIT_LOG_EXPORT, {
      username: actorEmail,
      resource: 'audit/export',
      payload: { format, limit },
    });

    return this.audit.exportLogs(format, limit);
  }

  // ===================== 2.5 SECURITY ALERTS & ESCALATION =====================

  @Get('alerts')
  @ApiOperation({ summary: 'List security alerts and anomalies' })
  async getAlerts(@Query() query: QueryAlertsDto) {
    return this.alertService.getAlerts(query);
  }

  @Patch('alerts/:id/acknowledge')
  @ApiOperation({ summary: 'Acknowledge an open security alert' })
  async acknowledgeAlert(
    @Param('id') id: string,
    @CurrentUser('email') actorEmail: string,
  ) {
    const updated = await this.alertService.acknowledgeAlert(id, actorEmail);

    await this.audit.logAdminAction(AUDIT_ACTIONS.ADMIN_ALERT_ACKNOWLEDGED, {
      username: actorEmail,
      resource: `audit/alerts/${id}/acknowledge`,
      payload: { alertId: id },
    });

    return updated;
  }

  @Patch('alerts/:id/resolve')
  @ApiOperation({ summary: 'Resolve a security alert with resolution documentation' })
  async resolveAlert(
    @Param('id') id: string,
    @Body() dto: ResolveAlertDto,
    @CurrentUser('email') actorEmail: string,
  ) {
    const updated = await this.alertService.resolveAlert(
      id,
      dto.resolutionNotes,
      actorEmail,
    );

    await this.audit.logAdminAction(AUDIT_ACTIONS.ADMIN_ALERT_RESOLVED, {
      username: actorEmail,
      resource: `audit/alerts/${id}/resolve`,
      payload: { alertId: id, resolutionNotes: dto.resolutionNotes },
    });

    return updated;
  }
}
