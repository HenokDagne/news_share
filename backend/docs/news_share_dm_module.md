# News Share – Direct Messaging (DM) Module

Implementation spec for adding a production-ready, one-to-one Direct Messaging module to the existing **News Share** app.

| Layer | Technology |
|---|---|
| Frontend | Flutter (existing) |
| Backend | NestJS (existing), modular monolith |
| Database | PostgreSQL (existing) |
| Real-time | Socket.IO WebSockets |
| Attachments | Cloudinary (existing storage service in News Share) |
| Offline alerts | Firebase Cloud Messaging (FCM) or existing push infrastructure |

> **Important:** Analyze the existing codebase and database before implementing anything. Reuse the existing authentication, users, notifications, storage infrastructure, and coding conventions. Do not modify unrelated features or introduce duplicate systems.

---

## 1. Database Architecture

Inspect the current PostgreSQL schema first, then design the messaging tables to fit it. **Document the proposed ER relationships and explain how they integrate with the existing design before implementing.**

### 1.1 Entities

| Table | Purpose |
|---|---|
| `conversations` | One-to-one conversation metadata and latest activity |
| `conversation_participants` | Conversation membership and per-participant read state |
| `messages` | Content, sender, type, timestamps, edit/delete info |
| `message_receipts` | Delivery and read status |
| `message_attachments` | Image and file attachment metadata |

### 1.2 Requirements

- Reuse the existing `users` table and user IDs.
- Support one-to-one conversations with **no duplicate conversation records**.
- Enforce unique participant relationships and appropriate constraints.
- Use UUID identifiers where consistent with the existing architecture.
- Add indexes for conversation history, participants, and message pagination.
- Use **transactions** for message persistence and related updates.
- Support **soft deletion** where appropriate.
- Use **migrations** that do not destroy existing data.

---

## 2. Real-Time Messaging Workflow

1. User opens another user's profile and taps **Message**.
2. Backend verifies messaging is permitted.
3. Retrieve the existing conversation or create a new one.
4. User sends a message through the authenticated API.
5. Backend validates sender, recipient, conversation membership, and privacy restrictions.
6. Persist the message in PostgreSQL.
7. Emit a Socket.IO event to the recipient.
8. Update conversation activity and unread counts.
9. Track delivery and read receipts.
10. If the recipient is offline, keep the message in PostgreSQL and send a push notification.
11. When the recipient reconnects, sync missed messages and conversation state.

### Must support

- Real-time delivery
- Typing indicators
- Online/offline presence
- Sent, delivered, and read statuses
- Offline message synchronization
- Duplicate prevention via **idempotency keys**

> **PostgreSQL is the source of truth.** WebSockets must never be the only persistence mechanism.

---

## 3. REST API & WebSocket Design

Follow existing NestJS conventions and document all endpoints.

### 3.1 Conversation APIs

| Method | Endpoint | Description |
|---|---|---|
| POST | `/messages/conversations` | Create or retrieve a conversation |
| GET | `/messages/conversations` | Retrieve inbox conversations |
| GET | `/messages/conversations/:id` | Retrieve conversation details |
| GET | `/messages/conversations/:id/messages` | Paginated message history |

### 3.2 Message APIs

| Method | Endpoint | Description |
|---|---|---|
| POST | `/messages/conversations/:id/messages` | Send a message |
| PATCH | `/messages/:id` | Edit own message |
| DELETE | `/messages/:id` | Delete own message |
| POST | `/messages/conversations/:id/read` | Mark messages as read |

### 3.3 Attachment APIs

| Method | Endpoint | Description |
|---|---|---|
| POST | `/messages/attachments/upload-url` | Request a signed Cloudinary upload payload |
| POST | `/messages/attachments/confirm` | Verify the Cloudinary upload and persist attachment metadata |

### 3.4 WebSocket Events

| Event | Purpose |
|---|---|
| `message:new` | New message received |
| `message:delivered` | Message delivered |
| `message:read` | Message read |
| `message:edited` | Message edited |
| `message:deleted` | Message deleted |
| `typing:start` | User started typing |
| `typing:stop` | User stopped typing |
| `user:online` | User came online |
| `user:offline` | User went offline |

### 3.5 Rules

