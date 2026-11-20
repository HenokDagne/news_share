import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BackupType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateBackupDto {
  @ApiPropertyOptional({ enum: BackupType, default: BackupType.FULL })
  @IsOptional()
  @IsEnum(BackupType)
  backupType?: BackupType = BackupType.FULL;

  @ApiPropertyOptional({ description: 'Optional description or note for the backup' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ description: 'Retention lock duration in days (WORM immutability)', default: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650) // up to 10 years
  retentionDays?: number = 30;

  @ApiPropertyOptional({ description: 'Target Recovery Point Objective in minutes', default: 1440 })
  @IsOptional()
  @IsInt()
  @Min(5)
  rpoTargetMinutes?: number;

  @ApiPropertyOptional({ description: 'Target Recovery Time Objective in minutes', default: 15 })
  @IsOptional()
  @IsInt()
  @Min(1)
  rtoTargetMinutes?: number;
}
