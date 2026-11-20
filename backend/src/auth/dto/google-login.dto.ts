import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GoogleLoginDto {
  @ApiProperty({
    example: 'user@gmail.com',
    description: 'Email address returned by Google OAuth',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({
    example: 'John Doe',
    description: 'Display name returned by Google OAuth',
  })
  @IsString()
  @IsOptional()
  fullName?: string;

  @ApiPropertyOptional({
    example: 'https://lh3.googleusercontent.com/a/ACg8oc...',
    description: 'Avatar/Profile picture URL from Google OAuth',
  })
  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @ApiPropertyOptional({
    description: 'Google ID token (JWT) for signature and claim verification',
  })
  @IsString()
  @IsOptional()
  idToken?: string;
}
