# News Share: Admin Web Application & Moderation System Analysis & Implementation Guide

## 1. Executive Summary & Architectural Overview

The **News Share Admin Management and Content Moderation System** is a unified, production-ready enterprise moderation platform. It provides a dedicated **Next.js Web Admin Application** located in `admin/`, updates the existing **NestJS Backend** in `backend/`, and enhances the **Flutter Mobile App** in `frontend/news_share/`.

Both client applications (Next.js Admin Web App and Flutter Mobile App) communicate directly with the **same single NestJS backend** via REST endpoints (`http://localhost:3000/api/v1`) and real-time WebSockets (`/admin` and `/user` namespaces).

```
                      +---------------------------------------+
                      |       NestJS API + WebSockets         |
                      |       (http://localhost:3000/api/v1)  |
                      +-------------------+-------------------+
                                          |
                   +----------------------+----------------------+
                   |                                             |
                   v                                             v
     +---------------------------+                 +---------------------------+
     |   Next.js 14 Admin Web    |                 |    Flutter Mobile App     |
     |   (Dark / TikTok-Style)   |                 | (TikTok-Style Reporting & |
     |      admin/ (Port 3001)   |                 |   Account Status Screen)  |
     +---------------------------+                 +---------------------------+
                   |                                             |
                   +----------------------+----------------------+
                                          |
                                          v
                              +-----------------------+
                              | PostgreSQL Database   |
                              |   (news_store)        |
                              +-----------------------+
```

### Core Principles
1. **Zero Data Loss & Additive Migrations**: All database schema changes are strictly additive with safe defaults (`UserStatus = ACTIVE`, `PostStatus = ACTIVE`). Existing user accounts, posts, followers, and audit logs are 100% preserved. The database is never dropped or reset.
2. **Real Data Only**: No mock or hardcoded statistics are used. Dashboard metrics, charts, tables, and queues query real database state.
3. **Strict Separation of Reporting and Automated Penalties**: Reports **never** trigger automatic bans or removals. Reports only group into `ReportCase` entities and compute an advisory `priorityScore`. Human moderators/admins always make the final decision.
4. **Strict Separation of "Not Interested" vs. "Report"**: "Not Interested" is a private user recommendation preference (`NotInterested` model) that immediately hides a post from the user's feed, timeline, and search. It is never treated as a violation report and produces no audit or case record.
5. **Unified Enforcement Point (`AccountStatusService`)**: All login pathways (email/password, Google Sign-In, token refresh, JWT requests, and WebSocket handshakes) check user status via user ID. Banned, suspended, or deactivated users are rejected with structured 403 responses.
6. **Role Hierarchy & Least Privilege**:
   - `USER` (Rank 0) < `MODERATOR` (Rank 1) < `ADMIN` (Rank 2) < `SUPER_ADMIN` (Rank 3).
   - Super Admins are provisioned **strictly** through database seed or CLI; no API endpoint can create or promote to `SUPER_ADMIN`.
   - Granular permissions (`UserPermission`) govern all administrative endpoints.
7. **Same-Transaction Auditability**: Every moderation decision, user status change, role change, and post removal commits to `AuditLog` inside the same database transaction.

---

## 2. Requirements & Specification

### 2.1 Role-Based Access Control (RBAC) & Permissions

#### Roles and Hierarchy
| Role | Rank | Description |
|---|---|---|
| `USER` | 0 | Standard mobile application user. Can report posts/users, manage "Not Interested", view own activity and warnings. |
| `MODERATOR` | 1 | Staff reviewer. Can review report cases, claim cases, remove/restore posts, issue warnings, and deactivate users. |
| `ADMIN` | 2 | Staff administrator. Has moderator capabilities plus temporary suspensions, permanent bans, user management, and audit log viewing. |
| `SUPER_ADMIN` | 3 | System owner. Unrestricted access to all permissions, staff management (`ADMINS_MANAGE`), audit export (`AUDIT_EXPORT`), sensitive actions, and user soft deletion. |

