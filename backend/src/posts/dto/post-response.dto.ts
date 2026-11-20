import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuthorResponseDto } from '../../users/users.mapper';

export class PostResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiPropertyOptional({ example: 'Headline', nullable: true })
  title: string | null;

  @ApiPropertyOptional({ example: 'Story text...', nullable: true })
  content: string | null;

  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/demo/image/upload/v1/news_share/posts/uid/abc.jpg',
    nullable: true,
  })
  imageUrl: string | null;

  @ApiProperty({ example: '2026-11-18T10:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ type: AuthorResponseDto })
  author: AuthorResponseDto;

  @ApiProperty({ example: false })
  isLiked: boolean;

  @ApiProperty({ example: false })
  isSaved: boolean;

  @ApiProperty({ example: false })
  isFollowing: boolean;

  @ApiProperty({ example: 42 })
  likesCount: number;

  @ApiProperty({ example: 12 })
  commentsCount: number;

  @ApiProperty({ example: 5 })
  savesCount: number;

  @ApiProperty({ example: 80 })
  sharesCount: number;
}
