# News Share: Applying the Security Features Specification (Project One) and How to Test It

Source: `Project_I.docx`, Addis Ababa Science and Technology University, Department of Software Engineering, *Computer System Security*, "Project Features I: Security Features Specification" (submission date in the document: December 7, 2026).

This guide takes every requirement in that specification and shows:

1. what the News Share backend already has,
2. what to add (with NestJS + Prisma code),
3. how to test each control, and what evidence to keep for your report.

It builds on `news_share_implementation_steps.md`, `news_share_database_design.md`, `news_share_api_design.md` and `news_share_srs.md`.

> Notes on the specification itself
> - The document numbers its sections 1 to 6 and then 8 (there is no section 7). Ask your instructor whether a section was left out.
> - It lists no title for the project, so the assignment is to apply these controls to a system of your own. News Share is the system used here.
> - Several controls are organizational (training, SIEM operations, penetration testing, policies). For those, code is only part of the answer: you build a small lab setup and produce documents. This guide gives both.

---

## 1. Gap analysis: specification vs. current News Share design

Status: **Done** = already in the current design, **Partial** = exists but needs changes, **Missing** = new work.

| Spec ref | Requirement | Current status | What to do |
|---|---|---|---|
| 1.1 | RBAC with least privilege | Missing (all users equal) | Roles USER / MODERATOR / ADMIN, guards, permission matrix |
| 1.1 | Role assign / modify / revoke, approval workflow | Missing | Role change requests with approval |
| 1.1 | Separation of duties | Missing | Requester cannot approve; target cannot approve own elevation |
| 1.1 | Audit trail for role changes | Missing | Audit log (section 4, S3) |
| 1.1 | Periodic access review | Missing | Access review endpoint and script |
| 1.2 | Minimal registration data | Done | Email, password, username only (`fullName` stays optional) |
| 1.2 | Email verification before activation | Missing | Verification token by email |
| 1.2 | CAPTCHA | Missing | reCAPTCHA v3 verification (provider-pluggable) |
| 1.2 | Secure profile update | Done | Owner-only `PATCH /me` |
| 1.2 | Biometric with fallback | Missing | Device-level unlock in Flutter (`local_auth`) with password fallback |
| 1.2 | Secure account recovery | Missing | Forgot / reset with single-use tokens, MFA step-up |
| 1.3 | 12+ char policy, breached-password check | Partial (8 chars) | Policy service plus Have I Been Pwned range check |
| 1.3 | Argon2id hashing | Done | Keep |
| 1.3 | Lockout after 5 failures | Missing | Counters, 15 min lock, unlock by time or reset |
| 1.3 | TLS for auth traffic | Missing | Reverse proxy with TLS 1.2+, HSTS |
| 1.3 | Password change/reset | Missing | `POST /me/password`, reset flow |
| 1.3 | Rate limiting on login/reset | Partial (login, register) | Add reset, verify, MFA endpoints |
| 1.4 | JWT + refresh rotation | Partial | Add sessions, reuse detection |
| 1.4 | Secure token storage | n/a server-side | Flutter secure storage; cookies only if a web client is added |
| 1.4 | Short expiry (10 min), revocation, logout | Partial | `Session` table; access tokens checked against it |
| 1.4 | Session and idle timeout | Missing | Idle 30 min, absolute 30 days |
| 1.4 | Session fixation, CSRF | Partial | New session per login; CSRF applies only to cookie auth |
| 1.5 | MFA (TOTP), enrollment, backup codes, recovery | Missing | TOTP service with encrypted secret |
| 2.1 | User activity logging | Missing | `AuditLog` plus interceptor |
| 2.2 | System event logging | Missing | Startup/shutdown/config/failure events |
| 2.3 | Encrypted, tamper-evident, access-restricted logs | Missing | AES-GCM details, HMAC hash chain, append-only trigger, admin-only API |
| 2.4 | Centralized logging, retention, dashboards | Missing | JSON logs to Loki/Grafana (lab SIEM), retention job |
| 2.5 | Alerting and escalation | Missing | Alert rules, webhook, escalation table |
| 3 | Backups (full/incremental, encrypted, 3-2-1, immutable, restore tests) | Missing (only a `pg_dump` mention) | Scripts, encryption, offsite object-lock copy, restore drill |
| 4.1 | Server-side validation, parameterized queries, output encoding, upload allow-lists | Partial | Add magic-byte check, image re-encoding, body limits; Prisma is parameterized |
| 4.2 | Generic errors | Partial | Verify no leaks; log details internally |
| 4.3 | Security headers | Partial (helmet default) | Configure HSTS, CSP, nosniff, frame, referrer |
| 4.4 | Encryption at rest/in transit, classification, masking, retention | Missing | Field encryption, classification table, masking script, retention jobs |
| 4.5 | API security, rate/size limits, mTLS, restricted endpoints | Partial | Size limits, route coverage test, Swagger off in prod, DB TLS |
| 5.1 | Secure coding, reviews, no hard-coded secrets | Partial | Lint rules, PR checklist, secret scanning |
| 5.2 | SAST, DAST, dependency scan, pen test, CI | Missing | Semgrep, ZAP, npm audit, gitleaks, Trivy in CI |
| 5.3 | Staging, version control, rollback | Missing | Staging compose, pre-deploy backup, rollback runbook |
| 6.1 | Incident response plan | Missing | Plan document and runbooks |
| 6.2 | BC/DR, RPO/RTO | Missing | Targets, DR drill |
| 6.3 | Security awareness | Missing | Training outline, phishing simulation, in-app prompts |
| 8 | Compliance and governance | Missing | Policies, risk register, change management, legal mapping |

---

## 2. Target security architecture

```
Flutter app ──HTTPS (TLS 1.2+)──▶ Reverse proxy (TLS, HSTS) ──▶ NestJS API ──▶ PostgreSQL (TLS, encrypted volume)
   │  secure storage (Keychain/Keystore)                         │  │  │
   │  optional biometric unlock                                  │  │  └─▶ Cloudinary (images)
   ▼                                                             │  └────▶ SMTP (verification / alerts)
 CAPTCHA token ────────────────────────────────────────────────▶ │
                                                                 ├─ Guards: JWT + session check, Roles, Throttler
                                                                 ├─ AuditService (HMAC hash chain, encrypted details)
                                                                 ├─ AlertService ──▶ webhook / email
                                                                 └─ JSON logs ──▶ Loki ──▶ Grafana (dashboards)

 Backups: pg_dump / WAL ──▶ age encryption ──▶ local disk ──▶ offsite object-lock bucket
 CI: lint → tests → Semgrep → gitleaks → npm audit → Trivy → ZAP baseline
```

### Login with MFA

```mermaid
sequenceDiagram
    participant C as Client
    participant A as API
    participant D as Database
    C->>A: POST /auth/login {email, password}
    A->>D: load user, check lock
    alt wrong password
        A->>D: failed_login_count + 1 (lock at 5)
        A-->>C: 401 Invalid credentials
    else password ok, MFA enabled
        A-->>C: 200 {mfaRequired: true, mfaToken (5 min)}
        C->>A: POST /auth/mfa/verify {mfaToken, code}
        A->>D: verify TOTP, create session
        A-->>C: 200 {accessToken, refreshToken}
    else password ok, no MFA
        A->>D: create session
        A-->>C: 200 {accessToken, refreshToken}
    end
```

### Role change workflow (separation of duties)

```mermaid
stateDiagram-v2
    [*] --> PENDING: request created by A (admin) or by the user for MODERATOR
    PENDING --> APPROVED: ADMIN B approves (B is not the requester and not the target)
    PENDING --> REJECTED: ADMIN B rejects
    PENDING --> CANCELLED: requester cancels
    APPROVED --> [*]: role changed, target sessions revoked, audit + alert
    REJECTED --> [*]
    CANCELLED --> [*]
```

### Fixed decisions for this security layer

| Topic | Decision |
|---|---|
| Roles | `USER`, `MODERATOR`, `ADMIN` |
| Password policy | 12 to 128 characters, at least 3 of 4 character classes, not containing the username or email name, not in the Have I Been Pwned breach list |
| Lockout | 5 consecutive failures, 15 minute lock, generic error; unlocks by time, password reset, or admin |
| Access token | 10 minutes, includes session id; checked against the session table on every request |
| Session | Idle timeout 30 minutes, absolute lifetime 30 days |
| Refresh token | Rotating; reuse of an already used token revokes the whole session |
| MFA | TOTP (RFC 6238, 30 s step), encrypted secret, 10 single-use backup codes |
| Email verification | Required before the first login; token valid 24 hours |
| Audit log | Append-only table, HMAC-SHA256 hash chain, AES-256-GCM encrypted details |
| Alerts | Rules in `AlertService`; webhook + email by severity |
| Secrets/encryption keys | Environment variables; 32-byte keys for data encryption and audit HMAC |

### API changes caused by the security layer

| Endpoint | Change |
|---|---|
| `POST /auth/register` | Needs `captchaToken` and `acceptTerms: true`. Returns `201 {message}` and **no tokens**. A duplicate email returns the same response (the owner gets an email), a duplicate username still returns `409`. |
| `POST /auth/verify-email` | New. `{token}` activates the account. |
| `POST /auth/resend-verification` | New. `{email}`, always `202`. |
| `POST /auth/login` | May return `{mfaRequired, mfaToken}`; returns `403` for an unverified email (after a correct password). |
| `POST /auth/mfa/verify` | New. |
| `POST /auth/refresh` | Reuse detection; idle timeout enforced. |
| `POST /auth/logout`, `/auth/logout-all` | Revoke the session / all sessions. |
| `POST /auth/forgot-password`, `/auth/reset-password` | New. Always `202` on forgot. |
| `POST /me/password` | New. Change password (MFA step-up if enabled). |
| `GET/DELETE /me/sessions` | New. List and revoke sessions. |
| `POST /me/mfa/setup`, `/enable`, `/disable`, `/backup-codes` | New. |
| `GET /me/export`, `DELETE /me` | New. Data export and account deletion. |
| `POST/GET /role-requests`, `POST /role-requests/:id/approve|reject` | New. |
| `GET /admin/users`, `POST /admin/users/:id/lock|unlock|revoke-sessions` | New (ADMIN). |
| `GET /admin/audit-logs`, `POST /admin/audit-logs/verify` | New (ADMIN). |
| `GET/POST /admin/access-review` | New (ADMIN). |
| `DELETE /moderation/posts/:id` | New (MODERATOR, ADMIN). |
| `GET /health` | New, public, no sensitive data. |

---

## 3. Setup

### 3.1 Dependencies

```bash
npm i nestjs-pino pino-http nodemailer otplib@12 qrcode sharp \
      @nestjs/schedule @nestjs/terminus
npm i -D pino-pretty @types/nodemailer @types/qrcode eslint-plugin-security
```

`otplib@12` is pinned because its `authenticator` API changed in later major versions.

### 3.2 Environment additions

```env
# encryption and integrity (generate each with: openssl rand -base64 32)
DATA_ENC_KEY=
AUDIT_HMAC_KEY=

# sessions and tokens
JWT_ACCESS_TTL_SECONDS=600
SESSION_IDLE_MINUTES=30
SESSION_ABSOLUTE_DAYS=30

# lockout
MAX_FAILED_LOGINS=5
LOCKOUT_MINUTES=15

# captcha (disable only in local development)
CAPTCHA_ENABLED=true
RECAPTCHA_SECRET=
RECAPTCHA_MIN_SCORE=0.5

# passwords
HIBP_ENABLED=true

# mail (Mailpit in development)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
MAIL_FROM="News Share <no-reply@newsshare.local>"
APP_BASE_URL=http://localhost:3000

# alerts
ALERT_WEBHOOK_URL=
SECURITY_EMAIL=security@newsshare.local

# behind a reverse proxy
TRUST_PROXY=1
```

Add `DATA_ENC_KEY` and `AUDIT_HMAC_KEY` to `REQUIRED` in `src/config/env.validation.ts`, and check they decode to 32 bytes:

```ts
for (const k of ['DATA_ENC_KEY', 'AUDIT_HMAC_KEY']) {
  if (Buffer.from(String(config[k] ?? ''), 'base64').length !== 32) {
    throw new Error(`${k} must be 32 random bytes, base64 encoded`);
  }
}
```

### 3.3 Docker Compose additions (development)

```yaml
services:
  mailpit:                       # captures outgoing email; UI at http://localhost:8025
    image: axllent/mailpit
    ports: ["1025:1025", "8025:8025"]
```

---

## 4. Implementation steps

Do the steps in order. Each ends with a **Verify** line.

### S1. Database schema changes (spec 1.1 to 1.5, 2.x)

Edit `prisma/schema.prisma`. Replace the `User` and `RefreshToken` models and add the rest.

```prisma
enum Role              { USER MODERATOR ADMIN }
enum RoleRequestStatus { PENDING APPROVED REJECTED CANCELLED }
enum TokenType         { EMAIL_VERIFY PASSWORD_RESET }

model User {
  id                String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  email             String    @unique
  passwordHash      String    @map("password_hash")
  role              Role      @default(USER)
  roleAssignedAt    DateTime? @map("role_assigned_at") @db.Timestamptz(6)
  emailVerifiedAt   DateTime? @map("email_verified_at") @db.Timestamptz(6)
  failedLoginCount  Int       @default(0) @map("failed_login_count")
  lockedUntil       DateTime? @map("locked_until") @db.Timestamptz(6)
  lastLoginAt       DateTime? @map("last_login_at") @db.Timestamptz(6)
  passwordChangedAt DateTime? @map("password_changed_at") @db.Timestamptz(6)
  mfaEnabled        Boolean   @default(false) @map("mfa_enabled")
  mfaSecretEnc      String?   @map("mfa_secret_enc")
  mfaLastStep       Int?      @map("mfa_last_step")
  consentAt         DateTime? @map("consent_at") @db.Timestamptz(6)
  consentVersion    String?   @map("consent_version")
  createdAt         DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt         DateTime  @updatedAt @map("updated_at") @db.Timestamptz(6)

  profile            Profile?
  sessions           Session[]
  oneTimeTokens      OneTimeToken[]
  backupCodes        MfaBackupCode[]
  roleRequestsTarget RoleChangeRequest[] @relation("RoleTarget")
  roleRequestsMade   RoleChangeRequest[] @relation("RoleRequester")
  roleRequestsDecided RoleChangeRequest[] @relation("RoleDecider")

  @@map("users")
}

model Session {
  id            String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId        String    @map("user_id") @db.Uuid
  ip            String?
  userAgent     String?   @map("user_agent")
  createdAt     DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  lastActiveAt  DateTime  @default(now()) @map("last_active_at") @db.Timestamptz(6)
  expiresAt     DateTime  @map("expires_at") @db.Timestamptz(6)       // absolute lifetime
  revokedAt     DateTime? @map("revoked_at") @db.Timestamptz(6)
  revokedReason String?   @map("revoked_reason")

  user          User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  refreshTokens RefreshToken[]

  @@index([userId])
  @@map("sessions")
}

model RefreshToken {
  id        String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  sessionId String    @map("session_id") @db.Uuid
  tokenHash String    @unique @map("token_hash")
  expiresAt DateTime  @map("expires_at") @db.Timestamptz(6)
  usedAt    DateTime? @map("used_at") @db.Timestamptz(6)               // set when rotated
  createdAt DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)

  session   Session   @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId])
  @@map("refresh_tokens")
}

model OneTimeToken {
  id        String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId    String    @map("user_id") @db.Uuid
  type      TokenType
  tokenHash String    @unique @map("token_hash")
  expiresAt DateTime  @map("expires_at") @db.Timestamptz(6)
  usedAt    DateTime? @map("used_at") @db.Timestamptz(6)
  createdAt DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)

  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, type])
  @@map("one_time_tokens")
}

model MfaBackupCode {
  id        String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId    String    @map("user_id") @db.Uuid
  codeHash  String    @map("code_hash")
  usedAt    DateTime? @map("used_at") @db.Timestamptz(6)
  createdAt DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)

  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("mfa_backup_codes")
}

model RoleChangeRequest {
  id            String            @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  targetUserId  String            @map("target_user_id") @db.Uuid
  requestedById String            @map("requested_by_id") @db.Uuid
  currentRole   Role              @map("current_role")
  requestedRole Role              @map("requested_role")
  reason        String
  status        RoleRequestStatus @default(PENDING)
  decidedById   String?           @map("decided_by_id") @db.Uuid
  decidedAt     DateTime?         @map("decided_at") @db.Timestamptz(6)
  decisionNote  String?           @map("decision_note")
  createdAt     DateTime          @default(now()) @map("created_at") @db.Timestamptz(6)

  target        User              @relation("RoleTarget", fields: [targetUserId], references: [id], onDelete: Cascade)
  requester     User              @relation("RoleRequester", fields: [requestedById], references: [id], onDelete: Cascade)
  decider       User?             @relation("RoleDecider", fields: [decidedById], references: [id], onDelete: SetNull)

  @@index([targetUserId, status])
  @@map("role_change_requests")
}

// No foreign key on actorId: audit rows must outlive deleted accounts.
model AuditLog {
  seq          BigInt   @id @default(autoincrement())
  id           String   @unique @db.Uuid
  ts           DateTime @db.Timestamptz(3)
  category     String                       // AUTH | AUTHZ | DATA | ADMIN | SYSTEM | SECURITY | BACKUP
  action       String
  outcome      String                       // SUCCESS | FAILURE | DENIED
  actorId      String?  @map("actor_id") @db.Uuid
  actorLabel   String?  @map("actor_label") // username or email at the time
  ip           String?
  userAgent    String?  @map("user_agent")
  resourceType String?  @map("resource_type")
  resourceId   String?  @map("resource_id")
  detailsEnc   String?  @map("details_enc") // AES-256-GCM encrypted JSON
  prevHash     String   @map("prev_hash")
  hash         String

  @@index([ts])
  @@index([actorId, ts])
  @@index([action, ts])
  @@map("audit_logs")
}
```