#### Granular Permissions
| Permission Code | Display Label | Description | Sensitive? | Default Preset |
|---|---|---|---|---|
| `DASHBOARD_VIEW` | View Dashboard | Access admin analytics and metrics | No | MODERATOR, ADMIN |
| `USERS_VIEW` | View Users | View user lists and detailed user profiles | No | MODERATOR, ADMIN |
| `USERS_MANAGE` | Manage Users | Warn, activate, or deactivate user accounts | No | MODERATOR, ADMIN |
| `USERS_BAN` | Ban/Suspend Users | Impose temporary suspensions and permanent bans | No | ADMIN |
| `USERS_DELETE` | Delete Users | Soft-delete accounts with 30-day grace period | **Yes** (Super Admin only) | - |
| `REPORTS_VIEW` | View Reports | Access report cases and moderation queues | No | MODERATOR, ADMIN |
| `REPORTS_MODERATE` | Moderate Reports | Claim cases, make decisions, dismiss reports | No | MODERATOR, ADMIN |
| `POSTS_REMOVE` | Remove/Restore Posts | Soft-remove violating posts or restore them | No | MODERATOR, ADMIN |
| `ADMINS_MANAGE` | Manage Staff | Create, promote, update, and deactivate staff | **Yes** (Super Admin only) | - |
| `AUDIT_VIEW` | View Audit Logs | Browse and filter tamper-evident audit logs | No | ADMIN |
| `AUDIT_EXPORT` | Export Audit Logs | Export sanitized audit data to CSV or JSON | **Yes** (Super Admin only) | - |

#### Escalation Rules
- Actor rank must be strictly higher than the role being granted.
- Granted permissions must be a subset of the actor's own permissions.
- Sensitive permissions (`ADMINS_MANAGE`, `USERS_DELETE`, `AUDIT_EXPORT`) may only be granted by `SUPER_ADMIN`.
- No administrator may edit their own role or permissions.
- No administrator may target an account of equal or higher rank.

---

### 2.2 Account Status & Enforcement

#### Account Status Lifecycle
```
       +-----------------------------+
       |           ACTIVE            |
       +--------------+--------------+
                      |
         +------------+------------+
         |            |            |
         v            v            v
   +-----------+ +-----------+ +-------+
   |DEACTIVATED| | SUSPENDED | | BANNED|
   +-----+-----+ +-----+-----+ +---+---+
         |             |           |
         | (Activate)  | (Expire)  | (Unban)
         +------+------+           |
                |                  |
                v                  |
       +-----------------+         |
       |     ACTIVE      |<--------+
       +-----------------+
                |
                | (Delete - 30 day grace)
                v
       +-----------------+
       |     DELETED     |
       +-----------------+
```

- **ACTIVE**: Normal standing.
- **DEACTIVATED**: Temporary administrative hold (reversible via `/activate`, no expiry).
- **SUSPENDED**: Temporary ban with mandatory `expiresAt` timestamp. Auto-lifted by background cron job or lazy check.
- **BANNED**: Permanent ban (no expiry).
- **DELETED**: Soft-deleted account. Email preserved as unusable, sessions revoked, posts hidden.

#### Enforcement Behavior
Whenever a restricted user attempts authentication or sends an authorized request, the backend returns:
```json
{
  "statusCode": 403,
  "error": "Forbidden",
  "code": "ACCOUNT_BANNED",
  "message": "Your account cannot be used right now.",
  "restriction": {
    "type": "BAN",
    "publicReason": "Repeated violations of Community Guidelines",
    "startsAt": "2026-11-20T12:00:00.000Z",
    "expiresAt": null,
    "permanent": true,
    "appealContact": "support@newsshare.com"
  }
}
```
*Note: Internal justification notes, confidential evidence references, and admin IDs are strictly excluded from user-facing responses.*

---

### 2.3 User-Facing Reporting & Preferences

#### Dynamic Report Reasons (`GET /api/v1/report-reasons`)
| Code | Label | Weight | Description |
|---|---|---|---|
| `SEXUAL_CONTENT` | Sexual content | 5 | Sexually explicit material |
| `NUDITY` | Nudity | 5 | Nude or exposed imagery |
| `HARASSMENT_BULLYING` | Harassment or bullying | 3 | Targeting or intimidating someone |
| `HATE_SPEECH` | Hate speech | 5 | Attacks on a protected group |
| `VIOLENCE` | Violence | 5 | Violent or graphic content, threats |
| `SPAM_SCAM` | Spam or scam | 2 | Misleading, repetitive or fraudulent |
| `MISINFORMATION` | Misinformation | 2 | False or misleading information |
| `OTHER` | Other | 1 | Something else (details required) |

#### Duplicate Protection & Rate Limiting
- A user can only submit **one report per open case** on any given post or profile.
- Duplicate submissions return `409 Conflict`.
- Once a post case is resolved, a user cannot re-report that same post.
- User profile cases allow re-reporting only after a 30-day cooling-off window.
- Rate limit: Maximum 10 reports per hour per user.

