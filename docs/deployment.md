# Deployment Guide

This guide details the production deployment procedures for all three independent applications within the **News Share** monorepo:
1. **Admin Portal (`admin/`)** &rarr; **Vercel**
2. **Backend API (`backend/`)** &rarr; **Render**
3. **Mobile App (`frontend/news_share/`)** &rarr; **Flutter (Android & iOS)**

---

## 1. Architecture & Platform Overview

```
                                  +-----------------------+
                                  |     Vercel Platform   |
                                  |      (Next.js 14)     |
                                  |     Root: "admin/"    |
                                  +-----------+-----------+
                                              |
                                              | HTTPS / WSS
                                              v
+------------------------+        +-----------+-----------+        +------------------------+
| Flutter Mobile Client  |        |    Render Platform    |        |   Managed PostgreSQL   |
| (Android AAB / iOS IPA)| -----> |   (NestJS + Prisma)   | -----> |   (Render / Supabase / |
| Root: "frontend/..."   | REST / |    Root: "backend/"   |  Pool  |        Neon DB)        |
+------------------------+  WSS   +-----------------------+        +------------------------+
```

---

## 2. Backend Deployment (Render)

The backend is a NestJS application using Prisma ORM with PostgreSQL, Redis/in-memory session management, and Cloudinary media uploads.

### 2.1 Render Service Configuration
* **Service Type**: Web Service (Node.js)
* **Repository**: Select your GitHub repository `news_share`
* **Branch**: `main`
* **Root Directory**: `backend` *(Critical: isolates backend from admin and frontend)*
* **Environment**: Node
* **Build Command**:
  ```bash
  npm install && npm run prisma:generate && npm run build
  ```
* **Pre-Deploy Command (Database Migrations)**:
  ```bash
  npx prisma migrate deploy
  ```
* **Start Command**:
  ```bash
  npm run start:prod
  ```
  *(Executes `node dist/main`)*

### 2.2 PostgreSQL Database Setup
Render provides a managed PostgreSQL database service, or you may connect an external database (e.g. Supabase, Neon, AWS RDS):
1. Create a **PostgreSQL** instance on Render (or external provider).
2. Ensure SSL mode is enabled (`?sslmode=require` or `?sslmode=prefer`).
3. Set the `DATABASE_URL` environment variable on the backend web service.

### 2.3 Required Production Environment Variables (Backend)

| Variable | Description | Example / Recommendation |
| :--- | :--- | :--- |
| `NODE_ENV` | Application environment mode | `production` |
| `PORT` | Listening port (assigned dynamically by Render) | `3000` (Render defaults to `10000`) |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/news_store?sslmode=require` |
| `JWT_ACCESS_SECRET` | High-entropy secret for access tokens | `64+ char random string` |
| `JWT_ACCESS_TTL_SECONDS` | Access token lifespan | `900` (15 minutes) |
| `JWT_REFRESH_TTL_DAYS` | Refresh token lifespan | `30` (30 days) |
| `BACKUP_ENCRYPTION_KEY` | AES-256-GCM master key for database backups | `32+ char cryptographic secret` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud identifier | Your production Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key | Your production API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | Your production API secret |
| `CLOUDINARY_UPLOAD_PRESET`| Cloudinary unsigned/signed preset | `news` |
| `CLOUDINARY_ROOT_FOLDER`| Storage folder in Cloudinary | `news_share` |
| `SWAGGER_ENABLED` | OpenAPI/Swagger UI visibility | `false` in production |
| `MAIL_HOST` | SMTP server host | `smtp.gmail.com` |
| `MAIL_PORT` | SMTP port | `587` |
| `MAIL_USER` | SMTP username | `alerts@yourdomain.com` |
| `MAIL_PASSWORD` | SMTP password / app password | Secure App Password |
| `MAIL_FROM` | Outgoing sender header | `News Share <no-reply@yourdomain.com>` |
| `CORS_ORIGIN` | Allowed domains for web/admin access | `https://admin.yourdomain.com,https://*.vercel.app` |

---

## 3. Admin Portal Deployment (Vercel)

The admin portal is a Next.js 14 application with Tailwind CSS and Lucide icons.

### 3.1 Vercel Project Configuration
1. In the Vercel Dashboard, import the `news_share` repository.
2. In **Project Settings**:
   * **Framework Preset**: `Next.js`
   * **Root Directory**: Click "Edit" and set to `admin` *(Critical: Vercel will build within `admin/` only)*
   * **Build Command**: `next build` (Default)
   * **Output Directory**: `.next` (Default)
   * **Install Command**: `npm install` (Default)
   * **Node.js Version**: `20.x`

### 3.2 Required Production Environment Variables (Admin)

| Variable | Description | Production Example |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | Base URL of deployed NestJS backend API | `https://news-share-backend.onrender.com/api/v1` |
| `NEXT_PUBLIC_WS_URL` | Base URL for WebSocket telemetry | `https://news-share-backend.onrender.com` |

---

## 4. Mobile Application Deployment (Flutter)

The mobile application is located in `frontend/news_share`.

### 4.1 Prerequisites
* Flutter SDK `^3.9.2` / Dart `^3.9.2`
* Java Development Kit (JDK 21 or 17)
* Android SDK & Xcode (for iOS builds)

### 4.2 Configuration
Ensure `frontend/news_share/.env` or runtime environment variables reflect production API endpoints:
```env
API_BASE_URL=https://news-share-backend.onrender.com/api/v1
NEWS_API_BASE_URL=https://newsapi.org/v2/everything
NEWS_API_KEY=your_production_news_api_key
GOOGLE_CLIENT_ID=your_production_google_oauth_client_id.apps.googleusercontent.com
```

### 4.3 Build Commands

#### Android Release Bundle (Google Play Store):
```bash
cd frontend/news_share
flutter clean
flutter pub get
flutter build appbundle --release
```
*Output: `build/app/outputs/bundle/release/app-release.aab`*

#### Android Release APK (Direct Distribution / Testing):
```bash
cd frontend/news_share
flutter build apk --release
```
*Output: `build/app/outputs/flutter-apk/app-release.apk`*

#### iOS Release IPA (Apple App Store / TestFlight):
```bash
cd frontend/news_share
flutter clean
flutter pub get
flutter build ipa --release
```
*Output: `build/ios/archive/Runner.xcarchive` (ready for Xcode Organizer upload)*

---

## 5. Deployment Verification Checklist

- [ ] **Backend Health**: `GET https://news-share-backend.onrender.com/health` returns status 200.
- [ ] **Database Migrations**: Check Render build logs confirming `npx prisma migrate deploy` executed successfully.
- [ ] **Admin Portal Connectivity**: Log in to `https://admin.yourdomain.com/login` and verify that Dashboard, Staff, Users, Audit Trail, and Backup & Recovery load data from the production API.
- [ ] **CORS Configuration**: Verify browser console displays no cross-origin errors on admin requests.
- [ ] **Mobile Connectivity**: Launch release APK/AAB build on a physical device and confirm user signup, news feed swiping, and social interactions reach the backend.
