import { PrismaClient, Permission, Role } from '@prisma/client';
import { hashPassword } from '../src/common/utils/hash.util';

const prisma = new PrismaClient();

async function uniqueUsername(tx: any, base: string): Promise<string> {
  let candidate = base;
  let counter = 1;
  while (await tx.profile.findUnique({ where: { username: candidate } })) {
    candidate = `${base}${counter++}`;
  }
  return candidate;
}

async function main() {
  const existingSuperAdmin = await prisma.user.findFirst({
    where: { role: Role.SUPER_ADMIN },
  });

  if (existingSuperAdmin) {
    console.log('A super admin already exists; skipping.');
    return;
  }

  const email = (process.env.ADMIN_SEED_EMAIL || 'admin@newsshare.com').trim().toLowerCase();
  const password = process.env.ADMIN_SEED_PASSWORD || 'AdminSuperPass2026!';

  if (password.length < 12) {
    throw new Error('ADMIN_SEED_PASSWORD must be at least 12 characters');
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  const permissions = Object.values(Permission);

  await prisma.$transaction(async (tx) => {
    let userId: string;

    if (existing) {
      const user = await tx.user.update({
        where: { id: existing.id },
        data: {
          role: Role.SUPER_ADMIN,
          status: 'ACTIVE',
        },
      });
      userId = user.id;
    } else {
      const passwordHash = await hashPassword(password);
      const username = await uniqueUsername(tx, 'admin');

      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          emailVerified: true,
          emailVerifiedAt: new Date(),
          role: Role.SUPER_ADMIN,
          status: 'ACTIVE',
          mustChangePassword: true,
          profile: {
            create: {
              username,
              fullName: 'Super Administrator',
            },
          },
        },
      });
      userId = user.id;
    }

    // Grant all permissions
    await tx.userPermission.createMany({
      data: permissions.map((p) => ({
        userId,
        permission: p,
      })),
      skipDuplicates: true,
    });

    console.log(`Super admin successfully provisioned for ${email}.`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
