# News Share: API Design

REST API implemented with NestJS (documented with Swagger). Data is stored in PostgreSQL through Prisma; images live on Cloudinary and the API returns only their URLs.

- **Base URL:** `http://localhost:3000/api/v1`
- **Interactive docs:** `http://localhost:3000/docs` (raw spec: `/docs-json`)
- **Format:** JSON (`application/json`), except uploads (`multipart/form-data`)

---

## 1. Conventions

| Topic | Rule |
|---|---|
| Versioning | URL prefix `/api/v1` |
| Field naming | camelCase (`imageUrl`, `followersCount`, `isRead`) |
| IDs | UUID strings |
| Timestamps | ISO 8601 in UTC, e.g. `2026-11-15T09:30:00.000Z` |
| Authentication | `Authorization: Bearer <accessToken>` on every endpoint except register, login and refresh |
| Pagination | Cursor-based: `?limit=20&cursor=<id>` |
| Idempotency | Follow and unfollow are idempotent |
| Rate limiting | 100 requests/minute per client globally; `register` and `login` limited to 10/minute (`429` when exceeded) |
| Unknown request fields | Rejected with `400` (strict validation) |
| Internal fields | `passwordHash`, `imagePublicId`, `avatarPublicId` are never returned |

### Pagination envelope

Request: `GET /feed?limit=20&cursor=<nextCursor from previous page>`

```json
{
  "data": [ ],
  "nextCursor": "5c1f3a2e-9d4b-4f2b-8f0e-2f3c9b1a7d10",
  "hasMore": true
}
```

- `limit`: 1 to 50, default 20.
- `nextCursor` is `null` when `hasMore` is `false`.
- Pass `nextCursor` back unchanged as `cursor`. Treat it as opaque.

### Error format

All errors use one shape:

```json
{
  "statusCode": 403,
  "error": "Forbidden",
  "message": "You do not own this post",
  "path": "/api/v1/posts/8a1c...",
  "timestamp": "2026-11-15T10:00:00.000Z"
}
```

`message` is a string, or an array of strings for validation errors (one per invalid field).

### Status codes

| Code | Meaning |
|---|---|
| 200 | OK |
| 201 | Created (register, create post) |
| 204 | Success, no body (deletes, logout) |
| 400 | Validation failed, empty post, self-follow, bad upload |
| 401 | Missing, invalid or expired access token; bad credentials; bad refresh token |
| 403 | Authenticated but not allowed (not the owner) |
| 404 | Resource not found (or not yours, for notifications) |
| 409 | Email or username already in use |
| 413 | Upload larger than the size limit |
| 429 | Rate limit exceeded |
| 500 | Unexpected server error |

---

## 2. Authentication flow

| Token | Lifetime | Notes |
|---|---|---|
| Access token (JWT) | 15 minutes | Sent as `Bearer` header |
| Refresh token | 30 days | Opaque string; rotated on every use |

```
register / login ──▶ { accessToken, refreshToken }
        │
        ▼
 call API with accessToken
        │  401 (expired)
        ▼
 POST /auth/refresh { refreshToken } ──▶ new { accessToken, refreshToken }
        │  (old refresh token is now revoked)
        ▼
 retry the original request
        │  refresh fails (401)
        ▼
 send the user to the login screen
```

Always store the **new** refresh token returned by `/auth/refresh`; the old one stops working. `POST /auth/logout` revokes the refresh token you send.

---

## 3. Response schemas

### Author (embedded in posts and notifications)

```json
{
  "id": "uuid",
  "username": "ada_l",
  "fullName": "Ada Lovelace",
  "avatarUrl": "https://res.cloudinary.com/demo/image/upload/v1/news_share/avatars/uid.jpg"
}
```

`fullName` and `avatarUrl` may be `null`.

### Profile (other users)

```json
{
  "id": "uuid",
  "username": "ada_l",
  "fullName": "Ada Lovelace",
  "avatarUrl": "https://res.cloudinary.com/...",
  "bio": "Mathematician",
  "followersCount": 12,
  "followingCount": 7
}
```

### Me (your own profile, adds `email`)

```json
{
  "id": "uuid",
  "email": "ada@example.com",
  "username": "ada_l",
  "fullName": "Ada Lovelace",
  "avatarUrl": null,
  "bio": null,
  "followersCount": 0,
  "followingCount": 0
}
```

### Post

```json
{
  "id": "uuid",
  "title": "Headline",
  "content": "Story text...",
  "imageUrl": "https://res.cloudinary.com/demo/image/upload/v1/news_share/posts/uid/abc.jpg",
  "createdAt": "2026-11-15T09:30:00.000Z",
  "author": { "id": "uuid", "username": "ada_l", "fullName": "Ada Lovelace", "avatarUrl": "https://..." }
}
```