Remove `emailVerified` and the old `refreshTokens` relation from `User`; `Profile` is unchanged.

```bash
npx prisma migrate dev --name security_layer
npx prisma generate
```

Importing Supabase users: set `emailVerifiedAt` to Supabase's `email_confirmed_at` (or the import time) so existing users are not locked out.

Make the audit table append-only with a custom migration (this one SQL file is infrastructure hardening, an intentional exception to "no raw SQL"):

```bash
npx prisma migrate dev --create-only --name audit_append_only
```

Put this in the generated `migration.sql`, then run `npx prisma migrate dev`:

```sql
CREATE OR REPLACE FUNCTION audit_logs_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_no_change
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION audit_logs_immutable();

CREATE TRIGGER audit_logs_no_truncate
BEFORE TRUNCATE ON audit_logs
FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_immutable();
```

In production also use a separate database role for the application with no `UPDATE`, `DELETE` or `TRUNCATE` privilege on `audit_logs`.

**Verify:** `npx prisma studio` shows the new tables; `UPDATE audit_logs SET action='x'` fails with "append-only" (use `psql` to try it).

---

### S2. Crypto helpers (spec 2.3, 4.4)

`src/common/utils/crypto.util.ts`:

```ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const key = () => Buffer.from(process.env.DATA_ENC_KEY!, 'base64'); // 32 bytes

/** AES-256-GCM. Output: v1.<iv>.<tag>.<ciphertext> (all base64). */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), enc.toString('base64')].join('.');
}

export function decrypt(payload: string): string {
  const [v, iv, tag, data] = payload.split('.');
  if (v !== 'v1') throw new Error('Unsupported ciphertext version');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}
```

**Verify:** a quick script shows `decrypt(encrypt('x')) === 'x'` and that changing one character of the ciphertext throws.

---

### S3. Audit logging, system events and alerts (spec 2.1 to 2.5)

`src/audit/audit.types.ts`:

```ts
export interface AuditEvent {
  category: 'AUTH' | 'AUTHZ' | 'DATA' | 'ADMIN' | 'SYSTEM' | 'SECURITY' | 'BACKUP';
  action: string;                 // e.g. LOGIN_FAILED, ROLE_CHANGE_APPROVED
  outcome: 'SUCCESS' | 'FAILURE' | 'DENIED';
  actorId?: string | null;
  actorLabel?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;   // never put passwords, tokens or OTP codes here
}
```

`src/audit/audit.service.ts` (hash chain with HMAC; the advisory lock serializes writers so the chain has no forks):

```ts
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService, private readonly alerts: AlertService) {}

  private chainHash(prev: string, f: unknown[]) {
    const hmacKey = Buffer.from(process.env.AUDIT_HMAC_KEY!, 'base64');
    return createHmac('sha256', hmacKey).update(prev + '|' + JSON.stringify(f)).digest('hex');
  }

  async log(e: AuditEvent): Promise<void> {
    try {
      const id = randomUUID();
      const ts = new Date();
      const detailsEnc = e.details ? encrypt(JSON.stringify(e.details)) : null;

      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(727001)`;       // parameter-free, infrastructure only
        const last = await tx.auditLog.findFirst({ orderBy: { seq: 'desc' }, select: { hash: true } });
        const prevHash = last?.hash ?? 'GENESIS';
        const fields = [id, ts.toISOString(), e.category, e.action, e.outcome, e.actorId ?? null,
          e.actorLabel ?? null, e.ip ?? null, e.userAgent ?? null, e.resourceType ?? null,
          e.resourceId ?? null, detailsEnc];
        await tx.auditLog.create({
          data: {
            id, ts, category: e.category, action: e.action, outcome: e.outcome,
            actorId: e.actorId, actorLabel: e.actorLabel, ip: e.ip, userAgent: e.userAgent,
            resourceType: e.resourceType, resourceId: e.resourceId, detailsEnc,
            prevHash, hash: this.chainHash(prevHash, fields),
          },
        });
      });
      this.alerts.evaluate(e);
    } catch (err) {
      this.logger.error(`audit write failed: ${(err as Error).message}`); // never break the request
    }
  }

  /** Recomputes the chain. Returns the first broken sequence number, if any. */
  async verifyChain() {
    let prev = 'GENESIS';
    let checked = 0;
    let cursor: bigint | undefined;
    for (;;) {
      const rows = await this.prisma.auditLog.findMany({
        orderBy: { seq: 'asc' }, take: 500,
        ...(cursor ? { cursor: { seq: cursor }, skip: 1 } : {}),
      });
      if (!rows.length) break;
      for (const r of rows) {
        const fields = [r.id, r.ts.toISOString(), r.category, r.action, r.outcome, r.actorId, r.actorLabel,
          r.ip, r.userAgent, r.resourceType, r.resourceId, r.detailsEnc];
        if (r.prevHash !== prev || r.hash !== this.chainHash(prev, fields)) {
          this.alerts.send('CRITICAL', 'Audit log chain broken', { seq: Number(r.seq) });
          return { ok: false, checked, brokenAtSeq: Number(r.seq) };
        }
        prev = r.hash;
        checked++;
      }
      cursor = rows[rows.length - 1].seq;
    }
    return { ok: true, checked, headHash: prev };
  }
}
```

The chain uses HMAC with a secret key, so someone with only database write access cannot recompute valid hashes. For stronger evidence, publish the `headHash` daily to a place the database admin cannot edit (an email to the security mailbox, a private repository, or the alert webhook).

`src/audit/audit.interceptor.ts` (records every mutating request; never logs bodies):

```ts
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(ctx: ExecutionContext, next: CallHandler) {
    const req = ctx.switchToHttp().getRequest();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next.handle();

    const write = (outcome: 'SUCCESS' | 'FAILURE', status: number) =>
      this.audit.log({
        category: String(req.route?.path ?? '').includes('/admin') ? 'ADMIN' : 'DATA',
        action: `${req.method} ${req.route?.path ?? req.path}`,
        outcome,
        actorId: req.user?.id,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        details: { status, params: req.params },        // ids only, no body
      });

    return next.handle().pipe(
      tap(() => write('SUCCESS', ctx.switchToHttp().getResponse().statusCode)),
      catchError((err) => { write('FAILURE', err?.status ?? 500); return throwError(() => err); }),
    );
  }
}
```

Authorization denials happen in guards, before interceptors, so log them in the exception filter. Replace the filter registration with dependency injection. In `all-exceptions.filter.ts` inject `AuditService` and add:

```ts
if (status === 401 || status === 403) {
  void this.audit.log({
    category: 'AUTHZ',
    action: status === 401 ? 'UNAUTHENTICATED_REQUEST' : 'FORBIDDEN_REQUEST',
    outcome: 'DENIED',
    actorId: req.user?.id,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    details: { method: req.method, path: String(req.url).split('?')[0] },
  });
}
```

Register in `AppModule`: `{ provide: APP_FILTER, useClass: AllExceptionsFilter }`, `{ provide: APP_INTERCEPTOR, useClass: AuditInterceptor }`, and remove `app.useGlobalFilters(...)` from `main.ts`.

`src/audit/alert.service.ts`:

```ts
type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);
  private failures = new Map<string, number[]>();         // ip -> timestamps (single instance; use Redis for several)

  constructor(private readonly mail: MailService) {}

  evaluate(e: AuditEvent) {
    if (e.action === 'LOGIN_FAILED' && e.ip) {
      const now = Date.now();
      const list = (this.failures.get(e.ip) ?? []).filter((t) => now - t < 10 * 60_000);
      list.push(now);
      this.failures.set(e.ip, list);
      if (list.length === 5) this.send('MEDIUM', 'Repeated failed logins from one IP', { ip: e.ip, count: 5 });
    }
    const rules: Record<string, Severity> = {
      ACCOUNT_LOCKED: 'MEDIUM',
      ROLE_CHANGE_REQUESTED: 'MEDIUM',
      ROLE_CHANGE_APPROVED: 'HIGH',
      MFA_DISABLED: 'HIGH',
      REFRESH_REUSE_DETECTED: 'HIGH',
      ADMIN_LOGIN: 'LOW',
      CONFIG_CHANGED: 'HIGH',
      SERVICE_FAILURE: 'HIGH',
      AUDIT_LOG_VIEWED: 'LOW',
    };
    const sev = rules[e.action];
    if (sev) this.send(sev, e.action, { actorId: e.actorId, ip: e.ip, resource: e.resourceId });
  }

  async send(severity: Severity, title: string, details: Record<string, unknown>) {
    this.logger.warn(JSON.stringify({ alert: true, severity, title, details }));
    const url = process.env.ALERT_WEBHOOK_URL;
    if (url && severity !== 'LOW') {
      fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `[${severity}] ${title} ${JSON.stringify(details)}` }) })
        .catch((e) => this.logger.error(`alert webhook failed: ${e.message}`));
    }
    if ((severity === 'HIGH' || severity === 'CRITICAL') && process.env.SECURITY_EMAIL) {
      this.mail.sendRaw(process.env.SECURITY_EMAIL, `[${severity}] ${title}`, JSON.stringify(details, null, 2))
        .catch(() => undefined);
    }
  }
}
```

Escalation table (put the same table in the Incident Response Plan):

| Severity | Examples | Notify | Acknowledge within | Escalate to |
|---|---|---|---|---|
| LOW | Admin login, audit log viewed | Log + dashboard | review daily | none |
| MEDIUM | 5 failed logins from one IP, account locked | Webhook channel | 4 hours | Security lead |
| HIGH | Role change approved, MFA disabled, refresh token reuse, config change | Webhook + email | 1 hour | Security lead, then Project owner |
| CRITICAL | Audit chain broken, suspected breach | Webhook + email + phone | 15 minutes | Incident commander, activate IR plan |

System events (spec 2.2) in `src/audit/system-events.service.ts`:

```ts
@Injectable()
export class SystemEventsService implements OnApplicationBootstrap, OnApplicationShutdown {
  constructor(private readonly audit: AuditService, private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    // fingerprint of non-secret configuration; a change between starts is logged
    const cfg = JSON.stringify({
      node: process.env.NODE_ENV, swagger: process.env.SWAGGER_ENABLED, captcha: process.env.CAPTCHA_ENABLED,
      idle: process.env.SESSION_IDLE_MINUTES, lock: process.env.MAX_FAILED_LOGINS, hibp: process.env.HIBP_ENABLED,
    });
    const fp = createHash('sha256').update(cfg).digest('hex');
    const last = await this.prisma.auditLog.findFirst({ where: { action: 'SYSTEM_STARTUP' }, orderBy: { seq: 'desc' } });
    await this.audit.log({ category: 'SYSTEM', action: 'SYSTEM_STARTUP', outcome: 'SUCCESS', details: { configFingerprint: fp } });
    if (last?.detailsEnc && JSON.parse(decrypt(last.detailsEnc)).configFingerprint !== fp) {
      await this.audit.log({ category: 'SYSTEM', action: 'CONFIG_CHANGED', outcome: 'SUCCESS', details: { configFingerprint: fp } });
    }
    process.on('uncaughtException', (e) => this.audit.log({ category: 'SYSTEM', action: 'SERVICE_FAILURE', outcome: 'FAILURE', details: { error: e.message } }));
    process.on('unhandledRejection', (e) => this.audit.log({ category: 'SYSTEM', action: 'SERVICE_FAILURE', outcome: 'FAILURE', details: { error: String(e) } }));
  }