#### Case Grouping & Priority Score
- All reports on target `POST:<id>` or `USER:<id>` attach to a single active `ReportCase`.
- `priorityScore = sum(reasonWeights) + (priorViolations * 5)`.
- UI Priority Levels:
  - `0 - 4`: **Low** (Gray/Blue)
  - `5 - 9`: **Medium** (Orange)
  - `10 - 19`: **High** (Amber/Red)
  - `20+`: **Critical** (Bright Red / Flashing)

---

## 3. Database Changes (Prisma Schema)

All modifications are strictly additive.

### 3.1 Extended Enums
```prisma
enum Role {
  USER
  MODERATOR
  ADMIN
  SUPER_ADMIN
  AUDITOR
}

enum UserStatus {
  ACTIVE
  DEACTIVATED
  SUSPENDED
  BANNED
  DELETED
}

enum Permission {
  DASHBOARD_VIEW
  USERS_VIEW
  USERS_MANAGE
  USERS_BAN
  USERS_DELETE
  REPORTS_VIEW
  REPORTS_MODERATE
  POSTS_REMOVE
  ADMINS_MANAGE
  AUDIT_VIEW
  AUDIT_EXPORT
}

enum RestrictionType {
  DEACTIVATION
  SUSPENSION
  BAN
}

enum RestrictionStatus {
  ACTIVE
  EXPIRED
  LIFTED
}

enum PostStatus {
  ACTIVE
  REMOVED
}

enum ReportTargetType {
  POST
  USER
}

enum ReportReason {
  SEXUAL_CONTENT
  NUDITY
  HARASSMENT_BULLYING
  HATE_SPEECH
  VIOLENCE
  SPAM_SCAM
  MISINFORMATION
  OTHER
}

enum CaseStatus {
  PENDING
  UNDER_REVIEW
  ACTION_TAKEN
  REJECTED
  RESOLVED
}

enum ModerationActionType {
  DISMISS_REPORTS
  REMOVE_POST
  RESTORE_POST
  WARN_USER
  SUSPEND_USER
  BAN_USER
  UNBAN_USER
  DEACTIVATE_USER
  ACTIVATE_USER
  DELETE_USER
  RESTORE_USER
}

enum ActivityType {
  REPORT_SUBMITTED
  REPORT_STATUS_CHANGED
  WARNING_RECEIVED
  RESTRICTION_APPLIED
  RESTRICTION_LIFTED
  POST_REMOVED
  POST_RESTORED
  ACCOUNT_STATUS_CHANGED
  PASSWORD_CHANGED
}
```

### 3.2 Additions to `User` & `Post` Models
```prisma
// User additions:
status             UserStatus        @default(ACTIVE)
statusUpdatedAt    DateTime?         @map("status_updated_at") @db.Timestamptz(6)
deletedAt          DateTime?         @map("deleted_at") @db.Timestamptz(6)
deletedById        String?           @map("deleted_by_id") @db.Uuid
mustChangePassword Boolean           @default(false) @map("must_change_password")
lastActiveAt       DateTime?         @map("last_active_at") @db.Timestamptz(6)
createdById        String?           @map("created_by_id") @db.Uuid

permissions        UserPermission[]
restrictions       UserRestriction[]
warnings           UserWarning[]
activities         UserActivity[]
notInterested      NotInterested[]
savedPosts         SavedPost[]
reportsFiled       Report[]
casesAgainst       ReportCase[]      @relation("CaseTargetUser")
actionsAgainst     ModerationAction[] @relation("ActionTargetUser")

// Post additions:
status             PostStatus        @default(ACTIVE)
removedAt          DateTime?         @map("removed_at") @db.Timestamptz(6)
removedById        String?           @map("removed_by_id") @db.Uuid
removalReason      String?           @map("removal_reason")

notInterestedBy    NotInterested[]
savedBy            SavedPost[]
cases              ReportCase[]
```

### 3.3 New Models
1. `UserPermission`: composite primary key `[userId, permission]`.
2. `UserRestriction`: tracks `type`, `status`, `reason`, `publicReason`, `startsAt`, `expiresAt`, `liftedAt`.
3. `UserWarning`: records administrative warnings with policy references.
4. `ReportCase`: aggregates reports against target `targetKey` (`POST:<uuid>` or `USER:<uuid>`), includes immutable initial content `snapshot`.
5. `Report`: stores individual user complaint, reason, details. Unique constraint `[caseId, reporterId]`.
6. `ModerationAction`: historical ledger of all moderator actions.
7. `NotInterested`: composite key `[userId, postId]` for feed filtering.
8. `SavedPost`: bookmarking capability.
9. `UserActivity`: user's private notification feed for moderation events.

