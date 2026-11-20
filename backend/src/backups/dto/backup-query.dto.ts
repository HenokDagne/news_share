import { ApiPropertyOptional } from '@nestjs/swagger';
import { BackupStatus, BackupType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class BackupQueryDto {
  @ApiPropertyOptional({ enum: BackupType })
  @IsOptional()
  @IsEnum(BackupType)
  backupType?: BackupType;

  @ApiPropertyOptional({ enum: BackupStatus })
  @IsOptional()
  @IsEnum(BackupStatus)
  status?: BackupStatus;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string;
}
