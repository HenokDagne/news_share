import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { toAuthor } from '../users/users.mapper';
import { cursorArgs, toPage } from '../common/utils/pagination.util';

const AUTHOR_SELECT = {
  id: true,
  username: true,
  fullName: true,
  avatarUrl: true,
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  private validateUuid(id: string) {
    if (!UUID_REGEX.test(id)) {
      throw new BadRequestException('Invalid UUID');
    }
  }

  private toResponse(item: any): NotificationResponseDto {
    return {
      id: item.id,
      type: item.type,
      message: item.message ?? null,
      isRead: item.isRead,
      createdAt: item.createdAt.toISOString(),
      postId: item.postId ?? null,
      actor: item.actor ? toAuthor(item.actor) : null,
    };
  }

  async findAll(userId: string, dto: ListNotificationsDto) {
    const { unread, limit = 20, cursor } = dto;

    const where: any = { userId };
    if (unread) {
      where.isRead = false;
    }

    const rows = await this.prisma.notification.findMany({
      where,
      take: limit + 1,
      ...cursorArgs(cursor),
      orderBy: { createdAt: 'desc' },
      include: {
        actor: { select: AUTHOR_SELECT },
      },
    });

    return toPage(rows, limit, (row) => this.toResponse(row));
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });
    return { count };
  }

  async markRead(userId: string, id: string) {
    this.validateUuid(id);

    const res = await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });

    if (res.count === 0) {
      throw new NotFoundException('Notification not found');
    }

    return { id, isRead: true };
  }

  async readAll(userId: string) {
    const res = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return { updated: res.count };
  }

  async remove(userId: string, id: string) {
    this.validateUuid(id);

    const res = await this.prisma.notification.deleteMany({
      where: { id, userId },
    });

    if (res.count === 0) {
      throw new NotFoundException('Notification not found');
    }
  }
}
