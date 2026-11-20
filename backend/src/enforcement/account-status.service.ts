import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RestrictionStatus, RestrictionType, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RestrictionService } from './restriction.service';

@Injectable()
export class AccountStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly restrictions: RestrictionService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Centralized Enforcement Point.
   * Call after credentials/tokens are verified. Never call before (prevents account enumeration).
   */
  async assertCanAuthenticate(user: {
    id: string;
    status: UserStatus;
    deletedAt?: Date | null;
  }): Promise<void> {
    if (user.deletedAt || user.status === UserStatus.DELETED) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === UserStatus.ACTIVE) {
      return;
    }

    // Check active restriction in user_restrictions
    const restriction = await this.prisma.userRestriction.findFirst({
      where: {
        userId: user.id,
        status: RestrictionStatus.ACTIVE,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Check if temporary suspension has expired (lazy check)
    if (
      restriction?.type === RestrictionType.SUSPENSION &&
      restriction.expiresAt &&
      restriction.expiresAt <= new Date()
    ) {
      await this.restrictions.expire(restriction.id);
      return;
    }

    const codeMap: Record<UserStatus, string> = {
      ACTIVE: 'ACTIVE',
      BANNED: 'ACCOUNT_BANNED',
      SUSPENDED: 'ACCOUNT_SUSPENDED',
      DEACTIVATED: 'ACCOUNT_DEACTIVATED',
      DELETED: 'ACCOUNT_DELETED',
    };

    const code = codeMap[user.status] || 'ACCOUNT_RESTRICTED';
    const appealEmail = this.config.get<string>('APPEAL_EMAIL') || 'support@newsshare.com';

    throw new ForbiddenException({
      statusCode: 403,
      error: 'Forbidden',
      code,
      message: 'Your account cannot be used right now.',
      restriction: restriction
        ? {
            type: restriction.type,
            publicReason: restriction.publicReason || 'Account restricted per Terms of Service',
            startsAt: restriction.startsAt,
            expiresAt: restriction.expiresAt,
            permanent: restriction.type === RestrictionType.BAN,
            appealContact: appealEmail,
          }
        : null,
    });
  }
}
