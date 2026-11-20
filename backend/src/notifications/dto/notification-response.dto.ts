import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuthorResponseDto } from '../../users/users.mapper';

export class NotificationResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'new_post', enum: ['follow', 'new_post'] })
  type: string;

  @ApiPropertyOptional({ example: 'A user you follow posted something new!', nullable: true })
  message: string | null;

  @ApiProperty({ example: false })
  isRead: boolean;

  @ApiProperty({ example: '2026-11-18T10:00:00.000Z' })
  createdAt: string;

  @ApiPropertyOptional({ example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', nullable: true })
  postId: string | null;

  @ApiPropertyOptional({ type: AuthorResponseDto, nullable: true })
  actor: AuthorResponseDto | null;
}
