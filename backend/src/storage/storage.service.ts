import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { randomUUID } from 'crypto';
import { ALLOWED_IMAGE_MIME_TYPES, MAX_AVATAR_BYTES, MAX_POST_IMAGE_BYTES } from '../common/constants/upload.constants';

export interface UploadResult {
  url: string;
  publicId: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly rootFolder: string;
  private readonly uploadPreset?: string;
  private readonly isConfigured: boolean;

  constructor(private readonly config: ConfigService) {
    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET');
    this.rootFolder = this.config.get<string>('CLOUDINARY_ROOT_FOLDER', 'news_share');
    this.uploadPreset = this.config.get<string>('CLOUDINARY_UPLOAD_PRESET');

    if (cloudName && apiKey && apiSecret && cloudName !== 'demo') {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
      this.isConfigured = true;
    } else {
      this.logger.warn('Cloudinary using mock/fallback mode (demo credentials).');
      this.isConfigured = false;
    }
  }

  private assertImage(file: Express.Multer.File, maxBytes: number) {
    if (!file) {
      throw new BadRequestException('No image file provided');
    }

    let mimetype = (file.mimetype || '').toLowerCase();
    // Resolve from file extension if generic application/octet-stream or non-standard
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(mimetype) || mimetype === 'application/octet-stream') {
      const ext = (file.originalname || '').split('.').pop()?.toLowerCase();
      if (ext === 'png') mimetype = 'image/png';
      else if (ext === 'jpg' || ext === 'jpeg') mimetype = 'image/jpeg';
      else if (ext === 'webp') mimetype = 'image/webp';
    }

    if (!ALLOWED_IMAGE_MIME_TYPES.includes(mimetype)) {
      throw new BadRequestException(
        `Invalid file type "${file.mimetype}". Allowed types: JPEG, PNG, WebP`,
      );
    }

    file.mimetype = mimetype;

    if (file.size > maxBytes) {
      throw new BadRequestException(
        `File size exceeds limit of ${Math.round(maxBytes / (1024 * 1024))} MB`,
      );
    }
  }

  private async uploadBuffer(
    buffer: Buffer,
    folder: string,
    publicId?: string,
    overwrite = true,
  ): Promise<UploadResult> {
    const fullFolder = `${this.rootFolder}/${folder}`;

    if (!this.isConfigured) {
      const generatedId = publicId || randomUUID();
      const mockPublicId = `${fullFolder}/${generatedId}`;
      const mockUrl = `https://res.cloudinary.com/demo/image/upload/v1/${mockPublicId}.jpg`;
      return { url: mockUrl, publicId: mockPublicId };
    }

    return new Promise((resolve, reject) => {
      const options: Record<string, any> = {
        folder: fullFolder,
        overwrite,
        resource_type: 'image',
      };
      if (this.uploadPreset) {
        options.upload_preset = this.uploadPreset;
      }
      if (publicId) {
        options.public_id = publicId;
      }

      const uploadStream = cloudinary.uploader.upload_stream(
        options,
        (error, result?: UploadApiResponse) => {
          if (error || !result) {
            this.logger.error(`Cloudinary upload failed: ${error?.message || 'unknown error'}`);
            return reject(new BadRequestException('Failed to upload image to storage'));
          }
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
          });
        },
      );

      uploadStream.end(buffer);
    });
  }

  async uploadAvatar(userId: string, file: Express.Multer.File): Promise<UploadResult> {
    this.assertImage(file, MAX_AVATAR_BYTES);
    return this.uploadBuffer(file.buffer, 'avatars', userId, true);
  }

  async uploadPostImage(userId: string, file: Express.Multer.File): Promise<UploadResult> {
    this.assertImage(file, MAX_POST_IMAGE_BYTES);
    const postAssetId = randomUUID();
    return this.uploadBuffer(file.buffer, `posts/${userId}`, postAssetId, false);
  }

  async safeDelete(publicId?: string | null, resourceType = 'image'): Promise<void> {
    if (!publicId) return;

    if (!this.isConfigured) {
      this.logger.debug(`[Mock] safeDelete called for ${publicId}`);
      return;
    }

    try {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
        invalidate: true,
      });
      this.logger.log(`Deleted Cloudinary asset: ${publicId}`);
    } catch (err) {
      this.logger.warn(`Failed to delete Cloudinary asset ${publicId}: ${(err as Error).message}`);
    }
  }
}
