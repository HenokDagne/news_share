import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class ConfirmAttachmentDto {
  @ApiProperty({ description: 'Pending attachment record ID' })
  @IsUUID()
  @IsNotEmpty()
  attachmentId: string;

  @ApiProperty({ description: 'Cloudinary public ID returned by client upload' })
  @IsString()
  @IsNotEmpty()
  cloudinaryPublicId: string;
}
