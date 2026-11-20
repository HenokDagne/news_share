import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission, Role } from '@prisma/client';
import { PERMISSIONS_KEY } from './require-permissions.decorator';
import { hasPermission } from './permissions.catalog';

export interface AuthUser {
  id: string;
  role: Role;
  sid?: string;
  permissions: Permission[];
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: AuthUser | undefined = request.user;

    if (!user || user.role === Role.USER) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Insufficient administrative permissions',
      });
    }

    if (!required.every((p) => hasPermission(user, p))) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        message: `Missing required permission: ${required.filter((p) => !hasPermission(user, p)).join(', ')}`,
      });
    }

    return true;
  }
}
