/**
 * Files Controller
 *
 * Handles file upload/download/deletion operations with GCS
 */

import type { User } from '@journey/schema';

import type { Logger } from '../core/logger';
import type { UserFilesRepository } from '../repositories/user-files.repository';
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
  filename: string;
  mimeType: string;
  fileType: string;
}

export class FilesController extends BaseController {
  private readonly gcsUploadService: GcsUploadService;
  private readonly storageQuotaService: StorageQuotaService;
  private readonly userFilesRepository: UserFilesRepository;
  private readonly logger: Logger;

  constructor({
    gcsUploadService,
    storageQuotaService,
    userFilesRepository,
    logger,
  }: {
    gcsUploadService: GcsUploadService;
    storageQuotaService: StorageQuotaService;
    userFilesRepository: UserFilesRepository;
    logger: Logger;
  }) {
    super();
    this.gcsUploadService = gcsUploadService;
    this.storageQuotaService = storageQuotaService;
    this.userFilesRepository = userFilesRepository;
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

      // Track file metadata in database
      await this.userFilesRepository.create({
        userId: user.id,
        storageKey: dto.storageKey,
        filename: dto.filename,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
        fileType: dto.fileType,
      });

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
      // Get file metadata before deletion
      const fileRecord =
        await this.userFilesRepository.findByStorageKey(storageKey);

      if (!fileRecord) {
        const error = new Error('File not found');
        (error as any).status = 404;
        throw error;
      }

      // Verify ownership
      if (fileRecord.userId !== user.id) {
        const error = new Error('Unauthorized');
        (error as any).status = 403;
        throw error;
      }

      // Soft delete file in database
      await this.userFilesRepository.softDelete(storageKey);

      // Move file to deleted/ prefix in GCS
      const result = await this.gcsUploadService.deleteFile(
        storageKey,
        user.id
      );

      // Decrement storage quota
      await this.storageQuotaService.updateUsage(
        user.id,
        -fileRecord.sizeBytes
      );

      this.logger.info('File deleted', {
        userId: user.id,
        storageKey,
        deletedKey: result.deletedKey,
        sizeBytes: fileRecord.sizeBytes,
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
