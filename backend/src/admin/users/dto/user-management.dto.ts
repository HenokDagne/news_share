import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class BanUserDto {
  @ApiProperty({ description: 'Internal justification for the restriction' })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiPropertyOptional({ description: 'Public reason shown to the affected user' })
  @IsString()
  @IsOptional()
  publicReason?: string;

  @ApiPropertyOptional({ description: 'Policy reference (e.g. HARASS-2)' })
  @IsString()
  @IsOptional()
  policyRef?: string;

  @ApiPropertyOptional({ description: 'Evidence reference (e.g. case ID or URL)' })
  @IsString()
  @IsOptional()
  evidenceRef?: string;

  @ApiPropertyOptional({
    description: 'Suspension duration in days (1-365). Omit for permanent ban.',
    example: 7,
  })
  @IsInt()
  @Min(1)
  @Max(365)
  @IsOptional()
  durationDays?: number;
}

export class WarnUserDto {
  @ApiProperty({ description: 'Warning message sent directly to user' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({ description: 'Policy violation reference' })
  @IsString()
  @IsOptional()
  policyRef?: string;

  @ApiPropertyOptional({ description: 'Internal admin reason' })
  @IsString()
  @IsOptional()
  reason?: string;
}

export class ActionReasonDto {
  @ApiProperty({ description: 'Internal reason for this action' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class DeleteUserDto {
  @ApiProperty({ description: 'Internal reason for deletion' })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiProperty({ description: 'Target username to confirm deletion' })
  @IsString()
  @IsNotEmpty()
  confirmUsername: string;
}
