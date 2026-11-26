import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class SendMessageDto {
  @ApiProperty({ description: 'Message text content (optional for IMAGE/FILE messages)', example: 'Hello, how are you?' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  content?: string;

  @ApiPropertyOptional({ description: 'Unique idempotency key to prevent duplicate sends', example: 'uuid-v4' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @ApiPropertyOptional({ description: 'Message type', enum: ['TEXT', 'IMAGE', 'FILE'], default: 'TEXT' })
  @IsOptional()
  @IsIn(['TEXT', 'IMAGE', 'FILE'])
  messageType?: 'TEXT' | 'IMAGE' | 'FILE';

  @ApiPropertyOptional({ description: 'Array of confirmed attachment IDs', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentIds?: string[];
}
