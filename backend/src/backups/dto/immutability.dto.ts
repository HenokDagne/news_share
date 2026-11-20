import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateImmutabilityDto {
  @ApiPropertyOptional({ description: 'Extend retention lock by additional days' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  extendDays?: number;

  @ApiPropertyOptional({ description: 'Set or clear legal hold (compliance lock)' })
  @IsOptional()
  @IsBoolean()
  legalHold?: boolean;
}
