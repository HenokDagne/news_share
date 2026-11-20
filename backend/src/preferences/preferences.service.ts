import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PostStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { publicPostsWhere } from '../common/visibility/visible-posts';

@Injectable()
export class PreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async markNotInterested(userId: string, postId: string): Promise<void> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, userId: true },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.userId === userId) {
      throw new BadRequestException('You cannot mark your own post as Not Interested');
    }

    await this.prisma.notInterested.upsert({
      where: {
        userId_postId: {
          userId,
          postId,
        },
      },
      create: {
        userId,
        postId,
      },
      update: {},
    });
  }

  async removeNotInterested(userId: string, postId: string): Promise<void> {
    try {
      await this.prisma.notInterested.delete({
        where: {
          userId_postId: {
            userId,
            postId,
          },
        },
      });
    } catch {
      // Idempotent: ignore if not found
    }
  }

  async savePost(userId: string, postId: string): Promise<void> {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, status: PostStatus.ACTIVE },
      select: { id: true },
    });

    if (!post) {
      throw new NotFoundException('Post not found or removed');
    }

    await this.prisma.savedPost.upsert({
      where: {
        userId_postId: {
          userId,
          postId,
        },
      },
      create: {
        userId,
        postId,
      },
      update: {},
    });
  }

  async unsavePost(userId: string, postId: string): Promise<void> {
    try {
      await this.prisma.savedPost.delete({
        where: {
          userId_postId: {
            userId,
            postId,
          },
        },
      });
    } catch {
      // Idempotent
    }
  }

  async getSavedPosts(userId: string, limit = 20, cursor?: string) {
    const take = Math.min(Math.max(limit, 1), 50);

    const savedRecords = await this.prisma.savedPost.findMany({
      where: {
        userId,
        post: publicPostsWhere(),
      },
      take: take + 1,
      cursor: cursor ? { userId_postId: { userId, postId: cursor } } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        post: {
          include: {
            author: {
              select: {
                id: true,
                username: true,
                fullName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    let nextCursor: string | null = null;
    let items = savedRecords;

    if (savedRecords.length > take) {
      const nextItem = items.pop();
      nextCursor = nextItem?.postId || null;
    }

    return {
      data: items.map((s) => ({
        ...s.post,
        isSaved: true,
        savedAt: s.createdAt,
      })),
      nextCursor,
      hasMore: nextCursor !== null,
    };
  }
}
