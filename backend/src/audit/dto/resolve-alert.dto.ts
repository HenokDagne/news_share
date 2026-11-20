import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ResolveAlertDto {
  @ApiProperty({
    example: 'Identified distributed brute force attack; IP range blocked on firewall.',
    description: 'Documentation of steps taken to mitigate and resolve the security alert',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  resolutionNotes: string;
}
