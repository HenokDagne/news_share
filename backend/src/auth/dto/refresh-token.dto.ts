import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ example: '9f2c...' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
