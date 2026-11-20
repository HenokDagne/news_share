import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
const request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

jest.setTimeout(30000);

describe('Social Feed Interactions e2e (Like, Comment, Follow, Save, Feed)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let userAToken = '';
  let userAId = '';
  let userBToken = '';
  let userBId = '';
  let testPostId = '';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    prisma = app.get(PrismaService);

    const rand = Math.floor(10000 + Math.random() * 90000);

    // Register & Login User A
    const regA = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `usera_${rand}@test.com`,
        password: 'Password123!',
        username: `usera_${rand}`,
      });
    if (regA.body.verificationToken) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/verify-email')
        .send({ token: regA.body.verificationToken });
    }
    const loginA = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: `usera_${rand}@test.com`,
        password: 'Password123!',
      });
    userAToken = loginA.body.accessToken;
    userAId = loginA.body.profile.id;

    // Register & Login User B
    const regB = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `userb_${rand}@test.com`,
        password: 'Password123!',
        username: `userb_${rand}`,
      });
    if (regB.body.verificationToken) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/verify-email')
        .send({ token: regB.body.verificationToken });
    }
    const loginB = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: `userb_${rand}@test.com`,
        password: 'Password123!',
      });
    userBToken = loginB.body.accessToken;
    userBId = loginB.body.profile.id;

    // User A creates a test post
    const postRes = await request(app.getHttpServer())
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${userAToken}`)
      .field('title', 'Exciting TikTok Style Launch')
      .field('content', 'Full screen vertical swipe news feed is live!');
    testPostId = postRes.body.id;
  });

  afterAll(async () => {
    if (testPostId) {
      await prisma.comment.deleteMany({ where: { postId: testPostId } });
      await prisma.like.deleteMany({ where: { postId: testPostId } });
      await prisma.savedPost.deleteMany({ where: { postId: testPostId } });
      await prisma.post.deleteMany({ where: { id: testPostId } });
    }
    if (userAId && userBId) {
      await prisma.follow.deleteMany({
        where: {
          OR: [
            { followerId: userBId, followingId: userAId },
            { followerId: userAId, followingId: userBId },
          ],
        },
      });
    }
    await app.close();
  });

  it('1. Follow and unfollow author', async () => {
    // User B follows User A
    const followRes = await request(app.getHttpServer())
      .post(`/api/v1/users/${userAId}/follow`)
      .set('Authorization', `Bearer ${userBToken}`);
    expect(followRes.status).toBe(200);

    // Verify follow status
    const statusRes = await request(app.getHttpServer())
      .get(`/api/v1/users/${userAId}/follow-status`)
      .set('Authorization', `Bearer ${userBToken}`);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.isFollowing).toBe(true);

    // Cannot follow oneself
    const selfFollow = await request(app.getHttpServer())
      .post(`/api/v1/users/${userAId}/follow`)
      .set('Authorization', `Bearer ${userAToken}`);
    expect(selfFollow.status).toBe(400);
  });

  it('2. Like and unlike a post with persistence', async () => {
    // User B likes User A's post
    const likeRes = await request(app.getHttpServer())
      .post(`/api/v1/posts/${testPostId}/like`)
      .set('Authorization', `Bearer ${userBToken}`);
    expect(likeRes.status).toBe(200);
    expect(likeRes.body.liked).toBe(true);
    expect(likeRes.body.likesCount).toBeGreaterThanOrEqual(1);

    // Verify in database
    const dbLike = await prisma.like.findUnique({
      where: { userId_postId: { userId: userBId, postId: testPostId } },
    });
    expect(dbLike).not.toBeNull();

    // User B unlikes
    const unlikeRes = await request(app.getHttpServer())
      .delete(`/api/v1/posts/${testPostId}/like`)
      .set('Authorization', `Bearer ${userBToken}`);
    expect(unlikeRes.status).toBe(200);
    expect(unlikeRes.body.liked).toBe(false);

    // User B likes again for feed test
    await request(app.getHttpServer())
      .post(`/api/v1/posts/${testPostId}/like`)
      .set('Authorization', `Bearer ${userBToken}`);
  });

  it('3. Add and fetch comments with real author profile', async () => {
    // User B adds a comment
    const commentRes = await request(app.getHttpServer())
      .post(`/api/v1/posts/${testPostId}/comments`)
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ content: 'Incredible full screen experience!' });
    expect(commentRes.status).toBe(201);
    expect(commentRes.body.content).toBe('Incredible full screen experience!');
    expect(commentRes.body.author).toBeDefined();
    expect(commentRes.body.author.id).toBe(userBId);

    // Fetch comments for post
    const listRes = await request(app.getHttpServer())
      .get(`/api/v1/posts/${testPostId}/comments`)
      .set('Authorization', `Bearer ${userBToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);
    expect(listRes.body.data[0].content).toBe('Incredible full screen experience!');
  });

  it('4. Save and unsave post', async () => {
    // User B saves post
    const saveRes = await request(app.getHttpServer())
      .post(`/api/v1/posts/${testPostId}/save`)
      .set('Authorization', `Bearer ${userBToken}`);
    expect(saveRes.status).toBe(204);

    // Check /me/saved
    const savedList = await request(app.getHttpServer())
      .get('/api/v1/me/saved')
      .set('Authorization', `Bearer ${userBToken}`);
    expect(savedList.status).toBe(200);
    expect(savedList.body.data.some((p: any) => p.id === testPostId)).toBe(true);
  });

  it('5. Feed includes accurate isLiked, isSaved, isFollowing, and counts', async () => {
    // User B queries feed
    const feedRes = await request(app.getHttpServer())
      .get('/api/v1/feed')
      .set('Authorization', `Bearer ${userBToken}`);
    expect(feedRes.status).toBe(200);

    const post = feedRes.body.data.find((p: any) => p.id === testPostId);
    expect(post).toBeDefined();
    expect(post.isLiked).toBe(true);
    expect(post.isSaved).toBe(true);
    expect(post.isFollowing).toBe(true);
    expect(post.likesCount).toBeGreaterThanOrEqual(1);
    expect(post.commentsCount).toBeGreaterThanOrEqual(1);
    expect(post.savesCount).toBeGreaterThanOrEqual(1);
  });
});
