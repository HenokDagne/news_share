import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

interface TestResult {
  step: string;
  name: string;
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: any;
  };
  response: {
    status: number;
    statusText: string;
    timeMs: number;
    headers: Record<string, string>;
    body: any;
  };
  tests: { assertion: string; passed: boolean }[];
}

async function main() {
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
  const results: TestResult[] = [];
  const uid = Math.random().toString(36).substring(2, 8);

  // Setup User A (Actor / Follower) and User B (Target / Author)
  async function registerUser(prefix: string) {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `${prefix}_${uid}@example.com`,
        password: 'Password123!',
        username: `${prefix}_${uid}`,
        fullName: `${prefix} TestUser`,
      }),
    });
    return res.json();
  }

  const userA = await registerUser('alice');
  const userB = await registerUser('bob');

  async function executeRequest(
    step: string,
    name: string,
    method: string,
    path: string,
    token: string,
    body?: any,
    assertions: (status: number, data: any) => { assertion: string; passed: boolean }[] = () => [],
  ) {
    const fullUrl = `${BASE_URL}${path}`;
    const reqHeaders: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    let reqBodyStr: string | undefined;

    if (body !== undefined) {
      reqHeaders['Content-Type'] = 'application/json';
      reqBodyStr = JSON.stringify(body);
    }

    const start = performance.now();
    const res = await fetch(fullUrl, {
      method,
      headers: reqHeaders,
      body: reqBodyStr,
    });
    const timeMs = Math.round(performance.now() - start);

    let resBody: any = null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      resBody = await res.json();
    } else {
      const text = await res.text();
      resBody = text || null;
    }

    const resHeaders: Record<string, string> = {};
    res.headers.forEach((val, key) => {
      resHeaders[key] = val;
    });

    const testChecks = assertions(res.status, resBody);

    const testResult: TestResult = {
      step,
      name,
      request: {
        method,
        url: fullUrl,
        headers: reqHeaders,
        body,
      },
      response: {
        status: res.status,
        statusText: res.statusText,
        timeMs,
        headers: resHeaders,
        body: resBody,
      },
      tests: testChecks,
    };

    results.push(testResult);
    return { status: res.status, body: resBody };
  }

  try {
    // -------------------------------------------------------------
    // TRIGGER 1: Alice follows Bob -> triggers follow notification for Bob
    // -------------------------------------------------------------
    await fetch(`${BASE_URL}/users/${userB.profile.id}/follow`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.accessToken}` },
    });
    await new Promise((r) => setTimeout(r, 200));

    // 1. GET /notifications/unread-count (Bob checks unread count - expect 1)
    await executeRequest(
      '1',
      'Get Unread Count - Bob after follow (GET /notifications/unread-count)',
      'GET',
      '/notifications/unread-count',
      userB.accessToken,
      undefined,
      (status, data) => [
        { assertion: 'Status code is 200 OK', passed: status === 200 },
        { assertion: 'Unread count is at least 1', passed: data?.count >= 1 },
      ],
    );

    // 2. GET /notifications (Bob gets notifications list)
    const bobNotifs = await executeRequest(
      '2',
      'Get Notifications - Bob lists follow notification (GET /notifications)',
      'GET',
      '/notifications?limit=10',
      userB.accessToken,
      undefined,
      (status, data) => [
        { assertion: 'Status code is 200 OK', passed: status === 200 },
        { assertion: 'Response has data array', passed: Array.isArray(data?.data) },
        { assertion: 'First notification type is "follow"', passed: data?.data[0]?.type === 'follow' },
        { assertion: 'Actor is Alice', passed: data?.data[0]?.actor?.id === userA.profile.id },
        { assertion: 'Notification is initially unread (isRead = false)', passed: data?.data[0]?.isRead === false },
      ],
    );
    const bobNotificationId = bobNotifs.body?.data[0]?.id;

    // -------------------------------------------------------------
    // TRIGGER 2: Bob posts a post -> triggers new_post notification for Alice (who follows Bob)
    // -------------------------------------------------------------
    const form = new FormData();
    form.append('title', 'Exclusive Tech Update from Bob');
    form.append('content', 'Exciting architectural innovations coming up.');
    const postRes = await fetch(`${BASE_URL}/posts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userB.accessToken}` },
      body: form,
    });
    const createdPost = await postRes.json();
    await new Promise((r) => setTimeout(r, 200));

    // 3. GET /notifications (Alice gets new_post notification)
    const aliceNotifs = await executeRequest(
      '3',
      'Get Notifications - Alice receives new_post notification (GET /notifications)',
      'GET',
      '/notifications?limit=10',
      userA.accessToken,
      undefined,
      (status, data) => [
        { assertion: 'Status code is 200 OK', passed: status === 200 },
        { assertion: 'First notification type is "new_post"', passed: data?.data[0]?.type === 'new_post' },
        { assertion: 'postId matches created post', passed: data?.data[0]?.postId === createdPost.id },
        { assertion: 'Actor is Bob', passed: data?.data[0]?.actor?.id === userB.profile.id },
      ],
    );
    const aliceNotificationId = aliceNotifs.body?.data[0]?.id;

    // 4. GET /notifications?unread=true (Filter unread notifications only)
    await executeRequest(
      '4',
      'Filter Unread Notifications - (GET /notifications?unread=true)',
      'GET',
      '/notifications?unread=true&limit=10',
      userB.accessToken,
      undefined,
      (status, data) => [
        { assertion: 'Status code is 200 OK', passed: status === 200 },
        { assertion: 'All returned notifications have isRead = false', passed: data?.data?.every((n: any) => n.isRead === false) },
      ],
    );

    // 5. PATCH /notifications/:id/read (Bob marks his notification as read)
    await executeRequest(
      '5',
      'Mark Single Notification Read - (PATCH /notifications/:id/read)',
      'PATCH',
      `/notifications/${bobNotificationId}/read`,
      userB.accessToken,
      undefined,
      (status, data) => [
        { assertion: 'Status code is 200 OK', passed: status === 200 },
        { assertion: 'Returned notification id matches', passed: data?.id === bobNotificationId },
        { assertion: 'isRead is true', passed: data?.isRead === true },
      ],
    );

    // 6. GET /notifications/unread-count (Bob checks unread count - now 0)
    await executeRequest(
      '6',
      'Get Unread Count - Bob after marking read (GET /notifications/unread-count)',
      'GET',
      '/notifications/unread-count',
      userB.accessToken,
      undefined,
      (status, data) => [
        { assertion: 'Status code is 200 OK', passed: status === 200 },
        { assertion: 'Unread count is 0', passed: data?.count === 0 },
      ],
    );

    // 7. PATCH /notifications/:id/read (Unauthorized user tries to mark other user notification)
    await executeRequest(
      '7',
      'Mark Notification Read - Non-Owner Access Attempt (PATCH /notifications/:id/read) - Not Found',
      'PATCH',
      `/notifications/${aliceNotificationId}/read`,
      userB.accessToken,
      undefined,
      (status, data) => [
        { assertion: 'Status code is 404 Not Found', passed: status === 404 },
        { assertion: 'Message is "Notification not found"', passed: data?.message === 'Notification not found' },
      ],
    );

    // 8. POST /notifications/read-all (Alice marks all her notifications as read)
    await executeRequest(
      '8',
      'Mark All Notifications Read - (POST /notifications/read-all)',
      'POST',
      '/notifications/read-all',
      userA.accessToken,
      undefined,
      (status, data) => [
        { assertion: 'Status code is 200 OK', passed: status === 200 },
        { assertion: 'Updated count is at least 1', passed: data?.updated >= 1 },
      ],
    );

    // 9. DELETE /notifications/:id (Alice deletes her notification)
    await executeRequest(
      '9',
      'Delete Notification - Alice deletes notification (DELETE /notifications/:id)',
      'DELETE',
      `/notifications/${aliceNotificationId}`,
      userA.accessToken,
      undefined,
      (status, data) => [
        { assertion: 'Status code is 204 No Content', passed: status === 204 },
        { assertion: 'Response body is empty', passed: data === null },
      ],
    );

    // 10. DELETE /notifications/:id (Verifying deletion - 404 Not Found)
    await executeRequest(
      '10',
      'Delete Notification - Re-delete or not found (DELETE /notifications/:id) - Not Found',
      'DELETE',
      `/notifications/${aliceNotificationId}`,
      userA.accessToken,
      undefined,
      (status, data) => [
        { assertion: 'Status code is 404 Not Found', passed: status === 404 },
        { assertion: 'Message is "Notification not found"', passed: data?.message === 'Notification not found' },
      ],
    );

    console.log(JSON.stringify(results, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
