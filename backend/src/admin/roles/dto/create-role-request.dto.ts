import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateRoleRequestDto {
  @ApiProperty({ enum: Role, description: 'Privileged role being requested (e.g. MODERATOR, ADMIN)' })
  @IsNotEmpty()
  @IsEnum(Role)
  requestedRole: Role;

  @ApiProperty({ description: 'Detailed business justification for requesting privileged role' })
  @IsNotEmpty()
  @IsString()
  @MinLength(10)
  justification: string;
}
