import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { AuditSeverity, Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { AuditService } from '../../audit/audit.service';
import { AUDIT_ACTIONS } from '../../audit/audit.constants';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly audit?: AuditService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = 'Internal Server Error';
    let message: string | string[] = 'An unexpected error occurred';
    let extra: Record<string, any> = {};

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
        error = exception.name.replace('Exception', '');
      } else if (typeof res === 'object' && res !== null) {
        const obj = res as Record<string, any>;
        message = obj.message || exception.message;
        error = obj.error || exception.name.replace('Exception', '');
        if (obj.code) extra.code = obj.code;
        if (obj.restriction) extra.restriction = obj.restriction;
        if (obj.lockout) extra.lockout = obj.lockout;
      }
    } else if (
      exception instanceof Prisma.PrismaClientKnownRequestError ||
      exception instanceof Prisma.PrismaClientUnknownRequestError ||
      exception instanceof Prisma.PrismaClientRustPanicError ||
      exception instanceof Prisma.PrismaClientInitializationError ||
      exception instanceof Prisma.PrismaClientValidationError
    ) {
      if (exception instanceof Prisma.PrismaClientKnownRequestError) {
        if (exception.code === 'P2002') {
          statusCode = HttpStatus.CONFLICT;
          error = 'Conflict';
          const target = (exception.meta?.target as string[]) || [];
          message = `Unique constraint failed on field(s): ${target.join(', ')}`;
        } else if (exception.code === 'P2025') {
          statusCode = HttpStatus.NOT_FOUND;
          error = 'Not Found';
          message = 'Requested record was not found.';
        } else {
          statusCode = HttpStatus.BAD_REQUEST;
          error = 'Bad Request';
          message = 'Invalid database request parameters.';
        }
      } else {
        statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
        error = 'Internal Server Error';
        message = 'An unexpected internal server error occurred. Please try again later.';
      }

      this.logger.error(
        `Prisma database error on ${request.method} ${request.url}: ${(exception as Error)?.message}`,
        (exception as Error)?.stack,
      );
    } else {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      error = 'Internal Server Error';
      message = 'An unexpected internal server error occurred. Please try again later.';

      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}: ${(exception as Error)?.message}`,
        (exception as Error)?.stack,
      );
    }

    // Section 4.2: Ensure generic error messages on 500s; never expose internal paths, db errors, or stack traces
    if (statusCode >= 500) {
      error = 'Internal Server Error';
      message = 'An unexpected internal server error occurred. Please try again later.';
    }

    // Sanitize any remaining user-facing text to purge internal file paths or stack traces
    if (typeof message === 'string') {
      message = message.replace(/[A-Za-z]:\\[^ \n\r\t]+/g, '[REDACTED_PATH]');
      message = message.replace(/\/(?:[a-zA-Z0-9_.-]+\/)+[a-zA-Z0-9_.-]+/g, '[REDACTED_PATH]');
    }

    // Section 2.2: Log critical system events: SERVICE_FAILURE on 500 errors
    if (statusCode >= 500 && this.audit) {
      void this.audit.logSystemEvent(AUDIT_ACTIONS.SERVICE_FAILURE, {
        username: (request as any).user?.email || (request as any).user?.username || 'SYSTEM',
        ipAddress:
          (request.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || request.ip,
        resource: `${request.method} ${request.url}`,
        httpMethod: request.method,
        statusCode,
        severity: AuditSeverity.HIGH,
        payload: {
          error,
          message,
          stack: (exception as Error)?.stack,
        },
      });
    }

    response.status(statusCode).json({
      statusCode,
      error,
      message,
      ...extra,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
