import { ApiProperty } from '@nestjs/swagger';
import { AuthorResponseDto } from '../../users/users.mapper';

export class CommentResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'Great article!' })
  content: string;

  @ApiProperty({ example: '2026-11-20T17:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ type: AuthorResponseDto })
  author: AuthorResponseDto;
}