---

## 4. API Specification

All endpoints are prefixed with `/api/v1`.

### 4.1 User-Facing APIs
- `GET /report-reasons`: Public metadata for available report reasons and descriptions.
- `POST /posts/:id/report`: File report against a post `{ reason, details? }`.
- `POST /users/:id/report`: File report against an account `{ reason, details? }`.
- `POST /posts/:id/not-interested`: Hide post from user recommendations.
- `DELETE /posts/:id/not-interested`: Undo hide preference.
- `POST /posts/:id/save` & `DELETE /posts/:id/save`: Bookmark or unbookmark post.
- `GET /me/saved`: Cursor-paginated saved posts list.
- `GET /me/activity`: User activity feed (filtering by type, unread status).
- `GET /me/reports`: Status of reports filed by current user.
- `GET /me/warnings`: Warnings issued to current user.
- `GET /me/account-status`: Standing and warning counter for logged-in user.
- `POST /me/activity/:id/read` & `POST /me/activity/read-all`: Mark activities as read.

### 4.2 Administrative APIs
- `GET /admin/me`: Current staff member info, active role, and permission array.
- `GET /admin/dashboard/summary`: Overall KPI metrics (total users, active, banned, posts, pending reports, etc.).
- `GET /admin/dashboard/timeseries`: Timeseries chart data (`registrations`, `posts`, `reports`, `moderation` across `7d`, `30d`, `90d`).
- `GET /admin/dashboard/recent`: Recent registrations, recent report cases, recent admin actions.
- `GET /admin/dashboard/distribution`: Account status breakdown and role distribution.
- `GET /admin/users`: Paginated, searchable, filterable user directory.
- `GET /admin/users/:id`: Comprehensive user dossier with violation history.
- `POST /admin/users/:id/activate`: Lift deactivation hold.
- `POST /admin/users/:id/deactivate`: Put user on administrative hold.
- `POST /admin/users/:id/warn`: Send formal warning.
- `POST /admin/users/:id/ban`: Issue temporary suspension or permanent ban.
- `POST /admin/users/:id/unban`: Lift active ban/suspension.
- `DELETE /admin/users/:id`: Soft-delete account.
- `POST /admin/users/:id/restore`: Restore soft-deleted account within 30-day grace period.
- `GET /admin/report-cases`: Moderation cases list with status, priority, and filters.
- `GET /admin/report-cases/:id`: Detailed case view with live post, initial snapshot, user history, and reports.
- `POST /admin/report-cases/:id/claim`: Claim case for review.
- `POST /admin/report-cases/:id/decision`: Execute multi-action moderation decision.
- `POST /admin/report-cases/:id/reopen`: Reopen resolved case.
- `POST /admin/posts/:id/restore`: Restore soft-removed post.
- `GET /admin/moderation/queue`: Priority-ordered active case queue with SLA tracking.
- `GET /admin/moderation/restrictions`: Active suspensions and deactivations.
- `GET /admin/moderation/removed-posts`: Removed content repository.
- `GET /admin/moderation/actions`: Historical ledger of moderation decisions.
- `GET /admin/permissions`: Permissions catalog and presets.
- `GET /admin/admins`: Staff members directory.
- `POST /admin/admins`: Provision or promote staff member.
- `PATCH /admin/admins/:id`: Update staff role and permission list.
- `POST /admin/admins/:id/deactivate` & `/activate`: Manage staff account status.
- `GET /admin/audit-logs`: Search and filter tamper-evident audit records.
- `GET /admin/audit-logs/:id`: Decrypted audit record details.
- `GET /admin/audit-logs/export`: Stream CSV or JSON export with spreadsheet formula sanitization.
- `POST /admin/audit-logs/verify`: Recompute and verify cryptographic HMAC hash chain.

---

## 5. Next.js Admin Web Application (`admin/`)

### 5.1 Technology Stack & Design System
- **Framework**: Next.js 14+ (App Router), React 18/19, TypeScript.
- **Styling**: Tailwind CSS with custom high-contrast dark theme.
- **UI & Icons**: Lucide React, Radix UI primitives.
- **Data Visualization**: Recharts for responsive SVG analytics charts.
- **Real-Time Client**: `socket.io-client` connected to NestJS `/admin` namespace.
- **Design Aesthetic**: TikTok/Instagram-inspired dark surfaces (`#0D0E12`, `#16181F`, `#20232D`), vibrant primary accents (`#00F2FE` cyan / `#FE2C55` neon pink / `#22C55E` emerald green), high-contrast typography, rounded-2xl cards, translucent glass borders (`rgba(255,255,255,0.08)`), and instant live indicators.