`title`, `content` and `imageUrl` may each be `null` (at least one is set). **Load the image directly from `imageUrl`** (it is served by the Cloudinary CDN, not by this API).

### Notification

```json
{
  "id": "uuid",
  "type": "new_post",
  "message": "A user you follow posted something new!",
  "isRead": false,
  "createdAt": "2026-11-15T09:31:00.000Z",
  "postId": "uuid",
  "actor": { "id": "uuid", "username": "ada_l", "fullName": "Ada Lovelace", "avatarUrl": "https://..." }
}
```

`type` is `follow` or `new_post`. `postId` is `null` for `follow`. `actor` can be `null` if the actor's account was deleted.

---

## 4. Validation rules

| Field | Rule |
|---|---|
| `email` | Valid email; stored lowercase |
| `password` | 8 to 72 characters |
| `username` | 3 to 20 characters: letters, digits, underscore; unique (case-insensitive) |
| `fullName` | Up to 80 characters |
| `bio` | Up to 300 characters |
| Post `title` | Up to 150 characters |
| Post `content` | Up to 5000 characters |
| Post | At least one of `title`, `content`, `image` |
| Avatar file | JPEG, PNG or WebP, up to 2 MB |
| Post image | JPEG, PNG or WebP, up to 5 MB |
| Path ids | Must be valid UUIDs (otherwise `400`) |
| `limit` | Integer 1 to 50 |

---

## 5. Endpoints

Legend: **Public** = no token needed. **Bearer** = requires the access token.

### 5.1 Auth

#### `POST /auth/register` (Public)

Creates the account and profile.

Request:
```json
{ "email": "ada@example.com", "password": "S3cure-pass!", "username": "ada_l", "fullName": "Ada Lovelace" }
```
`fullName` is optional.

Response `201`:
```json
{
  "profile": { "id": "uuid", "email": "ada@example.com", "username": "ada_l", "fullName": "Ada Lovelace",
               "avatarUrl": null, "bio": null, "followersCount": 0, "followingCount": 0 },
  "accessToken": "eyJ...",
  "refreshToken": "9f2c..."
}
```
Errors: `400` validation, `409` email or username taken, `429`.

#### `POST /auth/login` (Public)

Request: `{ "email": "ada@example.com", "password": "S3cure-pass!" }`

Response `200`: same shape as register.
Errors: `401` invalid credentials (the same message for unknown email and wrong password), `429`.

#### `POST /auth/refresh` (Public)

Request: `{ "refreshToken": "9f2c..." }`

Response `200`: same shape as register, with a **new** `refreshToken`. The submitted token is revoked.
Errors: `401` token unknown, expired or already used.

#### `POST /auth/logout` (Bearer)

Request: `{ "refreshToken": "9f2c..." }`

Response `204`. Revokes that refresh token. Calling it twice is harmless.

---

### 5.2 Users and profiles

#### `GET /me` (Bearer)

Response `200`: **Me** object.

#### `PATCH /me` (Bearer)

Update your profile. All fields optional.

Request: `{ "username": "ada_lovelace", "fullName": "Ada L.", "bio": "Mathematician" }`

Response `200`: **Me** object.
Errors: `400` validation, `409` username taken.

#### `PUT /me/avatar` (Bearer, `multipart/form-data`)

| Field | Type | Notes |
|---|---|---|
| `file` | binary | JPEG, PNG or WebP, max 2 MB |

Response `200`:
```json
{ "avatarUrl": "https://res.cloudinary.com/demo/image/upload/v1731/news_share/avatars/uid.jpg" }
```
Replaces the existing avatar. Errors: `400` wrong type or missing file, `413` too large.

#### `DELETE /me/avatar` (Bearer)

Response `204`. Removes the avatar (database fields cleared, Cloudinary asset deleted).

#### `GET /users/{id}` (Bearer)

Response `200`: **Profile** object. Errors: `400` invalid UUID, `404` not found.

#### `GET /users?search=ada&limit=20&cursor=` (Bearer)

Search profiles by username or full name (case-insensitive substring). `search` is required.

Response `200`: pagination envelope of **Profile** objects, ordered by username.

---

### 5.3 Posts

#### `POST /posts` (Bearer, `multipart/form-data`)

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | text | no | max 150 |
| `content` | text | no | max 5000 |
| `image` | binary | no | JPEG, PNG or WebP, max 5 MB |

At least one field must be present.

Response `201`: **Post** object (`imageUrl` is the Cloudinary URL when an image was sent).
Side effect: every follower of the author gets a `new_post` notification.
Errors: `400` empty post or bad file, `413` too large.

#### `GET /feed?limit=&cursor=` (Bearer)

