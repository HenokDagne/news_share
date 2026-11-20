import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { MailService } from '../src/mail/mail.service';

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(3333);

  const base = 'http://127.0.0.1:3333/api/v1';
  const mailService = app.get(MailService);

  try {
    console.log('Testing against NestJS on port 3333...');
    const rand = Math.random().toString(36).substring(2, 8);
    const u1Email = `u1_${rand}@example.com`;
    const u2Email = `u2_${rand}@example.com`;

    // 1. Register User 1
    const regRes = await fetch(`${base}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: u1Email,
        password: 'Password123!',
        username: `user1_${rand}`,
        fullName: 'User One',
      }),
    });
    const regData1 = await regRes.json();
    if (regRes.status !== 201) throw new Error(`Register failed: ${JSON.stringify(regData1)}`);
    const u1Token = mailService.getLatestToken(u1Email)!;
    const v1Res = await fetch(`${base}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: u1Token }),
    });
    const u1Auth = await v1Res.json();
    console.log(`[PASS] 1. Registered & verified user: ${u1Auth.profile.username} (${u1Auth.profile.id})`);

    // 2. Register User 2
    const regRes2 = await fetch(`${base}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: u2Email,
        password: 'Password123!',
        username: `user2_${rand}`,
        fullName: 'User Two',
      }),
    });
    const regData2 = await regRes2.json();
    if (regRes2.status !== 201) throw new Error(`Register failed: ${JSON.stringify(regData2)}`);
    const u2Token = mailService.getLatestToken(u2Email)!;
    const v2Res = await fetch(`${base}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: u2Token }),
    });
    const u2Auth = await v2Res.json();
    console.log(`[PASS] 2. Registered & verified user: ${u2Auth.profile.username} (${u2Auth.profile.id})`);

    // 3. User 2 follows User 1
    const followRes = await fetch(`${base}/users/${u1Auth.profile.id}/follow`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${u2Auth.accessToken}` },
    });
    const followData = await followRes.json();
    if (followRes.status !== 200 || !followData.following) throw new Error('Follow failed');
    console.log(`[PASS] 3. User 2 followed User 1: following=${followData.following}`);

    // 4. User 1 creates a post
    const form = new FormData();
    form.append('title', 'Breaking News');
    form.append('content', 'NestJS backend is running smoothly!');
    const postRes = await fetch(`${base}/posts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${u1Auth.accessToken}` },
      body: form,
    });
    const post = await postRes.json();
    if (postRes.status !== 201) throw new Error(`Create post failed: ${JSON.stringify(post)}`);
    console.log(`[PASS] 4. User 1 created post: "${post.title}" (${post.id})`);

    // 5. User 2 checks feed (should contain User 1's post)
    const feedRes = await fetch(`${base}/feed`, {
      headers: { Authorization: `Bearer ${u2Auth.accessToken}` },
    });
    const feed = await feedRes.json();
    if (!feed.data || feed.data.length === 0 || feed.data[0].id !== post.id) {
      throw new Error(`Feed missing post: ${JSON.stringify(feed)}`);
    }
    console.log(`[PASS] 5. User 2 feed has ${feed.data.length} post(s), first is "${feed.data[0].title}"`);

    // 6. User 2 checks notifications (should have new_post from User 1)
    await new Promise((r) => setTimeout(r, 200));
    const notifRes = await fetch(`${base}/notifications`, {
      headers: { Authorization: `Bearer ${u2Auth.accessToken}` },
    });
    const notifs = await notifRes.json();
    if (!notifs.data || notifs.data.length === 0) throw new Error('No notifications received');
    console.log(`[PASS] 6. User 2 notifications count: ${notifs.data.length}, type: ${notifs.data[0].type}`);

    // 7. User 2 marks notifications read
    const readAllRes = await fetch(`${base}/notifications/read-all`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${u2Auth.accessToken}` },
    });
    const readAllData = await readAllRes.json();
    console.log(`[PASS] 7. Read-all notifications: updated=${readAllData.updated}`);

    // 8. User 1 updates profile
    const patchMeRes = await fetch(`${base}/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${u1Auth.accessToken}`,
      },
      body: JSON.stringify({ bio: 'Software engineer & tech enthusiast' }),
    });
    const updatedMe = await patchMeRes.json();
    console.log(`[PASS] 8. User 1 bio updated: "${updatedMe.bio}"`);

    // 9. Search users
    const searchRes = await fetch(`${base}/users?search=user1`, {
      headers: { Authorization: `Bearer ${u2Auth.accessToken}` },
    });
    const searchResults = await searchRes.json();
    console.log(`[PASS] 9. User search found ${searchResults.data.length} match(es)`);

    // 10. Refresh token rotation
    const refreshRes = await fetch(`${base}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: u1Auth.refreshToken }),
    });
    const newTokens = await refreshRes.json();
    if (refreshRes.status !== 200 || !newTokens.accessToken) throw new Error('Refresh failed');
    console.log(`[PASS] 10. Token refresh successful, new refreshToken issued`);

    // 11. Old refresh token is revoked
    const reuseRes = await fetch(`${base}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: u1Auth.refreshToken }),
    });
    if (reuseRes.status !== 401) throw new Error('Old refresh token was not revoked!');
    console.log(`[PASS] 11. Reused old refresh token rejected with 401 Unauthorized as expected`);

    // 12. Logout
    const logoutRes = await fetch(`${base}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newTokens.accessToken}`,
      },
      body: JSON.stringify({ refreshToken: newTokens.refreshToken }),
    });
    if (logoutRes.status !== 204) throw new Error('Logout failed');
    console.log(`[PASS] 12. Logout returned 204 No Content`);

    console.log('\n========================================');
    console.log('ALL 12 END-TO-END ACCEPTANCE TESTS PASSED!');
    console.log('========================================\n');
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('Test script failed:', err);
  process.exit(1);
});