- Authenticate WebSocket connections with the **existing JWT system**.
- Validate conversation membership before allowing users to join rooms or receive events.
- Use **cursor-based pagination** for message history.

---

## 4. Attachment Storage – Cloudinary (Images & Files)

News Share already has a Cloudinary-based file/image storage service. **Reuse it** (same SDK, config module, env variables, and naming conventions) instead of adding S3 or any second storage provider. Binary data is never stored in PostgreSQL; messages reference attachment metadata only.

> Inspect the existing Cloudinary service first (module, provider, config keys, folder structure, upload helpers). Extend it with messaging-specific methods rather than duplicating it.

### 4.1 Supported content

- **Images:** JPEG, PNG, WebP
- **Documents:** PDF and other explicitly approved file types (uploaded as Cloudinary `raw` resources, or `image` for PDF if the existing service does so)

### 4.2 Upload flow (signed direct upload)

1. Flutter calls `POST /messages/attachments/upload-url` with `conversationId`, file name, MIME type, and size.
2. Backend verifies the user is a participant, then validates MIME type, extension, and max size.
3. Backend generates a **signed upload payload** using the existing Cloudinary service: `timestamp`, `signature`, `api_key`, `cloud_name`, `folder`, unique `public_id`, `resource_type`, and `type`.
4. Flutter uploads the file directly to Cloudinary with that payload (showing progress).
5. Flutter calls `POST /messages/attachments/confirm` with the returned `public_id`.
6. Backend **verifies the asset with Cloudinary** (Admin API / upload response): it exists, belongs to the expected folder, and format and `bytes` match the allowed values.
7. Backend stores metadata in `message_attachments` with status `confirmed`, owned by the uploader.
8. The attachment is then referenced when sending a message.

### 4.3 Storage structure

- Folder pattern: `news_share/messages/{conversationId}/{uuid}` (follow the existing folder convention if one exists).
- Unique `public_id` generated server-side; clients cannot choose it.
- Private delivery: use `type: authenticated` (or `private`) so assets are not publicly accessible by URL.

### 4.4 Metadata persisted in `message_attachments`

| Field | Notes |
|---|---|
| `id` | UUID |
| `message_id` | Nullable until attached to a message |
| `conversation_id` | For authorization checks |
| `uploader_id` | References `users.id` |
| `cloudinary_public_id` | Unique |
| `resource_type` | `image` / `raw` / `video` |
| `delivery_type` | `authenticated` / `private` |
| `format`, `mime_type` | Validated server-side |
| `bytes`, `width`, `height` | From Cloudinary response |
| `original_filename` | Sanitized |
| `status` | `pending` / `confirmed` / `orphaned` / `deleted` |
| `created_at`, `deleted_at` | Soft deletion support |

Do not store raw secure URLs permanently if assets are private; store `public_id` and generate access URLs on demand.

### 4.5 Secure download

- Download/preview endpoint (or inline signed URLs in message responses) verifies the requester is a conversation participant.
- Backend generates **short-lived signed Cloudinary URLs** (authenticated delivery, with expiry) via the existing service.
- Image thumbnails use Cloudinary transformations (signed).

### 4.6 Security requirements

- `CLOUDINARY_API_SECRET` stays on the backend only. Flutter receives only a one-time signature, `api_key`, and `cloud_name`.
- Enforce allowed formats and size limits on the backend (configurable via env, e.g. `MESSAGE_MAX_IMAGE_MB`, `MESSAGE_MAX_FILE_MB`); also restrict through the signed params or an upload preset where possible.
- Validate MIME type and extension at request time and again at confirm time against the actual Cloudinary asset.
- Only the uploader can confirm their upload, and only for a conversation they belong to.
- Reject confirm requests for assets outside the expected folder or with mismatched `public_id`.
- Sanitize file names; never trust client-provided MIME alone.

### 4.7 Orphan cleanup

- Attachments left `pending` (never confirmed) or `confirmed` but never linked to a message after a configurable window (e.g. 24h) are marked `orphaned`.
- A scheduled job (NestJS `@Cron`, using the existing scheduler if present) deletes them from Cloudinary (`destroy` with the correct `resource_type` and `type`) and soft-deletes the DB row.
- When a message is deleted, its attachments are also removed from Cloudinary, or queued for removal, according to the soft-delete policy.

