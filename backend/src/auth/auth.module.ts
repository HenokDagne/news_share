import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { EnforcementModule } from '../enforcement/enforcement.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { OneTimeTokenService } from './one-time-token.service';
import { CaptchaService } from './captcha.service';
import { PasswordPolicyService } from './password-policy.service';
import { SessionService } from './session.service';

@Module({
  imports: [
    EnforcementModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: config.get<number>('JWT_ACCESS_TTL_SECONDS', 600),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    OneTimeTokenService,
    CaptchaService,
    PasswordPolicyService,
    SessionService,
  ],
  exports: [
    AuthService,
    OneTimeTokenService,
    CaptchaService,
    PasswordPolicyService,
    SessionService,
  ],
})
export class AuthModule {}