  async onApplicationShutdown(signal?: string) {
    await this.audit.log({ category: 'SYSTEM', action: 'SYSTEM_SHUTDOWN', outcome: 'SUCCESS', details: { signal } });
  }
}
```

Add `app.enableShutdownHooks()` in `main.ts`. Create `AuditModule` (global) exporting `AuditService` and `AlertService`, and an admin controller:

```ts
@ApiTags('Admin')
@ApiBearerAuth('access-token')
@Roles(Role.ADMIN)
@Controller('admin/audit-logs')
export class AuditAdminController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  @Get()
  async list(@CurrentUser() me: AuthUser, @Query() q: AuditQueryDto) {
    await this.audit.log({ category: 'ADMIN', action: 'AUDIT_LOG_VIEWED', outcome: 'SUCCESS', actorId: me.id });
    const limit = q.limit ?? 50;
    const rows = await this.prisma.auditLog.findMany({
      where: { action: q.action, actorId: q.actorId, ts: { gte: q.from, lte: q.to } },
      orderBy: { seq: 'desc' }, take: limit + 1,
      ...(q.cursor ? { cursor: { seq: BigInt(q.cursor) }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return {
      data: items.map((r) => ({ ...r, seq: Number(r.seq),
        details: r.detailsEnc ? JSON.parse(decrypt(r.detailsEnc)) : null, detailsEnc: undefined, prevHash: undefined })),
      nextCursor: hasMore ? String(items[items.length - 1].seq) : null, hasMore,
    };
  }

  @Post('verify')
  @HttpCode(200)
  verify() { return this.audit.verifyChain(); }
}
```

Events to log explicitly (in services, call `audit.log` with the real actor and IP): `REGISTER`, `EMAIL_VERIFIED`, `LOGIN_SUCCESS`, `LOGIN_FAILED`, `ACCOUNT_LOCKED`, `LOGOUT`, `PASSWORD_CHANGED`, `PASSWORD_RESET_REQUESTED`, `PASSWORD_RESET_DONE`, `MFA_ENABLED`, `MFA_DISABLED`, `SESSION_REVOKED`, `REFRESH_REUSE_DETECTED`, `ROLE_CHANGE_REQUESTED|APPROVED|REJECTED`, `ACCESS_REVIEW_*`, `MODERATION_POST_REMOVED`, `ACCOUNT_DELETED`, `DATA_EXPORTED`, `BACKUP_CREATED|RESTORE_TESTED|BACKUP_FAILED`.

**Verify:** log in and out; `GET /admin/audit-logs` (as admin) shows the events with decrypted details; `POST /admin/audit-logs/verify` returns `ok: true`.

---

### S4. Mail, CAPTCHA and password policy (spec 1.2, 1.3)

`src/mail/mail.service.ts`:

```ts
@Injectable()
export class MailService {
  private readonly transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT ?? 587),
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  private readonly from = process.env.MAIL_FROM ?? 'no-reply@newsshare.local';

  sendRaw(to: string, subject: string, text: string) {
    return this.transport.sendMail({ from: this.from, to, subject, text });
  }
  sendVerification(to: string, token: string) {
    return this.sendRaw(to, 'Verify your News Share account',
      `Open this link to activate your account (valid 24 hours):\n${process.env.APP_BASE_URL}/verify-email?token=${token}\n\nIf you did not register, ignore this email.`);
  }
  sendPasswordReset(to: string, token: string) {
    return this.sendRaw(to, 'Reset your News Share password',
      `Use this link within 30 minutes:\n${process.env.APP_BASE_URL}/reset-password?token=${token}\n\nIf you did not ask for this, ignore it; your password is unchanged.`);
  }
  sendAccountExists(to: string) {
    return this.sendRaw(to, 'News Share sign-up attempt',
      'Someone tried to register with this email, but an account already exists. If this was you, use "Forgot password".');
  }
  sendLockNotice(to: string) {
    return this.sendRaw(to, 'Your News Share account was temporarily locked',
      'There were several failed sign-in attempts. The account unlocks automatically, or you can reset your password.');
  }
  sendSecurityNotice(to: string, what: string) {
    return this.sendRaw(to, 'Security notice', `${what}\nIf this was not you, reset your password and revoke your sessions.`);
  }
}
```

The links should open a page or deep link of your app that then calls `POST /auth/verify-email` or `/auth/reset-password`. Tokens are only ever sent in the request body, never as a URL parameter to an API route, so they stay out of server logs.

`src/auth/captcha.service.ts` (reCAPTCHA v3; the provider can be swapped):

```ts
@Injectable()
export class CaptchaService {
  async verify(token: string | undefined, action: string, ip?: string) {
    if (process.env.CAPTCHA_ENABLED === 'false') return;
    if (!token) throw new BadRequestException('CAPTCHA required');
    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: process.env.RECAPTCHA_SECRET!, response: token, ...(ip ? { remoteip: ip } : {}) }),
    });
    const data: any = await res.json();
    const min = Number(process.env.RECAPTCHA_MIN_SCORE ?? 0.5);
    if (!data.success || (data.score ?? 0) < min || (data.action && data.action !== action)) {
      throw new BadRequestException('CAPTCHA verification failed');
    }
  }
}
```

Mobile note: reCAPTCHA v3 is designed for web pages. In a Flutter app use Google's reCAPTCHA Enterprise mobile integration, or show the check in a WebView, or switch the provider to Cloudflare Turnstile or hCaptcha (change only this one service). For local tests set `CAPTCHA_ENABLED=false` or mock this service.

`src/auth/password-policy.service.ts`:

```ts
@Injectable()
export class PasswordPolicyService {
  private readonly logger = new Logger(PasswordPolicyService.name);

  async assert(password: string, ctx: { email?: string; username?: string }) {
    const problems: string[] = [];
    if (password.length < 12) problems.push('must be at least 12 characters');
    if (password.length > 128) problems.push('must be at most 128 characters');
    const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length;
    if (classes < 3) problems.push('must mix at least 3 of: lowercase, uppercase, digits, symbols');
    const lower = password.toLowerCase();
    const name = ctx.email?.split('@')[0]?.toLowerCase();
    if (name && name.length >= 3 && lower.includes(name)) problems.push('must not contain your email name');
    if (ctx.username && lower.includes(ctx.username.toLowerCase())) problems.push('must not contain your username');
    if (problems.length) throw new BadRequestException(`Password ${problems.join('; ')}`);

    if (await this.isBreached(password)) {
      throw new BadRequestException('This password appears in known data breaches. Choose a different one.');
    }
  }

  /** Have I Been Pwned range API (k-anonymity): only the first 5 hash characters leave the server. */
  private async isBreached(password: string): Promise<boolean> {
    if (process.env.HIBP_ENABLED === 'false') return false;
    const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase();
    try {
      const res = await fetch(`https://api.pwnedpasswords.com/range/${sha1.slice(0, 5)}`, {
        headers: { 'Add-Padding': 'true' }, signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return false;
      const suffix = sha1.slice(5);
      return (await res.text()).split('\n').some((l) => {
        const [s, count] = l.trim().split(':');
        return s === suffix && Number(count) > 0;
      });
    } catch (e) {
      this.logger.warn(`HIBP check skipped: ${(e as Error).message}`); // fail open on outage, but log it
      return false;
    }
  }
}
```

Update DTOs. `RegisterDto`: `@MinLength(12) @MaxLength(128) password`, `@IsString() captchaToken?`, `@Equals(true) acceptTerms: boolean`. Add `ResetPasswordDto { token, newPassword (same rules), mfaCode? }`, `ChangePasswordDto { currentPassword, newPassword, mfaCode? }`, `ForgotPasswordDto { email, captchaToken? }`.

**Verify:** unit-test `PasswordPolicyService` with `Passw0rd!` (too short), `aaaaaaaaaaaa` (too few classes), `Password123!xyz` (fails the breach check when online).

---

### S5. Sessions, tokens and the JWT strategy (spec 1.4)

`src/auth/session.service.ts`:

```ts
@Injectable()
export class SessionService {
  private readonly idleMs = Number(process.env.SESSION_IDLE_MINUTES ?? 30) * 60_000;
  private readonly absoluteMs = Number(process.env.SESSION_ABSOLUTE_DAYS ?? 30) * 86_400_000;
  private readonly accessTtl = Number(process.env.JWT_ACCESS_TTL_SECONDS ?? 600);

  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService,
              private readonly audit: AuditService, private readonly alerts: AlertService) {}

  /** New session id on every login: no pre-login session exists to fixate. */
  async start(userId: string, ctx: ReqCtx) {
    const s = await this.prisma.session.create({
      data: { userId, ip: ctx.ip, userAgent: ctx.ua?.slice(0, 255), expiresAt: new Date(Date.now() + this.absoluteMs) },
    });
    return this.issuePair(s.id, userId, s.expiresAt);
  }

  private async issuePair(sid: string, userId: string, expiresAt: Date) {
    const accessToken = await this.jwt.signAsync({ sub: userId, sid },
      { secret: process.env.JWT_ACCESS_SECRET!, expiresIn: this.accessTtl });
    const refreshToken = randomBytes(48).toString('hex');
    await this.prisma.refreshToken.create({ data: { sessionId: sid, tokenHash: sha256(refreshToken), expiresAt } });
    return { accessToken, refreshToken };
  }

  async rotate(raw: string, ctx: ReqCtx) {
    const rec = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(raw) }, include: { session: true },
    });
    if (!rec) throw new UnauthorizedException('Invalid refresh token');
    const s = rec.session;
    const now = Date.now();

    if (rec.usedAt) {                                   // an old token was replayed: assume theft
      await this.revoke(s.id, 'REFRESH_REUSE_DETECTED');
      await this.audit.log({ category: 'SECURITY', action: 'REFRESH_REUSE_DETECTED', outcome: 'DENIED',
        actorId: s.userId, ip: ctx.ip, resourceType: 'session', resourceId: s.id });
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (s.revokedAt || s.expiresAt.getTime() < now || rec.expiresAt.getTime() < now) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (now - s.lastActiveAt.getTime() > this.idleMs) {
      await this.revoke(s.id, 'IDLE_TIMEOUT');
      throw new UnauthorizedException('Session expired');
    }
    const used = await this.prisma.refreshToken.updateMany({ where: { id: rec.id, usedAt: null }, data: { usedAt: new Date() } });
    if (used.count !== 1) throw new UnauthorizedException('Invalid refresh token');   // lost a race

    await this.prisma.session.update({ where: { id: s.id }, data: { lastActiveAt: new Date(), ip: ctx.ip } });
    return { userId: s.userId, ...(await this.issuePair(s.id, s.userId, s.expiresAt)) };
  }

  /** Called by the JWT strategy on every request. */
  async touch(sid: string, userId: string) {
    const s = await this.prisma.session.findUnique({
      where: { id: sid },
      include: { user: { select: { role: true, emailVerifiedAt: true, lockedUntil: true } } },
    });
    const now = Date.now();
    if (!s || s.userId !== userId || s.revokedAt || s.expiresAt.getTime() < now) return null;
    if (now - s.lastActiveAt.getTime() > this.idleMs) { await this.revoke(sid, 'IDLE_TIMEOUT'); return null; }
    if (now - s.lastActiveAt.getTime() > 60_000) {       // avoid a write on every request
      await this.prisma.session.update({ where: { id: sid }, data: { lastActiveAt: new Date() } });
    }
    return s;
  }

  revoke(sid: string, reason: string) {
    return this.prisma.session.updateMany({ where: { id: sid, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: reason } });
  }
  revokeAllForUser(userId: string, reason: string, exceptSid?: string) {
    return this.prisma.session.updateMany({
      where: { userId, revokedAt: null, ...(exceptSid ? { NOT: { id: exceptSid } } : {}) },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }
  list(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, ip: true, userAgent: true, createdAt: true, lastActiveAt: true },
      orderBy: { lastActiveAt: 'desc' },
    });
  }
}
```

`ReqCtx` is `{ ip?: string; ua?: string }`. Add a small `@Ctx()` param decorator returning `{ ip: req.ip, ua: req.headers['user-agent'] }`.

Update `src/auth/strategies/jwt.strategy.ts` and `AuthUser`:

```ts
export interface AuthUser { id: string; role: Role; sid: string }

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private readonly sessions: SessionService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      algorithms: ['HS256'],                        // reject "none" and unexpected algorithms
    });
  }

  async validate(payload: { sub: string; sid: string }): Promise<AuthUser> {
    const s = payload.sid ? await this.sessions.touch(payload.sid, payload.sub) : null;
    if (!s || !s.user.emailVerifiedAt || (s.user.lockedUntil && s.user.lockedUntil > new Date())) {
      throw new UnauthorizedException();
    }
    return { id: s.userId, role: s.user.role, sid: s.id };   // role is read from the database each time
  }
}
```

Because the role is loaded from the database on each request, a revoked role or session takes effect immediately, even though the access token itself lives for 10 minutes.

Session management endpoints in `UsersController` (or a `SessionsController`): `GET /me/sessions`, `DELETE /me/sessions/:id` (only the caller's own), and in `AuthController`: `POST /auth/logout` (revokes `req.user.sid`), `POST /auth/logout-all`.

**Verify:** log in, call an endpoint (200), call `POST /auth/logout`, call the endpoint again with the same access token (now 401).

---

### S6. Authentication flows (spec 1.2, 1.3, 1.4)

`src/auth/one-time-token.service.ts`:

```ts
@Injectable()
export class OneTimeTokenService {
  constructor(private readonly prisma: PrismaService) {}

  async issue(userId: string, type: TokenType, ttlMinutes: number) {
    await this.prisma.oneTimeToken.deleteMany({ where: { userId, type, usedAt: null } });   // one live token at a time
    const raw = randomBytes(32).toString('hex');
    await this.prisma.oneTimeToken.create({
      data: { userId, type, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + ttlMinutes * 60_000) },
    });
    return raw;
  }

  async consume(raw: string, type: TokenType): Promise<string> {
    const rec = await this.prisma.oneTimeToken.findUnique({ where: { tokenHash: sha256(raw) } });
    if (!rec || rec.type !== type || rec.usedAt || rec.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired token');
    }
    const res = await this.prisma.oneTimeToken.updateMany({ where: { id: rec.id, usedAt: null }, data: { usedAt: new Date() } });
    if (res.count !== 1) throw new BadRequestException('Invalid or expired token');
    return rec.userId;
  }
}
```

Replace `src/auth/auth.service.ts` with the version below (imports omitted; services from S3 to S5 are injected).

```ts
const GENERIC = 'Invalid credentials';
const CONSENT_VERSION = '2026-11';

@Injectable()
export class AuthService implements OnModuleInit {
  private dummyHash = '';

  constructor(
    private readonly prisma: PrismaService, private readonly jwt: JwtService,
    private readonly sessions: SessionService, private readonly tokens: OneTimeTokenService,
    private readonly mfa: MfaService, private readonly policy: PasswordPolicyService,
    private readonly captcha: CaptchaService, private readonly mail: MailService,
    private readonly audit: AuditService,
  ) {}

  async onModuleInit() {                                  // used to equalise timing for unknown emails
    this.dummyHash = await hashPassword(randomBytes(16).toString('hex'));
  }

