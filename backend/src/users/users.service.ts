import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user || !user.profile) {
      throw new NotFoundException('User profile not found');
    }
    return toMe(user, user.profile);
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

  async getProfileById(id: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      throw new BadRequestException('Invalid UUID');
    }

    const profile = await this.prisma.profile.findUnique({
      where: { id },
    });
    if (!profile) {
      throw new NotFoundException('User profile not found');
    }
    return toProfile(profile);
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
    }

    const rows = await this.prisma.profile.findMany({
      where,
      take: limit + 1,
      ...cursorArgs(cursor),
      orderBy: { username: 'asc' },
    });

    return toPage(rows, limit, toProfile);
  }
}
