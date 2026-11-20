import {
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AuditCategory, AuditSeverity } from '@prisma/client';
import { AdminAuditService } from './admin-audit.service';
import { RequirePermissions } from '../../permissions/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../permissions/permissions.guard';

@ApiTags('Admin Audit Logs')
@ApiBearerAuth('JWT')
@Controller('admin/audit-logs')
export class AdminAuditController {
  constructor(private readonly auditService: AdminAuditService) {}

  @Get()
  @RequirePermissions('AUDIT_VIEW')
  @ApiOperation({ summary: 'Search and filter tamper-evident audit logs' })
  @ApiQuery({ name: 'category', required: false, enum: AuditCategory })
  @ApiQuery({ name: 'severity', required: false, enum: AuditSeverity })
  @ApiQuery({ name: 'action', required: false, type: String })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'q', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Paginated audit logs' })
  getAuditLogs(
    @CurrentUser() actor: AuthUser,
    @Query('category') category?: AuditCategory,
    @Query('severity') severity?: AuditSeverity,
    @Query('action') action?: string,
    @Query('userId') userId?: string,
    @Query('q') q?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.auditService.getAuditLogs(actor, {
      category,
      severity,
      action,
      userId,
      q,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }

  @Get('export')
  @RequirePermissions('AUDIT_EXPORT')
  @ApiOperation({ summary: 'Export sanitized audit records to CSV or JSON with formula protection' })
  @ApiQuery({ name: 'format', required: false, enum: ['csv', 'json'] })
  async exportAuditLogs(
    @CurrentUser() actor: AuthUser,
    @Res() res: Response,
    @Query('format') format: 'csv' | 'json' = 'csv',
    @Query('category') category?: AuditCategory,
    @Query('severity') severity?: AuditSeverity,
    @Query('action') action?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const data = await this.auditService.exportAuditLogs(actor, {
      category,
      severity,
      action,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      format,
    });

    const filename = `audit-export-${new Date().toISOString().split('T')[0]}.${format}`;

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(data);
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(data);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('AUDIT_VIEW')
  @ApiOperation({ summary: 'Verify HMAC cryptographic hash chain integrity' })
  @ApiResponse({ status: 200, description: 'Integrity verification result' })
  verifyChain() {
    return this.auditService.verifyChain();
  }

  @Get(':id')
  @RequirePermissions('AUDIT_VIEW')
  @ApiOperation({ summary: 'Get single audit log entry with decrypted data payload' })
  @ApiResponse({ status: 200, description: 'Audit log detail' })
  getAuditLog(@Param('id', ParseUUIDPipe) id: string) {
    return this.auditService.getAuditLog(id);
  }
}
