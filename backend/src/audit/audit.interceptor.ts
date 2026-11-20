import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { AuditService } from './audit.service';
import {
  AUDIT_ACTION_KEY,
  AUDIT_CATEGORY_KEY,
  AUDIT_SEVERITY_KEY,
} from './audit.decorator';
import { AuditCategory, AuditSeverity } from '@prisma/client';
import { AUDIT_ACTIONS } from './audit.constants';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly audit: AuditService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpCtx = context.switchToHttp();
    const req = httpCtx.getRequest<Request>();
    const res = httpCtx.getResponse<Response>();

    const startTime = Date.now();

    // Check for explicit route metadata
    const explicitAction = this.reflector.getAllAndOverride<string>(
      AUDIT_ACTION_KEY,
      [context.getHandler(), context.getClass()],
    );
    const explicitCategory = this.reflector.getAllAndOverride<AuditCategory>(
      AUDIT_CATEGORY_KEY,
      [context.getHandler(), context.getClass()],
    );
    const explicitSeverity = this.reflector.getAllAndOverride<AuditSeverity>(
      AUDIT_SEVERITY_KEY,
      [context.getHandler(), context.getClass()],
    );

    return next.handle().pipe(
      tap({
        next: (responseBody) => {
          this.recordLog(req, res.statusCode, startTime, explicitAction, explicitCategory, explicitSeverity, responseBody);
        },
        error: (err) => {
          const status = err.status || err.statusCode || 500;
          this.recordLog(req, status, startTime, explicitAction, explicitCategory, explicitSeverity, {
            error: err.message,
          });
        },
      }),
    );
  }

  private recordLog(
    req: Request,
    statusCode: number,
    startTime: number,
    explicitAction?: string,
    explicitCategory?: AuditCategory,
    explicitSeverity?: AuditSeverity,
    payload?: any,
  ) {
    const durationMs = Date.now() - startTime;
    const method = req.method;
    const url = req.originalUrl || req.url;

    // Filter out health-checks, static swagger assets, or noisy polling to avoid flooding logs
    if (url.includes('/docs-json') || url.includes('/swagger-ui') || url.endsWith('.ico')) {
      return;
    }

    // Determine actor
    const user = (req as any).user;
    const username = user?.email || user?.username || req.body?.email || req.body?.username || null;
    const userId = user?.id || null;
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.ip;
    const userAgent = req.headers['user-agent'] || null;

    // Determine action and category
    let action = explicitAction;
    let category = explicitCategory || AuditCategory.USER_ACTIVITY;
    let severity = explicitSeverity || AuditSeverity.INFO;

    if (!action) {
      if (url.includes('/auth/login')) {
        action = statusCode < 400 ? AUDIT_ACTIONS.AUTH_LOGIN_SUCCESS : AUDIT_ACTIONS.AUTH_LOGIN_FAILURE;
        category = AuditCategory.AUTHENTICATION;
      } else if (url.includes('/auth/register')) {
        action = AUDIT_ACTIONS.AUTH_REGISTER;
        category = AuditCategory.AUTHENTICATION;
      } else if (url.includes('/auth/logout')) {
        action = AUDIT_ACTIONS.AUTH_LOGOUT;
        category = AuditCategory.AUTHENTICATION;
      } else if (url.includes('/audit')) {
        action = AUDIT_ACTIONS.ADMIN_AUDIT_LOG_VIEW;
        category = AuditCategory.ADMIN_ACTION;
        severity = AuditSeverity.MEDIUM;
      } else if (method === 'POST') {
        action = `HTTP_${method}_${url.split('?')[0].replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`;
        category = AuditCategory.DATA_CHANGE;
      } else if (method === 'DELETE' || method === 'PATCH' || method === 'PUT') {
        action = `HTTP_${method}_${url.split('?')[0].replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`;
        category = AuditCategory.DATA_CHANGE;
        severity = method === 'DELETE' ? AuditSeverity.MEDIUM : AuditSeverity.INFO;
      } else {
        // Read queries: only log sensitive resources or admin actions to avoid bloat
        if (url.includes('/admin') || url.includes('/audit') || url.includes('/users/me')) {
          action = AUDIT_ACTIONS.SENSITIVE_RESOURCE_ACCESS;
          category = AuditCategory.SENSITIVE_RESOURCE;
        } else {
          // Regular GET on public feeds is skipped from heavy DB logging
          return;
        }
      }
    }

    // Capture sanitized payload
    const logPayload: Record<string, any> = {};
    if (req.body && Object.keys(req.body).length > 0) {
      logPayload.requestBody = req.body;
    }
    if (req.query && Object.keys(req.query).length > 0) {
      logPayload.query = req.query;
    }
    if (req.params && Object.keys(req.params).length > 0) {
      logPayload.params = req.params;
    }
    if (payload && statusCode >= 400) {
      logPayload.errorResponse = payload;
    }

    void this.audit.log({
      category,
      action,
      severity,
      userId,
      username,
      ipAddress,
      userAgent,
      resource: `${method} ${url}`,
      httpMethod: method,
      statusCode,
      durationMs,
      payload: Object.keys(logPayload).length > 0 ? logPayload : undefined,
    });
  }
}
