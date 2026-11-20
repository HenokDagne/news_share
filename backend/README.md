# News Share Backend (NestJS REST API)

Local NestJS REST API backend for the **News Share** mobile application, replacing Supabase. Built in strict adherence to the project's Software Requirements Specification (SRS), API Design, and Database Design.

---

## 1. Technology Stack

- **Framework**: NestJS 10 (TypeScript, Express)
- **ORM**: Prisma 6 with PostgreSQL 16
- **Authentication**: JWT (Access Token 15m, Refresh Token 30d with cryptographic rotation and reuse revocation), password hashing via `bcryptjs` and `argon2`
- **File Storage**: Cloudinary SDK (with local mock/fallback support for test runs)
- **Rate Limiting**: `@nestjs/throttler` (100 req/min global, 5 req/min on auth endpoints)
- **Documentation**: Swagger / OpenAPI 3.0 (`/docs` interactive UI and `/docs-json`)
- **Event Bus**: `@nestjs/event-emitter` for asynchronous decoupled notifications
- **Testing**: Jest E2E test suites with Supertest

---

## 2. Architecture & Modules

```
backend/
├── prisma/
│   ├── schema.prisma                  # 6 models: User, RefreshToken, Profile, Post, Follow, Notification
│   └── migrations/                    # Prisma SQL migrations
├── src/
│   ├── auth/                          # Register, Login, Refresh, Logout, JwtStrategy
│   ├── users/                         # /me, /me/avatar, /users/:id, /users (search)
│   ├── posts/                         # /posts, /feed, /posts/:id, /users/:id/posts
│   ├── follows/                       # /users/:id/follow, /follow-status, /followers, /following
│   ├── notifications/                 # /notifications, /unread-count, /read, /read-all, event listener
│   ├── storage/                       # Cloudinary integration with safe delete
│   ├── prisma/                        # Global PrismaClient service
│   ├── config/                        # Environment schema validation
│   ├── common/                        # DTOs, decorators, guards, filters, constants, utils
│   ├── app.module.ts
│   └── main.ts
├── scripts/
│   ├── export-openapi.ts              # Generates openapi.json
│   ├── reconcile-follow-counts.ts     # Audits & repairs follower/following counter cache
│   ├── import-from-supabase.ts        # Data migration pipeline from Supabase JSON dumps
│   ├── migrate-files-to-cloudinary.ts # Uploads assets from Supabase storage to Cloudinary
│   └── test-live-e2e.ts               # Standalone live E2E test suite against HTTP port
└── test/                              # 4 Jest E2E test suites covering SRS AC-01 through AC-23
```

---

## 3. Database Schema

The schema includes the following models matching the Database Design:
1. **User**: UUID primary key, lowercase unique email, hashed password, timestamps.
2. **RefreshToken**: SHA-256 hashed token lookup, user foreign key, `revokedAt`, `expiresAt`.
3. **Profile**: 1-to-1 with User, unique lowercase username (3-20 chars), full name, bio, avatar URL, denormalized counters (`followersCount`, `followingCount`).
4. **Post**: Title, content, image URL, Cloudinary public ID, author relation, timestamps.
5. **Follow**: Composite primary key `(followerId, followingId)`, follower/following profile relations.
6. **Notification**: Recipient user, actor user, post relation (optional), type (`follow` or `new_post`), `isRead` flag, timestamps.

---

## 4. API Endpoints (21 Endpoints)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | Public | Register new account and profile |
| `POST` | `/api/v1/auth/login` | Public | Email and password authentication |
| `POST` | `/api/v1/auth/refresh` | Public | Rotate refresh token for new access/refresh pair |
| `POST` | `/api/v1/auth/logout` | Bearer | Revoke refresh token |
| `GET` | `/api/v1/me` | Bearer | Get authenticated user's profile |
| `PATCH` | `/api/v1/me` | Bearer | Update profile (username, fullName, bio) |
| `PUT` | `/api/v1/me/avatar` | Bearer | Upload JPEG/PNG/WebP avatar (max 2 MB) |
| `DELETE` | `/api/v1/me/avatar` | Bearer | Delete avatar image |
| `GET` | `/api/v1/users` | Bearer | Search profiles by username or name |
| `GET` | `/api/v1/users/:id` | Bearer | View public profile of a user |
| `POST` | `/api/v1/posts` | Bearer | Create post with title, content, or image (max 5 MB) |
| `GET` | `/api/v1/feed` | Bearer | Personal feed (followed users + own) |
| `GET` | `/api/v1/posts` | Bearer | Global timeline, newest first |
| `GET` | `/api/v1/posts/:id` | Bearer | View post details |
| `GET` | `/api/v1/users/:id/posts`| Bearer | Posts by a specific user |
| `PATCH` | `/api/v1/posts/:id` | Bearer | Edit post (author only) |
| `DELETE` | `/api/v1/posts/:id` | Bearer | Delete post (author only) |
| `POST` | `/api/v1/users/:id/follow` | Bearer | Follow user (triggers follow notification) |
| `DELETE`| `/api/v1/users/:id/follow` | Bearer | Unfollow user |
| `GET` | `/api/v1/users/:id/follow-status` | Bearer | Mutual follow status check |
| `GET` | `/api/v1/users/:id/followers` | Bearer | Paginated list of followers |
| `GET` | `/api/v1/users/:id/following` | Bearer | Paginated list of following |
| `GET` | `/api/v1/notifications` | Bearer | Paginated user notifications |
| `GET` | `/api/v1/notifications/unread-count` | Bearer | Count of unread notifications |
| `PATCH`| `/api/v1/notifications/:id/read` | Bearer | Mark single notification as read |
| `POST` | `/api/v1/notifications/read-all` | Bearer | Mark all notifications as read |
| `DELETE`| `/api/v1/notifications/:id` | Bearer | Delete notification |

---

## 5. Local Setup & Execution

### 1. Configure Environment

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Ensure `DATABASE_URL` points to your PostgreSQL instance (e.g. `postgresql://postgres:pass3685@localhost:5432/news_store?schema=public`).

### 2. Apply Database Migrations

```bash
npx prisma migrate dev
npx prisma generate
```

### 3. Start the Server

```bash
# Development mode with hot-reload
npm run start:dev

# Or production build
npm run build
npm run start:prod
```

- **API Base URL**: `http://localhost:3000/api/v1`
- **Swagger Documentation**: `http://localhost:3000/docs`
- **OpenAPI JSON**: `http://localhost:3000/docs-json`

---

## 6. Testing

```bash
# Run all 4 Jest E2E test suites (23 tests covering SRS acceptance criteria)
npm run test:e2e

# Run the live end-to-end integration test against the running server
npm run test:live
```

---

## 7. Connecting the Flutter Application

The Flutter app (`frontend/news_share`) has been updated to use this NestJS REST API via `lib/services/api_client.dart`.

1. Create `frontend/news_share/.env`:
   ```properties
   # For Windows Desktop / iOS Simulator / Web:
   API_BASE_URL=http://localhost:3000/api/v1

   # For Android Emulator:
   # API_BASE_URL=http://10.0.2.2:3000/api/v1

   # For Physical Devices on LAN:
   # API_BASE_URL=http://<YOUR_LAN_IP>:3000/api/v1
   ```

2. Run Flutter analyze and run the app:
   ```bash
   cd ../frontend/news_share
   flutter pub get
   flutter analyze lib
   flutter run
   ```
