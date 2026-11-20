import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum DecisionOutcome {
  DISMISS = 'DISMISS',
  ACTION = 'ACTION',
  RESOLVE = 'RESOLVE',
}

export enum ModerationDecisionActionType {
  REMOVE_POST = 'REMOVE_POST',
  WARN_USER = 'WARN_USER',
  SUSPEND_USER = 'SUSPEND_USER',
  BAN_USER = 'BAN_USER',
}

export class IndividualActionDto {
  @ApiProperty({ enum: ModerationDecisionActionType })
  @IsEnum(ModerationDecisionActionType)
  type: ModerationDecisionActionType;

  @ApiPropertyOptional({ description: 'Public reason shown to affected user' })
  @IsString()
  @IsOptional()
  publicReason?: string;

  @ApiPropertyOptional({ description: 'Warning message sent if type is WARN_USER' })
  @IsString()
  @IsOptional()
  message?: string;

  @ApiPropertyOptional({ description: 'Duration in days if type is SUSPEND_USER' })
  @IsInt()
  @Min(1)
  @Max(365)
  @IsOptional()
  durationDays?: number;

  @ApiPropertyOptional({ description: 'Evidence reference link or note' })
  @IsString()
  @IsOptional()
  evidenceRef?: string;
}

export class CaseDecisionDto {
  @ApiProperty({ enum: DecisionOutcome, example: DecisionOutcome.ACTION })
  @IsEnum(DecisionOutcome)
  outcome: DecisionOutcome;

  @ApiProperty({
    example: 'Content violates community guidelines regarding harassment. Post removed and warning issued.',
    description: 'Documented rationale (minimum 10 characters required)',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10, { message: 'Decision note must be at least 10 characters long to document rationale' })
  note: string;

  @ApiPropertyOptional({ example: 'HARASS-2', description: 'Referenced policy rule' })
  @IsString()
  @IsOptional()
  policyRef?: string;

  @ApiPropertyOptional({
    type: [IndividualActionDto],
    description: 'List of moderation actions to apply (required when outcome is ACTION)',
  })
  @ValidateIf((o) => o.outcome === DecisionOutcome.ACTION)
  @IsArray()
  @ArrayNotEmpty({ message: 'At least one action is required when outcome is ACTION' })
  @ValidateNested({ each: true })
  @Type(() => IndividualActionDto)
  actions?: IndividualActionDto[];
}
