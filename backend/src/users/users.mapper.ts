import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuthorResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'ada_l' })
  username: string;

  @ApiPropertyOptional({ example: 'Ada Lovelace', nullable: true })
  fullName: string | null;

  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/demo/image/upload/v1/news_share/avatars/uid.jpg',
    nullable: true,
  })
  avatarUrl: string | null;
}

export class ProfileResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'ada_l' })
  username: string;

  @ApiPropertyOptional({ example: 'Ada Lovelace', nullable: true })
  fullName: string | null;

  @ApiPropertyOptional({ example: 'Mathematician', nullable: true })
  bio: string | null;

  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/demo/image/upload/v1/news_share/avatars/uid.jpg',
    nullable: true,
  })
  avatarUrl: string | null;

  @ApiProperty({ example: 12 })
  followersCount: number;

  @ApiProperty({ example: 7 })
  followingCount: number;
}

export class MeResponseDto extends ProfileResponseDto {
  @ApiProperty({ example: 'ada@example.com' })
  email: string;
}

export function toAuthor(profile: {
  id: string;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
}): AuthorResponseDto {
  return {
    id: profile.id,
    username: profile.username,
    fullName: profile.fullName ?? null,
    avatarUrl: profile.avatarUrl ?? null,
  };
}

export function toProfile(profile: {
  id: string;
  username: string;
  fullName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  followersCount: number;
  followingCount: number;
}): ProfileResponseDto {
  return {
    id: profile.id,
    username: profile.username,
    fullName: profile.fullName ?? null,
    bio: profile.bio ?? null,
    avatarUrl: profile.avatarUrl ?? null,
    followersCount: profile.followersCount,
    followingCount: profile.followingCount,
  };
}

export function toMe(
  user: { id: string; email: string },
  profile: {
    username: string;
    fullName: string | null;
    bio: string | null;
    avatarUrl: string | null;
    followersCount: number;
    followingCount: number;
  },
): MeResponseDto {
  return {
    id: user.id,
    email: user.email,
    username: profile.username,
    fullName: profile.fullName ?? null,
    bio: profile.bio ?? null,
    avatarUrl: profile.avatarUrl ?? null,
    followersCount: profile.followersCount,
    followingCount: profile.followingCount,
  };
}
