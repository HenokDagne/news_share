import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Permission, Role } from '@prisma/client';
import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class AssignRoleDto {
  @ApiProperty({ description: 'Target user UUID to assign/modify/revoke role for' })
  @IsNotEmpty()
  @IsUUID('4')
  userId: string;

  @ApiProperty({ enum: Role, description: 'Role to assign (USER, MODERATOR, ADMIN)' })
  @IsNotEmpty()
  @IsEnum(Role)
  role: Role;

  @ApiPropertyOptional({
    description: 'Specific granular permissions to grant (if omitted, role default preset is used)',
    enum: Permission,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(Permission, { each: true })
  permissions?: Permission[];

  @ApiProperty({ description: 'Documented justification/reason for the role change (for audit trail)' })
  @IsNotEmpty()
  @IsString()
  @MinLength(5)
  reason: string;
}
