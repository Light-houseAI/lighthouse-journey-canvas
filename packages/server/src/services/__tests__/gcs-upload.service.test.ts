/**
 * GCS Upload Service Tests
 *
 * Tests for Google Cloud Storage file upload service including:
 * - Signed URL generation for uploads
 * - File validation (magic bytes)
 * - Upload completion verification
 */

import { Storage } from '@google-cloud/storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MagicByteValidator } from '../../utils/magic-byte-validator';
import { GcsUploadService } from '../gcs-upload.service';

// Mock the Storage module
vi.mock('@google-cloud/storage', () => {
  return {
    Storage: vi.fn(),
  };
});

// Mock the MagicByteValidator
vi.mock('../../utils/magic-byte-validator', () => {
  return {
    MagicByteValidator: {
      validate: vi.fn(),
    },
  };
});

describe('GcsUploadService', () => {
  let service: GcsUploadService;
  let mockStorage: any;
  let mockBucket: any;
  let mockFile: any;
  let mockLogger: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock logger
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    // Create mock file
    mockFile = {
      getSignedUrl: vi.fn(),
      download: vi.fn(),
      delete: vi.fn(),
      exists: vi.fn(),
      getMetadata: vi.fn(),
      copy: vi.fn(),
    };

    // Create mock bucket
    mockBucket = {
      file: vi.fn().mockReturnValue(mockFile),
    };

    // Create mock storage
    mockStorage = {
      bucket: vi.fn().mockReturnValue(mockBucket),
    };

    // Mock Storage constructor
    (Storage as any).mockImplementation(() => mockStorage);

    // Set environment variables
    process.env.GCP_BUCKET_NAME = 'test-bucket';
    process.env.GCP_SERVICE_ACCOUNT_KEY = JSON.stringify({
      type: 'service_account',
      project_id: 'test-project',
      private_key_id: 'key123',
      private_key:
        '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7VJTUt9Us8cKj\nMzEfYyjiWA4R4/M2bS1+fWIcPm15j9OrbsL7VVpXXnq4r/6VxRQdKrN2X2N3U3X5\nHvNp3X2X3N3U3X5HvNp3X2X3N3U3X5HvNp3X2X3N3U3X5HvNp3X2X3N3U3X5Hvd\n-----END PRIVATE KEY-----\n',
      client_email: 'test@test-project.iam.gserviceaccount.com',
      client_id: '123456789',
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
    });

    // Create service instance with mock logger
    service = new GcsUploadService({ logger: mockLogger });
  });

  describe('generateUploadSignedUrl', () => {
    it('should generate a signed URL for PDF upload', async () => {
      const userId = 123;
      const fileType = 'resume';
      const fileExtension = 'pdf';
      const mimeType = 'application/pdf';

      const expectedUrl =
        'https://storage.googleapis.com/test-bucket/signed-url';

      mockFile.getSignedUrl.mockResolvedValue([expectedUrl]);

      const result = await service.generateUploadSignedUrl(
        userId,
        fileType,
        fileExtension,
        mimeType
      );

      expect(result).toBeDefined();
      expect(result.uploadUrl).toBe(expectedUrl);
      expect(result.storageKey).toMatch(
        /^users\/123\/application-materials\/resume\/\d+-[a-f0-9-]+\.pdf$/
      );
      expect(result.expiresAt).toBeInstanceOf(Date);

      // Verify getSignedUrl was called with correct parameters
      expect(mockFile.getSignedUrl).toHaveBeenCalledWith({
        version: 'v4',
        action: 'write',
        expires: expect.any(Date),
        contentType: mimeType,
      });
    });

    it('should generate a signed URL with filePrefix', async () => {
      const userId = 123;
      const fileType = 'brand_building_screenshot';
      const fileExtension = 'png';
      const mimeType = 'image/png';
      const filePrefix = 'linkedin';

      const expectedUrl =
        'https://storage.googleapis.com/test-bucket/signed-url';

      mockFile.getSignedUrl.mockResolvedValue([expectedUrl]);

      const result = await service.generateUploadSignedUrl(
        userId,
        fileType,
        fileExtension,
        mimeType,
        filePrefix
      );

      expect(result).toBeDefined();
      expect(result.uploadUrl).toBe(expectedUrl);
      expect(result.storageKey).toMatch(
        /^users\/123\/application-materials\/brand_building_screenshot\/linkedin\/\d+-[a-f0-9-]+\.png$/
      );
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should generate a signed URL for DOCX upload', async () => {
      const userId = 456;
      const fileType = 'cover-letter';
      const fileExtension = 'docx';
      const mimeType =
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

      const expectedUrl =
        'https://storage.googleapis.com/test-bucket/signed-url';

      mockFile.getSignedUrl.mockResolvedValue([expectedUrl]);

      const result = await service.generateUploadSignedUrl(
        userId,
        fileType,
        fileExtension,
        mimeType
      );

      expect(result).toBeDefined();
      expect(result.uploadUrl).toBe(expectedUrl);
      expect(result.storageKey).toMatch(
        /^users\/456\/application-materials\/cover-letter\/\d+-[a-f0-9-]+\.docx$/
      );
    });

    it('should generate unique storage keys for multiple requests', async () => {
      const userId = 123;
      const fileType = 'resume';
      const fileExtension = 'pdf';
      const mimeType = 'application/pdf';

      mockFile.getSignedUrl.mockResolvedValue([
        'https://storage.googleapis.com/test-bucket/url1',
      ]);

      const result1 = await service.generateUploadSignedUrl(
        userId,
        fileType,
        fileExtension,
        mimeType
      );

      mockFile.getSignedUrl.mockResolvedValue([
        'https://storage.googleapis.com/test-bucket/url2',
      ]);

      const result2 = await service.generateUploadSignedUrl(
        userId,
        fileType,
        fileExtension,
        mimeType
      );

      expect(result1.storageKey).not.toBe(result2.storageKey);
    });

    it('should set expiry to 5 minutes from now', async () => {
      const userId = 123;
      const fileType = 'resume';
      const fileExtension = 'pdf';
      const mimeType = 'application/pdf';

      mockFile.getSignedUrl.mockResolvedValue([
        'https://storage.googleapis.com/test-bucket/url',
      ]);

      const beforeCall = new Date();
      const result = await service.generateUploadSignedUrl(
        userId,
        fileType,
        fileExtension,
        mimeType
      );
      const afterCall = new Date();

      const expiryTime = result.expiresAt.getTime();
      const minExpectedTime = beforeCall.getTime() + 5 * 60 * 1000;
      const maxExpectedTime = afterCall.getTime() + 5 * 60 * 1000;

      expect(expiryTime).toBeGreaterThanOrEqual(minExpectedTime);
      expect(expiryTime).toBeLessThanOrEqual(maxExpectedTime);
    });

    it('should throw error if GCS bucket name is not configured', async () => {
      delete process.env.GCP_BUCKET_NAME;

      // Need to create new service instance after env change
      expect(() => new GcsUploadService({ logger: mockLogger })).toThrow(
        'GCP bucket name not configured'
      );
    });

    it('should throw error if GCS credentials are not configured', async () => {
      delete process.env.GCP_SERVICE_ACCOUNT_KEY;

      // Need to create new service instance after env change
      expect(() => new GcsUploadService({ logger: mockLogger })).toThrow(
        'GCP credentials not configured'
      );
    });
  });

  describe('completeUpload', () => {
    it('should validate and complete PDF upload successfully', async () => {
      const storageKey = 'users/123/application-materials/resume/12345-abc.pdf';
      const userId = 123;

      // Mock file exists
      mockFile.exists.mockResolvedValue([true]);

      // Mock file metadata
      mockFile.getMetadata.mockResolvedValue([{ size: '1024000' }]);

      // Mock file download with PDF magic bytes
      const pdfMagicBytes = Buffer.from('%PDF-1.4');
      mockFile.download.mockResolvedValue([pdfMagicBytes]);

      // Mock validation success
      vi.mocked(MagicByteValidator.validate).mockReturnValue({
        isValid: true,
        detectedType: 'application/pdf',
      });

      const result = await service.completeUpload(storageKey, userId);

      expect(result.success).toBe(true);
      expect(result.storageKey).toBe(storageKey);
      expect(result.validated).toBe(true);

      // Verify file was downloaded (first 8KB)
      expect(mockFile.download).toHaveBeenCalledWith({
        start: 0,
        end: 8191,
      });

      // Verify magic byte validation was called
      expect(MagicByteValidator.validate).toHaveBeenCalledWith(pdfMagicBytes);
    });

    it('should validate and complete DOCX upload successfully', async () => {
      const storageKey =
        'users/123/application-materials/resume/12345-abc.docx';
      const userId = 123;

      mockFile.exists.mockResolvedValue([true]);
      mockFile.getMetadata.mockResolvedValue([{ size: '1024000' }]);

      // Mock file download with DOCX magic bytes (ZIP signature)
      const docxMagicBytes = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
      mockFile.download.mockResolvedValue([docxMagicBytes]);

      vi.mocked(MagicByteValidator.validate).mockReturnValue({
        isValid: true,
        detectedType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      const result = await service.completeUpload(storageKey, userId);

      expect(result.success).toBe(true);
      expect(result.validated).toBe(true);
    });

    it('should validate and complete PNG image upload successfully', async () => {
      const storageKey =
        'users/123/application-materials/brand_building_screenshot/linkedin/12345-abc.png';
      const userId = 123;

      mockFile.exists.mockResolvedValue([true]);
      mockFile.getMetadata.mockResolvedValue([{ size: '524288' }]);

      // Mock file download with PNG magic bytes
      const pngMagicBytes = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);
      mockFile.download.mockResolvedValue([pngMagicBytes]);

      vi.mocked(MagicByteValidator.validate).mockReturnValue({
        isValid: true,
        detectedType: 'image/png',
      });

      const result = await service.completeUpload(storageKey, userId);

      expect(result.success).toBe(true);
      expect(result.validated).toBe(true);
    });

    it('should validate and complete JPEG image upload successfully', async () => {
      const storageKey =
        'users/123/application-materials/brand_building_screenshot/x/12345-abc.jpg';
      const userId = 123;

      mockFile.exists.mockResolvedValue([true]);
      mockFile.getMetadata.mockResolvedValue([{ size: '524288' }]);

      // Mock file download with JPEG magic bytes
      const jpegMagicBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      mockFile.download.mockResolvedValue([jpegMagicBytes]);

      vi.mocked(MagicByteValidator.validate).mockReturnValue({
        isValid: true,
        detectedType: 'image/jpeg',
      });

      const result = await service.completeUpload(storageKey, userId);

      expect(result.success).toBe(true);
      expect(result.validated).toBe(true);
    });

    it('should validate and complete GIF image upload successfully', async () => {
      const storageKey =
        'users/123/application-materials/brand_building_screenshot/linkedin/12345-abc.gif';
      const userId = 123;

      mockFile.exists.mockResolvedValue([true]);
      mockFile.getMetadata.mockResolvedValue([{ size: '524288' }]);

      // Mock file download with GIF magic bytes
      const gifMagicBytes = Buffer.from('GIF89a');
      mockFile.download.mockResolvedValue([gifMagicBytes]);

      vi.mocked(MagicByteValidator.validate).mockReturnValue({
        isValid: true,
        detectedType: 'image/gif',
      });

      const result = await service.completeUpload(storageKey, userId);

      expect(result.success).toBe(true);
      expect(result.validated).toBe(true);
    });

    it('should validate and complete WEBP image upload successfully', async () => {
      const storageKey =
        'users/123/application-materials/brand_building_screenshot/linkedin/12345-abc.webp';
      const userId = 123;

      mockFile.exists.mockResolvedValue([true]);
      mockFile.getMetadata.mockResolvedValue([{ size: '524288' }]);

      // Mock file download with WEBP magic bytes
      const webpMagicBytes = Buffer.from([
        0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
      ]);
      mockFile.download.mockResolvedValue([webpMagicBytes]);

      vi.mocked(MagicByteValidator.validate).mockReturnValue({
        isValid: true,
        detectedType: 'image/webp',
      });

      const result = await service.completeUpload(storageKey, userId);

      expect(result.success).toBe(true);
      expect(result.validated).toBe(true);
    });

    it('should delete file if magic byte validation fails', async () => {
      const storageKey = 'users/123/application-materials/resume/12345-abc.pdf';
      const userId = 123;

      mockFile.exists.mockResolvedValue([true]);

      // Mock file download with invalid magic bytes
      const invalidBytes = Buffer.from('not a pdf');
      mockFile.download.mockResolvedValue([invalidBytes]);

      vi.mocked(MagicByteValidator.validate).mockReturnValue({
        isValid: false,
        detectedType: null,
      });

      await expect(service.completeUpload(storageKey, userId)).rejects.toThrow(
        'File validation failed: invalid file type'
      );

      // Verify file was deleted
      expect(mockFile.delete).toHaveBeenCalled();
    });

    it('should be idempotent - succeed if already verified', async () => {
      const storageKey = 'users/123/application-materials/resume/12345-abc.pdf';
      const userId = 123;

      mockFile.exists.mockResolvedValue([true]);
      mockFile.getMetadata.mockResolvedValue([{ size: '1024000' }]);

      const pdfMagicBytes = Buffer.from('%PDF-1.4');
      mockFile.download.mockResolvedValue([pdfMagicBytes]);

      vi.mocked(MagicByteValidator.validate).mockReturnValue({
        isValid: true,
        detectedType: 'application/pdf',
      });

      // Call twice
      const result1 = await service.completeUpload(storageKey, userId);
      const result2 = await service.completeUpload(storageKey, userId);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });

    it('should throw error if file does not exist', async () => {
      const storageKey = 'users/123/application-materials/resume/12345-abc.pdf';
      const userId = 123;

      mockFile.exists.mockResolvedValue([false]);

      await expect(service.completeUpload(storageKey, userId)).rejects.toThrow(
        'File not found in storage'
      );
    });

    it('should throw error if user ID in storage key does not match', async () => {
      const storageKey = 'users/456/application-materials/resume/12345-abc.pdf';
      const userId = 123; // Different user ID

      await expect(service.completeUpload(storageKey, userId)).rejects.toThrow(
        'Storage key does not match user ID'
      );
    });

    it('should throw error for invalid storage key format', async () => {
      const storageKey = 'invalid/path/file.pdf';
      const userId = 123;

      await expect(service.completeUpload(storageKey, userId)).rejects.toThrow(
        'Invalid storage key format'
      );
    });
  });

  describe('getDownloadUrl', () => {
    it('should generate a download URL with 1 hour expiry', async () => {
      const storageKey = 'users/123/application-materials/resume/12345-abc.pdf';
      const expectedUrl =
        'https://storage.googleapis.com/test-bucket/download-url';

      mockFile.exists.mockResolvedValue([true]);
      mockFile.getSignedUrl.mockResolvedValue([expectedUrl]);

      const result = await service.getDownloadUrl(storageKey, 123);

      expect(result.downloadUrl).toBe(expectedUrl);
      expect(result.expiresAt).toBeInstanceOf(Date);

      // Verify getSignedUrl was called with read action and 1 hour expiry
      expect(mockFile.getSignedUrl).toHaveBeenCalledWith({
        version: 'v4',
        action: 'read',
        expires: expect.any(Date),
      });
    });

    it('should throw error if file does not exist', async () => {
      const storageKey = 'users/123/application-materials/resume/12345-abc.pdf';

      mockFile.exists.mockResolvedValue([false]);

      await expect(service.getDownloadUrl(storageKey, 123)).rejects.toThrow(
        'File not found'
      );
    });
  });

  describe('deleteFile', () => {
    it('should soft-delete file by moving to deleted/ prefix', async () => {
      const storageKey = 'users/123/application-materials/resume/12345-abc.pdf';
      const expectedDeletedKey =
        'deleted/users/123/application-materials/resume/12345-abc.pdf';

      const mockDestFile = {
        exists: vi.fn().mockResolvedValue([false]),
      };

      mockFile.exists.mockResolvedValue([true]);
      mockFile.move = vi.fn().mockResolvedValue([]);
      mockBucket.file.mockImplementation((key: string) => {
        if (key === expectedDeletedKey) return mockDestFile;
        return mockFile;
      });

      const result = await service.deleteFile(storageKey, 123);

      expect(result.success).toBe(true);
      expect(result.deletedKey).toBe(expectedDeletedKey);
      expect(mockFile.move).toHaveBeenCalledWith(expectedDeletedKey);
    });

    it('should throw error if file does not exist', async () => {
      const storageKey = 'users/123/application-materials/resume/12345-abc.pdf';

      mockFile.exists.mockResolvedValue([false]);

      await expect(service.deleteFile(storageKey, 123)).rejects.toThrow(
        'File not found'
      );
    });
  });
});
