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

  // Setup Alice & Bob
  async function registerUser(name: string) {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `${name}_${uid}@example.com`,
        password: 'Password123!',
        username: `${name}_${uid}`,
        fullName: `${name} Wonderland`,
      }),
    });
    return res.json();
  }

  const alice = await registerUser('alice');
  const bob = await registerUser('bob');

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
    // 1. POST /users/:id/follow (Alice follows Bob)
    await executeRequest(
      '1',
      'Follow User - Alice follows Bob (POST /users/:id/follow)',
      'POST',
      `/users/${bob.profile.id}/follow`,
      alice.accessToken,
      undefined,
      (status, data) => [
        { assertion: 'Status code is 200 OK', passed: status === 200 },
        { assertion: 'following is true', passed: data?.following === true },
      ],
    );

    // 2. POST /users/:id/follow (Idempotent follow)
    await executeRequest(
      '2',
      'Follow User - Idempotent re-follow (POST /users/:id/follow)',
      'POST',
      `/users/${bob.profile.id}/follow`,
      alice.accessToken,
      undefined,
      (status, data) => [
        { assertion: 'Status code is 200 OK', passed: status === 200 },
        { assertion: 'following remains true', passed: data?.following === true },
      ],
    );

    // 3. GET /users/:id/follow-status (Alice perspective)
    await executeRequest(
      '3',
      'Check Follow Status - Alice perspective (GET /users/:id/follow-status)',
      'GET',
      `/users/${bob.profile.id}/follow-status`,
      alice.accessToken,
      undefined,
      (status, data) => [
        { assertion: 'Status code is 200 OK', passed: status === 200 },
        { assertion: 'isFollowing is true', passed: data?.isFollowing === true },
        { assertion: 'isFollowedBy is false', passed: data?.isFollowedBy === false },
      ],
    );

    // 4. GET /users/:id/follow-status (Bob perspective)
    await executeRequest(
      '4',
      'Check Follow Status - Bob perspective (GET /users/:id/follow-status)',
      'GET',
      `/users/${alice.profile.id}/follow-status`,
      bob.accessToken,
      undefined,
      (status, data) => [
        { assertion: 'Status code is 200 OK', passed: status === 200 },
        { assertion: 'isFollowing is false', passed: data?.isFollowing === false },
        { assertion: 'isFollowedBy is true', passed: data?.isFollowedBy === true },
      ],
    );

    // 5. POST /users/:id/follow (Bob follows Alice - Mutual Follow)
    await executeRequest(
      '5',
      'Mutual Follow - Bob follows Alice (POST /users/:id/follow)',
      'POST',
      `/users/${alice.profile.id}/follow`,
      bob.accessToken,
      undefined,
      (status, data) => [
        { assertion: 'Status code is 200 OK', passed: status === 200 },
        { assertion: 'following is true', passed: data?.following === true },
      ],
    );

    // 6. GET /users/:id/follow-status (Mutual follow confirmed)
    await executeRequest(
      '6',
      'Check Follow Status - Mutual follow confirmed (GET /users/:id/follow-status)',
      'GET',
      `/users/${bob.profile.id}/follow-status`,
      alice.accessToken,
      undefined,
      (status, data) => [
        { assertion: 'Status code is 200 OK', passed: status === 200 },
        { assertion: 'isFollowing is true', passed: data?.isFollowing === true },
        { assertion: 'isFollowedBy is true (mutual)', passed: data?.isFollowedBy === true },
      ],
    );

    // 7. GET /users/:id/followers (List followers of Bob)
    await executeRequest(
      '7',
      'Get Followers of Bob (GET /users/:id/followers?limit=10)',
      'GET',
      `/users/${bob.profile.id}/followers?limit=10`,
      alice.accessToken,
      undefined,
      (status, data) => [
        { assertion: 'Status code is 200 OK', passed: status === 200 },
        { assertion: 'Response envelope contains data array', passed: Array.isArray(data?.data) },
        { assertion: 'Alice appears in Bob followers list', passed: data?.data?.some((u: any) => u.id === alice.profile.id) },
      ],
    );

    // 8. GET /users/:id/following (List following of Bob)
    await executeRequest(
      '8',
      'Get Following of Bob (GET /users/:id/following?limit=10)',
      'GET',
      `/users/${bob.profile.id}/following?limit=10`,
      alice.accessToken,
      undefined,
      (status, data) => [
        { assertion: 'Status code is 200 OK', passed: status === 200 },
        { assertion: 'Response envelope contains data array', passed: Array.isArray(data?.data) },
        { assertion: 'Alice appears in Bob following list', passed: data?.data?.some((u: any) => u.id === alice.profile.id) },
      ],
    );

    // 9. POST /users/:id/follow (Self-follow validation - 400)
    await executeRequest(
      '9',
      'Follow User - Self-follow attempt (POST /users/:id/follow) - Bad Request',
      'POST',
      `/users/${alice.profile.id}/follow`,
      alice.accessToken,
      undefined,
      (status, data) => [
        { assertion: 'Status code is 400 Bad Request', passed: status === 400 },
        { assertion: 'Message is "You cannot follow yourself"', passed: data?.message === 'You cannot follow yourself' },
      ],
    );

    // 10. POST /users/:id/follow (Non-existent user - 404)
    await executeRequest(
      '10',
      'Follow User - Non-existent user (POST /users/:id/follow) - Not Found',
      'POST',
      '/users/00000000-0000-0000-0000-000000000000/follow',
      alice.accessToken,
      undefined,
      (status, data) => [
        { assertion: 'Status code is 404 Not Found', passed: status === 404 },
        { assertion: 'Message is "User not found"', passed: data?.message === 'User not found' },
      ],
    );

    // 11. POST /users/:id/follow (Invalid UUID - 400)
    await executeRequest(
      '11',
      'Follow User - Invalid UUID (POST /users/:id/follow) - Bad Request',
      'POST',
      '/users/invalid-uuid/follow',
      alice.accessToken,
      undefined,
      (status, data) => [
        { assertion: 'Status code is 400 Bad Request', passed: status === 400 },
        { assertion: 'Message is "Invalid UUID"', passed: data?.message === 'Invalid UUID' },
      ],
    );

    // 12. DELETE /users/:id/follow (Alice unfollows Bob)
    await executeRequest(
      '12',
      'Unfollow User - Alice unfollows Bob (DELETE /users/:id/follow)',
      'DELETE',
      `/users/${bob.profile.id}/follow`,
      alice.accessToken,
      undefined,
      (status, data) => [
        { assertion: 'Status code is 200 OK', passed: status === 200 },
        { assertion: 'following is false', passed: data?.following === false },
      ],
    );

    // 13. DELETE /users/:id/follow (Idempotent unfollow)
    await executeRequest(
      '13',
      'Unfollow User - Idempotent re-unfollow (DELETE /users/:id/follow)',
      'DELETE',
      `/users/${bob.profile.id}/follow`,
      alice.accessToken,
      undefined,
      (status, data) => [
        { assertion: 'Status code is 200 OK', passed: status === 200 },
        { assertion: 'following remains false', passed: data?.following === false },
      ],
    );

    // 14. GET /users/:id/follow-status (Status after unfollow)
    await executeRequest(
      '14',
      'Check Follow Status - After Alice unfollowed Bob (GET /users/:id/follow-status)',
      'GET',
      `/users/${bob.profile.id}/follow-status`,
      alice.accessToken,
      undefined,
      (status, data) => [
        { assertion: 'Status code is 200 OK', passed: status === 200 },
        { assertion: 'isFollowing is false', passed: data?.isFollowing === false },
        { assertion: 'isFollowedBy remains true (Bob still follows Alice)', passed: data?.isFollowedBy === true },
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
