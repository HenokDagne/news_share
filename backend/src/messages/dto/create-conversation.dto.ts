import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateConversationDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Target user ID to start or open a direct conversation with',
  })
  @IsUUID()
  @IsNotEmpty()
  recipientId: string;
}
