# System Architecture & Monorepo Design

This document details the architectural design, service boundaries, and security model of the **News Share** monorepo.

---

## 1. Monorepo Organization & Boundaries

The repository is structured as a decoupled monorepo housing three distinct applications that share a single Git history without circular dependencies:

```
news_share/
├── .github/workflows/      # Independent, path-triggered CI pipelines
├── .vscode/                # Shared workspace developer configuration
├── admin/                  # Next.js 14 administrator portal (standalone app)
├── backend/                # NestJS 10 REST API, Socket.io, & Prisma (standalone app)
├── frontend/news_share/    # Flutter cross-platform mobile client (standalone app)
├── scripts/                # Local development & database startup utilities
├── docs/                   # Architectural & deployment specifications
├── .gitignore              # Monorepo-wide ignore rules
└── README.md               # Project root overview
```

### Boundary Guarantees
* **Zero Cross-Imports**: Neither `admin/`, `backend/`, nor `frontend/` import code or packages from one another.
* **Independent Dependency Trees**: Each application manages its own dependencies (`package.json` for admin/backend, `pubspec.yaml` for Flutter).
* **Isolated CI Workflows**: Modifying the mobile app in `frontend/` triggers only `flutter-ci.yml`, without rebuilding the admin portal or backend API.

---

## 2. Component Specifications

### 2.1 Backend API (`backend/`)
* **Framework**: NestJS 10 (TypeScript)
* **Runtime**: Node.js 20 LTS
* **ORM**: Prisma 6 with PostgreSQL
* **Security & Authentication**:
  - JWT Access Tokens (15 min) + Refresh Tokens (30 days) stored in database
  - Password hashing: Argon2id & Bcrypt
  - Role-Based Access Control (RBAC): `USER`, `MODERATOR`, `ADMIN`, `SUPER_ADMIN`, `AUDITOR`
  - HTTP Security: Helmet, strict CORS, Throttler rate limiting (sliding window)
  - Security Auditing: HMAC-chained tamper-evident audit ledger (`AuditLog`)
* **Real-time Engine**: Socket.io gateway for live notifications and admin telemetry
* **Backup & Recovery Subsystem**:
  - Automated cron snapshots (daily incremental, weekly full)
  - AES-256-GCM envelope encryption at rest
  - 3-2-1 multi-location tiering (Primary, Secondary, Offsite Vault)
  - WORM immutability locks resisting premature deletion
  - NIST SP 800-88 3-pass cryptographic wipe on disposal

### 2.2 Admin Portal (`admin/`)
* **Framework**: Next.js 14 (App Router)
* **Language**: TypeScript
* **Styling**: Tailwind CSS + Custom Dark Cybernetic Console Theme
* **Icons & Visuals**: Lucide Icons, Recharts
* **Core Modules**:
  - **Dashboard**: Real-time KPI analytics, user registration trends, engagement telemetry
  - **User Management**: Role management, status enforcement (activate, suspend, ban)
  - **Moderation Hub**: Report queue, content takedown, restriction management
  - **Audit Trail**: Tamper-evident ledger inspector with HMAC chain verification
  - **Backup & Recovery**: Archive inventory, one-click backup triggers, sandbox restoration verification, and immutability management

### 2.3 Mobile Client (`frontend/news_share/`)
* **Framework**: Flutter SDK 3.x (Dart 3.x)
* **Architecture**: Provider state management & service-oriented architecture
* **Features**:
  - Full-screen, vertically swipeable video/image news cards (TikTok-inspired UI)
  - Social interactions: follow, like, comment, bookmark, and native sharing bottom sheets
  - Multi-tier reporting workflow with structured reason categorization
  - Local biometric authentication (`local_auth`) and secure token storage (`shared_preferences`)

---

## 3. Data Flow & Communication Topology

```
+--------------------------+
|  Mobile Client (Flutter) |
+------------+-------------+
             |
             | HTTPS (REST API)
             v
+------------+-------------+           HTTPS (REST API)           +--------------------------+
|   Backend API (NestJS)   | <=================================== |   Admin Web (Next.js)    |
|   Port 3000 /api/v1      | < - - - - - - - - - - - - - - - - -  |   Port 3001              |
+------------+-------------+         WSS (Socket.io Telemetry)    +--------------------------+
             |
             | Prisma Connection Pool (TCP 5432)
             v
+------------+-------------+
|   PostgreSQL Database    |
|   (Public Schema)        |
+--------------------------+
```

1. **Authentication Flow**:
   - Clients send credentials to `POST /api/v1/auth/login`.
   - The backend validates password hashes via Argon2, checks account enforcement status, generates signed JWT tokens, and records an authentication audit log entry.
   - Subsequent requests pass the JWT in the `Authorization: Bearer <token>` header.

2. **Real-Time Telemetry Flow**:
   - Admin clients connect to `/admin` WebSocket namespace using authenticated JWT handshakes.
   - Administrative actions and system events trigger real-time broadcasts for instant dashboard telemetry updates.

3. **Storage & Media Flow**:
   - Post images and user avatars are uploaded directly via authenticated multipart requests to Cloudinary storage.
   - Cloudinary URLs and metadata are stored in PostgreSQL.

---

## 4. Security & Compliance Architecture

* **Role-Based Access Control**:
  Enforced on the backend via NestJS `JwtAuthGuard` and `RolesGuard`. Role rank hierarchy ensures least-privilege enforcement across endpoints.
* **Audit Trail**:
  Every administrative action, user ban, role modification, post removal, and backup operation is hashed and linked to its predecessor in a cryptographic hash chain.
* **Disaster Recovery (RPO / RTO)**:
  - Recovery Point Objective (RPO): Target 4 hours
  - Recovery Time Objective (RTO): Target 2 hours
  - Immutability: WORM locks prevent malicious tampering or ransomware attacks from deleting valid backup snapshots.
