import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CaptchaService {
  private readonly logger = new Logger(CaptchaService.name);
  private readonly enabled: boolean;
  private readonly secret?: string;
  private readonly minScore: number;

  constructor(private readonly config: ConfigService) {
    this.enabled = this.config.get<string>('CAPTCHA_ENABLED', 'false').toLowerCase() === 'true';
    this.secret = this.config.get<string>('RECAPTCHA_SECRET');
    this.minScore = Number(this.config.get<string>('RECAPTCHA_MIN_SCORE', '0.5'));
  }

  async verify(token: string | undefined, action: string, ip?: string): Promise<void> {
    if (!this.enabled) {
      return;
    }

    if (!token) {
      throw new BadRequestException('CAPTCHA token is required');
    }

    if (!this.secret) {
      this.logger.warn('CAPTCHA_ENABLED is true but RECAPTCHA_SECRET is not configured');
      return;
    }

    try {
      const body = new URLSearchParams({
        secret: this.secret,
        response: token,
        ...(ip ? { remoteip: ip } : {}),
      });

      const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });

      if (!res.ok) {
        throw new BadRequestException('CAPTCHA verification failed');
      }

      const data = (await res.json()) as {
        success?: boolean;
        score?: number;
        action?: string;
      };

      if (!data.success || (data.score !== undefined && data.score < this.minScore)) {
        throw new BadRequestException('CAPTCHA verification failed');
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(`CAPTCHA verification error: ${(err as Error).message}`);
      throw new BadRequestException('CAPTCHA verification service error');
    }
  }
}
