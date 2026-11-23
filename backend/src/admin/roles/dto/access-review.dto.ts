import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccessReviewAction, Permission, Role } from '@prisma/client';
import { IsArray, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, Min, MinLength } from 'class-validator';

export class CreateCampaignDto {
  @ApiProperty({ example: 'Q4-2026', description: 'Quarter identifier (e.g. Q4-2026)' })
  @IsNotEmpty()
  @IsString()
  quarter: string;

  @ApiProperty({ example: 2026, description: 'Year of review' })
  @IsNotEmpty()
  @IsInt()
  @Min(2020)
  @Max(2050)
  year: number;

  @ApiPropertyOptional({ example: 'Q4 2026 Periodic Access Review', description: 'Campaign title' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Optional operational notes for the review campaign' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RecordDecisionDto {
  @ApiProperty({ description: 'Privileged user ID being reviewed' })
  @IsNotEmpty()
  @IsUUID('4')
  userId: string;

  @ApiProperty({ enum: AccessReviewAction, description: 'Decision (MAINTAIN, REVOKE, MODIFY)' })
  @IsNotEmpty()
  @IsEnum(AccessReviewAction)
  decision: AccessReviewAction;

  @ApiProperty({ description: 'Documented justification for the access review decision' })
  @IsNotEmpty()
  @IsString()
  @MinLength(5)
  decisionReason: string;

  @ApiPropertyOptional({ enum: Role, description: 'New role if decision is MODIFY' })
  @IsOptional()
  @IsEnum(Role)
  newRole?: Role;

  @ApiPropertyOptional({
    description: 'Modified permissions if decision is MODIFY',
    enum: Permission,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(Permission, { each: true })
  newPermissions?: Permission[];
}