---

## 5. Push Notifications (Offline Users)

Use FCM or the existing push infrastructure. Push **supplements** WebSockets; it does not replace persistence.

### Requirements

- Notify recipients of new messages while offline.
- Skip pushes when the recipient is actively viewing the conversation.
- Include sender identity and a concise preview.
- Respect notification preferences and device permissions.
- Store and manage device tokens securely.
- Support multiple devices per user.
- Handle invalid or expired tokens.
- Avoid duplicate notifications for the same message.
- Do not expose sensitive message content unnecessarily.
- Never notify the sender about their own message.

---

## 6. Flutter UI/UX

Build a professional, Instagram-inspired experience consistent with the existing News Share design system.

### Screen 1 – Messages Inbox

- Messages page with a clear header
- Search conversations
- Avatars and display names
- Last message preview and timestamp
- Unread indicators
- Online status where available
- Empty, loading, and error states
- Pull-to-refresh and paginated loading

### Screen 2 – Chat Conversation

- Header with recipient avatar, name, and online status
- Incoming/outgoing message bubbles with timestamps
- Sent, delivered, and read indicators
- Real-time incoming messages
- Typing indicators
- Text composer
- Image and document selection
- Upload progress and attachment previews
- Message history pagination
- Edit and delete actions for own messages

### Screen 3 – Start Conversation

- Add a **Message** button to other users' profiles.
- Open an existing conversation, or create one when needed.
- Prevent opening a conversation with yourself.
- Respect block relationships and messaging privacy settings.
- Prevent unauthorized conversations.
- Navigate correctly between profile, inbox, and chat.

> Preserve existing navigation. Do not redesign unrelated screens.

---

## 7. Security & Business Rules

Enforce on both frontend and backend. **Backend validation is authoritative.**

- Users cannot message themselves or create conversations with themselves.
- Only authenticated users can send messages.
- Only participants can access conversation history.
- Users cannot send messages as another user.
- Users cannot edit or delete another sender's messages.
- Prevent unauthorized access and **IDOR**.
- Prevent duplicate conversations and duplicate message submissions.
- Respect existing block/unblock relationships.
- Respect messaging privacy permissions.
- Validate attachments and restrict unauthorized file access.
- Authenticate WebSocket connections and validate room membership.
- Protect device tokens and Cloudinary credentials (API secret never leaves the backend).
- Apply rate limiting and input validation.
- Do not expose private messages in application logs or admin interfaces.

---

## 8. Implementation Order & Testing

### 8.1 Steps

1. Analyze existing architecture and database.
2. Document messaging architecture and ER relationships.
3. Implement database entities and migrations.
4. Implement NestJS conversation and message services.
5. Implement REST APIs and Socket.IO gateway.
6. Integrate attachments with the existing Cloudinary service.
7. Integrate offline push notifications.
8. Implement Flutter Inbox, Chat, and Start Conversation screens.
9. Integrate authentication, blocking, and privacy rules.
10. Run end-to-end tests.

### 8.2 Verification Checklist

- [ ] Two different users can exchange messages
- [ ] Messages persist after app restart
- [ ] Real-time messages arrive correctly
- [ ] Offline recipients receive push notifications
- [ ] History synchronizes after reconnecting
- [ ] Image and document attachments upload and download securely
- [ ] Read and delivery statuses update correctly
- [ ] Unauthorized users cannot access conversations
- [ ] Self-messaging is rejected
- [ ] Blocking and privacy restrictions are enforced
- [ ] Existing application functionality is unaffected

---

## 9. Final Deliverables

- Architecture overview
- Database ER diagram and migration summary
- REST API and WebSocket documentation
- Cloudinary configuration requirements (env variables, folders, size/format limits, cleanup job)
- Push notification configuration requirements
- Flutter implementation summary
- Security implementation summary
- Test results and remaining issues

---

## Final Instruction

Implement a complete, functional messaging module using the existing News Share architecture.

**Do not** use mock messages, hardcoded users, simulated delivery statuses, or frontend-only functionality. **Do not** modify unrelated features. Analyze first, implement incrementally, and verify the complete workflow end to end.
