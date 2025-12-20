
## NewsShare Database ER Diagram

The ER diagram represents the complete PostgreSQL database schema for the NewsShare prototype application, capturing all entities, relationships, and constraints defined in the software architecture document.[^1]

### Core Entities and Relationships

```
+---------------+       +-----------------+       +---------------+
|     Users     |       |     Posts       |       | SourceArticles|
|---------------| 1:N  |-----------------| 1:N  |---------------|
| id (PK, UUID) |<---->| id (PK, UUID)   |<---->| id (PK, UUID) |
| email (UNQ)   |       | author_id (FK)  |       | source_name   |
| password_hash |       | title           |       | title         |
| display_name  |       | content         |       | content       |
| google_id     |       | tags[]          |       | article_url   |
| facebook_id   |       | comment_count   |       |               |
| follower_cnt  |       | like_count      |       |               |
+---------------+       +----------------+       +---------------+
         | 1:N                      | 1:N                | 1:N
         |                          |                    |
         v                          v                    v
+---------------+       +-----------------+       +-----------------+
|    Follows    |       |    Comments     |       |     Reposts     |
|---------------|       |-----------------|       |-----------------|
| id (PK, UUID) |       | id (PK, UUID)   |       | id (PK, UUID)   |
| follower_id   |       | post_id (FK)    |       | user_id (FK)    |
| followed_id   |       | user_id (FK)    |       | orig_post_id(FK)|
| created_at    |       | content         |       | orig_src_id(FK) |
+---------------+       | like_count      |       | comment         |
                        +-----------------+       +-----------------+
                               | 1:N                        | 1:N
                               |                            |
                               v                            v
                        +-----------------+       +-----------------+
                        |      Likes      |       |   Notifications |
                        |-----------------|       |-----------------|
                        | id (PK, UUID)   |       | id (PK, UUID)   |
                        | post_id (FK)?   |       | user_id (FK)    |
                        | comment_id(FK)? |       | type            |
                        | repost_id(FK)?  |       | title           |
                        | user_id (FK)    |       | message         |
                        +-----------------+       | is_read         |
                                                   +-----------------+
```

### Key Relationship Cardinalities

| Relationship                        | Cardinality           | Description                            |
| :---------------------------------- | :-------------------- | :------------------------------------- |
| **Users → Posts**            | 1:N                   | One user authors many posts            |
| **Users → Comments**         | 1:N                   | One user creates many comments         |
| **Users → Reposts**          | 1:N                   | One user creates many reposts          |
| **Users → Follows**          | 1:N (both directions) | Users follow other users               |
| **Posts → Comments**         | 1:N                   | One post receives many comments        |
| **Posts → Likes**            | 1:N                   | One post receives many likes           |
| **SourceArticles → Reposts** | 1:N                   | One article can be reposted many times |
| **Users → Notifications**    | 1:N                   | One user receives many notifications   |
| **Follows**                   | N:N                   | Many-to-many user relationships[^1]    |

### Constraint Details

**Critical Business Constraints:**

```
Reposts: MUST reference EXACTLY ONE of (original_post_id OR original_source_id)
Likes:   MUST reference EXACTLY ONE of (post_id OR comment_id OR repost_id)
Follows: follower_id ≠ followed_id (no self-follows)
```

**Unique Constraints:**

- `users.email` (unique)
- `users.google_id` (unique)
- `users.facebook_id` (unique)
- `follows(follower_id, followed_id)` (composite unique)
- `likes(post_id, user_id)`, `likes(comment_id, user_id)`, `likes(repost_id, user_id)`

### Performance Indexes

```
Critical Indexes for Feed Generation:
├── users: email, google_id, facebook_id
├── posts: author_id, created_at DESC
├── reposts: user_id, created_at DESC
├── comments: post_id, user_id, created_at DESC
├── follows: follower_id, followed_id
├── notifications: user_id, created_at DESC, is_read
└── source_articles: source_name, created_at DESC
```

### Data Flow Summary

**Feed Query Pattern:**

```
SELECT * FROM (
  -- User's own recent posts
  SELECT * FROM posts WHERE author_id = $user_id
  
  UNION ALL
  
  -- Followed users' posts
  SELECT p.* FROM posts p
  JOIN follows f ON p.author_id = f.followed_id
  WHERE f.follower_id = $user_id
  
  UNION ALL
  
  -- User's reposts
  SELECT * FROM reposts r JOIN posts p ON r.original_post_id = p.id
  WHERE r.user_id = $user_id
  
  UNION ALL
  
  -- Recent third-party articles
  SELECT * FROM source_articles
) AS feed_data
ORDER BY created_at DESC
LIMIT 20 OFFSET $page*20;
```

This ER diagram supports all NewsShare use cases: authentication (users table), content creation (posts), social engagement (follows, comments, likes), news aggregation (source_articles), sharing/reposting (reposts), and notifications. The normalized design ensures data integrity while supporting efficient feed generation and social features for the prototype scope.[^1]
