import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SearchUsersDto } from './dto/search-users.dto';
import { toMe, toProfile } from './users.mapper';
import { cursorArgs, toPage } from '../common/utils/pagination.util';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async updateUserRole(targetUserId: string, newRole: Role, adminUsername: string) {
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException('User not found');
    const oldRole = user.role;
    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { role: newRole },
    });
    return { id: updated.id, email: updated.email, oldRole, newRole: updated.role };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user || !user.profile) {
      throw new NotFoundException('User profile not found');
    }

    // Authoritative counts from database
    const [followersCount, followingCount, postsCount] = await Promise.all([
      this.prisma.follow.count({ where: { followingId: userId } }),
      this.prisma.follow.count({ where: { followerId: userId } }),
      this.prisma.post.count({ where: { userId, status: 'ACTIVE' } }),
    ]);

    // Keep cached profile counters synchronized
    if (user.profile.followersCount !== followersCount || user.profile.followingCount !== followingCount) {
      await this.prisma.profile.update({
        where: { id: userId },
        data: { followersCount, followingCount },
      }).catch(() => {});
    }

    return {
      ...toMe(user, {
        ...user.profile,
        followersCount,
        followingCount,
        postsCount,
      }),
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user || !user.profile) {
      throw new NotFoundException('User profile not found');
    }

    if (dto.username && dto.username.toLowerCase() !== user.profile.username.toLowerCase()) {
      const existing = await this.prisma.profile.findFirst({
        where: {
          username: {
            equals: dto.username,
            mode: 'insensitive',
          },
          id: { not: userId },
        },
      });
      if (existing) {
        throw new ConflictException('Username already in use');
      }
    }

    const updated = await this.prisma.profile.update({
      where: { id: userId },
      data: {
        ...(dto.username ? { username: dto.username.trim() } : {}),
        ...(dto.fullName !== undefined ? { fullName: dto.fullName?.trim() || null } : {}),
        ...(dto.bio !== undefined ? { bio: dto.bio?.trim() || null } : {}),
      },
    });

    return toMe(user, updated);
  }

  async uploadAvatar(userId: string, file: Express.Multer.File) {
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
    });
    if (!profile) {
      throw new NotFoundException('User profile not found');
    }

    const upload = await this.storage.uploadAvatar(userId, file);

    // Update profile
    await this.prisma.profile.update({
      where: { id: userId },
      data: {
        avatarUrl: upload.url,
        avatarPublicId: upload.publicId,
      },
    });

    return { avatarUrl: upload.url };
  }

  async deleteAvatar(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
    });
    if (!profile) {
      throw new NotFoundException('User profile not found');
    }

    if (profile.avatarPublicId) {
      await this.storage.safeDelete(profile.avatarPublicId);
    }

    await this.prisma.profile.update({
      where: { id: userId },
      data: {
        avatarUrl: null,
        avatarPublicId: null,
      },
    });
  }

  async getProfileById(id: string, currentUserId?: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      throw new BadRequestException('Invalid UUID');
    }

    const profile = await this.prisma.profile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            privacyPreference: {
              select: { privateAccount: true },
            },
          },
        },
      },
    });
    if (!profile) {
      throw new NotFoundException('User profile not found');
    }

    // Authoritative counts and relationship from database
    const [followersCount, followingCount, postsCount, isFollowing] = await Promise.all([
      this.prisma.follow.count({ where: { followingId: id } }),
      this.prisma.follow.count({ where: { followerId: id } }),
      this.prisma.post.count({ where: { userId: id, status: 'ACTIVE' } }),
      currentUserId && currentUserId !== id
        ? this.prisma.follow.findUnique({
            where: { followerId_followingId: { followerId: currentUserId, followingId: id } },
          }).then((r) => r !== null)
        : Promise.resolve(false),
    ]);

    // Synchronize stored counters if drifted
    if (profile.followersCount !== followersCount || profile.followingCount !== followingCount) {
      await this.prisma.profile.update({
        where: { id },
        data: { followersCount, followingCount },
      }).catch(() => {});
    }

    const isPrivate = profile.user?.privacyPreference?.privateAccount ?? false;
    return {
      ...toProfile({
        ...profile,
        followersCount,
        followingCount,
        postsCount,
        isFollowing,
      }),
      isPrivate,
    };
  }

  async searchUsers(dto: SearchUsersDto, currentUserId?: string) {
    const { search, limit = 20, cursor } = dto;

    const where: any = {};
    if (search && search.trim() !== '') {
      const term = search.trim();
      where.OR = [
        { username: { contains: term, mode: 'insensitive' } },
        { fullName: { contains: term, mode: 'insensitive' } },
      ];
    } else {
      // For general user discovery/suggestions, respect suggestAccount privacy preference
      const nonSuggested = await this.prisma.userPrivacyPreference.findMany({
        where: { suggestAccount: false },
        select: { userId: true },
      });
      if (nonSuggested.length > 0) {
        const excludeIds = nonSuggested.map((p) => p.userId);
        where.id = { notIn: excludeIds };
      }
    }

    if (currentUserId) {
      const blocks = await this.prisma.userBlock.findMany({
        where: {
          OR: [{ blockerId: currentUserId }, { blockedId: currentUserId }],
        },
        select: { blockerId: true, blockedId: true },
      });
      const blockedIds = blocks.map((b) => (b.blockerId === currentUserId ? b.blockedId : b.blockerId));
      if (blockedIds.length > 0) {
        where.id = where.id
          ? { ...where.id, notIn: Array.from(new Set([...(where.id.notIn || []), ...blockedIds])) }
          : { notIn: blockedIds };
      }
    }

    const rows = await this.prisma.profile.findMany({
      where,
      take: limit + 1,
      ...cursorArgs(cursor),
      orderBy: { username: 'asc' },
    });

    const followedSet = new Set<string>();
    if (currentUserId && rows.length > 0) {
      const myFollows = await this.prisma.follow.findMany({
        where: {
          followerId: currentUserId,
          followingId: { in: rows.map((r) => r.id) },
        },
        select: { followingId: true },
      });
      for (const f of myFollows) {
        followedSet.add(f.followingId);
      }
    }

    return toPage(rows, limit, (p) => ({
      ...toProfile(p),
      isFollowing: followedSet.has(p.id),
    }));
  }
}
