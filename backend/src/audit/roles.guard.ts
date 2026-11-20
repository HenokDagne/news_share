import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from './roles.decorator';
import { AuditService } from './audit.service';
import { AUDIT_ACTIONS } from './audit.constants';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.role) {
      await this.audit.logAuthorization(AUDIT_ACTIONS.AUTHZ_ROLE_VIOLATION, {
        userId: user?.id,
        username: user?.email,
        ipAddress: request.ip,
        resource: request.url,
        httpMethod: request.method,
        statusCode: 403,
        payload: { requiredRoles, userRole: 'NONE' },
      });
      throw new ForbiddenException('Access denied: User does not possess the required role');
    }

    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) {
      await this.audit.logAuthorization(AUDIT_ACTIONS.AUTHZ_ROLE_VIOLATION, {
        userId: user.id,
        username: user.email,
        ipAddress: request.ip,
        resource: request.url,
        httpMethod: request.method,
        statusCode: 403,
        payload: { requiredRoles, userRole: user.role },
      });
      throw new ForbiddenException(
        `Access denied: requires one of [${requiredRoles.join(', ')}], but user has [${user.role}]`,
      );
    }

    return true;
  }
}
