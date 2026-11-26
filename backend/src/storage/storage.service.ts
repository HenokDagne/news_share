import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
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

    // Section 4.1: Enforce allow-lists for file uploads (type, size, content)
    // Inspect magic byte signatures to prevent disguised executables / polyglots / shell scripts
    const buffer = file.buffer || (file.path && fs.existsSync(file.path) ? fs.readFileSync(file.path) : null);
    if (buffer && buffer.length >= 4) {
      const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
      const isPng =
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47;
      const isWebp =
        buffer.length >= 12 &&
        buffer[0] === 0x52 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x46 &&
        buffer[8] === 0x57 &&
        buffer[9] === 0x45 &&
        buffer[10] === 0x42 &&
        buffer[11] === 0x50;

      if (!isJpeg && !isPng && !isWebp) {
        throw new BadRequestException(
          'File content validation failed: file content signature does not match allowed image formats (JPEG, PNG, WebP). Malicious or executable uploads are prohibited.',
        );
      }
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

  /**
   * Generates a signed Cloudinary direct upload payload for secure client-side uploads.
   * Client receives signature, api_key, timestamp, and unique public_id; API secret never leaves the server.
   */
  generateSignedUploadPayload(folder: string, publicId: string, resourceType: 'image' | 'raw' = 'image') {
    const fullFolder = `${this.rootFolder}/${folder}`;
    const timestamp = Math.round(new Date().getTime() / 1000);
    const apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET') || 'demo_secret';
    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY') || 'demo_key';
    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME') || 'demo';

    const paramsToSign: Record<string, any> = {
      folder: fullFolder,
      public_id: publicId,
      timestamp,
      type: 'authenticated',
    };

    let signature = 'mock_signature';
    if (this.isConfigured) {
      signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);
    }

    return {
      timestamp,
      signature,
      apiKey,
      cloudName,
      folder: fullFolder,
      publicId,
      resourceType,
      deliveryType: 'authenticated',
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
    };
  }

  /**
   * Verifies an uploaded asset directly against Cloudinary Admin API
   */
  async verifyCloudinaryAsset(publicId: string, resourceType: 'image' | 'raw' = 'image') {
    if (!this.isConfigured) {
      return {
        bytes: 10240,
        format: 'jpg',
        width: 800,
        height: 600,
        resourceType,
      };
    }
    try {
      const res = await cloudinary.api.resource(publicId, {
        resource_type: resourceType,
        type: 'authenticated',
      });
      return {
        bytes: res.bytes,
        format: res.format,
        width: res.width,
        height: res.height,
        resourceType: res.resource_type,
      };
    } catch (e) {
      this.logger.warn(`Could not verify Cloudinary asset ${publicId}: ${(e as Error).message}`);
      return null;
    }
  }

  /**
   * Generates a short-lived signed Cloudinary URL for authorized preview/download
   */
  generateSignedDownloadUrl(publicId: string, resourceType: 'image' | 'raw' = 'image', expiresInSeconds = 3600) {
    if (!this.isConfigured) {
      return `https://res.cloudinary.com/demo/${resourceType}/upload/v1/${publicId}.jpg`;
    }
    return cloudinary.url(publicId, {
      resource_type: resourceType,
      type: 'authenticated',
      sign_url: true,
      expires_at: Math.round(Date.now() / 1000) + expiresInSeconds,
    });
  }
}
