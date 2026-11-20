import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

async function main() {
  const imageFilePath = 'C:/Users/hp/.gemini/antigravity/brain/02591ff6-7024-46e5-99f8-038617b5dd07/.user_uploaded/media_1795014650527_1af595b3.png';

  if (!fs.existsSync(imageFilePath)) {
    throw new Error(`User uploaded image not found at: ${imageFilePath}`);
  }

  const fileStats = fs.statSync(imageFilePath);
  const fileBuffer = fs.readFileSync(imageFilePath);
  const fileName = path.basename(imageFilePath);

  console.log('--------------------------------------------------');
  console.log(`[FILE DETAILS] Name: ${fileName}`);
  console.log(`[FILE DETAILS] Size: ${fileStats.size} bytes`);
  console.log(`[FILE DETAILS] Type: image/png`);
  console.log('--------------------------------------------------');

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
  const uid = Math.random().toString(36).substring(2, 8);

  try {
    // 1. Register a test user to obtain Bearer token
    console.log('\n[STEP 1] Authenticating user to obtain access token...');
    const regRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `uploader_${uid}@example.com`,
        password: 'Password123!',
        username: `uploader_${uid}`,
        fullName: 'Image Uploader Test',
      }),
    });
    const authData = await regRes.json();
    const token = authData.accessToken;
    console.log(`[STEP 1] Logged in as ${authData.profile.username} (${authData.profile.id})`);

    // 2. Prepare multipart/form-data with the user's real image
    console.log('\n[STEP 2] Preparing multipart/form-data upload with real image file...');
    const formData = new FormData();
    formData.append('title', 'Java 25 and Gradle 8.12 Incompatibility Issue');
    formData.append(
      'content',
      "Can't use Java 25.0.4.1 and Gradle 8.12 to import Gradle project android. Suggestion: Upgrade Gradle to 9.7.1 or use Java 21 as Gradle JVM.",
    );

    const blob = new Blob([fileBuffer], { type: 'image/png' });
    formData.append('image', blob, 'gradle_java_error.png');

    console.log('\n================== REQUEST ==================');
    console.log('METHOD: POST');
    console.log(`URL: ${BASE_URL}/posts`);
    console.log('HEADERS:');
    console.log(`  Authorization: Bearer ${token.substring(0, 30)}...`);
    console.log('  Content-Type: multipart/form-data');
    console.log('FORM DATA FIELDS:');
    console.log('  title: "Java 25 and Gradle 8.12 Incompatibility Issue"');
    console.log('  content: "Can\'t use Java 25.0.4.1 and Gradle 8.12 to import Gradle project android. Suggestion: Upgrade Gradle to 9.7.1 or use Java 21 as Gradle JVM."');
    console.log(`  image: [File: gradle_java_error.png, Size: ${fileStats.size} bytes, MIME: image/png]`);
    console.log('=============================================');

    const startTime = performance.now();
    const uploadRes = await fetch(`${BASE_URL}/posts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
    const elapsedTime = Math.round(performance.now() - startTime);

    const resJson = await uploadRes.json();

    console.log('\n================== RESPONSE ==================');
    console.log(`STATUS: ${uploadRes.status} ${uploadRes.statusText}`);
    console.log(`TIME: ${elapsedTime} ms`);
    console.log('HEADERS:');
    uploadRes.headers.forEach((v, k) => {
      console.log(`  ${k}: ${v}`);
    });
    console.log('BODY:');
    console.log(JSON.stringify(resJson, null, 2));
    console.log('==============================================');

    if (uploadRes.status !== 201) {
      throw new Error(`Upload failed with status ${uploadRes.status}`);
    }

    // 3. Verify Cloudinary CDN Accessibility
    const imageUrl = resJson.imageUrl;
    console.log(`\n[STEP 3] Verifying Cloudinary CDN asset at: ${imageUrl}`);
    const cdnStart = performance.now();
    const cdnRes = await fetch(imageUrl);
    const cdnTime = Math.round(performance.now() - cdnStart);

    console.log(`[STEP 3] Cloudinary CDN Response Status: ${cdnRes.status} ${cdnRes.statusText} (${cdnTime} ms)`);
    console.log(`[STEP 3] Cloudinary CDN Content-Type: ${cdnRes.headers.get('content-type')}`);
    console.log(`[STEP 3] Cloudinary CDN Content-Length: ${cdnRes.headers.get('content-length')} bytes`);

    if (cdnRes.status === 200) {
      console.log('[STEP 3 PASS] The uploaded image is publicly and securely accessible on Cloudinary CDN!');
    } else {
      throw new Error(`Cloudinary CDN returned status ${cdnRes.status}`);
    }

    // 4. Verify post retrieval from database
    console.log(`\n[STEP 4] Fetching post from database via GET /api/v1/posts/${resJson.id}...`);
    const getRes = await fetch(`${BASE_URL}/posts/${resJson.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const getJson = await getRes.json();
    console.log(`[STEP 4] Retrieved post from database successfully:`);
    console.log(`  Post ID: ${getJson.id}`);
    console.log(`  Title: ${getJson.title}`);
    console.log(`  Image URL: ${getJson.imageUrl}`);
    console.log(`  Author: ${getJson.author.username} (${getJson.author.fullName})`);

    console.log('\n==================================================');
    console.log('ALL VERIFICATIONS SUCCESSFUL: REAL IMAGE UPLOAD WORKS END-TO-END!');
    console.log('==================================================\n');
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
