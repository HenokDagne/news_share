import { SetMetadata } from '@nestjs/common';
import { AuditCategory, AuditSeverity } from '@prisma/client';

export const AUDIT_ACTION_KEY = 'audit_action';
export const AUDIT_CATEGORY_KEY = 'audit_category';
export const AUDIT_SEVERITY_KEY = 'audit_severity';

export const AuditLogAction = (
  action: string,
  category: AuditCategory = AuditCategory.USER_ACTIVITY,
  severity: AuditSeverity = AuditSeverity.INFO,
) => {
  return (target: any, key?: string | symbol, descriptor?: TypedPropertyDescriptor<any>) => {
    SetMetadata(AUDIT_ACTION_KEY, action)(target, key!, descriptor!);
    SetMetadata(AUDIT_CATEGORY_KEY, category)(target, key!, descriptor!);
    SetMetadata(AUDIT_SEVERITY_KEY, severity)(target, key!, descriptor!);
  };
};
