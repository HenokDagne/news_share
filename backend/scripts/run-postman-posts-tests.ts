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
    isMultipart?: boolean;
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

  // Setup Author User & Follower User
  async function registerUser(prefix: string) {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `${prefix}_${uid}@example.com`,
        password: 'Password123!',
        username: `${prefix}_${uid}`,
        fullName: `${prefix} User`,
      }),
    });
    return res.json();
  }

  const author = await registerUser('author');
  const follower = await registerUser('follower');
  const stranger = await registerUser('stranger');

  // Follower follows Author
  await fetch(`${BASE_URL}/users/${author.profile.id}/follow`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${follower.accessToken}` },
  });

  let createdPostId = '';
  let imagePostId = '';

  async function executeRequest(
    step: string,
    name: string,
    method: string,
    path: string,
    headers: Record<string, string>,
    bodyPayload?: { type: 'json' | 'form'; data: any },
    assertions: (status: number, data: any) => { assertion: string; passed: boolean }[] = () => [],
  ) {
    const fullUrl = `${BASE_URL}${path}`;
    const reqHeaders: Record<string, string> = { ...headers };
    let reqBody: any;
    let loggedBody: any;

    if (bodyPayload) {
      if (bodyPayload.type === 'json') {
        reqHeaders['Content-Type'] = 'application/json';
        reqBody = JSON.stringify(bodyPayload.data);
        loggedBody = bodyPayload.data;
      } else if (bodyPayload.type === 'form') {
        const formData = new FormData();
        loggedBody = {};
        for (const [k, v] of Object.entries(bodyPayload.data)) {
          if (v instanceof Blob) {
            formData.append(k, v, (v as any).name || 'file.png');
            loggedBody[k] = `[Binary File: ${(v as any).name || 'file.png'}]`;
          } else {
            formData.append(k, String(v));
            loggedBody[k] = v;
          }
        }
        reqBody = formData;
      }
    }

    const start = performance.now();
    const res = await fetch(fullUrl, {
      method,
      headers: reqHeaders,
      body: reqBody,
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
        body: loggedBody,
        isMultipart: bodyPayload?.type === 'form',
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
    // 1. POST /posts (Create post with text)
    const p1 = await executeRequest(
      '1',
      'Create Post - Title & Content (POST /posts)',
      'POST',
      '/posts',
      { Authorization: `Bearer ${author.accessToken}` },
      {
        type: 'form',
        data: {
          title: 'Decentralized Architecture in 2026',
          content: 'Here is an in-depth breakdown of high-performance backend pipelines.',
        },
      },
      (status, data) => [
        { assertion: 'Status code is 201 Created', passed: status === 201 },
        { assertion: 'Post has valid UUID', passed: typeof data?.id === 'string' && data.id.length > 20 },
        { assertion: 'Post title and content match request', passed: data?.title === 'Decentralized Architecture in 2026' && data?.content?.includes('in-depth breakdown') },
        { assertion: 'Author relation is embedded', passed: data?.author?.id === author.profile.id && data?.author?.username === author.profile.username },
      ],
    );
    createdPostId = p1.body?.id;

    // 2. POST /posts (Create post with Real Cloudinary Image)
    const dummyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAA streak', 'base64');
    const imageBlob = new Blob([dummyPng], { type: 'image/png' });
    (imageBlob as any).name = 'tech_summit.png';

    const p2 = await executeRequest(
      '2',
      'Create Post - With Real Cloudinary Image Upload (POST /posts)',
      'POST',
      '/posts',
      { Authorization: `Bearer ${author.accessToken}` },
      {
        type: 'form',
        data: {
          title: 'Cloudinary CDN Integration Showcase',
          image: imageBlob,
        },
      },
      (status, data) => [
        { assertion: 'Status code is 201 Created', passed: status === 201 },
        { assertion: 'imageUrl is populated with Cloudinary URL', passed: typeof data?.imageUrl === 'string' && data.imageUrl.includes('cloudinary.com') },
        { assertion: 'Post title matches', passed: data?.title === 'Cloudinary CDN Integration Showcase' },
      ],
    );
    imagePostId = p2.body?.id;

    // 3. POST /posts (Empty post - 400 Bad Request)
    await executeRequest(
      '3',
      'Create Post - Missing All Fields (POST /posts) - Bad Request',
      'POST',
      '/posts',
      { Authorization: `Bearer ${author.accessToken}` },
      {
        type: 'form',
        data: {},
      },
      (status, data) => [
        { assertion: 'Status code is 400 Bad Request', passed: status === 400 },
        { assertion: 'Error explains post needs at least one field', passed: typeof data?.message === 'string' && data.message.includes('needs a title, content or an image') },
      ],
    );

    // 4. GET /posts (Global Timeline)
    await executeRequest(
      '4',
      'Get Global Timeline (GET /posts?limit=20)',
      'GET',
      '/posts?limit=20',
      { Authorization: `Bearer ${stranger.accessToken}` },
      undefined,
      (status, data) => [
        { assertion: 'Status code is 200 OK', passed: status === 200 },
        { assertion: 'Response envelope contains data array', passed: Array.isArray(data?.data) },
        { assertion: 'Timeline includes newly created post', passed: data?.data?.some((p: any) => p.id === createdPostId) },
        { assertion: 'Pagination metadata present', passed: 'hasMore' in data && 'nextCursor' in data },
      ],
    );

    // 5. GET /posts/:id (Single post lookup)
    await executeRequest(
      '5',
      'Get Post by ID (GET /posts/:id) - Success',
      'GET',
      `/posts/${createdPostId}`,
      { Authorization: `Bearer ${stranger.accessToken}` },
      undefined,
      (status, data) => [
        { assertion: 'Status code is 200 OK', passed: status === 200 },
        { assertion: 'Returned post ID matches requested ID', passed: data?.id === createdPostId },
        { assertion: 'Post has author info embedded', passed: !!data?.author?.username },
      ],
    );

    // 6. GET /posts/:id (Invalid UUID)
    await executeRequest(
      '6',
      'Get Post by Invalid UUID (GET /posts/:id) - Bad Request',
      'GET',
      '/posts/not-a-valid-uuid',
      { Authorization: `Bearer ${stranger.accessToken}` },
      undefined,
      (status, data) => [
        { assertion: 'Status code is 400 Bad Request', passed: status === 400 },
        { assertion: 'Message is "Invalid UUID"', passed: data?.message === 'Invalid UUID' },
      ],
    );

    // 7. GET /posts/:id (Non-existent UUID - 404)
    await executeRequest(
      '7',
      'Get Post by Non-existent ID (GET /posts/:id) - Not Found',
      'GET',
      '/posts/00000000-0000-0000-0000-000000000000',
      { Authorization: `Bearer ${stranger.accessToken}` },
      undefined,
      (status, data) => [
        { assertion: 'Status code is 404 Not Found', passed: status === 404 },
        { assertion: 'Message is "Post not found"', passed: data?.message === 'Post not found' },
      ],
    );

    // 8. GET /users/:id/posts (Posts by Author)
    await executeRequest(
      '8',
      'Get Posts by Author (GET /users/:id/posts)',
      'GET',
      `/users/${author.profile.id}/posts?limit=10`,
      { Authorization: `Bearer ${stranger.accessToken}` },
      undefined,
      (status, data) => [
        { assertion: 'Status code is 200 OK', passed: status === 200 },
        { assertion: 'All returned posts belong to author', passed: data?.data?.every((p: any) => p.author.id === author.profile.id) },
        { assertion: 'Returned at least 2 posts', passed: data?.data?.length >= 2 },
      ],
    );

    // 9. GET /feed (Follower Personal Feed)
    await executeRequest(
      '9',
      'Get Personal Feed for Follower (GET /feed)',
      'GET',
      '/feed?limit=10',
      { Authorization: `Bearer ${follower.accessToken}` },
      undefined,
      (status, data) => [
        { assertion: 'Status code is 200 OK', passed: status === 200 },
        { assertion: 'Feed contains followed author posts', passed: data?.data?.some((p: any) => p.id === createdPostId) },
      ],
    );

    // 10. PATCH /posts/:id (Author updates post)
    await executeRequest(
      '10',
      'Update Post by Author (PATCH /posts/:id) - Success',
      'PATCH',
      `/posts/${createdPostId}`,
      { Authorization: `Bearer ${author.accessToken}` },
      {
        type: 'form',
        data: {
          title: 'Decentralized Architecture in 2026 [Updated]',
          content: 'Updated content with latest benchmark results.',
        },
      },
      (status, data) => [
        { assertion: 'Status code is 200 OK', passed: status === 200 },
        { assertion: 'Post title is updated', passed: data?.title === 'Decentralized Architecture in 2026 [Updated]' },
        { assertion: 'Post content is updated', passed: data?.content === 'Updated content with latest benchmark results.' },
      ],
    );

    // 11. PATCH /posts/:id (Forbidden - Stranger attempts update)
    await executeRequest(
      '11',
      'Update Post by Non-Author (PATCH /posts/:id) - Forbidden',
      'PATCH',
      `/posts/${createdPostId}`,
      { Authorization: `Bearer ${stranger.accessToken}` },
      {
        type: 'form',
        data: {
          title: 'Hacked Title',
        },
      },
      (status, data) => [
        { assertion: 'Status code is 403 Forbidden', passed: status === 403 },
        { assertion: 'Message is "You do not own this post"', passed: data?.message === 'You do not own this post' },
      ],
    );

    // 12. DELETE /posts/:id (Forbidden - Stranger attempts deletion)
    await executeRequest(
      '12',
      'Delete Post by Non-Author (DELETE /posts/:id) - Forbidden',
      'DELETE',
      `/posts/${createdPostId}`,
      { Authorization: `Bearer ${stranger.accessToken}` },
      undefined,
      (status, data) => [
        { assertion: 'Status code is 403 Forbidden', passed: status === 403 },
        { assertion: 'Message is "You do not own this post"', passed: data?.message === 'You do not own this post' },
      ],
    );

    // 13. DELETE /posts/:id (Author deletes post with Cloudinary image)
    await executeRequest(
      '13',
      'Delete Post by Author (DELETE /posts/:id) - Success',
      'DELETE',
      `/posts/${imagePostId}`,
      { Authorization: `Bearer ${author.accessToken}` },
      undefined,
      (status, data) => [
        { assertion: 'Status code is 204 No Content', passed: status === 204 },
        { assertion: 'Response body is empty', passed: data === null },
      ],
    );

    // 14. GET /posts/:id (Verify deleted post returns 404)
    await executeRequest(
      '14',
      'Get Deleted Post (GET /posts/:id) - Verifying Deletion',
      'GET',
      `/posts/${imagePostId}`,
      { Authorization: `Bearer ${author.accessToken}` },
      undefined,
      (status, data) => [
        { assertion: 'Status code is 404 Not Found', passed: status === 404 },
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