  // ---- registration and verification ------------------------------------------------
  async register(dto: RegisterDto, ctx: ReqCtx) {
    await this.captcha.verify(dto.captchaToken, 'register', ctx.ip);
    const email = dto.email.toLowerCase();
    await this.policy.assert(dto.password, { email, username: dto.username });

    const usernameTaken = await this.prisma.profile.findFirst({
      where: { username: { equals: dto.username, mode: 'insensitive' } }, select: { id: true },
    });
    if (usernameTaken) throw new ConflictException('Username already taken');   // usernames are public anyway

    const existing = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      void this.mail.sendAccountExists(email);                // the caller cannot tell the difference
      await this.audit.log({ category: 'AUTH', action: 'REGISTER_DUPLICATE_EMAIL', outcome: 'FAILURE', ip: ctx.ip });
    } else {
      const user = await this.prisma.user.create({
        data: {
          email, passwordHash: await hashPassword(dto.password),
          consentAt: new Date(), consentVersion: CONSENT_VERSION,
          profile: { create: { username: dto.username, fullName: dto.fullName } },
        },
      });
      void this.mail.sendVerification(email, await this.tokens.issue(user.id, 'EMAIL_VERIFY', 24 * 60));
      await this.audit.log({ category: 'AUTH', action: 'REGISTER', outcome: 'SUCCESS',
        actorId: user.id, actorLabel: dto.username, ip: ctx.ip, userAgent: ctx.ua });
    }
    return { message: 'If the details are valid, a verification email has been sent.' };
  }

  async verifyEmail(token: string, ctx: ReqCtx) {
    const userId = await this.tokens.consume(token, 'EMAIL_VERIFY');
    await this.prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
    await this.audit.log({ category: 'AUTH', action: 'EMAIL_VERIFIED', outcome: 'SUCCESS', actorId: userId, ip: ctx.ip });
    return { verified: true };
  }

  async resendVerification(emailRaw: string) {
    const user = await this.prisma.user.findUnique({ where: { email: emailRaw.toLowerCase() } });
    if (user && !user.emailVerifiedAt) {
      void this.mail.sendVerification(user.email, await this.tokens.issue(user.id, 'EMAIL_VERIFY', 24 * 60));
    }
    return { message: 'If the account exists and is not verified, an email was sent.' };   // always the same
  }

  // ---- login, lockout, MFA ----------------------------------------------------------
  async login(dto: LoginDto, ctx: ReqCtx) {
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email }, include: { profile: true } });

    if (!user || !user.profile) {
      await verifyPassword(this.dummyHash, dto.password);     // same work as a real check
      await this.audit.log({ category: 'AUTH', action: 'LOGIN_FAILED', outcome: 'FAILURE', ip: ctx.ip,
        actorLabel: email, details: { reason: 'unknown_user' } });
      throw new UnauthorizedException(GENERIC);
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.audit.log({ category: 'AUTH', action: 'LOGIN_BLOCKED_LOCKED', outcome: 'DENIED',
        actorId: user.id, ip: ctx.ip });
      throw new UnauthorizedException(GENERIC);               // do not reveal the lock
    }

    const { ok, needsRehash } = await verifyPassword(user.passwordHash, dto.password);
    if (!ok) { await this.registerFailure(user, ctx); throw new UnauthorizedException(GENERIC); }
    if (!user.emailVerifiedAt) throw new ForbiddenException('Email not verified');

    if (needsRehash) {
      await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(dto.password) } });
    }
    if (user.mfaEnabled) {
      const mfaToken = await this.jwt.signAsync({ sub: user.id, purpose: 'mfa' },
        { secret: process.env.JWT_ACCESS_SECRET!, expiresIn: 300 });
      await this.audit.log({ category: 'AUTH', action: 'LOGIN_MFA_REQUIRED', outcome: 'SUCCESS', actorId: user.id, ip: ctx.ip });
      return { mfaRequired: true as const, mfaToken };
    }
    return this.completeLogin(user, ctx);
  }

  async verifyMfa(dto: MfaVerifyDto, ctx: ReqCtx) {
    let payload: { sub: string; purpose: string };
    try { payload = await this.jwt.verifyAsync(dto.mfaToken, { secret: process.env.JWT_ACCESS_SECRET! }); }
    catch { throw new UnauthorizedException(GENERIC); }
    if (payload.purpose !== 'mfa') throw new UnauthorizedException(GENERIC);

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, include: { profile: true } });
    if (!user || !user.profile || (user.lockedUntil && user.lockedUntil > new Date())) throw new UnauthorizedException(GENERIC);

    const ok = dto.backupCode ? await this.mfa.useBackupCode(user.id, dto.backupCode)
                              : await this.mfa.checkCode(user, dto.code ?? '');
    if (!ok) { await this.registerFailure(user, ctx); throw new UnauthorizedException(GENERIC); }
    return this.completeLogin(user, ctx);
  }

  private async registerFailure(user: User, ctx: ReqCtx) {
    const max = Number(process.env.MAX_FAILED_LOGINS ?? 5);
    const minutes = Number(process.env.LOCKOUT_MINUTES ?? 15);
    const updated = await this.prisma.user.update({
      where: { id: user.id }, data: { failedLoginCount: { increment: 1 } }, select: { failedLoginCount: true },
    });
    await this.audit.log({ category: 'AUTH', action: 'LOGIN_FAILED', outcome: 'FAILURE',
      actorId: user.id, ip: ctx.ip, userAgent: ctx.ua, details: { count: updated.failedLoginCount } });

    if (updated.failedLoginCount >= max) {
      await this.prisma.user.update({
        where: { id: user.id }, data: { lockedUntil: new Date(Date.now() + minutes * 60_000), failedLoginCount: 0 },
      });
      await this.audit.log({ category: 'AUTH', action: 'ACCOUNT_LOCKED', outcome: 'SUCCESS',
        actorId: user.id, ip: ctx.ip, details: { minutes } });
      void this.mail.sendLockNotice(user.email);
    }
  }

  private async completeLogin(user: User & { profile: Profile | null }, ctx: ReqCtx) {
    await this.prisma.user.update({
      where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    const pair = await this.sessions.start(user.id, ctx);
    await this.audit.log({ category: 'AUTH', action: user.role === 'USER' ? 'LOGIN_SUCCESS' : 'ADMIN_LOGIN',
      outcome: 'SUCCESS', actorId: user.id, actorLabel: user.profile?.username, ip: ctx.ip, userAgent: ctx.ua });
    return { profile: toMe(user.profile!, user.email), ...pair };
  }

  // ---- refresh, logout ---------------------------------------------------------------
  async refresh(token: string, ctx: ReqCtx) {
    const r = await this.sessions.rotate(token, ctx);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: r.userId }, include: { profile: true } });
    return { profile: toMe(user.profile!, user.email), accessToken: r.accessToken, refreshToken: r.refreshToken };
  }

  async logout(user: AuthUser, ctx: ReqCtx) {
    await this.sessions.revoke(user.sid, 'LOGOUT');
    await this.audit.log({ category: 'AUTH', action: 'LOGOUT', outcome: 'SUCCESS', actorId: user.id, ip: ctx.ip });
  }

  async logoutAll(user: AuthUser, ctx: ReqCtx) {
    await this.sessions.revokeAllForUser(user.id, 'LOGOUT_ALL');
    await this.audit.log({ category: 'AUTH', action: 'LOGOUT_ALL', outcome: 'SUCCESS', actorId: user.id, ip: ctx.ip });
  }

  // ---- recovery and password change ---------------------------------------------------
  async forgotPassword(dto: ForgotPasswordDto, ctx: ReqCtx) {
    await this.captcha.verify(dto.captchaToken, 'forgot_password', ctx.ip);
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (user) void this.mail.sendPasswordReset(user.email, await this.tokens.issue(user.id, 'PASSWORD_RESET', 30));
    await this.audit.log({ category: 'AUTH', action: 'PASSWORD_RESET_REQUESTED', outcome: 'SUCCESS',
      actorId: user?.id, ip: ctx.ip });
    return { message: 'If the account exists, a reset email was sent.' };        // always the same
  }

  async resetPassword(dto: ResetPasswordDto, ctx: ReqCtx) {
    const userId = await this.tokens.consume(dto.token, 'PASSWORD_RESET');
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.mfaEnabled) {                                  // identity verification before the reset
      const ok = dto.mfaCode ? await this.mfa.checkCode(user, dto.mfaCode) : false;
      if (!ok) throw new UnauthorizedException('MFA code required');
    }
    await this.policy.assert(dto.newPassword, { email: user.email });
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(dto.newPassword), passwordChangedAt: new Date(),
              failedLoginCount: 0, lockedUntil: null },
    });
    await this.sessions.revokeAllForUser(userId, 'PASSWORD_RESET');
    void this.mail.sendSecurityNotice(user.email, 'Your password was changed.');
    await this.audit.log({ category: 'AUTH', action: 'PASSWORD_RESET_DONE', outcome: 'SUCCESS', actorId: userId, ip: ctx.ip });
    return { message: 'Password updated. Please sign in.' };
  }

  async changePassword(me: AuthUser, dto: ChangePasswordDto, ctx: ReqCtx) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: me.id } });
    if (!(await verifyPassword(user.passwordHash, dto.currentPassword)).ok) throw new UnauthorizedException('Current password is incorrect');
    if (user.mfaEnabled && !(await this.mfa.checkCode(user, dto.mfaCode ?? ''))) throw new UnauthorizedException('MFA code required');
    await this.policy.assert(dto.newPassword, { email: user.email });
    await this.prisma.user.update({
      where: { id: me.id }, data: { passwordHash: await hashPassword(dto.newPassword), passwordChangedAt: new Date() },
    });
    await this.sessions.revokeAllForUser(me.id, 'PASSWORD_CHANGED', me.sid);   // keep only this session
    void this.mail.sendSecurityNotice(user.email, 'Your password was changed.');
    await this.audit.log({ category: 'AUTH', action: 'PASSWORD_CHANGED', outcome: 'SUCCESS', actorId: me.id, ip: ctx.ip });
    return { message: 'Password changed' };
  }
}
```

Controller changes in `AuthController`: add `@Ctx() ctx` to each handler and pass it through; add `@Public()` plus `@Throttle({ default: { limit: 10, ttl: 60_000 } })` to `register`, `login`, `mfa/verify`, `forgot-password`, `reset-password`, `resend-verification`, `verify-email`; `logout` and `logout-all` use `@CurrentUser()`; `POST /me/password` lives in `UsersController`.

**Verify:** register (Mailpit at `http://localhost:8025` shows the email) → login returns `403` → verify the token → login works → 5 wrong passwords then the correct one returns `401` → `GET /admin/audit-logs` shows `ACCOUNT_LOCKED`.

---

### S7. Multi-factor authentication (spec 1.5)

`src/auth/mfa.service.ts`:

```ts
@Injectable()
export class MfaService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {
    authenticator.options = { window: 1, step: 30, digits: 6 };   // tolerate one step of clock drift
  }

  async setup(userId: string, email: string) {
    const secret = authenticator.generateSecret();
    await this.prisma.user.update({
      where: { id: userId }, data: { mfaSecretEnc: encrypt(secret), mfaEnabled: false, mfaLastStep: null },
    });
    const otpauthUrl = authenticator.keyuri(email, 'News Share', secret);
    return { secret, otpauthUrl, qrCodeDataUrl: await QRCode.toDataURL(otpauthUrl) };
  }

  async enable(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.mfaSecretEnc) throw new BadRequestException('Run setup first');
    if (!(await this.checkCode(user, code))) throw new BadRequestException('Invalid code');
    await this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } });
    await this.audit.log({ category: 'AUTH', action: 'MFA_ENABLED', outcome: 'SUCCESS', actorId: userId });
    return { backupCodes: await this.generateBackupCodes(userId) };      // shown once
  }

  /** Accepts a code once: the time step must be newer than the last accepted step (replay protection). */
  async checkCode(user: { id: string; mfaSecretEnc: string | null; mfaLastStep: number | null }, code: string) {
    if (!user.mfaSecretEnc || !/^\d{6}$/.test(code)) return false;
    const delta = authenticator.checkDelta(code, decrypt(user.mfaSecretEnc));
    if (delta === null) return false;
    const step = Math.floor(Date.now() / 30_000) + delta;
    if (user.mfaLastStep !== null && step <= user.mfaLastStep) return false;
    await this.prisma.user.update({ where: { id: user.id }, data: { mfaLastStep: step } });
    return true;
  }

  async generateBackupCodes(userId: string) {
    await this.prisma.mfaBackupCode.deleteMany({ where: { userId } });
    const codes = Array.from({ length: 10 }, () => {
      const h = randomBytes(5).toString('hex');
      return `${h.slice(0, 5)}-${h.slice(5)}`;
    });
    await this.prisma.mfaBackupCode.createMany({
      data: codes.map((c) => ({ userId, codeHash: sha256(c.replace('-', '')) })),
    });
    return codes;
  }

  async useBackupCode(userId: string, code: string) {
    const res = await this.prisma.mfaBackupCode.updateMany({
      where: { userId, codeHash: sha256(code.replace(/[\s-]/g, '').toLowerCase()), usedAt: null },
      data: { usedAt: new Date() },
    });
    return res.count === 1;
  }

  async disable(userId: string, password: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await verifyPassword(user.passwordHash, password)).ok || !(await this.checkCode(user, code))) {
      throw new UnauthorizedException('Password or code incorrect');
    }
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: false, mfaSecretEnc: null, mfaLastStep: null } }),
      this.prisma.mfaBackupCode.deleteMany({ where: { userId } }),
    ]);
    await this.audit.log({ category: 'AUTH', action: 'MFA_DISABLED', outcome: 'SUCCESS', actorId: userId });
  }
}
```

Controller endpoints (`/me/mfa/*`, all authenticated; `/auth/mfa/verify` public):

| Endpoint | Behavior |
|---|---|
| `POST /me/mfa/setup` | Returns `secret`, `otpauthUrl`, `qrCodeDataUrl` (shown once; user scans with an authenticator app) |
| `POST /me/mfa/enable` `{code}` | Confirms enrollment, returns 10 backup codes once |
| `POST /me/mfa/disable` `{password, code}` | Step-up, then disables and alerts |
| `POST /me/mfa/backup-codes` `{code}` | Regenerates backup codes (invalidates the old ones) |
| `POST /auth/mfa/verify` `{mfaToken, code?, backupCode?}` | Completes login |

Account recovery for a lost authenticator: use a backup code; if those are gone too, an ADMIN runs `scripts/reset-mfa.ts <userId>` after verifying the person's identity out of band, which is audited and alerted.

**Verify:** enable MFA with an authenticator app; log in (`mfaRequired`); verify with the current code (200); reuse the same code a second time (401); log in with a backup code (works once, then 401).

---

### S8. Role-based access control (spec 1.1)

#### Permission matrix (least privilege)

| Capability | USER | MODERATOR | ADMIN |
|---|---|---|---|
| Own profile, posts, follows, notifications | yes | yes | yes |
| Read other profiles and posts | yes | yes | yes |
| Remove any post (with reason) | no | yes | yes |
| Request own promotion to MODERATOR | yes | n/a | n/a |
| Request a role change for any user | no | no | yes |
| Approve / reject role changes | no | no | yes (not own, not as requester) |
| List users, lock/unlock, revoke sessions | no | no | yes |
| Read and verify audit logs | no | no | yes |
| Run access review | no | no | yes |
| Change passwords or MFA of others | no | no | no (use reset flows) |

Admins cannot read passwords, tokens or MFA secrets by design.

#### Guard and decorator

`src/common/decorators/roles.decorator.ts`:

```ts
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
```

`src/common/guards/roles.guard.ts`:

```ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!required?.length) return true;
    const user: AuthUser | undefined = ctx.switchToHttp().getRequest().user;
    if (!user || !required.includes(user.role)) throw new ForbiddenException('Insufficient permissions');
    return true;     // the 403 is logged by the exception filter
  }
}
```

Register it after the JWT guard in `AppModule`: `{ provide: APP_GUARD, useClass: RolesGuard }` (providers run in listed order: Throttler, JWT, Roles).

#### Role change workflow

`src/roles/role-requests.service.ts`:

