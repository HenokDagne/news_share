import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { toProfile } from '../users/users.mapper';
import { EVENTS, UserFollowedEvent } from '../common/events/events';
import { cursorArgs, toPage } from '../common/utils/pagination.util';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class FollowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  private validateUuid(id: string) {
    if (!UUID_REGEX.test(id)) {
      throw new BadRequestException('Invalid UUID');
    }
  }

  async follow(me: string, targetId: string) {
    this.validateUuid(targetId);
    if (me === targetId) {
      throw new BadRequestException('Cannot follow yourself');
    }

    const target = await this.prisma.profile.findUnique({
      where: { id: targetId },
      select: { id: true },
    });
    if (!target) {
      throw new NotFoundException('User not found');
    }

    // Check if either user has blocked the other
    const block = await this.prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: me, blockedId: targetId },
          { blockerId: targetId, blockedId: me },
        ],
      },
    });
    if (block) {
      throw new BadRequestException('Cannot follow this user due to account block');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const res = await tx.follow.createMany({
        data: [{ followerId: me, followingId: targetId }],
        skipDuplicates: true,
      });

      // Synchronize exact counts directly from database
      const [targetFollowers, myFollowing] = await Promise.all([
        tx.follow.count({ where: { followingId: targetId } }),
        tx.follow.count({ where: { followerId: me } }),
      ]);

      await tx.profile.update({
        where: { id: targetId },
        data: { followersCount: targetFollowers },
      });
      await tx.profile.update({
        where: { id: me },
        data: { followingCount: myFollowing },
      });

      return {
        created: res.count === 1,
        targetFollowers,
        myFollowing,
      };
    });

    if (result.created) {
      this.events.emit(
        EVENTS.USER_FOLLOWED,
        new UserFollowedEvent(me, targetId),
      );
    }

    return {
      following: true,
      isFollowing: true,
      targetUserId: targetId,
      targetFollowersCount: result.targetFollowers,
      currentUserId: me,
      currentUserFollowingCount: result.myFollowing,
    };
  }

  async unfollow(me: string, targetId: string) {
    this.validateUuid(targetId);
    if (me === targetId) {
      throw new BadRequestException('Cannot unfollow yourself');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.follow.deleteMany({
        where: {
          followerId: me,
          followingId: targetId,
        },
      });

      // Synchronize exact counts directly from database
      const [targetFollowers, myFollowing] = await Promise.all([
        tx.follow.count({ where: { followingId: targetId } }),
        tx.follow.count({ where: { followerId: me } }),
      ]);

      await tx.profile.update({
        where: { id: targetId },
        data: { followersCount: targetFollowers },
      });
      await tx.profile.update({
        where: { id: me },
        data: { followingCount: myFollowing },
      });

      return {
        targetFollowers,
        myFollowing,
      };
    });

    return {
      following: false,
      isFollowing: false,
      targetUserId: targetId,
      targetFollowersCount: result.targetFollowers,
      currentUserId: me,
      currentUserFollowingCount: result.myFollowing,
    };
  }

  async getFollowStatus(me: string, targetId: string) {
    this.validateUuid(targetId);

    const [followingRow, followedByRow] = await Promise.all([
      this.prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: me,
            followingId: targetId,
          },
        },
      }),
      this.prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: targetId,
            followingId: me,
          },
        },
      }),
    ]);

    return {
      isFollowing: followingRow !== null,
      isFollowedBy: followedByRow !== null,
    };
  }

  async getFollowers(targetId: string, limit = 20, cursor?: string) {
    this.validateUuid(targetId);

    const rows = await this.prisma.follow.findMany({
      where: { followingId: targetId },
      take: limit + 1,
      ...(cursor ? { cursor: { followerId_followingId: { followerId: cursor, followingId: targetId } }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: { follower: true },
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return {
      data: items.map((r) => toProfile(r.follower)),
      nextCursor: hasMore ? items[items.length - 1].followerId : null,
      hasMore,
    };
  }

  async getFollowing(targetId: string, limit = 20, cursor?: string) {
    this.validateUuid(targetId);

    const rows = await this.prisma.follow.findMany({
      where: { followerId: targetId },
      take: limit + 1,
      ...(cursor ? { cursor: { followerId_followingId: { followerId: targetId, followingId: cursor } }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: { following: true },
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return {
      data: items.map((r) => toProfile(r.following)),
      nextCursor: hasMore ? items[items.length - 1].followingId : null,
      hasMore,
    };
  }
}
