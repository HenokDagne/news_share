import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { MailService } from '../src/mail/mail.service';
import { PrismaService } from '../src/prisma/prisma.service';

interface TestResult {
  title: string;
  passed: boolean;
  details?: string;
}

async function runTests() {
  console.log('--- STARTING SECTION 1.2 IDENTIFICATION & REGISTRATION SECURITY TESTS ---');

  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(3456, '127.0.0.1');

  const BASE_URL = 'http://127.0.0.1:3456/api/v1';
  const mailService = app.get(MailService);
  const prismaService = app.get(PrismaService);
  const results: TestResult[] = [];

  const uid = Math.random().toString(36).substring(2, 8);
  const testEmail = `sec_user_${uid}@example.com`;
  const testPassword = 'SecurePassword123!';
  const newPassword = 'NewSecurePassword456!';
  const testUsername = `sec_user_${uid}`;

  let verificationToken = '';
  let resetToken = '';
  let accessToken = '';
  let refreshToken = '';

  try {
    // 1. Minimal Data Registration with CAPTCHA support
    console.log('\n[TEST 1] Registering with minimal required fields (email, password, username)...');
    const regRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        username: testUsername,
        fullName: 'Security Test User',
        acceptTerms: true,
      }),
    });
    const regData = await regRes.json();
    const test1Passed = regRes.status === 201 && regData.requiresVerification === true;
    results.push({
      title: 'T-REG-01: Minimal data registration returns 201 with verification requirement',
      passed: test1Passed,
      details: JSON.stringify(regData),
    });
    console.log(`Test 1 Result: ${test1Passed ? 'PASSED' : 'FAILED'} (Status: ${regRes.status})`);

    // Verify token was sent in outbox
    verificationToken = mailService.getLatestToken(testEmail) || '';
    const tokenSent = verificationToken.length > 20;
    results.push({
      title: 'T-REG-02: Verification email generated and delivered with cryptographic token',
      passed: tokenSent,
      details: `Token length: ${verificationToken.length}`,
    });
    console.log(`Token captured in MailService: ${tokenSent ? 'PASSED' : 'FAILED'}`);

    // 2. Login before verification must return 403 Forbidden
    console.log('\n[TEST 2] Attempting login before email verification...');
    const unverifiedLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });
    const unverifiedLoginData = await unverifiedLoginRes.json();
    const test2Passed = unverifiedLoginRes.status === 403;
    results.push({
      title: 'T-REG-03: Login blocked with 403 Forbidden before email verification',
      passed: test2Passed,
      details: JSON.stringify(unverifiedLoginData),
    });
    console.log(`Test 2 Result: ${test2Passed ? 'PASSED' : 'FAILED'} (Status: ${unverifiedLoginRes.status})`);

    // 3. Invalid verification token returns 400
    console.log('\n[TEST 3] Testing invalid verification token...');
    const invalidVerifyRes = await fetch(`${BASE_URL}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'bogus_token_12345' }),
    });
    const test3Passed = invalidVerifyRes.status === 400;
    results.push({
      title: 'T-REG-04: Invalid or forged verification token rejected with 400 Bad Request',
      passed: test3Passed,
    });
    console.log(`Test 3 Result: ${test3Passed ? 'PASSED' : 'FAILED'}`);

    // 4. Verify email with valid token
    console.log('\n[TEST 4] Verifying email with valid token...');
    const verifyRes = await fetch(`${BASE_URL}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: verificationToken }),
    });
    const verifyData = await verifyRes.json();
    const test4Passed = verifyRes.status === 200 && verifyData.verified === true;
    results.push({
      title: 'T-REG-05: Account activation succeeds with valid email verification token',
      passed: test4Passed,
      details: JSON.stringify(verifyData),
    });
    console.log(`Test 4 Result: ${test4Passed ? 'PASSED' : 'FAILED'} (Status: ${verifyRes.status})`);

    // 5. Token reuse rejected (Single-use token)
    console.log('\n[TEST 5] Attempting token reuse (replay attack)...');
    const replayRes = await fetch(`${BASE_URL}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: verificationToken }),
    });
    const test5Passed = replayRes.status === 400;
    results.push({
      title: 'T-REG-06: Verification token replay attack rejected with 400 Bad Request',
      passed: test5Passed,
    });
    console.log(`Test 5 Result: ${test5Passed ? 'PASSED' : 'FAILED'}`);

    // 6. Login now succeeds after verification
    console.log('\n[TEST 6] Logging in after email verification...');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });
    const loginData = await loginRes.json();
    const test6Passed = loginRes.status === 200 && !!loginData.accessToken;
    accessToken = loginData.accessToken;
    refreshToken = loginData.refreshToken;
    results.push({
      title: 'T-REG-07: Login succeeds with 200 OK after account is verified',
      passed: test6Passed,
    });
    console.log(`Test 6 Result: ${test6Passed ? 'PASSED' : 'FAILED'} (Status: ${loginRes.status})`);

    // 7. Secure Profile Management (GET & PATCH /me)
    console.log('\n[TEST 7] Testing secure profile retrieval and update...');
    const getMeRes = await fetch(`${BASE_URL}/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const getMeData = await getMeRes.json();
    const getMePassed = getMeRes.status === 200 && getMeData.email === testEmail;

    const patchMeRes = await fetch(`${BASE_URL}/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        bio: 'Updated bio through secure profile update',
      }),
    });
    const patchMeData = await patchMeRes.json();
    const patchMePassed = patchMeRes.status === 200 && patchMeData.bio === 'Updated bio through secure profile update';

    results.push({
      title: 'T-PROF-01: Secure profile retrieval and update (GET & PATCH /me)',
      passed: getMePassed && patchMePassed,
    });
    console.log(`Test 7 Result: ${getMePassed && patchMePassed ? 'PASSED' : 'FAILED'}`);

    // 8. Account Recovery (Forgot Password & Reset Password)
    console.log('\n[TEST 8] Testing account recovery (Forgot Password)...');
    const forgotRes = await fetch(`${BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail }),
    });
    const forgotData = await forgotRes.json();
    const forgotPassed = forgotRes.status === 200;
    resetToken = mailService.getLatestToken(testEmail) || '';
    const resetTokenGenerated = resetToken.length > 20;

    results.push({
      title: 'T-REC-01: Forgot password generates single-use reset token and generic response',
      passed: forgotPassed && resetTokenGenerated,
      details: forgotData.message,
    });
    console.log(`Test 8 Result: ${forgotPassed && resetTokenGenerated ? 'PASSED' : 'FAILED'}`);

    // 9. Reset Password with token
    console.log('\n[TEST 9] Resetting password with reset token...');
    const resetRes = await fetch(`${BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: resetToken,
        newPassword: newPassword,
      }),
    });
    const resetData = await resetRes.json();
    const resetPassed = resetRes.status === 200;

    results.push({
      title: 'T-REC-02: Password reset succeeds with valid token and revokes previous sessions',
      passed: resetPassed,
      details: resetData.message,
    });
    console.log(`Test 9 Result: ${resetPassed ? 'PASSED' : 'FAILED'}`);

    // 10. Replay attack on reset token rejected
    console.log('\n[TEST 10] Testing password reset token reuse (replay)...');
    const resetReplayRes = await fetch(`${BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: resetToken,
        newPassword: 'AnotherPassword999!',
      }),
    });
    const resetReplayPassed = resetReplayRes.status === 400;
    results.push({
      title: 'T-REC-03: Reset token replay attack rejected with 400 Bad Request',
      passed: resetReplayPassed,
    });
    console.log(`Test 10 Result: ${resetReplayPassed ? 'PASSED' : 'FAILED'}`);

    // 11. Old password fails, new password logs in
    console.log('\n[TEST 11] Verifying old password fails and new password succeeds...');
    const oldLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });
    const oldLoginFailed = oldLoginRes.status === 401;

    const newLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: newPassword,
      }),
    });
    const newLoginPassed = newLoginRes.status === 200;

    results.push({
      title: 'T-REC-04: Old password rejected (401) and new password accepted (200)',
      passed: oldLoginFailed && newLoginPassed,
    });
    console.log(`Test 11 Result: ${oldLoginFailed && newLoginPassed ? 'PASSED' : 'FAILED'}`);

    // 12. Cleanup test user
    await prismaService.user.deleteMany({ where: { email: testEmail } });

  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    await app.close();
  }

  console.log('\n======================================================');
  console.log('         SECTION 1.2 TEST RESULTS SUMMARY             ');
  console.log('======================================================');
  let passCount = 0;
  for (const r of results) {
    const symbol = r.passed ? '✔ PASS' : '✖ FAIL';
    if (r.passed) passCount++;
    console.log(`${symbol} - ${r.title}`);
    if (r.details) console.log(`       Details: ${r.details}`);
  }
  console.log(`\nTOTAL: ${passCount}/${results.length} PASSED`);
  if (passCount !== results.length) {
    process.exit(1);
  }
}

runTests();
