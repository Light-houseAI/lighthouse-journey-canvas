/**
 * Files Schema Tests
 * Tests for file upload and storage quota API schemas
 */

import { describe, expect, it } from 'vitest';

import {
  completeUploadResponseSchema,
  completeUploadSchema,
  deleteFileResponseSchema,
  downloadUrlResponseSchema,
  requestUploadResponseSchema,
  requestUploadSchema,
  storageQuotaSchema,
} from '../files.schemas';

// Constants
const MAX_FILENAME_LENGTH = 255;
const MAX_MIMETYPE_LENGTH = 100;
const MAX_FILETYPE_LENGTH = 50;

// Test data factories
const createValidStorageQuota = (
  overrides: Partial<{
    bytesUsed: number;
    quotaBytes: number;
    bytesAvailable: number;
    percentUsed: number;
  }> = {}
) => ({
  bytesUsed: 1024000,
  quotaBytes: 10240000,
  bytesAvailable: 9216000,
  percentUsed: 10,
  ...overrides,
});

const createValidRequestUpload = (
  overrides: Partial<{
    fileType: string;
    fileExtension: string;
    mimeType: string;
    sizeBytes: number;
  }> = {}
) => ({
  fileType: 'document',
  fileExtension: 'pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1024000,
  ...overrides,
});

const createValidCompleteUpload = (
  overrides: Partial<{
    storageKey: string;
    sizeBytes: number;
    filename: string;
    mimeType: string;
    fileType: string;
  }> = {}
) => ({
  storageKey: 'uploads/123e4567-e89b-12d3-a456-426614174000',
  sizeBytes: 1024000,
  filename: 'document.pdf',
  mimeType: 'application/pdf',
  fileType: 'document',
  ...overrides,
});

