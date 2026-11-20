import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostResponseDto } from './dto/post-response.dto';
import { toAuthor } from '../users/users.mapper';
import { EVENTS, PostCreatedEvent } from '../common/events/events';
import { cursorArgs, toPage } from '../common/utils/pagination.util';
import { feedPostsWhere, publicPostsWhere } from '../common/visibility/visible-posts';

const AUTHOR_SELECT = {
  id: true,
  username: true,
  fullName: true,
  avatarUrl: true,
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly events: EventEmitter2,
  ) {}

  private toResponse(post: any): PostResponseDto {
    return {
      id: post.id,
      title: post.title ?? null,
      content: post.content ?? null,
      imageUrl: post.imageUrl ?? null,
      createdAt: post.createdAt.toISOString(),
      author: toAuthor(post.author),
    };
  }

  async create(userId: string, dto: CreatePostDto, file?: Express.Multer.File) {
    const title = dto.title?.trim() || null;
    const content = dto.content?.trim() || null;

    if (!title && !content && !file) {
      throw new BadRequestException('A post needs a title, content or an image');
    }

    const upload = file ? await this.storage.uploadPostImage(userId, file) : null;

    try {
      const post = await this.prisma.post.create({
        data: {
          userId,
          title,
          content,
          imageUrl: upload?.url,
          imagePublicId: upload?.publicId,
        },
        include: {
          author: { select: AUTHOR_SELECT },
        },
      });

      this.events.emit(EVENTS.POST_CREATED, new PostCreatedEvent(post.id, userId));

      return this.toResponse(post);
    } catch (err) {
      if (upload?.publicId) {
        await this.storage.safeDelete(upload.publicId);
      }
      throw err;
    }
  }

  async feed(userId: string, limit = 20, cursor?: string) {
    // Followed user ids + current user id
    const follows = await this.prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    const userIds = [userId, ...follows.map((f) => f.followingId)];

    const rows = await this.prisma.post.findMany({
      where: {
        AND: [
          { userId: { in: userIds } },
          feedPostsWhere(userId),
        ],
      },
      take: limit + 1,
      ...cursorArgs(cursor),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        author: { select: AUTHOR_SELECT },
      },
    });

    return toPage(rows, limit, (row) => this.toResponse(row));
  }

  async timeline(limit = 20, cursor?: string) {
    const rows = await this.prisma.post.findMany({
      where: publicPostsWhere(),
      take: limit + 1,
      ...cursorArgs(cursor),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        author: { select: AUTHOR_SELECT },
      },
    });

    return toPage(rows, limit, (row) => this.toResponse(row));
  }

  async userPosts(targetUserId: string, limit = 20, cursor?: string) {
    if (!UUID_REGEX.test(targetUserId)) {
      throw new BadRequestException('Invalid UUID');
    }

    const rows = await this.prisma.post.findMany({
      where: {
        AND: [
          { userId: targetUserId },
          publicPostsWhere(),
        ],
      },
      take: limit + 1,
      ...cursorArgs(cursor),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        author: { select: AUTHOR_SELECT },
      },
    });

    return toPage(rows, limit, (row) => this.toResponse(row));
  }

  async findOne(id: string) {
    if (!UUID_REGEX.test(id)) {
      throw new BadRequestException('Invalid UUID');
    }

    const post = await this.prisma.post.findFirst({
      where: {
        id,
        ...publicPostsWhere(),
      },
      include: {
        author: { select: AUTHOR_SELECT },
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return this.toResponse(post);
  }

  async update(userId: string, id: string, dto: UpdatePostDto, file?: Express.Multer.File) {
    if (!UUID_REGEX.test(id)) {
      throw new BadRequestException('Invalid UUID');
    }

    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    if (post.userId !== userId) {
      throw new ForbiddenException('You do not own this post');
    }

    const newTitle = dto.title !== undefined ? dto.title.trim() || null : post.title;
    const newContent = dto.content !== undefined ? dto.content.trim() || null : post.content;

    let newImageUrl = post.imageUrl;
    let newImagePublicId = post.imagePublicId;
    let oldImageToDelete: string | null = null;

    if (file) {
      const upload = await this.storage.uploadPostImage(userId, file);
      newImageUrl = upload.url;
      newImagePublicId = upload.publicId;
      oldImageToDelete = post.imagePublicId;
    }

    if (!newTitle && !newContent && !newImageUrl) {
      if (file && newImagePublicId) {
        await this.storage.safeDelete(newImagePublicId);
      }
      throw new BadRequestException('A post needs a title, content or an image');
    }

    try {
      const updated = await this.prisma.post.update({
        where: { id },
        data: {
          title: newTitle,
          content: newContent,
          imageUrl: newImageUrl,
          imagePublicId: newImagePublicId,
        },
        include: {
          author: { select: AUTHOR_SELECT },
        },
      });

      if (oldImageToDelete) {
        await this.storage.safeDelete(oldImageToDelete);
      }

      return this.toResponse(updated);
    } catch (err) {
      if (file && newImagePublicId) {
        await this.storage.safeDelete(newImagePublicId);
      }
      throw err;
    }
  }

  async remove(userId: string, id: string) {
    if (!UUID_REGEX.test(id)) {
      throw new BadRequestException('Invalid UUID');
    }

    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    if (post.userId !== userId) {
      throw new ForbiddenException('You do not own this post');
    }

    await this.prisma.post.delete({ where: { id } });
    await this.storage.safeDelete(post.imagePublicId);
  }
}
