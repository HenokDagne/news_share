import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class RestoreTestDto {
  @ApiPropertyOptional({ description: 'Target test environment', default: 'ISOLATED_SANDBOX' })
  @IsOptional()
  @IsString()
  testEnvironment?: string = 'ISOLATED_SANDBOX';

  @ApiPropertyOptional({ description: 'Perform full data rows verification', default: true })
  @IsOptional()
  @IsBoolean()
  verifyDataRows?: boolean = true;
}
