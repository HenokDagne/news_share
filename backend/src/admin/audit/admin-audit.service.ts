import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditCategory, AuditSeverity, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { AuditCryptoService } from '../../audit/audit-crypto.service';
import { AuthUser } from '../../permissions/permissions.guard';

function sanitizeCsvCell(v: unknown): string {
  let s = v == null ? '' : String(v);
  // Formula injection neutralization (Excel, LibreOffice, Google Sheets)
  if (/^[=+\-@\t\r]/.test(s)) {
    s = `'${s}`;
  }
  return `"${s.replace(/"/g, '""')}"`;
}

@Injectable()
export class AdminAuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly crypto: AuditCryptoService,
  ) {}

  async getAuditLogs(
    actor: AuthUser,
    params: {
      category?: AuditCategory;
      severity?: AuditSeverity;
      action?: string;
      userId?: string;
      q?: string;
      from?: Date;
      to?: Date;
      page?: number;
      pageSize?: number;
    },
  ) {
    const page = Math.max(params.page || 1, 1);
    const pageSize = Math.min(Math.max(params.pageSize || 20, 1), 100);
    const skip = (page - 1) * pageSize;

    const where: Prisma.AuditLogWhereInput = {
      ...(params.category ? { category: params.category } : {}),
      ...(params.severity ? { severity: params.severity } : {}),
      ...(params.action ? { action: params.action } : {}),
      ...(params.userId ? { userId: params.userId } : {}),
      ...(params.from || params.to
        ? {
            timestamp: {
              ...(params.from ? { gte: params.from } : {}),
              ...(params.to ? { lte: params.to } : {}),
            },
          }
        : {}),
      ...(params.q
        ? {
            OR: [
              { action: { contains: params.q, mode: 'insensitive' } },
              { username: { contains: params.q, mode: 'insensitive' } },
              { resource: { contains: params.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, records] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { sequenceNumber: 'desc' },
      }),
    ]);

    // Record view in audit trail
    await this.audit.log({
      category: 'ADMIN_ACTION',
      action: 'AUDIT_VIEWED',
      userId: actor.id,
      resource: 'audit_logs',
      payload: { page, pageSize, filterCount: total },
    });

    const items = records.map((r) => ({
      id: r.id,
      sequenceNumber: r.sequenceNumber.toString(),
      timestamp: r.timestamp,
      category: r.category,
      action: r.action,
      severity: r.severity,
      userId: r.userId,
      username: r.username,
      ipAddress: r.ipAddress,
      resource: r.resource,
      httpMethod: r.httpMethod,
      statusCode: r.statusCode,
      recordHash: r.recordHash,
    }));

    return {
      items,
      data: items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getAuditLog(id: string) {
    const record = await this.prisma.auditLog.findUnique({ where: { id } });
    if (!record) throw new NotFoundException('Audit log not found');

    let decryptedPayload: any = null;
    if (record.encryptedData) {
      try {
        decryptedPayload = this.crypto.decryptPayload(record.encryptedData);
      } catch {
        decryptedPayload = '[Decryption failed: Key mismatch or invalid payload]';
      }
    }

    return {
      ...record,
      sequenceNumber: record.sequenceNumber.toString(),
      decryptedPayload,
    };
  }

  async exportAuditLogs(
    actor: AuthUser,
    params: {
      category?: AuditCategory;
      severity?: AuditSeverity;
      action?: string;
      from?: Date;
      to?: Date;
      format?: 'csv' | 'json';
    },
  ) {
    const where: Prisma.AuditLogWhereInput = {
      ...(params.category ? { category: params.category } : {}),
      ...(params.severity ? { severity: params.severity } : {}),
      ...(params.action ? { action: params.action } : {}),
      ...(params.from || params.to
        ? {
            timestamp: {
              ...(params.from ? { gte: params.from } : {}),
              ...(params.to ? { lte: params.to } : {}),
            },
          }
        : {}),
    };

    const records = await this.prisma.auditLog.findMany({
      where,
      orderBy: { sequenceNumber: 'asc' },
      take: 100_000, // Capped at 100k
    });

    await this.audit.log({
      category: 'ADMIN_ACTION',
      action: 'AUDIT_EXPORTED',
      userId: actor.id,
      resource: 'audit_logs',
      payload: {
        format: params.format || 'csv',
        recordCount: records.length,
        filters: params,
      },
    });

    if (params.format === 'json') {
      return JSON.stringify(
        records.map((r) => ({
          ...r,
          sequenceNumber: r.sequenceNumber.toString(),
        })),
        null,
        2,
      );
    }

    // CSV format
    const headers = [
      'Sequence',
      'Timestamp',
      'Category',
      'Action',
      'Severity',
      'Username',
      'IP Address',
      'Resource',
      'Status Code',
      'Record Hash',
    ];

    const rows = records.map((r) => [
      sanitizeCsvCell(r.sequenceNumber.toString()),
      sanitizeCsvCell(r.timestamp.toISOString()),
      sanitizeCsvCell(r.category),
      sanitizeCsvCell(r.action),
      sanitizeCsvCell(r.severity),
      sanitizeCsvCell(r.username || ''),
      sanitizeCsvCell(r.ipAddress || ''),
      sanitizeCsvCell(r.resource || ''),
      sanitizeCsvCell(r.statusCode || ''),
      sanitizeCsvCell(r.recordHash),
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }

  async verifyChain() {
    return this.audit.verifyLogIntegrity();
  }
}
