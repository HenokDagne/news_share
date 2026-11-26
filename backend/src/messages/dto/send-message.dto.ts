import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({
    example: 'Hello! How are you doing today?',
    description: 'Message body content',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content: string;
}
