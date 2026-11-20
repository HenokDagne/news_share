import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({ example: 'Bad Request' })
  error: string;

  @ApiProperty({
    oneOf: [
      { type: 'string', example: 'Validation failed' },
      { type: 'array', items: { type: 'string' }, example: ['email must be an email'] },
    ],
  })
  message: string | string[];

  @ApiProperty({ example: '/api/v1/posts' })
  path: string;

  @ApiProperty({ example: '2026-11-18T10:00:00.000Z' })
  timestamp: string;
}
