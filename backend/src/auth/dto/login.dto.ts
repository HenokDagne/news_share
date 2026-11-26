import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'ada@example.com', description: 'User email or username' })
  @IsString()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'S3cure-pass!' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