describe('Storage Quota Schemas', () => {
  describe('storageQuotaSchema', () => {
    it('should validate valid storage quota', () => {
      const result = storageQuotaSchema.safeParse(createValidStorageQuota());
      expect(result.success).toBe(true);
    });

    it('should validate when no storage is used', () => {
      const result = storageQuotaSchema.safeParse(
        createValidStorageQuota({
          bytesUsed: 0,
          percentUsed: 0,
        })
      );
      expect(result.success).toBe(true);
    });

    it('should validate when storage is full', () => {
      const result = storageQuotaSchema.safeParse(
        createValidStorageQuota({
          bytesUsed: 10240000,
          bytesAvailable: 0,
          percentUsed: 100,
        })
      );
      expect(result.success).toBe(true);
    });

    it('should reject negative bytesUsed', () => {
      const result = storageQuotaSchema.safeParse(
        createValidStorageQuota({ bytesUsed: -1 })
      );
      expect(result.success).toBe(false);
    });

    it('should reject negative bytesAvailable', () => {
      const result = storageQuotaSchema.safeParse(
        createValidStorageQuota({ bytesAvailable: -1 })
      );
      expect(result.success).toBe(false);
    });

    it('should reject zero quotaBytes', () => {
      const result = storageQuotaSchema.safeParse(
        createValidStorageQuota({ quotaBytes: 0 })
      );
      expect(result.success).toBe(false);
    });

    it('should reject negative quotaBytes', () => {
      const result = storageQuotaSchema.safeParse(
        createValidStorageQuota({ quotaBytes: -1 })
      );
      expect(result.success).toBe(false);
    });

    it('should reject percentUsed below 0', () => {
      const result = storageQuotaSchema.safeParse(
        createValidStorageQuota({ percentUsed: -0.1 })
      );
      expect(result.success).toBe(false);
    });

    it('should reject percentUsed above 100', () => {
      const result = storageQuotaSchema.safeParse(
        createValidStorageQuota({ percentUsed: 100.1 })
      );
      expect(result.success).toBe(false);
    });

    it('should reject non-integer bytesUsed', () => {
      const result = storageQuotaSchema.safeParse(
        createValidStorageQuota({ bytesUsed: 1024.5 })
      );
      expect(result.success).toBe(false);
    });

    it('should reject extra fields (strict mode)', () => {
      const result = storageQuotaSchema.safeParse({
        ...createValidStorageQuota(),
        extraField: 'not allowed',
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('File Upload Request Schemas', () => {
  describe('requestUploadSchema', () => {
    it('should validate valid upload request', () => {
      const result = requestUploadSchema.safeParse(createValidRequestUpload());
      expect(result.success).toBe(true);
    });

    it('should validate various file types', () => {
      const fileTypes = [
        { fileType: 'image', fileExtension: 'png', mimeType: 'image/png' },
        {
          fileType: 'document',
          fileExtension: 'docx',
          mimeType:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        },
        { fileType: 'video', fileExtension: 'mp4', mimeType: 'video/mp4' },
      ];

      fileTypes.forEach((types) => {
        const result = requestUploadSchema.safeParse(
          createValidRequestUpload(types)
        );
        expect(result.success).toBe(true);
      });
    });

    it('should reject zero file size', () => {
      const result = requestUploadSchema.safeParse(
        createValidRequestUpload({ sizeBytes: 0 })
      );
      expect(result.success).toBe(false);
    });

    it('should reject negative file size', () => {
      const result = requestUploadSchema.safeParse(
        createValidRequestUpload({ sizeBytes: -1 })
      );
      expect(result.success).toBe(false);
    });

    it('should reject non-integer file size', () => {
      const result = requestUploadSchema.safeParse(
        createValidRequestUpload({ sizeBytes: 1024.5 })
      );
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const result = requestUploadSchema.safeParse({
        fileType: 'document',
        // Missing other fields
      });
      expect(result.success).toBe(false);
    });

    it('should reject extra fields (strict mode)', () => {
      const result = requestUploadSchema.safeParse({
        ...createValidRequestUpload(),
        extraField: 'not allowed',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('completeUploadSchema', () => {
    it('should validate valid complete upload request', () => {
      const result = completeUploadSchema.safeParse(
        createValidCompleteUpload()
      );
      expect(result.success).toBe(true);
    });

    it('should validate filename at maximum length', () => {
      const result = completeUploadSchema.safeParse(
        createValidCompleteUpload({
          filename: 'a'.repeat(MAX_FILENAME_LENGTH),
        })
      );
      expect(result.success).toBe(true);
    });

    it('should reject filename exceeding maximum length', () => {
      const result = completeUploadSchema.safeParse(
        createValidCompleteUpload({
          filename: 'a'.repeat(MAX_FILENAME_LENGTH + 1),
        })
      );
      expect(result.success).toBe(false);
    });

    it('should reject empty filename', () => {
      const result = completeUploadSchema.safeParse(
        createValidCompleteUpload({ filename: '' })
      );
      expect(result.success).toBe(false);
    });

    it('should reject empty storageKey', () => {
      const result = completeUploadSchema.safeParse(
        createValidCompleteUpload({ storageKey: '' })
      );
      expect(result.success).toBe(false);
    });

    it('should validate mimeType at maximum length', () => {
      const result = completeUploadSchema.safeParse(
        createValidCompleteUpload({
          mimeType: 'a'.repeat(MAX_MIMETYPE_LENGTH),
        })
      );
      expect(result.success).toBe(true);
    });

    it('should reject mimeType exceeding maximum length', () => {
      const result = completeUploadSchema.safeParse(
        createValidCompleteUpload({
          mimeType: 'a'.repeat(MAX_MIMETYPE_LENGTH + 1),
        })
      );
      expect(result.success).toBe(false);
    });

    it('should validate fileType at maximum length', () => {
      const result = completeUploadSchema.safeParse(
        createValidCompleteUpload({
          fileType: 'a'.repeat(MAX_FILETYPE_LENGTH),
        })
      );
      expect(result.success).toBe(true);
    });

    it('should reject fileType exceeding maximum length', () => {
      const result = completeUploadSchema.safeParse(
        createValidCompleteUpload({
          fileType: 'a'.repeat(MAX_FILETYPE_LENGTH + 1),
        })
      );
      expect(result.success).toBe(false);
    });

    it('should validate filename with special characters', () => {
      const result = completeUploadSchema.safeParse(
        createValidCompleteUpload({
          filename: 'My Document (2024) - Final [v2].pdf',
        })
      );
      expect(result.success).toBe(true);
    });

    it('should validate filename with Unicode characters', () => {
      const result = completeUploadSchema.safeParse(
        createValidCompleteUpload({
          filename: 'Документ_测试_ファイル.pdf',
        })
      );
      expect(result.success).toBe(true);
    });

    it('should reject zero file size', () => {
      const result = completeUploadSchema.safeParse(
        createValidCompleteUpload({ sizeBytes: 0 })
      );
      expect(result.success).toBe(false);
    });

    it('should reject extra fields (strict mode)', () => {
      const result = completeUploadSchema.safeParse({
        ...createValidCompleteUpload(),
        extraField: 'not allowed',
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('File Upload Response Schemas', () => {
  describe('requestUploadResponseSchema', () => {
    it('should validate valid upload URL response', () => {
      const validData = {
        uploadUrl: 'https://storage.example.com/upload/123',
        storageKey: 'uploads/123e4567-e89b-12d3-a456-426614174000',
        expiresAt: '2024-12-31T23:59:59Z',
      };
      const result = requestUploadResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid URL format', () => {
      const invalidData = {
        uploadUrl: 'not-a-valid-url',
        storageKey: 'uploads/123',
        expiresAt: '2024-12-31T23:59:59Z',
      };
      const result = requestUploadResponseSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should validate various URL formats', () => {
      const urls = [
        'https://storage.example.com/upload',
        'https://cdn.example.com:8080/files/upload',
        'https://s3.amazonaws.com/bucket/key',
      ];

      urls.forEach((uploadUrl) => {
        const result = requestUploadResponseSchema.safeParse({
          uploadUrl,
          storageKey: 'uploads/123',
          expiresAt: '2024-12-31T23:59:59Z',
        });
        expect(result.success).toBe(true);
      });
    });

    it('should reject extra fields (strict mode)', () => {
      const result = requestUploadResponseSchema.safeParse({
        uploadUrl: 'https://storage.example.com/upload/123',
        storageKey: 'uploads/123',
        expiresAt: '2024-12-31T23:59:59Z',
        extraField: 'not allowed',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('completeUploadResponseSchema', () => {
    it('should validate valid complete upload response', () => {
      const validData = {
        storageKey: 'uploads/123e4567-e89b-12d3-a456-426614174000',
        verified: true,
      };
      const result = completeUploadResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate when verified is false', () => {
      const validData = {
        storageKey: 'uploads/123',
        verified: false,
      };
      const result = completeUploadResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject non-boolean verified', () => {
      const invalidData = {
        storageKey: 'uploads/123',
        verified: 'true', // String instead of boolean
      };
      const result = completeUploadResponseSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject extra fields (strict mode)', () => {
      const result = completeUploadResponseSchema.safeParse({
        storageKey: 'uploads/123',
        verified: true,
        extraField: 'not allowed',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('downloadUrlResponseSchema', () => {
    it('should validate valid download URL response', () => {
      const validData = {
        downloadUrl: 'https://storage.example.com/download/123',
        expiresAt: '2024-12-31T23:59:59Z',
      };
      const result = downloadUrlResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid URL format', () => {
      const invalidData = {
        downloadUrl: 'not-a-valid-url',
        expiresAt: '2024-12-31T23:59:59Z',
      };
      const result = downloadUrlResponseSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject extra fields (strict mode)', () => {
      const result = downloadUrlResponseSchema.safeParse({
        downloadUrl: 'https://storage.example.com/download/123',
        expiresAt: '2024-12-31T23:59:59Z',
        extraField: 'not allowed',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('deleteFileResponseSchema', () => {
    it('should validate valid delete response', () => {
      const validData = {
        deleted: true,
        deletedKey: 'uploads/123e4567-e89b-12d3-a456-426614174000',
      };
      const result = deleteFileResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate when deletion failed', () => {
      const validData = {
        deleted: false,
        deletedKey: 'uploads/123',
      };
      const result = deleteFileResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject non-boolean deleted', () => {
      const invalidData = {
        deleted: 'true',
        deletedKey: 'uploads/123',
      };
      const result = deleteFileResponseSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject extra fields (strict mode)', () => {
      const result = deleteFileResponseSchema.safeParse({
        deleted: true,
        deletedKey: 'uploads/123',
        extraField: 'not allowed',
      });
      expect(result.success).toBe(false);
    });
  });
});
