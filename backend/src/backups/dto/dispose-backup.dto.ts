import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class DisposeBackupDto {
  @ApiProperty({ description: 'Documented justification / reason for secure disposal of backup' })
  @IsNotEmpty()
  @IsString()
  @MinLength(10)
  reason: string;
}