```ts
@Injectable()
export class RoleRequestsService {
  constructor(private readonly prisma: PrismaService, private readonly sessions: SessionService,
              private readonly audit: AuditService) {}

  async create(me: AuthUser, dto: CreateRoleRequestDto, ctx: ReqCtx) {
    const targetId = dto.targetUserId ?? me.id;
    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target) throw new NotFoundException('User not found');
    if (target.role === dto.requestedRole) throw new BadRequestException('User already has this role');

    const selfService = targetId === me.id;
    if (selfService && !(target.role === 'USER' && dto.requestedRole === 'MODERATOR')) {
      throw new ForbiddenException('You can only request MODERATOR for yourself');
    }
    if (!selfService && me.role !== 'ADMIN') throw new ForbiddenException('Only admins can request changes for others');

    const pending = await this.prisma.roleChangeRequest.findFirst({ where: { targetUserId: targetId, status: 'PENDING' } });
    if (pending) throw new ConflictException('A request for this user is already pending');

    const req = await this.prisma.roleChangeRequest.create({
      data: { targetUserId: targetId, requestedById: me.id, currentRole: target.role,
              requestedRole: dto.requestedRole, reason: dto.reason },
    });
    await this.audit.log({ category: 'ADMIN', action: 'ROLE_CHANGE_REQUESTED', outcome: 'SUCCESS',
      actorId: me.id, ip: ctx.ip, resourceType: 'role_request', resourceId: req.id,
      details: { target: targetId, from: target.role, to: dto.requestedRole, reason: dto.reason } });
    return req;
  }

  async decide(me: AuthUser, id: string, approve: boolean, note: string | undefined, ctx: ReqCtx) {
    const req = await this.prisma.roleChangeRequest.findUnique({ where: { id } });
    if (!req || req.status !== 'PENDING') throw new NotFoundException('Pending request not found');

    // separation of duties
    if (req.requestedById === me.id) throw new ForbiddenException('You cannot decide a request you made');
    if (req.targetUserId === me.id) throw new ForbiddenException('You cannot decide a request about your own role');

    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.roleChangeRequest.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: approve ? 'APPROVED' : 'REJECTED', decidedById: me.id, decidedAt: new Date(), decisionNote: note },
      });
      if (claimed.count !== 1) throw new ConflictException('Request already decided');

      if (approve) {
        if (req.currentRole === 'ADMIN' && req.requestedRole !== 'ADMIN') {
          const admins = await tx.user.count({ where: { role: 'ADMIN' } });
          if (admins <= 1) throw new BadRequestException('Cannot remove the last admin');
        }
        await tx.user.update({ where: { id: req.targetUserId }, data: { role: req.requestedRole, roleAssignedAt: new Date() } });
      }
    });

    if (approve) await this.sessions.revokeAllForUser(req.targetUserId, 'ROLE_CHANGED');   // force re-login with the new role
    await this.audit.log({ category: 'ADMIN', action: approve ? 'ROLE_CHANGE_APPROVED' : 'ROLE_CHANGE_REJECTED',
      outcome: 'SUCCESS', actorId: me.id, ip: ctx.ip, resourceType: 'role_request', resourceId: id,
      details: { target: req.targetUserId, to: req.requestedRole, note } });
    return { id, status: approve ? 'APPROVED' : 'REJECTED' };
  }

  list(me: AuthUser) {
    return this.prisma.roleChangeRequest.findMany({
      where: me.role === 'ADMIN' ? {} : { OR: [{ requestedById: me.id }, { targetUserId: me.id }] },
      orderBy: { createdAt: 'desc' }, take: 100,
    });
  }
}
```

The system needs at least two admins, otherwise nobody can approve anything. Create them with a one-time, audited bootstrap script `scripts/create-admin.ts <email>` that sets `role = ADMIN`, logs `ADMIN_BOOTSTRAPPED`, and is run only by the system owner.

Controller:

```ts
@Controller('role-requests')
export class RoleRequestsController {
  @Post()               create(@CurrentUser() me, @Body() dto: CreateRoleRequestDto, @Ctx() ctx) { ... }
  @Get()                list(@CurrentUser() me) { ... }
  @Roles(Role.ADMIN) @Post(':id/approve') @HttpCode(200)  approve(...)  // decide(me, id, true, dto.note, ctx)
  @Roles(Role.ADMIN) @Post(':id/reject')  @HttpCode(200)  reject(...)   // decide(me, id, false, dto.note, ctx)
}
```

#### Moderation and administration endpoints

```ts
@Roles(Role.MODERATOR, Role.ADMIN)
@Delete('moderation/posts/:id')
async removePost(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReasonDto, @Ctx() ctx: ReqCtx) {
  const post = await this.prisma.post.findUniqueOrThrow({ where: { id } });
  await this.prisma.post.delete({ where: { id } });
  await this.storage.safeDelete(post.imagePublicId);
  await this.audit.log({ category: 'ADMIN', action: 'MODERATION_POST_REMOVED', outcome: 'SUCCESS',
    actorId: me.id, ip: ctx.ip, resourceType: 'post', resourceId: id, details: { author: post.userId, reason: dto.reason } });
}
```

Admin user management (`@Roles(Role.ADMIN)`): `GET /admin/users` (id, username, role, lastLoginAt, lockedUntil, mfaEnabled; no secrets), `POST /admin/users/:id/lock` and `/unlock` (sets `lockedUntil` far in the future or null, resets the counter), `POST /admin/users/:id/revoke-sessions`. Each writes an audit event.

#### Periodic access review (quarterly)

`GET /admin/access-review` returns every MODERATOR and ADMIN with `roleAssignedAt`, `lastLoginAt`, and a `stale` flag (no login in 90 days, or never):

```ts
const cutoff = new Date(Date.now() - 90 * 86_400_000);
const privileged = await this.prisma.user.findMany({
  where: { role: { in: ['MODERATOR', 'ADMIN'] } },
  select: { id: true, role: true, roleAssignedAt: true, lastLoginAt: true, profile: { select: { username: true } } },
});
return privileged.map((u) => ({ ...u, stale: !u.lastLoginAt || u.lastLoginAt < cutoff }));
```

`POST /admin/access-review/:userId` with `{decision: 'KEEP' | 'REVOKE', note}`: `KEEP` writes `ACCESS_REVIEW_CONFIRMED`; `REVOKE` creates a `RoleChangeRequest` to `USER` (so it still needs a second admin) and writes `ACCESS_REVIEW_REVOKE_REQUESTED`. `scripts/access-review.ts` prints the same list as CSV for the quarterly meeting; keep the signed-off CSV as evidence.

**Verify:** a USER calling `GET /admin/users` gets `403`; a MODERATOR can delete another user's post; an ADMIN cannot approve their own request or a request about themselves; after an approval the target's old access token returns `401`.

---

### S9. Security headers, limits, TLS and transport (spec 1.3, 4.3, 4.4, 4.5)

Replace `src/main.ts`:

```ts
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));                                    // nestjs-pino
  app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 0));      // correct client IP behind the proxy
  app.enableShutdownHooks();
  app.useBodyParser('json', { limit: '100kb' });                     // input size limit
  app.useBodyParser('urlencoded', { limit: '100kb', extended: false });

  const apiHelmet = helmet({
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"], formAction: ["'none'"] } },
    hsts: { maxAge: 31_536_000, includeSubDomains: true },           // only honored over HTTPS
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'no-referrer' },
    noSniff: true,                                                   // X-Content-Type-Options: nosniff
    crossOriginResourcePolicy: { policy: 'same-site' },
  });
  const docsHelmet = helmet({ contentSecurityPolicy: false });       // Swagger UI needs inline scripts
  app.use((req, res, next) => (req.path.startsWith('/docs') ? docsHelmet(req, res, next) : apiHelmet(req, res, next)));

  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: (process.env.CORS_ORIGINS ?? '').split(',').filter(Boolean), credentials: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  if (process.env.NODE_ENV !== 'production' && process.env.SWAGGER_ENABLED !== 'false') setupSwagger(app);
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
```

Swagger is off in production by default here. For a native mobile client CORS is not needed; an empty list blocks browsers from other origins.

Required headers and their purpose:

| Header | Value | Protects against |
|---|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Downgrade to HTTP |
| `Content-Security-Policy` | `default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'` | Script injection, framing |
| `X-Content-Type-Options` | `nosniff` | MIME sniffing |
| `X-Frame-Options` | `DENY` | Clickjacking |
| `Referrer-Policy` | `no-referrer` | URL leakage |

TLS: terminate TLS at a reverse proxy. Minimal nginx server block (TLS 1.2 and 1.3 only):

```nginx
server {
  listen 443 ssl http2;
  server_name api.newsshare.local;
  ssl_certificate     /etc/nginx/certs/api.crt;
  ssl_certificate_key /etc/nginx/certs/api.key;
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_prefer_server_ciphers off;
  client_max_body_size 6m;                         # a little above the largest image
  location / {
    proxy_pass http://api:3000;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto https;
  }
}
server { listen 80; return 301 https://$host$request_uri; }
```

For local development create a trusted certificate with `mkcert`. Caddy is an alternative that obtains certificates automatically for a public domain.

Database transport and mTLS: use `?sslmode=verify-full&sslrootcert=...` in `DATABASE_URL` for any non-local database. Mutual TLS is only relevant for service-to-service links; today News Share has one API talking to Postgres, so document it as "not required yet" and, if you add a worker, queue or second service, give each a client certificate and enable `clientcert=verify-full` in `pg_hba.conf`.

**Verify:** `curl -sI https://api.newsshare.local/api/v1/feed` shows the five headers; `curl http://...` redirects to HTTPS; an oversized JSON body returns `413`.

---

### S10. Upload hardening (spec 4.1)

`src/storage/image-sanitizer.ts` (allow-list by type, size and actual content, then re-encode):

```ts
const SIGNATURES: Record<string, (b: Buffer) => boolean> = {
  'image/jpeg': (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png':  (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': (b) => b.length > 12 && b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP',
};

export async function sanitizeImage(file: Express.Multer.File | undefined, maxBytes: number): Promise<Buffer> {
  if (!file) throw new BadRequestException('File is required');
  const check = SIGNATURES[file.mimetype];
  if (!check) throw new BadRequestException('Only JPEG, PNG or WebP images are allowed');
  if (file.size > maxBytes) throw new BadRequestException(`File too large (max ${maxBytes / 1024 / 1024} MB)`);
  if (!check(file.buffer)) throw new BadRequestException('File content does not match its type');

  const fmt = file.mimetype.split('/')[1] as 'jpeg' | 'png' | 'webp';
  try {
    // decoding and re-encoding drops embedded payloads and strips metadata such as EXIF GPS location
    return await sharp(file.buffer, { limitInputPixels: 40_000_000 }).rotate().toFormat(fmt).toBuffer();
  } catch {
    throw new BadRequestException('Invalid or unsupported image');
  }
}
```

In `StorageService`, replace `assertImage` with `const clean = await sanitizeImage(file, MAX_...)` and upload `clean` instead of `file.buffer`. Also set `limits: { fileSize, files: 1 }` on every `FileInterceptor`.

**Verify:** upload a text file renamed to `.png` (400), a JPEG with GPS EXIF (the returned Cloudinary image has no EXIF), a 6 MB image (413 or 400).

---

### S11. Secure error handling and log hygiene (spec 4.2, 2.3)

The exception filter already returns a generic body for 500s and logs details internally. Add structured logging with redaction. In `AppModule` imports:

```ts
LoggerModule.forRoot({
  pinoHttp: {
    level: process.env.LOG_LEVEL ?? 'info',
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]',
              'req.body.password', 'req.body.newPassword', 'req.body.currentPassword',
              'req.body.refreshToken', 'req.body.mfaToken', 'req.body.code', 'req.body.token'],
      censor: '[REDACTED]',
    },
    serializers: {
      req: (req) => ({ id: req.id, method: req.method, url: String(req.url).split('?')[0], ip: req.remoteAddress }),
    },
    transport: process.env.NODE_ENV === 'production' ? undefined : { target: 'pino-pretty' },
  },
}),
```

Rules to keep: never put passwords, tokens or OTP codes in a URL, a log line or an audit `details` object; never return `error.stack`; validation errors may name fields but never echo submitted secrets.

Add a health endpoint with `@nestjs/terminus` (`GET /health`, public, returns only `{status}`), so monitoring does not need credentials.

**Verify:** trigger a 500 (for example stop the database) and confirm the client sees only `Internal server error`, while the server log shows the detail.

---

### S12. Data protection (spec 4.4) and account deletion

#### Data classification for News Share

| Class | Data | Controls |
|---|---|---|
| Public | Username, avatar URL, post title/content/image URL, follower counts | Served to any logged-in user |
| Internal | Notifications, session metadata (IP, user agent) | Owner and system only; retained 90 days / 30 days |
| Confidential | Email, `fullName`, `bio`, consent records | Owner and admin list view (email hidden from other users) |
| Restricted | Password hashes, refresh token hashes, MFA secrets and backup codes, audit logs, encryption keys | Never returned by the API; MFA secret and audit details encrypted at rest; backups encrypted |

#### Encryption at rest

- Application-level AES-256-GCM for `mfaSecretEnc` and `detailsEnc` (S2).
- Database volume on an encrypted disk (BitLocker, LUKS, FileVault) for the local lab; managed encrypted storage in production.
- Backups encrypted with `age` (S13).
- Cloudinary stores the images; check its security documentation for its encryption-at-rest statement and record it as a third-party control.

#### Masking for non-production

`scripts/anonymize-for-dev.ts` runs against a **copy** of production data before it is used in staging or development:

```ts
await prisma.$transaction(async (tx) => {
  const users = await tx.user.findMany({ select: { id: true } });
  for (const [i, u] of users.entries()) {
    await tx.user.update({ where: { id: u.id },
      data: { email: `user${i}@example.test`, passwordHash: DEV_HASH, mfaEnabled: false, mfaSecretEnc: null } });
  }
  await tx.profile.updateMany({ data: { fullName: null, bio: null, avatarUrl: null, avatarPublicId: null } });
  await tx.session.deleteMany(); await tx.oneTimeToken.deleteMany();
});
```

Refuse to run unless `NODE_ENV !== 'production'`.

#### Retention and secure deletion

| Data | Retention | Mechanism |
|---|---|---|
| Sessions and refresh tokens | 30 days after expiry or revocation | Nightly job |
| One-time tokens | 7 days after expiry | Nightly job |
| Read notifications | 90 days | Nightly job |
| Audit logs | 12 months online, then encrypted archive for 24 months | Archive procedure (S14) |
| Backups | 30 daily, 12 weekly | Backup script |
| Deleted accounts | Removed at once; remain in backups until those expire (maximum 30 days for daily backups) | Documented in the privacy notice |

```ts
@Injectable()
export class RetentionJob {
  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 3 * * *')
  async run() {
    const day = 86_400_000, now = Date.now();
    await this.prisma.session.deleteMany({ where: { OR: [{ expiresAt: { lt: new Date(now - 30 * day) } }, { revokedAt: { lt: new Date(now - 30 * day) } }] } });
    await this.prisma.oneTimeToken.deleteMany({ where: { expiresAt: { lt: new Date(now - 7 * day) } } });
    await this.prisma.notification.deleteMany({ where: { isRead: true, createdAt: { lt: new Date(now - 90 * day) } } });
  }
}
```

Enable it with `ScheduleModule.forRoot()` in `AppModule`.

#### Account deletion and data export (also closes the gap noted in the database design)

`DELETE /me` `{password, mfaCode?}`:

1. Verify the password (and MFA if enabled).
2. Delete the Cloudinary avatar and every post image of the user (`safeDelete`).
3. In one transaction decrement `followersCount` for everyone the user follows and `followingCount` for everyone who follows the user, then delete the `users` row (everything else cascades).
4. Write an `ACCOUNT_DELETED` audit event containing only the id (no email).

`GET /me/export` returns the user's own profile, posts, follows, notifications and consent record as JSON and writes `DATA_EXPORTED`.

**Verify:** after `DELETE /me` the user's posts and files are gone, other users' counters dropped by one, and the audit log has the event.

---

### S13. Backups (spec 3)

Targets: **RPO** 24 hours (nightly full backup) for the course lab, **RTO** 2 hours. Production with WAL archiving can reach an RPO of minutes (see Tier 2).

#### Tier 1: nightly encrypted full backup (required)

Create an `age` key pair once (`age-keygen -o backup.key`), keep `backup.key` offline, and put the public key in `BACKUP_AGE_RECIPIENT`.

