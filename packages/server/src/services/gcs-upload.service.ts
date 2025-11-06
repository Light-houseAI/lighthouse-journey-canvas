/**
 * GCS Upload Service
 *
 * Handles file uploads to Google Cloud Storage including:
 * - Signed URL generation for client-side uploads
 * - File validation (magic bytes)
 * - Upload completion verification
 */

import { Storage } from '@google-cloud/storage';
import { randomUUID } from 'crypto';

import type { Logger } from '../core/logger';
import { MagicByteValidator } from '../utils/magic-byte-validator';

export interface UploadSignedUrlResult {
  uploadUrl: string;
  storageKey: string;
  expiresAt: Date;
}

export interface CompleteUploadResult {
  success: boolean;
  storageKey: string;
  validated: boolean;
  sizeBytes: number;
}

export interface DownloadUrlResult {
  downloadUrl: string;
  expiresAt: Date;
}

export interface DeleteFileResult {
  success: boolean;
  deletedKey: string;
}

export class GcsUploadService {
  private storage: Storage;
  private bucketName: string;
  private logger: Logger;

  constructor({ logger }: { logger: Logger }) {
    this.logger = logger;

    // Read GCP configuration from environment
    const serviceAccountKey = process.env.GCP_SERVICE_ACCOUNT_KEY;
    this.bucketName = process.env.GCP_BUCKET_NAME || '';

    if (!serviceAccountKey) {
      throw new Error('GCP credentials not configured');
    }

    if (!this.bucketName) {
      throw new Error('GCP bucket name not configured');
    }

    // Parse service account key
    let credentials;
    try {
      credentials = JSON.parse(serviceAccountKey);
    } catch {
      throw new Error('Invalid GCP service account key JSON');
    }

    // Initialize GCS client
    this.storage = new Storage({
      credentials,
      projectId: credentials.project_id,
    });
  }

  /**
   * Generate a signed URL for file upload
   * Format: users/{userId}/application-materials/{type}/{prefix}/{timestamp}-{uuid}.{ext}
   * Or without prefix: users/{userId}/application-materials/{type}/{timestamp}-{uuid}.{ext}
   */
  async generateUploadSignedUrl(
    userId: number,
    fileType: string,
    fileExtension: string,
    mimeType: string,
    filePrefix?: string
  ): Promise<UploadSignedUrlResult> {
    if (!this.bucketName) {
      throw new Error('GCP bucket name not configured');
    }

    // Generate storage key
    const timestamp = Date.now();
    const uuid = randomUUID();
    const prefixPath = filePrefix ? `${filePrefix}/` : '';
    const storageKey = `users/${userId}/application-materials/${fileType}/${prefixPath}${timestamp}-${uuid}.${fileExtension}`;

    // Set expiry to 5 minutes from now
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Get bucket reference
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(storageKey);

    // Generate signed URL for PUT operation
    const [uploadUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: expiresAt,
      contentType: mimeType,
    });

    return {
      uploadUrl,
      storageKey,
      expiresAt,
    };
  }

  /**
   * Complete upload by validating file magic bytes
   * Downloads first 8KB to check file type
   * Idempotent - succeeds if already validated
   */
  async completeUpload(
    storageKey: string,
    userId: number
  ): Promise<CompleteUploadResult> {
    // Validate storage key format and user ID
    const keyPattern = /^users\/(\d+)\/application-materials\/.+\/.+\..+$/;
    const match = storageKey.match(keyPattern);

    if (!match) {
      throw new Error('Invalid storage key format');
    }

    const keyUserId = parseInt(match[1], 10);
    if (keyUserId !== userId) {
      throw new Error('Storage key does not match user ID');
    }

    // Get file reference
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(storageKey);

    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      throw new Error('File not found in storage');
    }

    // Download first 8KB for magic byte validation
    const [fileBuffer] = await file.download({
      start: 0,
      end: 8191, // 8KB - 1
    });

    // Validate magic bytes
    const validation = MagicByteValidator.validate(fileBuffer);

    if (!validation.isValid) {
      // Delete invalid file
      try {
        await file.delete();
      } catch (deleteError) {
        this.logger.error(
          'Failed to delete invalid file after validation',
          deleteError as Error
        );
        // Don't throw - validation failure is the primary error
      }
      throw new Error('File validation failed: invalid file type');
    }

    // Get file metadata to verify size
    const [metadata] = await file.getMetadata();
    const actualSize = parseInt(metadata.size as string, 10);

    return {
      success: true,
      storageKey,
      validated: true,
      sizeBytes: actualSize,
    };
  }

  /**
   * Generate a download URL with 1 hour expiry
   */
  async getDownloadUrl(
    storageKey: string,
    userId: number
  ): Promise<DownloadUrlResult> {
    // Validate storage key belongs to user
    const keyPattern = /^users\/(\d+)\//;
    const match = storageKey.match(keyPattern);

    if (match && parseInt(match[1], 10) !== userId) {
      throw new Error('Unauthorized access to file');
    }

    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(storageKey);

    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      throw new Error('File not found');
    }

    // Set expiry to 1 hour from now
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    // Generate signed URL for GET operation
    const [downloadUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: expiresAt,
    });

    return {
      downloadUrl,
      expiresAt,
    };
  }

  /**
   * Soft-delete file by moving to deleted/ prefix
   */
  async deleteFile(
    storageKey: string,
    userId: number
  ): Promise<DeleteFileResult> {
    // Validate storage key belongs to user
    const keyPattern = /^users\/(\d+)\//;
    const match = storageKey.match(keyPattern);

    if (match && parseInt(match[1], 10) !== userId) {
      throw new Error('Unauthorized access to file');
    }

    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(storageKey);

    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      throw new Error('File not found');
    }

    // Move to deleted/ prefix
    const deletedKey = `deleted/${storageKey}`;
    await file.move(deletedKey);

    return {
      success: true,
      deletedKey,
    };
  }
}
