import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import {
  EVENTS,
  PostCreatedEvent,
  UserFollowedEvent,
} from '../../common/events/events';

@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(private readonly prisma: PrismaService) {}

  @OnEvent(EVENTS.USER_FOLLOWED, { async: true })
  async onUserFollowed(e: UserFollowedEvent) {
    try {
      const followerProfile = await this.prisma.profile.findUnique({
        where: { id: e.followerId },
        select: { username: true, fullName: true },
      });

      const actorDisplay = followerProfile?.fullName
        ? `${followerProfile.fullName} (@${followerProfile.username})`
        : followerProfile?.username
          ? `@${followerProfile.username}`
          : 'Someone';

      await this.prisma.notification.create({
        data: {
          userId: e.followingId,
          actorId: e.followerId,
          type: 'follow',
          message: `${actorDisplay} started following you`,
        },
      });
    } catch (err) {
      this.logger.error(`follow notification failed: ${(err as Error).message}`);
    }
  }

  @OnEvent(EVENTS.POST_CREATED, { async: true })
  async onPostCreated(e: PostCreatedEvent) {
    try {
      const authorProfile = await this.prisma.profile.findUnique({
        where: { id: e.authorId },
        select: { username: true, fullName: true },
      });

      const authorDisplay = authorProfile?.fullName
        ? `${authorProfile.fullName} (@${authorProfile.username})`
        : authorProfile?.username
          ? `@${authorProfile.username}`
          : 'Someone you follow';

      const followers = await this.prisma.follow.findMany({
        where: { followingId: e.authorId },
        select: { followerId: true },
      });

      if (!followers.length) return;

      await this.prisma.notification.createMany({
        data: followers.map((f) => ({
          userId: f.followerId,
          actorId: e.authorId,
          type: 'new_post',
          postId: e.postId,
          message: `${authorDisplay} published a new post`,
        })),
      });
    } catch (err) {
      this.logger.error(`new_post notifications failed: ${(err as Error).message}`);
    }
  }
}
