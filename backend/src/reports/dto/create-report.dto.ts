import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { ReportReason } from '@prisma/client';

export class CreateReportDto {
  @ApiProperty({
    enum: ReportReason,
    example: 'HARASSMENT_BULLYING',
    description: 'Violation reason category',
  })
  @IsEnum(ReportReason, { message: 'Invalid report reason code' })
  reason: ReportReason;

  @ApiPropertyOptional({
    example: 'This post targets and insults members directly.',
    description: 'Detailed description (max 500 chars). Required if reason is OTHER.',
  })
  @ValidateIf((o) => o.reason === ReportReason.OTHER || (o.details && o.details.length > 0))
  @IsString({ message: 'Details must be a text string' })
  @MaxLength(500, { message: 'Details cannot exceed 500 characters' })
  details?: string;
}
