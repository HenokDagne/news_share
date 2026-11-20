import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function importFromSupabase() {
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    console.log('No data directory found. Create "data/" with export files to import.');
    return;
  }

  console.log('Importing data from data/ directory...');

  const usersPath = path.join(dataDir, 'users.json');
  const profilesPath = path.join(dataDir, 'profiles.json');
  const postsPath = path.join(dataDir, 'posts.json');
  const followersPath = path.join(dataDir, 'followers.json');
  const notificationsPath = path.join(dataDir, 'notifications.json');

  if (fs.existsSync(usersPath)) {
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    for (const u of users) {
      await prisma.user.upsert({
        where: { id: u.id },
        update: {},
        create: {
          id: u.id,
          email: u.email.toLowerCase(),
          passwordHash: u.encrypted_password || u.password_hash,
          emailVerified: u.email_verified || false,
          createdAt: u.created_at ? new Date(u.created_at) : new Date(),
        },
      });
    }
    console.log(`Imported ${users.length} users.`);
  }

  if (fs.existsSync(profilesPath)) {
    const profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf8'));
    for (const p of profiles) {
      await prisma.profile.upsert({
        where: { id: p.id },
        update: {},
        create: {
          id: p.id,
          username: p.username,
          fullName: p.full_name || null,
          bio: p.bio || null,
          avatarUrl: p.avatar_url || null,
          followersCount: p.followers_count || 0,
          followingCount: p.following_count || 0,
        },
      });
    }
    console.log(`Imported ${profiles.length} profiles.`);
  }

  if (fs.existsSync(postsPath)) {
    const posts = JSON.parse(fs.readFileSync(postsPath, 'utf8'));
    for (const p of posts) {
      await prisma.post.upsert({
        where: { id: p.id },
        update: {},
        create: {
          id: p.id,
          userId: p.user_id,
          title: p.title || null,
          content: p.content || null,
          imageUrl: p.image_url || null,
          createdAt: p.created_at ? new Date(p.created_at) : new Date(),
        },
      });
    }
    console.log(`Imported ${posts.length} posts.`);
  }

  if (fs.existsSync(followersPath)) {
    const followers = JSON.parse(fs.readFileSync(followersPath, 'utf8'));
    let importedFollows = 0;
    for (const f of followers) {
      // Drop self-follows (FR-MIG-01)
      if (f.follower_id === f.following_id) continue;
      await prisma.follow.upsert({
        where: {
          followerId_followingId: {
            followerId: f.follower_id,
            followingId: f.following_id,
          },
        },
        update: {},
        create: {
          followerId: f.follower_id,
          followingId: f.following_id,
          createdAt: f.created_at ? new Date(f.created_at) : new Date(),
        },
      });
      importedFollows++;
    }
    console.log(`Imported ${importedFollows} follow relations.`);
  }

  if (fs.existsSync(notificationsPath)) {
    const notifications = JSON.parse(fs.readFileSync(notificationsPath, 'utf8'));
    for (const n of notifications) {
      await prisma.notification.upsert({
        where: { id: n.id },
        update: {},
        create: {
          id: n.id,
          userId: n.user_id,
          actorId: n.actor_id || null,
          type: n.type || 'follow',
          postId: n.post_id || null,
          message: n.message || null,
          isRead: n.is_read || false,
          createdAt: n.created_at ? new Date(n.created_at) : new Date(),
        },
      });
    }
    console.log(`Imported ${notifications.length} notifications.`);
  }

  console.log('Import completed.');
}

importFromSupabase()
  .catch((e) => {
    console.error('Import failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
