import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function reconcile() {
  console.log('Reconciling follower and following counts...');

  const profiles = await prisma.profile.findMany({ select: { id: true } });

  for (const profile of profiles) {
    const [followersCount, followingCount] = await Promise.all([
      prisma.follow.count({ where: { followingId: profile.id } }),
      prisma.follow.count({ where: { followerId: profile.id } }),
    ]);

    await prisma.profile.update({
      where: { id: profile.id },
      data: {
        followersCount,
        followingCount,
      },
    });

    console.log(
      `Profile ${profile.id}: followers=${followersCount}, following=${followingCount}`,
    );
  }

  console.log('Follow counts reconciled successfully.');
}

reconcile()
  .catch((e) => {
    console.error('Reconciliation failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