`scripts/backup.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
DIR=${BACKUP_DIR:-./backups}
mkdir -p "$DIR"
OUT="$DIR/news_share_$STAMP.dump.age"

# 1) full logical dump, encrypted in the pipe (nothing unencrypted touches disk)
pg_dump --format=custom --no-owner "$DATABASE_URL" | age -r "$BACKUP_AGE_RECIPIENT" -o "$OUT"
sha256sum "$OUT" > "$OUT.sha256"

# 2) second medium / offsite copy (S3 or B2 bucket with Object Lock for the immutable copy)
rclone copy "$OUT" "offsite:news-share-backups/" --s3-no-check-bucket
rclone copy "$OUT.sha256" "offsite:news-share-backups/"

# 3) retention on local copies (30 days)
find "$DIR" -name 'news_share_*.age*' -mtime +30 -exec shred -u {} \;

# 4) audit trail for the backup operation
npx ts-node scripts/log-audit-event.ts BACKUP_CREATED SUCCESS "$(basename "$OUT")"
```

`scripts/log-audit-event.ts` is a ten-line script that boots `AuditService` (or inserts through Prisma using the same hash chain) so that backup and restore events appear in the same tamper-evident log. If the script fails, `trap` an `ERR` handler that logs `BACKUP_FAILED` and sends a HIGH alert.

Schedule it nightly (cron: `0 2 * * * /opt/news-share/scripts/backup.sh`).

#### 3-2-1 and immutability

| Rule | News Share implementation |
|---|---|
| 3 copies | Live database, local encrypted backup, offsite encrypted backup |
| 2 media types | Local disk (SSD) and cloud object storage |
| 1 offsite | S3-compatible bucket in another location/provider |
| Immutable copy | Offsite bucket with Object Lock (compliance or governance mode, 30 days retention) |

For a purely local demo, mark a backup immutable with `sudo chattr +i file` (Linux) and show that deletion fails; describe Object Lock as the production design.

#### Tier 2: incremental backups and point-in-time recovery

Use WAL archiving for continuous incremental backups plus a weekly base backup (`pg_basebackup`). In production, `pgBackRest` or WAL-G handles full, differential and incremental backups with encryption and retention. Configure with `archive_mode=on` and an `archive_command` that copies WAL segments to the encrypted store. This reduces RPO from 24 hours to minutes.

#### Cloudinary images

The database backup does not contain image files. Enable Cloudinary's backup feature if your plan includes it, or periodically export the asset list with the Admin API and download the originals into the same encrypted, offsite process. Record the choice in the backup policy.

#### Access control, disposal, restore testing

- Backups and keys are readable only by the admin account running the job (`chmod 600`, directory `700`); the age private key is stored offline.
- Secure disposal: delete with `shred -u` for files on disk; for cloud objects use lifecycle expiry; for retired media follow NIST SP 800-88 (cryptographic erase by destroying the key, or physical destruction). Record disposal in the audit log.
- Restore test, monthly, `scripts/restore-test.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
START=$(date +%s)
LATEST=$(ls -1t backups/news_share_*.dump.age | head -1)
sha256sum -c "$LATEST.sha256"

docker run -d --name restore_test -e POSTGRES_PASSWORD=x -p 55432:5432 postgres:16
sleep 8
age -d -i "$BACKUP_AGE_IDENTITY" "$LATEST" | pg_restore --no-owner -d "postgresql://postgres:x@localhost:55432/postgres"

# sanity checks
psql "postgresql://postgres:x@localhost:55432/postgres" -c "SELECT count(*) AS users FROM users;" -c "SELECT count(*) AS posts FROM posts;"
DATABASE_URL="postgresql://postgres:x@localhost:55432/postgres" npx ts-node scripts/verify-audit-chain.ts

docker rm -f restore_test
echo "Restore took $(( $(date +%s) - START )) seconds"
npx ts-node scripts/log-audit-event.ts RESTORE_TESTED SUCCESS "$LATEST"
```

The duration printed is your measured RTO for the report.

**Verify:** run `backup.sh`, run `restore-test.sh`, confirm the restored database has the same row counts and the audit chain verifies.

---

### S14. Centralized logging, dashboards and retention (spec 2.4)

The API already writes JSON logs (pino) to stdout and security events to `audit_logs`. For a lab SIEM use Loki and Grafana; for a more complete SIEM use Wazuh or the Elastic stack.

