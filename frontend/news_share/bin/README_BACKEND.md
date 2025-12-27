# NewsShare Backend Structure

This document describes the backend directory structure for the NewsShare application.

## Directory Overview

### `/bin`

Main entry point and server files.

### `/bin/server.dart`

Main server entry point that initializes the database and starts the HTTP server.

### `/bin/config/`

Configuration files for server, database, and environment variables.

### `/bin/database/`

- `db_connector.dart`: Database connection initialization
- `migrations/`: Database schema migrations
- `repositories/`: Data access layer (repository pattern)

### `/bin/models/`

Data models/DTOs organized by entity (User, Post, Repost, Feed, Notification, SourceArticle).

### `/bin/services/`

Business logic layer:

- `auth/`: Authentication services (JWT, Google, Facebook)
- `post/`: Post management services
- `repost/`: Repost services
- `feed/`: Feed aggregation services
- `news/`: Third-party news integration services
- `notification/`: Notification services

### `/bin/routes/`

API route handlers organized by feature:

- `auth/`: Authentication endpoints
- `posts/`: Post CRUD endpoints
- `reposts/`: Repost endpoints
- `feed/`: Feed endpoints
- `notifications/`: Notification endpoints
- `news/`: News search/filter endpoints

### `/bin/middleware/`

Middleware functions:

- `auth_middleware.dart`: JWT authentication
- `error_handler_middleware.dart`: Global error handling
- `logging_middleware.dart`: Request logging
- `validation_middleware.dart`: Request validation
- `rate_limiting_middleware.dart`: Rate limiting

### `/bin/utils/`

Utility functions:

- `exceptions/`: Custom exception classes
- `responses/`: API response helpers
- `validators/`: Input validation
- `helpers/`: General helper functions

## Features Implemented

1. **Repost News**: `/api/reposts`
2. **Post Own News**: `/api/posts`
3. **Feed News**: `/api/feed` (aggregates posts, reposts, and third-party news)
4. **Authentication**: `/api/auth` (JWT, Google, Facebook)
5. **Notifications**: `/api/notifications`

## Getting Started

1. Set up environment variables in `.env`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=news_share_db
DB_USER=postgres
DB_PASSWORD=your_password
SERVER_HOST=localhost
SERVER_PORT=8080
JWT_SECRET=your-secret-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret
NEWS_API_KEY=your-news-api-key
```

2. Run the server:

```bash
dart run bin/server.dart
```

## API Endpoints

### Authentication (`/api/auth`)

- `POST /register` - Register new user
- `POST /login` - User login
- `POST /google` - Google OAuth
- `POST /facebook` - Facebook OAuth
- `POST /refresh` - Refresh JWT token
- `GET /me` - Get current user (requires auth)
- `POST /logout` - Logout

### Posts (`/api/posts`)

- `GET /` - Get all posts
- `GET /<id>` - Get post by ID
- `POST /` - Create post (requires auth)
- `PUT /<id>` - Update post (requires auth)
- `DELETE /<id>` - Delete post (requires auth)
- `POST /<id>/like` - Like post (requires auth)
- `DELETE /<id>/like` - Unlike post (requires auth)

### Reposts (`/api/reposts`)

- `GET /` - Get reposts
- `POST /` - Create repost (requires auth)
- `DELETE /<id>` - Delete repost (requires auth)

### Feed (`/api/feed`)

- `GET /?page=1&limit=20&q=query` - Get user feed (requires auth)

### Notifications (`/api/notifications`)

- `GET /` - Get notifications (requires auth)
- `GET /<id>` - Get notification by ID (requires auth)
- `PUT /<id>/read` - Mark as read (requires auth)
- `PUT /read-all` - Mark all as read (requires auth)
- `DELETE /<id>` - Delete notification (requires auth)

### News (`/api/news`)

- `GET /search?q=query` - Search news (requires auth)
- `GET /filter?category=tech&source=bbc` - Filter news (requires auth)
- `GET /sources` - Get news sources (requires auth)

## Next Steps

1. Implement all service methods (currently placeholders)
2. Create repository implementations
3. Add database migrations
4. Implement third-party news API integrations
5. Add comprehensive error handling and validation
6. Add unit and integration tests
7. Add API documentation (OpenAPI/Swagger)
8. 
9. 
10. 
11. 
12. 
13. 
14. news_share_full_project/                    # ROOT (Monorepo)
    ├── backend/                               # Django API Server
    │   ├── manage.py
    │   ├── .env                               # NEWS_API_KEY
    │   ├── .gitignore
    │   ├── requirements.txt
    │   ├── news_share_api/                   # Django Project
    │   │   ├── __init__.py
    │   │   ├── settings.py
    │   │   ├── urls.py
    │   │   └── wsgi.py
    │   └── news/                             # Django App
    │       ├── __init__.py
    │       ├── admin.py
    │       ├── apps.py
    │       ├── migrations/
    │       ├── models.py
    │       ├── tests.py
    │       ├── urls.py                       # /api/news/
    │       └── views.py                      # fetch_news()
    ├── frontend/                             # Flutter Mobile App
    │   ├── lib/
    │   │   ├── models/
    │   │   │   └── news_item.dart
    │   │   ├── services/
    │   │   │   └── news_service.dart         # http://backend:3000/api/news/
    │   │   └── screen/
    │   │       └── home/
    │   │           ├── home_page.dart
    │   │           ├── news_card.dart
    │   │           ├── top_app_bar.dart
    │   │           ├── create_post_box.dart
    │   │           └── bottom_nav.dart
    │   ├── pubspec.yaml
    │   ├── .gitignore
    │   └── flutter/
    └── README.md
