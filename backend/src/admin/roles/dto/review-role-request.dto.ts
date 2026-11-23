import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Permission } from '@prisma/client';
import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export enum ReviewAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export class ReviewRoleRequestDto {
  @ApiProperty({ enum: ReviewAction, description: 'Approval decision' })
  @IsNotEmpty()
  @IsEnum(ReviewAction)
  action: ReviewAction;

  @ApiProperty({ description: 'Documented review notes explaining approval or rejection' })
  @IsNotEmpty()
  @IsString()
  @MinLength(5)
  reviewNotes: string;

  @ApiPropertyOptional({
    description: 'Optional custom permissions if approving with modified scope',
    enum: Permission,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(Permission, { each: true })
  customPermissions?: Permission[];
}