### 5.2 Application Architecture & Pages
```
admin/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx               # High-contrast staff login & 2FA/Password change
│   ├── (dashboard)/
│   │   ├── layout.tsx                   # Responsive Admin Shell (Sidebar, Header, Live Socket Status)
│   │   ├── page.tsx                     # Dashboard KPI metrics, charts, live event stream
│   │   ├── users/
│   │   │   ├── page.tsx                 # Paginated user table, filters, search
│   │   │   └── [id]/page.tsx            # Full user dossier, restriction drawer
│   │   ├── reports/
│   │   │   ├── page.tsx                 # Case queue, priority matrix, SLA age
│   │   │   └── [id]/page.tsx            # Side-by-side Case Review & Decision Studio
│   │   ├── moderation/
│   │   │   └── page.tsx                 # Tabs: Active Queue, Restrictions, Removed Posts, Action Log
│   │   ├── staff/
│   │   │   └── page.tsx                 # Staff list, Invite/Promote dialog, Permission checklist
│   │   └── audit/
│   │       └── page.tsx                 # Filterable audit log browser, export CSV/JSON, verify chain
├── components/
│   ├── ui/                              # Buttons, Badges, Modals, Inputs, Tables, Shimmers
│   ├── layout/                          # Sidebar, Header, Breadcrumbs, Notifications
│   ├── dashboard/                       # KpiCard, TimeseriesChart, DistributionDonut, RecentLists
│   ├── users/                           # UserActionModal (Ban, Warn, Deactivate, Delete)
│   ├── reports/                         # DecisionDialog, SnapshotViewer, ReasonBadges
│   └── audit/                           # ExportDialog, ChainStatusCard
├── lib/
│   ├── api.ts                           # Fetch client with auto bearer token & 403 handling
│   ├── auth-context.tsx                 # Session state, role & permission helpers
│   ├── socket.ts                        # Socket.io connection manager for /admin
│   └── utils.ts                         # Formatting, date calculations, CSV helpers
```

---

## 6. Flutter Mobile App Integration (`frontend/news_share`)

### 6.1 TikTok-Style Post & Profile Actions
- **Post Three-Dot Menu (`showPostActionsSheet`)**:
  - `Share`: Invokes native share sheet.
  - `Save` / `Remove from saved`: Calls `POST/DELETE /api/v1/posts/:id/save`.
  - `Not interested` (other users' posts only): Optimistically hides the post with undo toast, calls `POST /api/v1/posts/:id/not-interested`.
  - `Report` (other users' posts only): Launches TikTok-style bottom sheet.
- **Profile Menu**:
  - `Share Profile`.
  - `Report Account`: Opens TikTok-style report sheet targeting `USER`.

### 6.2 Multi-Step TikTok-Style Report Sheet (`_ReportSheet`)
1. Fetches real reason list dynamically from `GET /api/v1/report-reasons`.
2. Clean radio list with reason title and helpful subtitle descriptions.
3. Expandable text box for optional or required (for `OTHER`) details (max 500 characters).
4. Submits to `POST /api/v1/posts/:id/report` or `POST /api/v1/users/:id/report`.
5. Graceful handling of `409 Conflict` ("You have already reported this").

### 6.3 Account Restriction Screen (`AccountStatusScreen`)
- Intercepts 403 responses with error codes `ACCOUNT_BANNED`, `ACCOUNT_SUSPENDED`, `ACCOUNT_DEACTIVATED`.
- Displays violation notice, public reason, appeal instructions, countdown for temporary suspensions, and forces session termination.

### 6.4 Personal History & Status Screen (`ActivityPage`)
- Displays user's filed reports, administrative warnings, and status outcomes without revealing moderator identities.

---

## 7. Implementation Roadmap & Verification Gates

```
Phase 1: Database Migration & Prisma Schema Updates
Phase 2: Backend Core Services (Permissions, Enforcement, Reports, Admin Modules)
Phase 3: Next.js Admin Web Application Build
Phase 4: Flutter Mobile App Reporting & Moderation Enhancements
Phase 5: Automated Testing, Static Analysis & Cross-App Verification
```

---
*End of Analysis & Implementation Guide. Ready for Phase 1 execution.*
