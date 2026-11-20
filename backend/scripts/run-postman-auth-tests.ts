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
  const testEmail = `postman_${uid}@example.com`;
  const testPassword = 'Password123!';
  const testUsername = `postman_${uid}`;
  const testFullName = 'Postman Test User';

  let currentAccessToken = '';
  let currentRefreshToken = '';
  let registeredUserId = '';

  async function executeRequest(
    step: string,
    name: string,
    method: string,
    path: string,
    headers: Record<string, string>,
    body?: any,
    assertions: (status: number, data: any) => { assertion: string; passed: boolean }[] = () => [],
  ) {
    const fullUrl = `${BASE_URL}${path}`;
    const reqHeaders = { ...headers };
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
    // 1. POST /auth/register (Success)
    const regRes = await executeRequest(
      '1',
      'Register User (POST /auth/register) - Success',
      'POST',
      '/auth/register',
      {},
      {
        email: testEmail,
        password: testPassword,
        username: testUsername,
        fullName: testFullName,
      },
      (status, data) => [
        { assertion: 'Status code is 201 Created', passed: status === 201 },
        { assertion: 'Response has accessToken and refreshToken', passed: !!data?.accessToken && !!data?.refreshToken },
        { assertion: 'Response profile has correct email and username', passed: data?.profile?.email === testEmail && data?.profile?.username === testUsername },
        { assertion: 'Profile initial counters are 0', passed: data?.profile?.followersCount === 0 && data?.profile?.followingCount === 0 },
      ],
    );
    currentAccessToken = regRes.body?.accessToken;
    currentRefreshToken = regRes.body?.refreshToken;
    registeredUserId = regRes.body?.profile?.id;

    // 2. POST /auth/register (Duplicate Email / 409 Conflict)
    await executeRequest(
      '2',
      'Register User - Duplicate Email (POST /auth/register) - Conflict',
      'POST',
      '/auth/register',
      {},
      {
        email: testEmail,
        password: testPassword,
        username: `diff_${uid}`,
        fullName: 'Another User',
      },
      (status, data) => [
        { assertion: 'Status code is 409 Conflict', passed: status === 409 },
        { assertion: 'Error message indicates email taken', passed: typeof data?.message === 'string' && data.message.includes('Email') },
      ],
    );

    // 3. POST /auth/register (Validation Error / 400 Bad Request)
    await executeRequest(
      '3',
      'Register User - Weak Password (POST /auth/register) - Bad Request',
      'POST',
      '/auth/register',
      {},
      {
        email: `invalid_${uid}@example.com`,
        password: '123', // < 8 characters
        username: `short_${uid}`,
      },
      (status, data) => [
        { assertion: 'Status code is 400 Bad Request', passed: status === 400 },
        { assertion: 'Validation returns array of error messages', passed: Array.isArray(data?.message) },
      ],
    );

    // 4. POST /auth/login (Success)
    const loginRes = await executeRequest(
      '4',
      'Login (POST /auth/login) - Success',
      'POST',
      '/auth/login',
      {},
      {
        email: testEmail,
        password: testPassword,
      },
      (status, data) => [
        { assertion: 'Status code is 200 OK', passed: status === 200 },
        { assertion: 'Response has accessToken and refreshToken', passed: !!data?.accessToken && !!data?.refreshToken },
        { assertion: 'Profile id matches registered user', passed: data?.profile?.id === registeredUserId },
      ],
    );
    currentAccessToken = loginRes.body?.accessToken;
    currentRefreshToken = loginRes.body?.refreshToken;

    // 5. POST /auth/login (Invalid Password / 401 Unauthorized)
    await executeRequest(
      '5',
      'Login - Wrong Password (POST /auth/login) - Unauthorized',
      'POST',
      '/auth/login',
      {},
      {
        email: testEmail,
        password: 'WrongPassword!',
      },
      (status, data) => [
        { assertion: 'Status code is 401 Unauthorized', passed: status === 401 },
        { assertion: 'Message is "Invalid email or password"', passed: data?.message === 'Invalid email or password' },
      ],
    );

    // 6. GET /me (Success with Bearer Token)
    await executeRequest(
      '6',
      'Get Current User Profile (GET /me) - Success',
      'GET',
      '/me',
      { Authorization: `Bearer ${currentAccessToken}` },
      undefined,
      (status, data) => [
        { assertion: 'Status code is 200 OK', passed: status === 200 },
        { assertion: 'User profile matches logged in user', passed: data?.id === registeredUserId && data?.email === testEmail },
      ],
    );

    // 7. GET /me (Unauthorized - Missing Token)
    await executeRequest(
      '7',
      'Get Current User Profile (GET /me) - Missing Token',
      'GET',
      '/me',
      {},
      undefined,
      (status, data) => [
        { assertion: 'Status code is 401 Unauthorized', passed: status === 401 },
      ],
    );

    // 8. POST /auth/refresh (Success - Token Rotation)
    const refreshRes = await executeRequest(
      '8',
      'Refresh Token Rotation (POST /auth/refresh) - Success',
      'POST',
      '/auth/refresh',
      {},
      {
        refreshToken: currentRefreshToken,
      },
      (status, data) => [
        { assertion: 'Status code is 200 OK', passed: status === 200 },
        { assertion: 'New accessToken and refreshToken issued', passed: !!data?.accessToken && !!data?.refreshToken },
        { assertion: 'New refreshToken differs from old one', passed: data?.refreshToken !== currentRefreshToken },
      ],
    );
    const oldRefreshToken = currentRefreshToken;
    currentAccessToken = refreshRes.body?.accessToken;
    currentRefreshToken = refreshRes.body?.refreshToken;

    // 9. POST /auth/refresh (Replay Prevention - Reusing Revoked Token)
    await executeRequest(
      '9',
      'Refresh Token Replay (POST /auth/refresh) - Revoked Token Rejection',
      'POST',
      '/auth/refresh',
      {},
      {
        refreshToken: oldRefreshToken,
      },
      (status, data) => [
        { assertion: 'Status code is 401 Unauthorized', passed: status === 401 },
        { assertion: 'Error indicates invalid/revoked refresh token', passed: typeof data?.message === 'string' },
      ],
    );

    // 10. POST /auth/logout (Success)
    await executeRequest(
      '10',
      'Logout (POST /auth/logout) - Success',
      'POST',
      '/auth/logout',
      { Authorization: `Bearer ${currentAccessToken}` },
      {
        refreshToken: currentRefreshToken,
      },
      (status, data) => [
        { assertion: 'Status code is 204 No Content', passed: status === 204 },
        { assertion: 'Response body is empty', passed: data === null },
      ],
    );

    // Output raw JSON summary for programmatic consumption
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
