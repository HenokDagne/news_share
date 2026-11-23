# News Share Monorepo

A modern, full-stack, cross-platform news sharing and social interaction ecosystem built with **NestJS**, **Next.js**, and **Flutter**.

---

## 1. Repository Structure

```text
news_share/
├── .github/
│   └── workflows/
│       ├── admin-ci.yml        # CI pipeline for Admin Portal (Next.js)
│       ├── backend-ci.yml      # CI pipeline for Backend API (NestJS)
│       └── flutter-ci.yml      # CI pipeline for Mobile App (Flutter)
├── .vscode/                    # Workspace configuration & Java/Gradle runtime settings
├── admin/                      # Next.js 14 administrator web portal
├── backend/                    # NestJS REST API with PostgreSQL & Prisma ORM
├── frontend/                   # Flutter cross-platform mobile client (in frontend/news_share)
├── scripts/                    # Local development & service startup scripts
│   ├── run_postgres.bat        # Foreground PostgreSQL runner
│   ├── start_db.bat            # PostgreSQL daemon starter
│   └── start_backend.bat       # Starts PostgreSQL, sets ADB reverse proxy, & launches backend
├── docs/                       # Project architecture & deployment guides
│   ├── deployment.md           # Independent deployment guides (Vercel, Render, Flutter)
│   └── architecture.md         # Monorepo architecture, data flow, & security model
├── .gitignore                  # Monorepo-wide Git ignore rules
└── README.md                   # This overview document
```

---

## 2. Applications Overview

| Application      | Path                   | Technology                       | Primary Role                                 | Deployment Target           |
| :--------------- | :--------------------- | :------------------------------- | :------------------------------------------- | :-------------------------- |
| **Backend API**  | `backend/`             | NestJS 10, Prisma 6, PostgreSQL  | REST API, WebSockets, RBAC, Backups          | **Render**                  |
| **Admin Portal** | `admin/`               | Next.js 14, Tailwind CSS, Lucide | Staff dashboard, moderation, audit, recovery | **Vercel**                  |
| **Mobile App**   | `frontend/news_share/` | Flutter 3.x, Dart 3.x, Provider  | Full-screen news feed, social engagement     | **Google Play / App Store** |

---

## 3. Local Development Quickstart

### 3.1 Start Services via Scripts (`scripts/`)
On Windows, use the bundled scripts located in `scripts/`:

1. **Start PostgreSQL**:
   ```cmd
   scripts\start_db.bat
   ```
2. **Start Backend with Database & ADB Port Forwarding**:
   ```cmd
   scripts\start_backend.bat
   ```

### 3.2 Manual Application Startup

#### Backend API (`backend/`):
```bash
cd backend
cp .env.example .env            # Configure DATABASE_URL and secrets
npm install
npm run prisma:generate
npx prisma migrate dev
npm run start:dev               # Runs on http://localhost:3000
```

#### Admin Portal (`admin/`):
```bash
cd admin
cp .env.local.example .env.local # Verify NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
npm install
npm run dev                     # Runs on http://localhost:3001
```

#### Flutter Mobile Client (`frontend/news_share/`):
```bash
cd frontend/news_share
cp .env.example .env            # Set API_BASE_URL=http://localhost:3000/api/v1
flutter pub get
flutter run
```

---

## 4. Documentation Links

* 🚀 **[Deployment Guide](docs/deployment.md)**: Independent deployment procedures for Vercel, Render, and Flutter mobile builds.
* 🏛️ **[Architecture Guide](docs/architecture.md)**: Architectural patterns, database schema, security model, and communication topology.

---

## 5. Continuous Integration (CI/CD)

The repository uses path-filtered GitHub Actions workflows located in `.github/workflows/`:
* **`admin-ci.yml`**: Runs on changes to `admin/**` (Type-checks & builds Next.js).
* **`backend-ci.yml`**: Runs on changes to `backend/**` (Generates Prisma client, compiles NestJS, and executes tests).
* **`flutter-ci.yml`**: Runs on changes to `frontend/**` (Fetches Flutter dependencies and runs `flutter analyze`).

---

## 6. Monorepo Principles & Constraints

1. **No Shared Submodule Coupling**: Single Git repository with independent project roots.
2. **Subdirectory Isolation**: Subdirectories `admin/`, `backend/`, and `frontend/` are self-contained and run on independent dependency trees.
3. **No Uncommitted Secrets or Logs**: Environment files (`.env*`) and runtime logs are strictly ignored by `.gitignore` (with `.env.example` templates preserved).
