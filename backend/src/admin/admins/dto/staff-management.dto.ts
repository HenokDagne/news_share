import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { Permission, Role } from '@prisma/client';

export class CreateStaffDto {
  @ApiProperty({ example: 'mod@newsshare.com', description: 'Staff email address' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ example: 'mod_alex', description: 'Username for the staff account' })
  @IsString()
  @IsOptional()
  username?: string;

  @ApiProperty({ enum: [Role.MODERATOR, Role.ADMIN], example: Role.MODERATOR })
  @IsEnum(Role)
  role: Role;

  @ApiPropertyOptional({
    enum: Permission,
    isArray: true,
    description: 'Specific permissions granted. Defaults to preset if omitted.',
  })
  @IsArray()
  @IsEnum(Permission, { each: true })
  @ArrayUnique()
  @IsOptional()
  permissions?: Permission[];
}

export class UpdateStaffDto {
  @ApiPropertyOptional({ enum: [Role.USER, Role.MODERATOR, Role.ADMIN] })
  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @ApiPropertyOptional({ enum: Permission, isArray: true })
  @IsArray()
  @IsEnum(Permission, { each: true })
  @ArrayUnique()
  @IsOptional()
  permissions?: Permission[];
}
