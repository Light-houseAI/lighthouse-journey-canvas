/**
 * Files Controller
 *
 * Handles file upload/download/deletion operations with GCS
 */

import type { User } from '@journey/schema';

import type { Logger } from '../core/logger';
import { GcsUploadService } from '../services/gcs-upload.service';
import { StorageQuotaService } from '../services/storage-quota.service';
import { BaseController } from './base.controller';

export interface RequestUploadDTO {
  fileType: string;
  fileExtension: string;
  mimeType: string;
  sizeBytes: number;
}

export interface CompleteUploadDTO {
  storageKey: string;
  sizeBytes: number;
}

export class FilesController extends BaseController {
  private readonly gcsUploadService: GcsUploadService;
  private readonly storageQuotaService: StorageQuotaService;
  private readonly logger: Logger;

  constructor({
    gcsUploadService,
    storageQuotaService,
    logger,
  }: {
    gcsUploadService: GcsUploadService;
    storageQuotaService: StorageQuotaService;
    logger: Logger;
  }) {
    super();
    this.gcsUploadService = gcsUploadService;
    this.storageQuotaService = storageQuotaService;
    this.logger = logger;
  }

  /**
   * Request a signed URL for file upload
   */
  async requestUpload(user: User, dto: RequestUploadDTO) {
    try {
      // Validate file type (PDF only)
      const allowedExtensions = ['pdf'];
      if (!allowedExtensions.includes(dto.fileExtension.toLowerCase())) {
        const error = new Error(
          'Invalid file type. Only PDF files are allowed'
        );
        (error as any).status = 400;
        throw error;
      }

      // Check quota
      const quotaCheck = await this.storageQuotaService.checkQuota(
        user.id,
        dto.sizeBytes
      );

      if (!quotaCheck.allowed) {
        const error = new Error(
          quotaCheck.reason || 'Insufficient storage quota'
        );
        (error as any).status = 400;
        (error as any).details = {
          bytesNeeded: quotaCheck.bytesNeeded,
          bytesAvailable: quotaCheck.bytesAvailable,
        };
        throw error;
      }

      // Generate signed URL
      const result = await this.gcsUploadService.generateUploadSignedUrl(
        user.id,
        dto.fileType,
        dto.fileExtension,
        dto.mimeType
      );

      this.logger.info('Generated upload URL', {
        userId: user.id,
        fileType: dto.fileType,
        storageKey: result.storageKey,
      });

      return {
        uploadUrl: result.uploadUrl,
        storageKey: result.storageKey,
        expiresAt: result.expiresAt.toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to generate upload URL', error as Error);
      throw error;
    }
  }

  /**
   * Complete file upload and validate
   */
  async completeUpload(user: User, dto: CompleteUploadDTO) {
    try {
      // Validate file
      const result = await this.gcsUploadService.completeUpload(
        dto.storageKey,
        user.id
      );

      // Update storage quota
      await this.storageQuotaService.updateUsage(user.id, dto.sizeBytes);

      this.logger.info('Upload completed', {
        userId: user.id,
        storageKey: dto.storageKey,
        sizeBytes: dto.sizeBytes,
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to complete upload', error as Error);
      throw error;
    }
  }

  /**
   * Get download URL for file
   */
  async getDownloadUrl(user: User, storageKey: string) {
    try {
      const result = await this.gcsUploadService.getDownloadUrl(
        storageKey,
        user.id
      );

      this.logger.info('Generated download URL', {
        userId: user.id,
        storageKey,
      });

      return {
        downloadUrl: result.downloadUrl,
        expiresAt: result.expiresAt.toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to generate download URL', error as Error);
      throw error;
    }
  }

  /**
   * Delete file (soft-delete)
   */
  async deleteFile(user: User, storageKey: string) {
    try {
      // Get file size before deletion (for quota update)
      // In a real implementation, we would store file metadata
      // For now, we'll just mark it as deleted without updating quota
      // TODO: Implement metadata storage to track file sizes

      const result = await this.gcsUploadService.deleteFile(
        storageKey,
        user.id
      );

      this.logger.info('File deleted', {
        userId: user.id,
        storageKey,
        deletedKey: result.deletedKey,
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to delete file', error as Error);
      throw error;
    }
  }

  /**
   * Get storage quota information
   */
  async getQuota(user: User) {
    try {
      const quota = await this.storageQuotaService.getQuota(user.id);

      return quota;
    } catch (error) {
      // Ensure error is properly formatted before logging
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Failed to get quota', err);
      throw err;
    }
  }
}