Posts from people you follow plus your own, newest first.
Response `200`: pagination envelope of **Post**.

#### `GET /posts?limit=&cursor=` (Bearer)

Global timeline, newest first.
Response `200`: pagination envelope of **Post**.

#### `GET /posts/{id}` (Bearer)

Response `200`: **Post**. Errors: `400` invalid UUID, `404`.

#### `GET /users/{id}/posts?limit=&cursor=` (Bearer)

Posts by one user, newest first.
Response `200`: pagination envelope of **Post**.

#### `PATCH /posts/{id}` (Bearer, owner only, `multipart/form-data`)

Same fields as create; all optional. Sending a new `image` replaces the old one (the old Cloudinary asset is deleted).

Response `200`: **Post**.
Errors: `400` would leave the post empty or bad file, `403` not your post, `404`.

#### `DELETE /posts/{id}` (Bearer, owner only)

Response `204`. Deletes the post, its notifications, and its Cloudinary image.
Errors: `403` not your post, `404`.

---

### 5.4 Follows

All follow endpoints use the target user's id in the path.

#### `POST /users/{id}/follow` (Bearer)

Response `200`: `{ "following": true }`
- Idempotent: following someone you already follow succeeds and changes nothing.
- A **new** follow increments both counters and creates a `follow` notification for the target.
- Errors: `400` cannot follow yourself, `404` user not found.

#### `DELETE /users/{id}/follow` (Bearer)

Response `200`: `{ "following": false }`
- Idempotent. Decrements both counters only if a follow existed. No notification is created.

#### `GET /users/{id}/follow-status` (Bearer)

Response `200`:
```json
{ "isFollowing": true, "isFollowedBy": false }
```
`isFollowing`: you follow them. `isFollowedBy`: they follow you.

#### `GET /users/{id}/followers?limit=&cursor=` (Bearer)

Profiles that follow this user, newest follow first.
Response `200`: pagination envelope of **Profile**.

#### `GET /users/{id}/following?limit=&cursor=` (Bearer)

Profiles this user follows, newest follow first.
Response `200`: pagination envelope of **Profile**.

---

### 5.5 Notifications

Notifications are created only by the server. You can only see and change your own.

#### `GET /notifications?unread=true&limit=&cursor=` (Bearer)

Response `200`: pagination envelope of **Notification**, newest first. `unread=true` returns only unread items.

#### `GET /notifications/unread-count` (Bearer)

Response `200`: `{ "count": 3 }`

#### `PATCH /notifications/{id}/read` (Bearer)

Response `200`: `{ "id": "uuid", "isRead": true }`
Errors: `404` not found or not yours.

#### `POST /notifications/read-all` (Bearer)

Response `200`: `{ "updated": 5 }`

#### `DELETE /notifications/{id}` (Bearer)

Response `204`. Errors: `404` not found or not yours.

---

## 6. Endpoint summary

| Method | Path | Auth | Success |
|---|---|---|---|
| POST | `/auth/register` | Public | 201 |
| POST | `/auth/login` | Public | 200 |
| POST | `/auth/refresh` | Public | 200 |
| POST | `/auth/logout` | Bearer | 204 |
| GET | `/me` | Bearer | 200 |
| PATCH | `/me` | Bearer | 200 |
| PUT | `/me/avatar` | Bearer | 200 |
| DELETE | `/me/avatar` | Bearer | 204 |
| GET | `/users` | Bearer | 200 |
| GET | `/users/{id}` | Bearer | 200 |
| POST | `/posts` | Bearer | 201 |
| GET | `/feed` | Bearer | 200 |
| GET | `/posts` | Bearer | 200 |
| GET | `/posts/{id}` | Bearer | 200 |
| GET | `/users/{id}/posts` | Bearer | 200 |
| PATCH | `/posts/{id}` | Bearer (owner) | 200 |
| DELETE | `/posts/{id}` | Bearer (owner) | 204 |
| POST | `/users/{id}/follow` | Bearer | 200 |
| DELETE | `/users/{id}/follow` | Bearer | 200 |
| GET | `/users/{id}/follow-status` | Bearer | 200 |
| GET | `/users/{id}/followers` | Bearer | 200 |
| GET | `/users/{id}/following` | Bearer | 200 |
| GET | `/notifications` | Bearer | 200 |
| GET | `/notifications/unread-count` | Bearer | 200 |
| PATCH | `/notifications/{id}/read` | Bearer (recipient) | 200 |
| POST | `/notifications/read-all` | Bearer | 200 |
| DELETE | `/notifications/{id}` | Bearer (recipient) | 204 |

---

## 7. Authorization rules

The acting user always comes from the access token. Ids in request bodies are never trusted.

