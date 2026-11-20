import { Permission, Role } from '@prisma/client';

export const RANK: Record<Role, number> = {
  USER: 0,
  MODERATOR: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
  AUDITOR: 1,
};

/** Only a SUPER_ADMIN may grant or modify these sensitive permissions. */
export const SENSITIVE: Permission[] = ['ADMINS_MANAGE', 'USERS_DELETE', 'AUDIT_EXPORT'];

export const PRESETS: Record<'MODERATOR' | 'ADMIN', Permission[]> = {
  MODERATOR: [
    'DASHBOARD_VIEW',
    'USERS_VIEW',
    'REPORTS_VIEW',
    'REPORTS_MODERATE',
    'POSTS_REMOVE',
    'USERS_MANAGE',
  ],
  ADMIN: [
    'DASHBOARD_VIEW',
    'USERS_VIEW',
    'USERS_MANAGE',
    'USERS_BAN',
    'REPORTS_VIEW',
    'REPORTS_MODERATE',
    'POSTS_REMOVE',
    'AUDIT_VIEW',
  ],
};

export const PERMISSION_LABELS: Record<Permission, string> = {
  DASHBOARD_VIEW: 'View dashboard analytics & metrics',
  USERS_VIEW: 'View users list and profiles',
  USERS_MANAGE: 'Activate, deactivate, or warn users',
  USERS_BAN: 'Suspend or permanently ban users',
  USERS_DELETE: 'Soft-delete user accounts (30-day grace)',
  REPORTS_VIEW: 'View reported cases and queues',
  REPORTS_MODERATE: 'Review, claim, and decide on report cases',
  POSTS_REMOVE: 'Remove or restore reported posts',
  ADMINS_MANAGE: 'Create, update, and manage staff accounts',
  AUDIT_VIEW: 'View security audit logs',
  AUDIT_EXPORT: 'Export audit logs to CSV/JSON',
};

export function hasPermission(
  user: { role: Role; permissions?: Permission[] },
  permission: Permission,
): boolean {
  if (user.role === Role.SUPER_ADMIN) return true;
  return user.permissions?.includes(permission) ?? false;
}