Run the API with `node dist/main.js | tee -a logs/app.log` (or point Docker's JSON log driver at a file) and add to `docker-compose.yml`:

```yaml
  loki:
    image: grafana/loki:3.0.0
    ports: ["3100:3100"]
  promtail:
    image: grafana/promtail:3.0.0
    volumes:
      - ./logs:/var/log/news-share:ro
      - ./ops/promtail.yml:/etc/promtail/config.yml:ro
    command: -config.file=/etc/promtail/config.yml
  grafana:
    image: grafana/grafana:11.0.0
    ports: ["3001:3000"]
```

`ops/promtail.yml`:

```yaml
server: { http_listen_port: 9080 }
positions: { filename: /tmp/positions.yaml }
clients: [{ url: http://loki:3100/loki/api/v1/push }]
scrape_configs:
  - job_name: news-share
    static_configs:
      - targets: [localhost]
        labels: { job: news-share, __path__: /var/log/news-share/*.log }
```

Dashboard panels (Grafana, Loki data source):

| Panel | LogQL |
|---|---|
| Failed logins per minute | `sum(rate({job="news-share"} \|= "LOGIN_FAILED" [1m]))` |
| Account lockouts | `count_over_time({job="news-share"} \|= "ACCOUNT_LOCKED" [1h])` |
| 401 / 403 responses | `sum(rate({job="news-share"} \|~ "\"statusCode\":(401\|403)" [5m]))` |
| Server errors (5xx) | `sum(rate({job="news-share"} \|~ "\"statusCode\":5.." [5m]))` |
| Alerts raised | `{job="news-share"} \|= "\"alert\":true"` |

Also add Grafana alert rules that call the same webhook for "more than 20 failed logins in 5 minutes" so detection works even if the application alert fails.

Retention (document it in the policy): application logs 90 days (Loki `retention_period: 2160h`), audit logs 12 months online. The audit table is append-only and chained, so retention is an archive-then-purge procedure run by the system owner: export rows older than 12 months to an encrypted file with the last hash recorded as a checkpoint, then run the purge with the delete trigger disabled for that statement, then log `AUDIT_ARCHIVED` with the checkpoint hash. The chain verification then starts from the stored checkpoint instead of `GENESIS`.

Log access: only ADMINs through `GET /admin/audit-logs` (every read is itself audited); Grafana behind authentication and a read-only role for non-admins.

**Verify:** run 6 wrong logins; the Grafana failed-login panel moves and the webhook/Mailpit receives the alert.

---

### S15. Secure development, testing pipeline and deployment (spec 5)

#### Secure coding practices (5.1)

- Follow OWASP ASVS (target Level 1 for the course, with Level 2 items for authentication and sessions) and the OWASP API Security Top 10; the mapping is in section 6.
- Add `eslint-plugin-security` to `.eslintrc.js` and ban dangerous APIs:

```js
module.exports = {
  extends: ['plugin:security/recommended-legacy'],
  rules: {
    'no-restricted-syntax': ['error',
      { selector: "MemberExpression[property.name='$queryRawUnsafe']", message: 'Use parameterized Prisma queries' },
      { selector: "MemberExpression[property.name='$executeRawUnsafe']", message: 'Use parameterized Prisma queries' },
      { selector: "CallExpression[callee.name='eval']", message: 'eval is forbidden' }],
  },
};
```

- Pull request template `.github/pull_request_template.md` with a security checklist: input validated by a DTO; ownership/role check present; no secrets or PII in logs; new endpoints in Swagger and tested for 401/403; dependencies reviewed; migration reviewed.
- Peer review required for every merge; one reviewer must tick the security checklist.
- No hard-coded credentials: secrets come only from the environment, `.env` is git-ignored, gitleaks runs in CI and as a pre-commit hook. Insecure defaults are removed: the app refuses to start without the keys (S1 config validation), Swagger is off in production, `CAPTCHA_ENABLED` defaults to true.

#### CI pipeline (5.2)

`.github/workflows/security.yml`:

```yaml
name: ci-security
on: [push, pull_request]
jobs:
  build-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_USER: news_share, POSTGRES_PASSWORD: news_share_pw, POSTGRES_DB: news_share_test }
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U news_share" --health-interval 5s --health-timeout 3s --health-retries 10
    env:
      DATABASE_URL: postgresql://news_share:news_share_pw@localhost:5432/news_share_test?schema=public
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx prisma migrate deploy
      - run: npm run lint
      - run: npm run test:e2e
  sast:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install semgrep && semgrep scan --config p/owasp-top-ten --config p/nodejs --config p/typescript --error
  secrets:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: gitleaks/gitleaks-action@v2
  dependencies:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm audit --audit-level=high
  container:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t news-share-api:ci .
      - uses: aquasecurity/trivy-action@master
        with: { image-ref: news-share-api:ci, severity: 'HIGH,CRITICAL', exit-code: '1' }
  dast:
    runs-on: ubuntu-latest
    needs: build-test
    steps:
      - uses: actions/checkout@v4
      - run: docker compose -f docker-compose.staging.yml up -d --build && sleep 20
      - run: docker run --network host -v $PWD:/zap/wrk ghcr.io/zaproxy/zaproxy:stable zap-api-scan.py -t http://localhost:3000/docs-json -f openapi -r zap-report.html
      - uses: actions/upload-artifact@v4
        with: { name: zap-report, path: zap-report.html }
```

For the DAST job the staging compose file must run with `NODE_ENV=staging` so that `/docs-json` is exposed (S9 disables Swagger only when `NODE_ENV=production`). Pin third-party actions to a commit or version tag before relying on them. Enable Dependabot (`.github/dependabot.yml`, npm and docker, weekly).

**Penetration testing (before a major release):** run only against your own staging environment, with written scope. Checklist: OWASP ZAP active scan with an authenticated context, Burp Suite manual tests (IDOR, mass assignment, JWT tampering, race conditions on follow and role approval), `sqlmap` against search and list endpoints, upload fuzzing, brute-force and rate-limit checks, TLS scan. Record findings in the risk register with severity, fix and retest date.

#### Secure deployment (5.3)

- **Staging:** `docker-compose.staging.yml` identical to production except for data (masked, S12) and keys. Every release is deployed and tested there first (smoke test from `news_share_implementation_steps.md` Step 16, plus the security tests of section 5).
- **Reproducible builds:** `package-lock.json` committed, `npm ci`, a multi-stage Dockerfile that runs as a non-root user, images tagged with the Git commit.

```dockerfile
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build && npm prune --omit=dev

FROM node:20-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package*.json ./
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

- **Version control:** protected `main` branch, required reviews and passing CI before merge, signed tags for releases.
- **Rollback:** Prisma has no automatic down migrations, so a rollback is: (1) `scripts/backup.sh` immediately before the deploy, (2) redeploy the previous image tag, (3) if a migration must be undone, restore the pre-deploy backup (practice this on staging). Write migrations in two steps (add, then remove later) so the previous version keeps working.

**Verify:** a pull request with a planted fake secret fails the `secrets` job; one with `$queryRawUnsafe` fails lint; the ZAP report is attached to the run.

---

### S16. Incident response, continuity, training, governance (spec 6 and 8)

These are mostly documents. Create a `docs/security/` folder with the files below. Each outline is written for News Share so it can be filled in rather than invented.

#### `incident-response-plan.md` (6.1)

| Item | Content |
|---|---|
| Roles | Incident Commander, Security Lead, Developer on call, Communications owner (for user notices), Scribe |
| Severity | SEV1 data breach or full outage; SEV2 compromised admin/privileged account or active attack; SEV3 contained anomaly; SEV4 suspicious event |
| Phases | Detection → Containment → Eradication → Recovery → Post-incident review |
| Contacts | Name, phone, email, backup contact for each role; hosting, Cloudinary, DNS and mail providers; legal/regulator contact |
| Escalation | The severity table in S3 |
| Evidence | Preserve logs and the audit chain head hash; do not delete anything before copying it |

News Share runbooks (one page each):

| Scenario | Containment and recovery |
|---|---|
| Credential-stuffing wave | Tighten throttling, require CAPTCHA on login, lock targeted accounts, notify users, review `LOGIN_FAILED` by IP in Grafana |
| Stolen refresh token | Detected as `REFRESH_REUSE_DETECTED`; session already revoked; `POST /admin/users/:id/revoke-sessions`; email the user |
| Leaked `JWT_ACCESS_SECRET` | Rotate the secret, restart, run `scripts/revoke-all-sessions.ts` (marks every session revoked), force re-login, review audit log for the exposure window |
| Leaked Cloudinary key | Rotate the key in the Cloudinary console, update the environment, review uploads in the window |
| Compromised admin account | Lock account, revoke sessions, review `ROLE_*` and `ADMIN` events, verify audit chain, reset MFA, run access review |
| Database tampering or audit chain break | Treat as SEV1; isolate, verify chain from last checkpoint, restore from the last good backup, rotate keys |
| Ransomware / data loss | Isolate, restore the immutable backup (S13), rotate all secrets, verify counts and chain |
| Suspected personal-data breach | Assess scope, contain, notify within the legal deadline (see below), document |

Post-incident review template: timeline, root cause, what worked, what did not, actions with owner and due date, update the risk register.

#### `business-continuity-and-dr.md` (6.2)

| Component | RPO | RTO | Strategy |
|---|---|---|---|
| PostgreSQL | 24 h (Tier 1) or 15 min (WAL, Tier 2) | 2 h | Restore from encrypted backup (S13) |
| API | none (stateless; sessions live in the database) | 30 min | Redeploy image; `restart: unless-stopped`; second replica behind the proxy |
| Cloudinary images | Provider SLA | Provider SLA | Backup export of assets |
| Mail | n/a | 4 h | Switch SMTP provider; verification and reset can be retried |
| Secrets and keys | n/a | 1 h | Stored offline in a password manager / vault; documented rotation |

DR drill (twice a year): declare a simulated loss of the database host, restore to a clean machine, point a staging API at it, run the smoke and security tests, measure time against the RTO, record in the report. If you run two API replicas, the rate-limit store must move from memory to Redis.

#### `security-awareness-training.md` (6.3)

- Audience and topics: phishing, password hygiene (use a password manager, no reuse), enabling MFA, recognizing the app's real verification emails, reporting incidents. Admins and moderators additionally: role approval etiquette, never sharing sessions, reporting lost devices.
- In-product reinforcement: strength hints on the password field, an MFA nudge after login, "new device signed in" emails, the Security notice emails from S4.
- Periodic campaigns: quarterly one-page reminders; a simulated phishing exercise in a controlled setting with participants' knowledge and consent (for example a self-hosted GoPhish campaign in a class lab), measuring click and report rates.

#### Governance and compliance (section 8)

Policies to write (two pages each): Information Security Policy, Acceptable Use Policy, Access Control Policy (roles, approvals, quarterly review), Password and MFA Policy (the S4 and S7 rules), Backup and Retention Policy (S12, S13), Logging and Monitoring Policy (S3, S14), Incident Response (S16), Change Management.

Risk register (keep it in `docs/security/risk-register.md` and update after every test round):

| ID | Asset | Threat | Likelihood | Impact | Score | Treatment | Owner | Status |
|---|---|---|---|---|---|---|---|---|
| R1 | User accounts | Credential stuffing | High | High | 9 | Lockout, throttling, CAPTCHA, HIBP, MFA | Backend lead | Mitigated |
| R2 | Refresh tokens | Theft and replay | Medium | High | 6 | Rotation, reuse detection, secure storage | Backend lead | Mitigated |
| R3 | Admin role | Privilege abuse | Low | Critical | 6 | SoD approval, audit, alerts, quarterly review | System owner | Mitigated |
| R4 | Audit logs | Tampering | Low | High | 4 | Append-only trigger, HMAC chain, off-host head hash | System owner | Mitigated |
| R5 | Database | Data loss, ransomware | Medium | Critical | 8 | Encrypted 3-2-1 backups, immutable copy, restore tests | Ops | In progress |
| R6 | Uploads | Malicious file, privacy leak (EXIF) | Medium | Medium | 4 | Magic-byte check, re-encode, size limits | Backend lead | Mitigated |
| R7 | Dependencies | Known vulnerabilities | High | Medium | 6 | npm audit, Dependabot, Trivy | Backend lead | Ongoing |
| R8 | Secrets | Leak in repo | Medium | High | 6 | gitleaks, env-only secrets, rotation runbook | Backend lead | Mitigated |
| R9 | Third parties | Cloudinary, mail, CAPTCHA, HIBP outage or data transfer | Medium | Medium | 4 | Fail-safe behavior, vendor review | System owner | Open |
| R10 | Personal data | Breach or non-compliance | Low | High | 4 | Minimization, encryption, retention, IR plan | System owner | In progress |

Score = likelihood (1 to 3) × impact (1 to 3), with Critical counted as 4 for impact so the maximum is 12; adjust the scale to your instructor's template.

Change management (`docs/security/change-management.md`): every security-relevant change (auth, roles, crypto, logging, backup, infrastructure) goes through a pull request with the security checklist, a rollback plan, staging verification, and a recorded approval; emergency changes are allowed with after-the-fact review within 2 working days; all changes are linked to a commit and, when they alter configuration, recorded as `CONFIG_CHANGED` by S3.

Review calendar: quarterly access review and tabletop IR exercise; monthly dependency review and restore test; twice-yearly DR drill; before each major release a penetration test.

Legal requirements (Ethiopia): the Personal Data Protection Proclamation No. 1321/2024 came into force on 24 July 2024 and is enforced by the Ethiopian Communications Authority. Secondary sources describe it as consent-based, requiring security measures and breach reporting (one source says within 72 hours), and as restricting transfers abroad and favoring local storage. I could not read the proclamation text itself, so verify every point below against the official text or with a lawyer before relying on it:

| Topic | Effect on News Share |
|---|---|
| Consent | Registration stores `consentAt` and `consentVersion`; show a privacy notice; `acceptTerms` is mandatory |
| Minimization | Collect email, password, username only; `fullName` and `bio` stay optional |
| Rights (access, correction, deletion) | `GET /me/export`, `PATCH /me`, `DELETE /me` |
| Security measures | Sections S2 to S14 |
| Breach reporting | IR plan includes a notification step with the legal deadline |
| Cross-border transfer / localization | Cloudinary, the mail provider, reCAPTCHA and HIBP are processors outside the country; record them in a processor list and review whether local storage or transfer conditions apply to your hosting choice |

If you also have users in the EU, GDPR applies on its own terms.

---

### S17. Flutter client changes

| Spec item | Client work |
|---|---|
| Secure token storage (1.4) | Store both tokens only in `flutter_secure_storage` (iOS Keychain, Android Keystore); never in shared preferences, logs or files |
| Biometric authentication with fallback (1.2) | After the first login, store the refresh token behind `local_auth`; on app start ask for fingerprint/face; if unavailable or failed, fall back to the password (and MFA). The server stays unaware: biometrics only unlock the local secret |
| Registration | Add password-strength guidance, `acceptTerms` checkbox, CAPTCHA step, "check your email" screen; handle the new `201 {message}` (no tokens) |
| Email verification | Handle the link (deep link or small web page) that posts the token to `POST /auth/verify-email` |
| Login | Handle `{mfaRequired, mfaToken}` with a code screen (and "use a backup code"); show a generic error for any `401` |
| Sessions | Settings screen listing `GET /me/sessions` with "sign out other devices" |
| MFA enrollment | Show the QR code from `qrCodeDataUrl`, ask for a first code, then show the backup codes once with a save prompt |
| Idle timeout | Treat `401` from an idle session as "session expired", clear tokens, go to login |
| TLS | Use `https://` only; do not disable certificate validation; optionally pin the certificate or public key |
| Output encoding | Render user text with `Text` widgets only; never load post content into a `WebView` as HTML |
| CSRF (1.4) | Not applicable to Bearer-header auth in a mobile app; if you later add a web client, use an HttpOnly, Secure, SameSite=Strict refresh cookie plus an anti-CSRF token |

---

## 5. Test plan

### 5.1 Test setup

- Separate test database and `.env.test` (see `news_share_implementation_steps.md`, Step 17).
- Mock `MailService` to capture emails, `CaptchaService` to accept tokens, `StorageService` to avoid Cloudinary, and stub `fetch` for HIBP.
- Helpers in `test/helpers.ts`:

```ts
export const outbox: { to: string; subject: string; text: string }[] = [];
export const MailMock = {
  sendRaw: async (to, subject, text) => void outbox.push({ to, subject, text }),
  sendVerification: async (to, token) => void outbox.push({ to, subject: 'verify', text: token }),
  sendPasswordReset: async (to, token) => void outbox.push({ to, subject: 'reset', text: token }),
  sendAccountExists: async () => undefined, sendLockNotice: async () => undefined, sendSecurityNotice: async () => undefined,
};

export const GOOD_PASSWORD = 'Tr4in-Station-Lamp-77!';

export async function registerVerified(app, email: string, username: string) {
  await request(app.getHttpServer()).post('/api/v1/auth/register')
    .send({ email, password: GOOD_PASSWORD, username, acceptTerms: true, captchaToken: 't' }).expect(201);
  const token = outbox.filter((m) => m.to === email && m.subject === 'verify').pop()!.text;
  await request(app.getHttpServer()).post('/api/v1/auth/verify-email').send({ token }).expect(200);
  const res = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password: GOOD_PASSWORD }).expect(200);
  return { ...res.body, auth: { Authorization: `Bearer ${res.body.accessToken}` } };
}

export const promote = (prisma, userId, role) =>
  prisma.user.update({ where: { id: userId }, data: { role } });     // test shortcut only
```

### 5.2 Test matrix

Run the automated cases with `npm run test:e2e`; manual cases are done on staging or the local lab and documented with a screenshot or command output.

| ID | Spec | Test | Expected | Type |
|---|---|---|---|---|
| T-RBAC-01 | 1.1 | USER calls `GET /admin/users` | 403 | Auto |
| T-RBAC-02 | 1.1 | MODERATOR deletes another user's post via `/moderation/posts/:id` | 204, audit event `MODERATION_POST_REMOVED` | Auto |
| T-RBAC-03 | 1.1 | MODERATOR calls `/admin/audit-logs` | 403 | Auto |
| T-RBAC-04 | 1.1 | USER sends `PATCH /me {role:'ADMIN'}` | 400 (unknown field rejected) | Auto |
| T-RBAC-05 | 1.1 | Admin A creates a request, A approves it | 403 (requester cannot approve) | Auto |
| T-RBAC-06 | 1.1 | USER requests MODERATOR for self, tries to approve it (as USER) | 403 on approve | Auto |
| T-RBAC-07 | 1.1 | Admin B approves; target's old access token used | role changed; old token 401; target's new login has new role | Auto |
| T-RBAC-08 | 1.1 | Demote the only admin | 400 "last admin" | Auto |
| T-RBAC-09 | 1.1 | Role events in audit log with actor, target and reason | Present | Auto |
| T-RBAC-10 | 1.1 | `GET /admin/access-review` lists stale privileged users | `stale: true` for no login in 90 days | Auto |
| T-REG-01 | 1.2 | Register, then login before verifying | Login 403 | Auto |
| T-REG-02 | 1.2 | Verify with a valid token, then login | 200 | Auto |
| T-REG-03 | 1.2 | Reuse the verification token | 400 | Auto |
| T-REG-04 | 1.2 | Expired verification token (set `expiresAt` in the past) | 400 | Auto |
| T-REG-05 | 1.2 | Register with the same email twice | Same 201 body both times; only one account; the owner is emailed | Auto |
| T-REG-06 | 1.2 | Register without `captchaToken` while CAPTCHA enabled | 400 | Auto |
| T-REG-07 | 1.2 | Register without `acceptTerms` | 400 | Auto |
| T-REC-01 | 1.2 | `forgot-password` for an unknown and a known email | Same 202 body, similar timing | Auto |
| T-REC-02 | 1.2 | Reset with a valid token, then use it again | 200, then 400 | Auto |
| T-REC-03 | 1.2 | After reset, old sessions | 401 | Auto |
| T-REC-04 | 1.2 | Reset for an MFA account without a code | 401 | Auto |
| T-PWD-01 | 1.3 | Passwords `Short1!`, `aaaaaaaaaaaaaaaa`, one containing the username | 400 with reasons | Auto |
| T-PWD-02 | 1.3 | HIBP stub returns the hash suffix | 400 breached | Auto |
| T-PWD-03 | 1.3 | HIBP stub times out | Registration still works, warning logged | Auto |
| T-PWD-04 | 1.3 | Inspect `users.password_hash` | Starts with `$argon2id$`, never plaintext | Auto |
| T-PWD-05 | 1.3 | Imported bcrypt hash logs in, then check the hash | Login 200; hash is now argon2id | Auto |
| T-LOCK-01 | 1.3 | 5 wrong passwords, then the correct one | 6th attempt 401 (locked); `ACCOUNT_LOCKED` audited; alert sent | Auto |
| T-LOCK-02 | 1.3 | After `lockedUntil` passes (set it in the past) | Correct password works, counter reset | Auto |
| T-LOCK-03 | 1.3 | Wrong password vs unknown email | Identical status and message | Auto |
| T-LOCK-04 | 1.3 | Password reset while locked | Account unlocked | Auto |
| T-RATE-01 | 1.3, 4.5 | 11 login requests in one minute | 429 on the 11th | Auto |
| T-RATE-02 | 4.5 | Same for `forgot-password`, `verify-email`, `mfa/verify` | 429 | Auto |
| T-TLS-01 | 1.3, 4.4 | `testssl.sh` or `nmap --script ssl-enum-ciphers` against the proxy | TLS 1.2/1.3 only; no SSLv3, TLS 1.0/1.1; HSTS present | Manual |
| T-TLS-02 | 1.3 | `curl -I http://host` | 301 to HTTPS | Manual |
| T-TLS-03 | 1.3 | Search logs and URLs for a test password | Not found | Manual |
| T-TOK-01 | 1.4 | Expired, tampered, `alg: none` and wrong-secret tokens | 401 | Auto |
| T-TOK-02 | 1.4 | Refresh rotation: use refresh token R1 (gets R2), then R1 again | Second use 401, session revoked, R2 also fails | Auto |
| T-TOK-03 | 1.4 | `POST /auth/logout` then reuse the access token | 401 | Auto |
| T-TOK-04 | 1.4 | `logout-all` with two sessions | Both sessions revoked | Auto |
| T-TOK-05 | 1.4 | Set `lastActiveAt` 31 minutes back | Next request 401 (idle timeout) | Auto |
| T-TOK-06 | 1.4 | Set `expiresAt` in the past | 401 (absolute timeout) | Auto |
| T-TOK-07 | 1.4 | Login twice | Different session ids (no fixation) | Auto |
| T-TOK-08 | 1.4 | Responses contain no `Set-Cookie` | Header absent (Bearer auth, so no CSRF surface) | Auto |
| T-TOK-09 | 1.4 | Flutter: inspect app storage on a test device | Tokens only in Keychain/Keystore | Manual |
| T-MFA-01 | 1.5 | Enable MFA, login | `mfaRequired` response, no tokens | Auto |
| T-MFA-02 | 1.5 | Wrong code, then correct code | 401, then 200 | Auto |
| T-MFA-03 | 1.5 | Reuse the same valid code | 401 (replay rejected) | Auto |
| T-MFA-04 | 1.5 | Backup code once, then again | 200, then 401 | Auto |
| T-MFA-05 | 1.5 | 5 wrong MFA codes | Account locked | Auto |
| T-MFA-06 | 1.5 | `mfa/disable` without password or code | 401; with both 200, `MFA_DISABLED` alert | Auto |
| T-MFA-07 | 1.5 | Inspect `mfa_secret_enc` | Ciphertext (`v1.…`), not the base32 secret | Auto |
| T-AUD-01 | 2.1 | Login success/failure, post create, follow | Audit rows with actor, IP, action, outcome, timestamp | Auto |
| T-AUD-02 | 2.1 | Unauthenticated and forbidden requests | `UNAUTHENTICATED_REQUEST` / `FORBIDDEN_REQUEST` rows | Auto |
| T-AUD-03 | 2.1 | Search audit `details` for password or token strings | None | Auto |
| T-AUD-04 | 2.2 | Start and stop the app | `SYSTEM_STARTUP`, `SYSTEM_SHUTDOWN`; changing a config value gives `CONFIG_CHANGED` | Manual |
| T-AUD-05 | 2.3 | Read `details_enc` in the database | Ciphertext only | Auto |
| T-AUD-06 | 2.3 | `UPDATE`/`DELETE`/`TRUNCATE` on `audit_logs` | Rejected by trigger | Auto |
| T-AUD-07 | 2.3 | Disable the trigger on the **test** DB, edit one row, call `/admin/audit-logs/verify` | `ok: false`, `brokenAtSeq` set, CRITICAL alert | Auto |
| T-AUD-08 | 2.3 | USER/MODERATOR calls `/admin/audit-logs` | 403 | Auto |
| T-LOG-01 | 2.4 | Run the scenarios, open Grafana | Panels show events; logs searchable | Manual |
| T-ALR-01 | 2.5 | 5 failed logins from one IP | Webhook/Mailpit alert received within a minute | Auto/Manual |
| T-ALR-02 | 2.5 | Approve a role change | HIGH alert sent | Auto |
| T-BKP-01 | 3 | Run `backup.sh` | Encrypted `.age` file, checksum, offsite copy, `BACKUP_CREATED` audit | Manual |
| T-BKP-02 | 3 | Try to read the backup without the key | Fails | Manual |
| T-BKP-03 | 3 | Run `restore-test.sh` | Row counts match, audit chain verifies, duration recorded | Manual |
| T-BKP-04 | 3 | Delete or overwrite the immutable copy | Denied by Object Lock (or `chattr +i` in the lab) | Manual |
| T-BKP-05 | 3 | Run backup as a different OS user | Permission denied | Manual |
| T-VAL-01 | 4.1 | `' OR 1=1 --` and `'; DROP TABLE users;--` in `search` and in text fields | Treated as plain text; normal results; tables intact | Auto |
| T-VAL-02 | 4.1 | Unknown fields, wrong types, 10 MB JSON body | 400 / 413 | Auto |
| T-VAL-03 | 4.1 | Post title `<script>alert(1)</script>` | Stored and returned as a JSON string; `Content-Type: application/json`, `nosniff`; Flutter shows literal text | Auto/Manual |
| T-VAL-04 | 4.1 | Upload `.txt` renamed `.png`; PNG header with junk body; oversized file; SVG | 400 / 413 | Auto |
| T-VAL-05 | 4.1 | Upload a JPEG with GPS EXIF | Stored image has no EXIF | Auto |
| T-VAL-06 | 4.1 | Search the codebase for `$queryRawUnsafe` | None (lint enforces) | Auto |
| T-ERR-01 | 4.2 | Force a 500 | Body is `Internal server error`; no stack, SQL or paths | Auto |
| T-ERR-02 | 4.2 | Prisma errors (duplicate, missing row) | Generic 409 / 404 | Auto |
| T-HDR-01 | 4.3 | Any response | HSTS (via the proxy), CSP, nosniff, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, no `X-Powered-By` | Auto |
| T-DATA-01 | 4.4 | `users` and `profiles` responses for another user | No email, hash or secrets | Auto |
| T-DATA-02 | 4.4 | Run the anonymize script on a copy | No real emails or names remain | Manual |
| T-DATA-03 | 4.4 | Retention job with old rows | Expired sessions, tokens, read notifications removed | Auto |
| T-DATA-04 | 4.4 | `DELETE /me` | Rows, Cloudinary assets deleted; others' counters corrected; audit event | Auto |
| T-API-01 | 4.5 | For every non-public route in `/docs-json`, call it anonymously | 401 | Auto |
| T-API-02 | 4.5 | Production mode: `/docs`, `/docs-json` | 404 | Auto |
| T-API-03 | 4.5 | IDOR: B edits A's post, marks A's notification read, deletes A's session | 403 / 404 | Auto |
| T-API-04 | 4.5 | `limit=1000`, search term of 10,000 characters | 400 | Auto |
| T-SDLC-01 | 5.2 | CI: SAST, secrets, dependency, container scans | Pass; a planted issue fails the job | CI |
| T-SDLC-02 | 5.2 | ZAP baseline/API scan against staging | No High findings; report archived | CI/Manual |
| T-SDLC-03 | 5.2 | Penetration test checklist | Findings logged in the risk register | Manual |
| T-DEP-01 | 5.3 | Deploy to staging, run smoke and security tests, then roll back | Previous version restored from tag and backup | Manual |
| T-IR-01 | 6.1 | Tabletop exercise with one runbook (stolen refresh token) | Roles, timings and gaps recorded | Manual |
| T-DR-01 | 6.2 | DR drill | Measured RTO meets the target | Manual |

### 5.3 Example e2e tests

```ts
describe('Account lockout (T-LOCK-01, T-LOCK-02, T-LOCK-03)', () => {
  it('locks after 5 failures and unlocks after the lock expires', async () => {
    await registerVerified(app, 'lock@example.com', 'lock_user');
    const login = (password: string) =>
      request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: 'lock@example.com', password });

    for (let i = 0; i < 5; i++) await login('wrong-password-1!').expect(401);
    await login(GOOD_PASSWORD).expect(401);                                   // correct password, but locked

    await prisma.user.update({ where: { email: 'lock@example.com' }, data: { lockedUntil: new Date(Date.now() - 1000) } });
    await login(GOOD_PASSWORD).expect(200);

    const unknown = await request(app.getHttpServer()).post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'whatever-1234!' }).expect(401);
    const wrong = await login('wrong-password-1!').expect(401);
    expect(unknown.body.message).toEqual(wrong.body.message);                 // no account enumeration
  });
});

describe('Refresh token reuse (T-TOK-02)', () => {
  it('revokes the session when an old refresh token is replayed', async () => {
    const { refreshToken } = await registerVerified(app, 'r@example.com', 'refresher');
    const r2 = await request(app.getHttpServer()).post('/api/v1/auth/refresh').send({ refreshToken }).expect(200);
    await request(app.getHttpServer()).post('/api/v1/auth/refresh').send({ refreshToken }).expect(401);       // replay
    await request(app.getHttpServer()).post('/api/v1/auth/refresh').send({ refreshToken: r2.body.refreshToken }).expect(401);
  });
});

describe('Role separation of duties (T-RBAC-05, T-RBAC-07)', () => {
  it('requester cannot approve; a second admin can; the target is forced to re-login', async () => {
    const a1 = await registerVerified(app, 'a1@example.com', 'admin_one');
    const a2 = await registerVerified(app, 'a2@example.com', 'admin_two');
    const u  = await registerVerified(app, 'u@example.com',  'plain_user');
    await promote(prisma, a1.profile.id, 'ADMIN'); await promote(prisma, a2.profile.id, 'ADMIN');
    const admin1 = (await login(app, 'a1@example.com')).auth, admin2 = (await login(app, 'a2@example.com')).auth;

    const created = await request(app.getHttpServer()).post('/api/v1/role-requests').set(admin1)
      .send({ targetUserId: u.profile.id, requestedRole: 'MODERATOR', reason: 'Community moderation' }).expect(201);

    await request(app.getHttpServer()).post(`/api/v1/role-requests/${created.body.id}/approve`).set(admin1).expect(403);
    await request(app.getHttpServer()).post(`/api/v1/role-requests/${created.body.id}/approve`).set(admin2).expect(200);

    await request(app.getHttpServer()).get('/api/v1/me').set(u.auth).expect(401);       // old session revoked
    const again = await login(app, 'u@example.com');
    await request(app.getHttpServer()).delete(`/api/v1/moderation/posts/${somePostId}`).set(again.auth)
      .send({ reason: 'spam' }).expect(204);
  });
});

describe('Route coverage (T-API-01)', () => {
  it('every non-public route rejects anonymous requests', async () => {
    const doc = buildSwaggerDocument(app);
    const publicPaths = ['/auth/register', '/auth/login', '/auth/refresh', '/auth/verify-email', '/auth/resend-verification',
                         '/auth/forgot-password', '/auth/reset-password', '/auth/mfa/verify', '/health'];
    for (const [path, methods] of Object.entries(doc.paths)) {
      if (publicPaths.some((p) => path.endsWith(p))) continue;
      for (const method of Object.keys(methods as object)) {
        const url = '/api/v1' + path.replace(/{[^}]+}/g, '00000000-0000-0000-0000-000000000000');
        await (request(app.getHttpServer()) as any)[method](url).expect(401);
      }
    }
  });
});

describe('Audit chain (T-AUD-06, T-AUD-07)', () => {
  it('rejects edits and detects tampering', async () => {
    await audit.log({ category: 'AUTH', action: 'TEST_EVENT', outcome: 'SUCCESS' });
    await expect(prisma.$executeRaw`UPDATE audit_logs SET action = 'x'`).rejects.toThrow(/append-only/);

    expect((await audit.verifyChain()).ok).toBe(true);
    await prisma.$executeRaw`ALTER TABLE audit_logs DISABLE TRIGGER audit_logs_no_change`;   // test database only
    await prisma.$executeRaw`UPDATE audit_logs SET action = 'TAMPERED' WHERE seq = (SELECT min(seq) FROM audit_logs)`;
    await prisma.$executeRaw`ALTER TABLE audit_logs ENABLE TRIGGER audit_logs_no_change`;
    expect((await audit.verifyChain()).ok).toBe(false);
  });
});

describe('Security headers and error handling (T-HDR-01, T-ERR-01)', () => {
  it('sets the required headers', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/feed').expect(401);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['set-cookie']).toBeUndefined();
  });
  it('does not leak internals on 500', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/__test/boom');      // test-only route that throws
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/stack|prisma|SELECT|node_modules|\\/src\\//i);
  });
});
```

`HSTS` is set by `helmet` too, but browsers only honor it over HTTPS, so test it against the reverse proxy (T-TLS-01), not the plain HTTP test server. The `login(app, email)` helper used above is `registerVerified` without the registration step.

### 5.4 Manual and tool-based tests (commands)

```bash
# SAST and secrets
semgrep scan --config p/owasp-top-ten --config p/nodejs --config p/typescript src/
gitleaks detect --source . --redact

# dependencies and container
npm audit --audit-level=high
trivy image news-share-api:latest --severity HIGH,CRITICAL

# TLS configuration (against your own proxy)
testssl.sh --protocols --headers https://api.newsshare.local
nmap --script ssl-enum-ciphers -p 443 api.newsshare.local

# DAST with ZAP (staging only)
docker run --rm --network host -v "$PWD:/zap/wrk" ghcr.io/zaproxy/zaproxy:stable \
  zap-api-scan.py -t http://localhost:3000/docs-json -f openapi -r zap-report.html

# SQL injection probing of your own staging (never against systems you do not own)
sqlmap -u "https://staging.newsshare.local/api/v1/users?search=ada" --headers="Authorization: Bearer $TOKEN" --batch --level=2

# brute-force / rate-limit check
for i in $(seq 1 15); do curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' -d '{"email":"a@example.com","password":"x"}'; done
```

Only test systems you own or have written permission to test. Keep each tool's output as evidence.

---

## 6. Mapping to the specification (evidence for the report)

| Spec section | News Share feature | Evidence to collect |
|---|---|---|
| 1.1 RBAC | Roles, permission matrix, role-change workflow, SoD, access review | Matrix table, e2e results T-RBAC-*, audit rows, signed access-review CSV |
| 1.2 Registration | Minimal form, email verification, CAPTCHA, recovery, biometric unlock | Screenshots of Mailpit email and app flow, T-REG-*, T-REC-* |
| 1.3 Passwords | 12+ policy, HIBP, argon2id, lockout, TLS, rate limits | T-PWD-*, T-LOCK-*, T-RATE-*, `testssl` report |
| 1.4 Tokens/sessions | Rotation with reuse detection, revocation, idle and absolute timeout | T-TOK-*, session table screenshot |
| 1.5 MFA | TOTP, backup codes, recovery | T-MFA-*, enrollment screenshots |
| 2.1 to 2.2 Logging | `audit_logs` with events and system events | T-AUD-01..04, sample admin API output |
| 2.3 Log protection | Encrypted details, HMAC chain, append-only trigger, admin-only access | T-AUD-05..08 |
| 2.4 Centralized monitoring | Loki/Grafana dashboards, retention policy | Dashboard screenshots, retention document |
| 2.5 Alerting | Alert rules, severity and escalation table | T-ALR-*, webhook/Mailpit screenshots |
| 3 Backups | Scripts, encryption, 3-2-1, immutable copy, restore test, audit | T-BKP-*, restore log with measured RTO |
| 4.1 Validation | DTOs, Prisma parameterized queries, upload sanitizer, encoding at render | T-VAL-* |
| 4.2 Errors | Generic filter, internal logs | T-ERR-* |
| 4.3 Headers | helmet configuration | T-HDR-01, `curl -I` output |
| 4.4 Data protection | Classification table, encryption, masking, retention, deletion | T-DATA-*, policy table |
| 4.5 API security | Global auth guard, throttling, size limits, route coverage, mTLS note | T-API-*, T-RATE-* |
| 5.1 Secure coding | ASVS mapping, lint rules, PR checklist, secret scanning | Lint config, PR template, gitleaks report |
| 5.2 Testing | CI pipeline, ZAP, pen-test checklist | Workflow runs, ZAP report, findings in the risk register |
| 5.3 Deployment | Staging, reproducible builds, rollback runbook | T-DEP-01 record |
| 6.1 to 6.3 | IR plan, BC/DR, training | Documents, T-IR-01, T-DR-01 notes |
| 8 Governance | Policies, risk register, change management, legal mapping | `docs/security/*` |

OWASP ASVS and API Top 10 quick mapping:

| Area | Controls |
|---|---|
| V2 Authentication / API2 Broken Authentication | S4, S5, S6, S7 |
| V3 Session management | S5 |
| V4 Access control / API1 BOLA, API5 BFLA | S8, ownership checks in services, T-API-03 |
| V5 Validation / API3 Property-level authorization | DTO whitelist (`forbidNonWhitelisted`), response mappers |
| V7 Logging | S3, S14 |
| V8 Data protection | S2, S12, S13 |
| V9 Communication | S9 |
| V12 Files | S10 |
| V14 Configuration / API8 Misconfiguration | S9, S15, env validation |
| API4 Unrestricted resource consumption | Throttling, body and upload limits |
| API9 Improper inventory | Swagger inventory, route coverage test |

---

## 7. Suggested order and timeline

The specification names December 7, 2026 as the submission date. Today is November 18, which leaves about 19 days. A realistic plan:

| Days | Work | Steps |
|---|---|---|
| 1 to 4 | Schema, crypto, audit log, mail, password policy, CAPTCHA, sessions, auth flows, lockout, headers | S1 to S6, S9, S11 |
| 5 to 8 | RBAC with role-change workflow, access review, admin endpoints, alerts, system events | S3 (alerts), S8 |
| 9 to 11 | MFA, upload hardening, data protection jobs, account deletion | S7, S10, S12 |
| 12 to 14 | Backups with restore test, logging dashboards | S13, S14 |
| 15 to 16 | CI pipeline, staging compose, ZAP and scans | S15 |
| 17 to 19 | Run the full test matrix, collect evidence, write the policy documents, risk register and report | Section 5, S16, section 6 |

If time is short, the controls that matter most and are fastest are: password policy and lockout, email verification, session timeouts with refresh rotation, RBAC with audit logging, security headers, and backups with a restore test. MFA, the hash-chained log and the CI scans come next. Anything you cannot finish should still appear in the report as a documented design with the reason it was deferred, rather than being claimed as done.

---

## 8. New requirements to add to the SRS

Add these to `news_share_srs.md` section 5 and trace them to the tests in section 5 of this guide.

| ID | Requirement |
|---|---|
| FR-SEC-RBAC-01..06 | Roles, least privilege, request/approve workflow, separation of duties, audit, quarterly review |
| FR-SEC-REG-01..05 | Email verification, CAPTCHA, consent, recovery, no account enumeration |
| FR-SEC-PWD-01..06 | 12+ policy, breach check, argon2id, lockout, change and reset, rate limits |
| FR-SEC-SESS-01..06 | Session store, rotation with reuse detection, revocation, idle and absolute timeout, secure client storage |
| FR-SEC-MFA-01..04 | TOTP enrollment, backup codes, replay protection, recovery |
| FR-SEC-LOG-01..08 | User, system and security events; encryption; tamper evidence; restricted access; retention; alerting |
| FR-SEC-BKP-01..07 | Scheduled encrypted backups, 3-2-1, immutable copy, restore tests, audit, disposal |
| FR-SEC-APP-01..08 | Validation, parameterized queries, output encoding, upload allow-list, generic errors, headers, size limits |
| FR-SEC-DATA-01..05 | Classification, encryption, masking, retention, deletion and export |
| FR-SEC-SDLC-01..05 | Secure coding rules, SAST, DAST, dependency scanning, CI gates, staging and rollback |
| FR-SEC-GOV-01..05 | Incident response, BC/DR, training, policies, risk register, change management |

---

## 9. References

- Project specification: `Project_I.docx` (AASTU, Computer System Security, Project One).
- OWASP ASVS, OWASP Top 10, OWASP API Security Top 10, OWASP Cheat Sheet Series (Authentication, Session Management, Password Storage, Logging).
- NIST SP 800-63B (digital identity and passwords), NIST SP 800-88 (media sanitization).
- RFC 6238 (TOTP), RFC 9110 (HTTP semantics).
- Have I Been Pwned "Pwned Passwords" range API (k-anonymity).
- Ethiopia Personal Data Protection Proclamation No. 1321/2024: secondary summaries include https://digitalpolicyalert.org (entry 24927) and law-firm guides on mondaq.com; read the official text before relying on any detail.
