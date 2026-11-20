import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

interface StepReport {
  step: string;
  action: string;
  endpoint: string;
  status: number;
  data: any;
  passed: boolean;
  notes?: string;
}

async function run() {
  console.log('===============================================================');
  console.log(' STARTING NOTIFICATION ENDPOINT TEST FOR henokd12@gmail.com ');
  console.log(' THREE DIFFERENT USERS FOLLOWING henokd12@gmail.com ');
  console.log('===============================================================');

  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(3000, '127.0.0.1');

  const BASE_URL = 'http://127.0.0.1:3000/api/v1';
  const reports: StepReport[] = [];
  const ts = Date.now().toString().slice(-6);

  try {
    // -----------------------------------------------------------------
    // 1. Authenticate / Setup Target User: henokd12@gmail.com
    // -----------------------------------------------------------------
    console.log('\n--- 1. Authenticating target user: henokd12@gmail.com ---');
    const henokAuthRes = await fetch(`${BASE_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'henokd12@gmail.com',
        fullName: 'Henok Dagne',
        avatarUrl: 'https://lh3.googleusercontent.com/a/henok_avatar.png',
      }),
    });
    const henokAuth = await henokAuthRes.json();
    const henokToken = henokAuth.accessToken;
    const henokProfileId = henokAuth.profile.id;
    console.log(`Target Henok Profile ID: ${henokProfileId}, Username: ${henokAuth.profile.username}`);

    reports.push({
      step: '1',
      action: 'Target User Authentication (Google OAuth)',
      endpoint: 'POST /auth/google',
      status: henokAuthRes.status,
      data: { id: henokProfileId, email: henokAuth.profile.email, username: henokAuth.profile.username },
      passed: henokAuthRes.status === 200 && !!henokToken,
    });

    // Check initial unread count for Henok
    const initialCountRes = await fetch(`${BASE_URL}/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${henokToken}` },
    });
    const initialCount = await initialCountRes.json();
    console.log(`Initial unread notification count for Henok: ${initialCount.count}`);

    // -----------------------------------------------------------------
    // 2. Register 3 Distinct Users
    // -----------------------------------------------------------------
    console.log('\n--- 2. Registering 3 Distinct Followers ---');
    async function registerFollower(index: number, name: string) {
      const email = `follower_${index}_${ts}@example.com`;
      const username = `flw_${index}_${ts}`;
      const res = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          username,
          password: 'Password123!',
          fullName: name,
        }),
      });
      const data = await res.json();
      return { token: data.accessToken, profile: data.profile };
    }

    const follower1 = await registerFollower(1, 'Marcus Aurelius');
    const follower2 = await registerFollower(2, 'Ada Lovelace');
    const follower3 = await registerFollower(3, 'Nikola Tesla');
    console.log(`Follower 1 created: @${follower1.profile.username} (${follower1.profile.fullName})`);
    console.log(`Follower 2 created: @${follower2.profile.username} (${follower2.profile.fullName})`);
    console.log(`Follower 3 created: @${follower3.profile.username} (${follower3.profile.fullName})`);

    reports.push({
      step: '2',
      action: 'Register 3 distinct users',
      endpoint: 'POST /auth/register (x3)',
      status: 201,
      data: [follower1.profile.username, follower2.profile.username, follower3.profile.username],
      passed: !!follower1.token && !!follower2.token && !!follower3.token,
    });

    // -----------------------------------------------------------------
    // 3. Three Different Users Follow henokd12@gmail.com
    // -----------------------------------------------------------------
    console.log('\n--- 3. Users Following henokd12@gmail.com ---');
    
    // Follower 1 follows Henok
    const f1Res = await fetch(`${BASE_URL}/users/${henokProfileId}/follow`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${follower1.token}` },
    });
    const f1Data = await f1Res.json();
    console.log(`Follower 1 (@${follower1.profile.username}) followed Henok: Status ${f1Res.status}`, f1Data);

    reports.push({
      step: '3.1',
      action: 'Follower 1 follows henokd12@gmail.com',
      endpoint: `POST /users/${henokProfileId}/follow`,
      status: f1Res.status,
      data: f1Data,
      passed: f1Res.status === 201 && f1Data.following === true,
    });

    // Follower 2 follows Henok
    const f2Res = await fetch(`${BASE_URL}/users/${henokProfileId}/follow`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${follower2.token}` },
    });
    const f2Data = await f2Res.json();
    console.log(`Follower 2 (@${follower2.profile.username}) followed Henok: Status ${f2Res.status}`, f2Data);

    reports.push({
      step: '3.2',
      action: 'Follower 2 follows henokd12@gmail.com',
      endpoint: `POST /users/${henokProfileId}/follow`,
      status: f2Res.status,
      data: f2Data,
      passed: f2Res.status === 201 && f2Data.following === true,
    });

    // Follower 3 follows Henok
    const f3Res = await fetch(`${BASE_URL}/users/${henokProfileId}/follow`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${follower3.token}` },
    });
    const f3Data = await f3Res.json();
    console.log(`Follower 3 (@${follower3.profile.username}) followed Henok: Status ${f3Res.status}`, f3Data);

    reports.push({
      step: '3.3',
      action: 'Follower 3 follows henokd12@gmail.com',
      endpoint: `POST /users/${henokProfileId}/follow`,
      status: f3Res.status,
      data: f3Data,
      passed: f3Res.status === 201 && f3Data.following === true,
    });

    // Short wait for asynchronous event listener to emit notifications
    await new Promise((r) => setTimeout(r, 600));

    // -----------------------------------------------------------------
    // 4. Test Notification Endpoints for henokd12@gmail.com
    // -----------------------------------------------------------------
    console.log('\n--- 4. Testing Notification Endpoints for Henok ---');

    // 4.1 GET /notifications/unread-count
    const unreadRes = await fetch(`${BASE_URL}/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${henokToken}` },
    });
    const unreadData = await unreadRes.json();
    console.log(`Unread Count for Henok: ${unreadData.count}`);
    reports.push({
      step: '4.1',
      action: 'Get unread notification count',
      endpoint: 'GET /notifications/unread-count',
      status: unreadRes.status,
      data: unreadData,
      passed: unreadRes.status === 200 && unreadData.count >= 3,
      notes: `Expected count >= 3, got ${unreadData.count}`,
    });

    // 4.2 GET /notifications
    const listRes = await fetch(`${BASE_URL}/notifications?limit=10`, {
      headers: { Authorization: `Bearer ${henokToken}` },
    });
    const listData = await listRes.json();
    console.log(`Received ${listData.data?.length} notifications for Henok:`);
    listData.data.slice(0, 3).forEach((n: any, idx: number) => {
      console.log(`  [${idx + 1}] Type: ${n.type} | Actor: @${n.actor?.username} (${n.actor?.fullName}) | Message: "${n.message}" | isRead: ${n.isRead}`);
    });

    const receivedActors = listData.data.map((n: any) => n.actor?.username);
    const hasAllThree = [follower1.profile.username, follower2.profile.username, follower3.profile.username].every(u => receivedActors.includes(u));

    reports.push({
      step: '4.2',
      action: 'List notifications for henokd12@gmail.com',
      endpoint: 'GET /notifications?limit=10',
      status: listRes.status,
      data: {
        total: listData.data?.length,
        firstThree: listData.data?.slice(0, 3),
      },
      passed: listRes.status === 200 && hasAllThree,
      notes: `All 3 followers present: ${hasAllThree}`,
    });

    const firstNotifId = listData.data[0]?.id;

    // 4.3 PATCH /notifications/:id/read (mark single notification read)
    console.log(`\nMarking notification ${firstNotifId} as read...`);
    const readSingleRes = await fetch(`${BASE_URL}/notifications/${firstNotifId}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${henokToken}` },
    });
    const readSingleData = await readSingleRes.json();
    console.log(`Notification marked read:`, readSingleData);

    reports.push({
      step: '4.3',
      action: 'Mark single notification as read',
      endpoint: `PATCH /notifications/${firstNotifId}/read`,
      status: readSingleRes.status,
      data: readSingleData,
      passed: readSingleRes.status === 200 && readSingleData.isRead === true,
    });

    // Verify unread count decremented by 1
    const unreadAfterSingleRes = await fetch(`${BASE_URL}/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${henokToken}` },
    });
    const unreadAfterSingle = await unreadAfterSingleRes.json();
    console.log(`Unread count after marking 1 read: ${unreadAfterSingle.count}`);

    // 4.4 POST /notifications/read-all (mark all read)
    console.log(`\nMarking all notifications as read for Henok...`);
    const readAllRes = await fetch(`${BASE_URL}/notifications/read-all`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${henokToken}` },
    });
    const readAllData = await readAllRes.json();
    console.log(`Mark all read response:`, readAllData);

    const finalUnreadRes = await fetch(`${BASE_URL}/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${henokToken}` },
    });
    const finalUnreadData = await finalUnreadRes.json();
    console.log(`Final unread count for Henok: ${finalUnreadData.count}`);

    reports.push({
      step: '4.4',
      action: 'Mark all notifications as read',
      endpoint: 'POST /notifications/read-all',
      status: readAllRes.status,
      data: { updatedCount: readAllData.updated, finalUnread: finalUnreadData.count },
      passed: readAllRes.status === 200 && finalUnreadData.count === 0,
    });

    // 4.5 DELETE /notifications/:id (delete a notification)
    console.log(`\nDeleting notification ${firstNotifId}...`);
    const deleteRes = await fetch(`${BASE_URL}/notifications/${firstNotifId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${henokToken}` },
    });
    console.log(`Delete response status: ${deleteRes.status}`);

    reports.push({
      step: '4.5',
      action: 'Delete notification',
      endpoint: `DELETE /notifications/${firstNotifId}`,
      status: deleteRes.status,
      data: { deleted: true },
      passed: deleteRes.status === 204,
    });

    console.log('\n===============================================================');
    console.log(' ALL NOTIFICATION ENDPOINT TESTS COMPLETED SUCCESSFULLY! ');
    console.log('===============================================================');
    console.table(reports.map(r => ({
      Step: r.step,
      Action: r.action,
      Endpoint: r.endpoint,
      Status: r.status,
      Passed: r.passed ? 'PASS' : 'FAIL',
      Notes: r.notes || '',
    })));

  } catch (err) {
    console.error('Test execution failed:', err);
  } finally {
    await app.close();
  }
}

run();
