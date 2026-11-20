import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ReqContext } from '../common/decorators/req-context.decorator';
import { RequestContext } from './session.service';
import { AuthenticatedUser } from './strategies/jwt.strategy';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  @ApiOperation({ summary: 'Register a new account (requires 12+ char password and email verification)' })
  @ApiResponse({ status: 201, description: 'Account registered successfully, verification email sent' })
  @ApiResponse({ status: 400, description: 'Validation, weak password, or CAPTCHA error' })
  @ApiResponse({ status: 409, description: 'Email or username already in use' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  register(@Body() dto: RegisterDto, @ReqContext() ctx: RequestContext) {
    return this.auth.register(dto, ctx);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email address with token' })
  @ApiResponse({ status: 200, description: 'Email verified successfully, session started' })
  @ApiResponse({ status: 400, description: 'Invalid or expired verification token' })
  verifyEmail(@Body() dto: VerifyEmailDto, @ReqContext() ctx: RequestContext) {
    return this.auth.verifyEmail(dto, ctx);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend email verification token' })
  @ApiResponse({ status: 200, description: 'Verification email sent if account exists and is unverified' })
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.auth.resendVerification(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password (enforces 5-attempt lockout)' })
  @ApiResponse({ status: 200, description: 'Logged in successfully, session tokens issued' })
  @ApiResponse({ status: 401, description: 'Invalid email or password / Account locked' })
  @ApiResponse({ status: 403, description: 'Email not verified' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  login(@Body() dto: LoginDto, @ReqContext() ctx: RequestContext) {
    return this.auth.login(dto, ctx);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset email' })
  @ApiResponse({ status: 200, description: 'Password reset link sent if account exists' })
  @ApiResponse({ status: 400, description: 'Validation or CAPTCHA error' })
  forgotPassword(@Body() dto: ForgotPasswordDto, @ReqContext() ctx: RequestContext) {
    return this.auth.forgotPassword(dto, ctx);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using single-use token (unlocks account)' })
  @ApiResponse({ status: 200, description: 'Password reset successfully, sessions invalidated' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token, or weak password' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @ApiBearerAuth('access-token')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password with current password verification' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 400, description: 'New password violates policy or identical to current' })
  @ApiResponse({ status: 401, description: 'Current password incorrect' })
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.auth.changePassword(user.id, user.sid, dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login or register via Google OAuth' })
  @ApiResponse({ status: 200, description: 'Authenticated with Google successfully' })
  loginWithGoogle(@Body() dto: GoogleLoginDto, @ReqContext() ctx: RequestContext) {
    return this.auth.loginWithGoogle(dto, ctx);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token and issue fresh token pair (reuse detection enabled)' })
  @ApiResponse({ status: 200, description: 'Tokens rotated successfully' })
  @ApiResponse({ status: 401, description: 'Invalid, expired, or reused refresh token' })
  refresh(@Body() dto: RefreshTokenDto, @ReqContext() ctx: RequestContext) {
    return this.auth.refresh(dto, ctx);
  }

  @ApiBearerAuth('access-token')
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and revoke current session' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(@CurrentUser() user: AuthenticatedUser) {
    await this.auth.logout(user.id, user.sid);
    return { message: 'Logged out successfully' };
  }

  @ApiBearerAuth('access-token')
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and revoke all active sessions for current user' })
  @ApiResponse({ status: 200, description: 'All sessions revoked successfully' })
  async logoutAll(@CurrentUser() user: AuthenticatedUser) {
    await this.auth.logoutAll(user.id);
    return { message: 'All active sessions have been signed out' };
  }

  @ApiBearerAuth('access-token')
  @Get('sessions')
  @ApiOperation({ summary: 'List active sessions for current user' })
  @ApiResponse({ status: 200, description: 'List of active sessions' })
  listSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.sessions.list(user.id, user.sid);
  }

  @ApiBearerAuth('access-token')
  @Delete('sessions/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a specific session' })
  @ApiResponse({ status: 200, description: 'Session revoked successfully' })
  async revokeSession(
    @CurrentUser('id') userId: string,
    @Param('id') sessionId: string,
  ) {
    await this.sessions.revoke(sessionId, 'USER_REVOKED');
    return { message: 'Session revoked successfully' };
  }
}
