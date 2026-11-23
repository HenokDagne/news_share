import { Permission, Role } from '@prisma/client';

export const RANK: Record<Role, number> = {
  USER: 0,
  MODERATOR: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
  AUDITOR: 1,
};

/** Only a SUPER_ADMIN may grant or modify these sensitive permissions. */
export const SENSITIVE: Permission[] = [
  'ADMINS_MANAGE',
  'USERS_DELETE',
  'AUDIT_EXPORT',
  'BACKUPS_MANAGE',
  'ROLES_MANAGE',
  'ACCESS_REVIEWS_MANAGE',
];

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
    'BACKUPS_VIEW',
    'BACKUPS_CREATE',
    'BACKUPS_RESTORE',
    'ROLES_VIEW',
    'ROLES_MANAGE',
    'ACCESS_REVIEWS_MANAGE',
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
  BACKUPS_VIEW: 'View backup archives and recovery metrics',
  BACKUPS_CREATE: 'Trigger manual full and incremental backups',
  BACKUPS_RESTORE: 'Execute backup restoration verification tests',
  BACKUPS_MANAGE: 'Manage retention locks, legal holds, and secure disposal',
  ROLES_VIEW: 'View user roles and role change requests',
  ROLES_MANAGE: 'Assign, modify, revoke roles and review requests',
  ACCESS_REVIEWS_MANAGE: 'Conduct and record quarterly periodic access reviews',
};

export function hasPermission(
  user: { role: Role; permissions?: Permission[] },
  permission: Permission,
): boolean {
  if (user.role === Role.SUPER_ADMIN) return true;
  return user.permissions?.includes(permission) ?? false;
}
