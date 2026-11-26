import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class EditMessageDto {
  @ApiProperty({ description: 'Updated message content', example: 'Updated message text' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content: string;
}
