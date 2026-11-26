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
import { CreateCommentDto } from './dto/create-comment.dto';
import { CommentResponseDto } from './dto/comment-response.dto';
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

  private postInclude(currentUserId?: string) {
    return {
      author: {
        select: {
          ...AUTHOR_SELECT,
          ...(currentUserId
            ? {
                followers: {
                  where: { followerId: currentUserId },
                  select: { followerId: true },
                },
              }
            : {}),
        },
      },
      _count: {
        select: {
          likes: true,
          comments: true,
          savedBy: true,
        },
      },
      ...(currentUserId
        ? {
            likes: {
              where: { userId: currentUserId },
              select: { userId: true },
            },
            savedBy: {
              where: { userId: currentUserId },
              select: { userId: true },
            },
          }
        : {}),
    };
  }

  private toResponse(post: any, currentUserId?: string): PostResponseDto {
    const isLiked = currentUserId && post.likes ? post.likes.length > 0 : false;
    const isSaved = currentUserId && post.savedBy ? post.savedBy.length > 0 : false;
    const isFollowing =
      currentUserId && post.author?.followers ? post.author.followers.length > 0 : false;

    return {
      id: post.id,
      title: post.title ?? null,
      content: post.content ?? null,
      imageUrl: post.imageUrl ?? null,
      createdAt: post.createdAt.toISOString(),
      author: toAuthor(post.author),
      isLiked,
      isSaved,
      isFollowing,
      likesCount: post._count?.likes ?? 0,
      commentsCount: post._count?.comments ?? 0,
      savesCount: post._count?.savedBy ?? 0,
      sharesCount: 80,
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
        include: this.postInclude(userId),
      });

      this.events.emit(EVENTS.POST_CREATED, new PostCreatedEvent(post.id, userId));

      return this.toResponse(post, userId);
    } catch (err) {
      if (upload?.publicId) {
        await this.storage.safeDelete(upload.publicId);
      }
      throw err;
    }
  }

  private async getBlockedUserIds(userId: string): Promise<string[]> {
    const blocks = await this.prisma.userBlock.findMany({
      where: {
        OR: [{ blockerId: userId }, { blockedId: userId }],
      },
      select: { blockerId: true, blockedId: true },
    });
    const set = new Set<string>();
    for (const b of blocks) {
      if (b.blockerId === userId) set.add(b.blockedId);
      if (b.blockedId === userId) set.add(b.blockerId);
    }
    return Array.from(set);
  }

  async feed(userId: string, limit = 20, cursor?: string) {
    // Followed user ids + current user id, minus any blocked accounts
    const blockedIds = await this.getBlockedUserIds(userId);
    const follows = await this.prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    const userIds = [userId, ...follows.map((f) => f.followingId)].filter((id) => !blockedIds.includes(id));

    const rows = await this.prisma.post.findMany({
      where: {
        AND: [
          { userId: { in: userIds, notIn: blockedIds } },
          feedPostsWhere(userId),
        ],
      },
      take: limit + 1,
      ...cursorArgs(cursor),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: this.postInclude(userId),
    });

    return toPage(rows, limit, (row) => this.toResponse(row, userId));
  }

  async timeline(currentUserId?: string, limit = 20, cursor?: string) {
    const blockedIds = currentUserId ? await this.getBlockedUserIds(currentUserId) : [];

    // Filter out private accounts unless the current viewer follows them
    let excludedPrivateUserIds: string[] = [];
    const privateAccounts = await this.prisma.userPrivacyPreference.findMany({
      where: { privateAccount: true },
      select: { userId: true },
    });
    if (privateAccounts.length > 0) {
      const privateIds = privateAccounts.map((p) => p.userId);
      if (!currentUserId) {
        excludedPrivateUserIds = privateIds;
      } else {
        const myFollows = await this.prisma.follow.findMany({
          where: { followerId: currentUserId, followingId: { in: privateIds } },
          select: { followingId: true },
        });
        const followedPrivateIds = new Set(myFollows.map((f) => f.followingId));
        followedPrivateIds.add(currentUserId);
        excludedPrivateUserIds = privateIds.filter((id) => !followedPrivateIds.has(id));
      }
    }

    const allExcludedIds = Array.from(new Set([...blockedIds, ...excludedPrivateUserIds]));

    const rows = await this.prisma.post.findMany({
      where: {
        AND: [
          publicPostsWhere(),
          allExcludedIds.length > 0 ? { userId: { notIn: allExcludedIds } } : {},
        ],
      },
      take: limit + 1,
      ...cursorArgs(cursor),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: this.postInclude(currentUserId),
    });

    return toPage(rows, limit, (row) => this.toResponse(row, currentUserId));
  }

  async userPosts(targetUserId: string, currentUserId?: string, limit = 20, cursor?: string) {
    if (!UUID_REGEX.test(targetUserId)) {
      throw new BadRequestException('Invalid UUID');
    }

    if (currentUserId) {
      const isBlocked = await this.prisma.userBlock.findFirst({
        where: {
          OR: [
            { blockerId: currentUserId, blockedId: targetUserId },
            { blockerId: targetUserId, blockedId: currentUserId },
          ],
        },
      });
      if (isBlocked) {
        return toPage([], limit, (row) => this.toResponse(row, currentUserId));
      }
    }

    // Check private account access
    if (currentUserId !== targetUserId) {
      const targetPref = await this.prisma.userPrivacyPreference.findUnique({
        where: { userId: targetUserId },
        select: { privateAccount: true },
      });
      if (targetPref?.privateAccount) {
        if (!currentUserId) {
          return toPage([], limit, (row) => this.toResponse(row, currentUserId));
        }
        const isFollowing = await this.prisma.follow.findUnique({
          where: { followerId_followingId: { followerId: currentUserId, followingId: targetUserId } },
        });
        if (!isFollowing) {
          return toPage([], limit, (row) => this.toResponse(row, currentUserId));
        }
      }
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
      include: this.postInclude(currentUserId),
    });

    return toPage(rows, limit, (row) => this.toResponse(row, currentUserId));
  }

  async findOne(id: string, currentUserId?: string) {
    if (!UUID_REGEX.test(id)) {
      throw new BadRequestException('Invalid UUID');
    }

    const post = await this.prisma.post.findFirst({
      where: {
        id,
        ...publicPostsWhere(),
      },
      include: this.postInclude(currentUserId),
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return this.toResponse(post, currentUserId);
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
        include: this.postInclude(userId),
      });

      if (oldImageToDelete) {
        await this.storage.safeDelete(oldImageToDelete);
      }

      return this.toResponse(updated, userId);
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

  // ===================== LIKE / UNLIKE =====================

  async like(userId: string, postId: string) {
    if (!UUID_REGEX.test(postId)) {
      throw new BadRequestException('Invalid UUID');
    }
    const post = await this.prisma.post.findFirst({
      where: { id: postId, ...publicPostsWhere() },
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Check if post author and user have blocked each other
    const isBlocked = await this.prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: post.userId },
          { blockerId: post.userId, blockedId: userId },
        ],
      },
    });
    if (isBlocked) {
      throw new ForbiddenException('Cannot interact with this post due to an account block');
    }

    await this.prisma.like.upsert({
      where: { userId_postId: { userId, postId } },
      create: { userId, postId },
      update: {},
    });

    const likesCount = await this.prisma.like.count({ where: { postId } });
    return { liked: true, likesCount };
  }

  async unlike(userId: string, postId: string) {
    if (!UUID_REGEX.test(postId)) {
      throw new BadRequestException('Invalid UUID');
    }
    try {
      await this.prisma.like.delete({
        where: { userId_postId: { userId, postId } },
      });
    } catch (_) {
      // already unliked
    }

    const likesCount = await this.prisma.like.count({ where: { postId } });
    return { liked: false, likesCount };
  }

  // ===================== COMMENTS =====================

  async addComment(userId: string, postId: string, dto: CreateCommentDto): Promise<CommentResponseDto> {
    if (!UUID_REGEX.test(postId)) {
      throw new BadRequestException('Invalid UUID');
    }
    const post = await this.prisma.post.findFirst({
      where: { id: postId, ...publicPostsWhere() },
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Check if post author and commenter have blocked each other
    const isBlocked = await this.prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: post.userId },
          { blockerId: post.userId, blockedId: userId },
        ],
      },
    });
    if (isBlocked) {
      throw new ForbiddenException('Cannot comment on this post due to an account block');
    }

    // Enforce author comment permissions
    if (userId !== post.userId) {
      const authorPref = await this.prisma.userPrivacyPreference.findUnique({
        where: { userId: post.userId },
        select: { commentPermission: true },
      });
      const perm = authorPref?.commentPermission ?? 'EVERYONE';
      if (perm === 'NO_ONE') {
        throw new ForbiddenException('The author has turned off comments on their posts');
      } else if (perm === 'FOLLOWERS') {
        const isFollower = await this.prisma.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: userId,
              followingId: post.userId,
            },
          },
        });
        if (!isFollower) {
          throw new ForbiddenException('Only followers can comment on this post');
        }
      }
    }

    const comment = await this.prisma.comment.create({
      data: {
        postId,
        userId,
        content: dto.content.trim(),
      },
      include: {
        author: { select: AUTHOR_SELECT },
      },
    });

    return {
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
      author: toAuthor(comment.author),
    };
  }

  async getComments(postId: string, limit = 50, cursor?: string) {
    if (!UUID_REGEX.test(postId)) {
      throw new BadRequestException('Invalid UUID');
    }
    const post = await this.prisma.post.findFirst({
      where: { id: postId, ...publicPostsWhere() },
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const rows = await this.prisma.comment.findMany({
      where: { postId },
      take: limit + 1,
      ...cursorArgs(cursor),
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: {
        author: { select: AUTHOR_SELECT },
      },
    });

    return toPage(rows, limit, (row) => ({
      id: row.id,
      content: row.content,
      createdAt: row.createdAt.toISOString(),
      author: toAuthor(row.author),
    }));
  }

  async deleteComment(userId: string, commentId: string) {
    if (!UUID_REGEX.test(commentId)) {
      throw new BadRequestException('Invalid UUID');
    }
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    if (comment.userId !== userId) {
      throw new ForbiddenException('You do not own this comment');
    }
    await this.prisma.comment.delete({ where: { id: commentId } });
    return { deleted: true };
  }
}