| Resource | Read | Create | Update | Delete |
|---|---|---|---|---|
| Own account/profile | Owner (`/me`) | Register | Owner | not exposed |
| Other profiles | Any logged-in user | n/a | n/a | n/a |
| Posts | Any logged-in user | Logged-in user (as author) | Author only | Author only |
| Follows | Any logged-in user | As yourself only | n/a | As yourself only |
| Notifications | Recipient only | Server only | Recipient only (read flag) | Recipient only |
| Avatar | Public URL | Own only | Own only | Own only |

---

## 8. Server-side effects (event flow)

| Request | Effect |
|---|---|
| `POST /users/{id}/follow` (new follow) | Counters +1, then a `follow` notification is created for the target |
| `POST /posts` | Post saved, then one `new_post` notification per follower |
| `PATCH /posts/{id}` with a new image | New image uploaded, row updated, old image deleted |
| `DELETE /posts/{id}` | Row deleted (its notifications cascade), then the Cloudinary image deleted |
| `PUT /me/avatar` | Image uploaded to the user's fixed avatar slot on Cloudinary, profile URL updated |

Notifications are created asynchronously after the main request succeeds. A notification failure never fails the request that triggered it.

---

## 9. Image handling (upload and display)

```
Upload:   Flutter --multipart--> API --> Cloudinary (stores the file)
                                  |
                                  +--> PostgreSQL (stores imageUrl + public id)
                                  +--> response: { ..., "imageUrl": "https://res.cloudinary.com/..." }

Display:  Flutter --GET /feed--> API --> JSON with imageUrl
          Flutter --GET imageUrl--> Cloudinary CDN (image bytes)
```

- Multipart field names: **`image`** for posts, **`file`** for avatars.
- The client never talks to Cloudinary for uploads; it always uploads to this API.
- Cloudinary URL transformations can resize images on the fly (insert a segment after `/upload/`), for example `c_fill,w_200,h_200,f_auto,q_auto` for avatar thumbnails.

---

## 10. Typical client flows

**First launch / login**
1. `POST /auth/register` or `POST /auth/login` → store both tokens.
2. `GET /me` (optional, the login response already contains the profile).
3. `GET /feed` and `GET /notifications/unread-count`.

**Create a post with a photo**
1. Pick an image, send `POST /posts` as multipart (`title`, `content`, `image`).
2. Insert the returned **Post** at the top of the feed.

**Follow a user**
1. `GET /users/{id}` and `GET /users/{id}/follow-status` to render the profile screen.
2. `POST /users/{id}/follow` (or `DELETE`) and flip the button from the response.

**Notifications screen**
1. `GET /notifications?limit=20`, page with `cursor`.
2. Tapping one: `PATCH /notifications/{id}/read`, then open `GET /posts/{postId}` (for `new_post`) or `GET /users/{actor.id}` (for `follow`).
3. "Mark all as read": `POST /notifications/read-all`.

**Token refresh**
- On any `401`, call `POST /auth/refresh` once, store the new pair, retry the request; if refresh also returns `401`, go to login.

---

## 11. Local testing examples

```bash
API=http://localhost:3000/api/v1

# register
curl -X POST $API/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"ada@example.com","password":"S3cure-pass!","username":"ada_l"}'

# create a post with an image
curl -X POST $API/posts -H "Authorization: Bearer $TOKEN" \
  -F 'title=Hello' -F 'content=First post' -F 'image=@./photo.jpg'

# feed, page 2
curl "$API/feed?limit=20&cursor=$NEXT_CURSOR" -H "Authorization: Bearer $TOKEN"

# follow
curl -X POST $API/users/$USER_ID/follow -H "Authorization: Bearer $TOKEN"
```

Physical device or emulator hosts for Flutter: Android emulator `10.0.2.2:3000`, iOS simulator `localhost:3000`, physical phone `<computer LAN IP>:3000`.

---

## 12. Swagger documentation

- Open `/docs`, call `POST /auth/login`, copy `accessToken`, click **Authorize**, paste it (without the word `Bearer`).
- Endpoints are grouped by tags: Auth, Users, Posts, Follows, Notifications.
- File endpoints show a file picker for `image` / `file`.
- The OpenAPI JSON at `/docs-json` can generate a typed Dart client (OpenAPI Generator, `dart-dio`). Review generated multipart code before relying on it.
- In production, disable Swagger (`SWAGGER_ENABLED=false`) or protect it with basic auth.

---

## 13. Change policy

- Backward-compatible additions (new optional fields, new endpoints) stay in `v1`.
- Breaking changes (renamed or removed fields, changed semantics) ship under a new prefix (`/api/v2`) while `v1` keeps working for a transition period.
- Clients should ignore unknown response fields.
