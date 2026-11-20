import { PrismaClient } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const ROOT = process.env.CLOUDINARY_ROOT_FOLDER || 'news_share';

async function migrateImages() {
  console.log('Migrating images without public IDs to Cloudinary...');

  // 1. Avatars
  const profiles = await prisma.profile.findMany({
    where: {
      avatarUrl: { not: null },
      avatarPublicId: null,
    },
  });

  console.log(`Found ${profiles.length} avatars to migrate.`);
  for (const profile of profiles) {
    if (!profile.avatarUrl) continue;
    try {
      const res = await cloudinary.uploader.upload(profile.avatarUrl, {
        folder: `${ROOT}/avatars`,
        public_id: profile.id,
        overwrite: true,
      });

      await prisma.profile.update({
        where: { id: profile.id },
        data: {
          avatarUrl: res.secure_url,
          avatarPublicId: res.public_id,
        },
      });
      console.log(`Migrated avatar for profile ${profile.id}`);
    } catch (err) {
      console.error(`Failed to migrate avatar for profile ${profile.id}:`, err);
    }
  }

  // 2. Posts
  const posts = await prisma.post.findMany({
    where: {
      imageUrl: { not: null },
      imagePublicId: null,
    },
  });

  console.log(`Found ${posts.length} post images to migrate.`);
  for (const post of posts) {
    if (!post.imageUrl) continue;
    try {
      const assetId = randomUUID();
      const res = await cloudinary.uploader.upload(post.imageUrl, {
        folder: `${ROOT}/posts/${post.userId}`,
        public_id: assetId,
        overwrite: false,
      });

      await prisma.post.update({
        where: { id: post.id },
        data: {
          imageUrl: res.secure_url,
          imagePublicId: res.public_id,
        },
      });
      console.log(`Migrated image for post ${post.id}`);
    } catch (err) {
      console.error(`Failed to migrate image for post ${post.id}:`, err);
    }
  }

  console.log('Image migration complete.');
}

migrateImages()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
