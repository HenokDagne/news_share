import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class RetentionPolicyDto {
  @ApiPropertyOptional({
    default: 90,
    description: 'Number of retention days. Logs older than this will be safely archived/purged.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(7)
  @Max(3650)
  retentionDays?: number = 90;
}
