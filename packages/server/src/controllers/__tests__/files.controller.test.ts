/**
 * Unit Tests for Files Controller
 *
 * Tests file upload/download/delete operations with GCS integration,
 * quota enforcement, and authorization checks.
 */

import type { User } from '@journey/schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';

import type { Logger } from '../../core/logger';
import type { UserFilesRepository } from '../../repositories/user-files.repository';
import type { GcsUploadService } from '../../services/gcs-upload.service';
import type { StorageQuotaService } from '../../services/storage-quota.service';
import {
  type CompleteUploadDTO,
  FilesController,
  type RequestUploadDTO,
} from '../files.controller';

describe('FilesController', () => {
  let controller: FilesController;
  let mockGcsUploadService: MockProxy<GcsUploadService>;
  let mockStorageQuotaService: MockProxy<StorageQuotaService>;
  let mockUserFilesRepository: MockProxy<UserFilesRepository>;
  let mockLogger: MockProxy<Logger>;

  const mockUser: User = {
    id: 123,
    email: 'test@example.com',
    userName: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    password: 'hashed',
    interest: null,
    hasCompletedOnboarding: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockLogger = mock<Logger>();
    mockGcsUploadService = mock<GcsUploadService>();
    mockStorageQuotaService = mock<StorageQuotaService>();
    mockUserFilesRepository = mock<UserFilesRepository>();

    controller = new FilesController({
      gcsUploadService: mockGcsUploadService,
      storageQuotaService: mockStorageQuotaService,
      userFilesRepository: mockUserFilesRepository,
      logger: mockLogger,
    });
  });

  describe('requestUpload', () => {
    const validDTO: RequestUploadDTO = {
      fileType: 'resume',
      fileExtension: 'pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024 * 1024, // 1MB
    };

    it('should generate signed URL for valid PDF upload', async () => {
      mockStorageQuotaService.checkQuota.mockResolvedValue({
        allowed: true,
      });

      mockGcsUploadService.generateUploadSignedUrl.mockResolvedValue({
        uploadUrl: 'https://storage.googleapis.com/signed-url',
        storageKey: 'users/123/application-materials/resume/12345.pdf',
        expiresAt: new Date('2025-01-01T12:00:00Z'),
      });

      const result = await controller.requestUpload(mockUser, validDTO);

      expect(mockStorageQuotaService.checkQuota).toHaveBeenCalledWith(
        123,
        1024 * 1024
      );
      expect(mockGcsUploadService.generateUploadSignedUrl).toHaveBeenCalledWith(
        123,
        'resume',
        'pdf',
        'application/pdf'
      );
      expect(result).toEqual({
        uploadUrl: 'https://storage.googleapis.com/signed-url',
        storageKey: 'users/123/application-materials/resume/12345.pdf',
        expiresAt: '2025-01-01T12:00:00.000Z',
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Generated upload URL', {
        userId: 123,
        fileType: 'resume',
        storageKey: 'users/123/application-materials/resume/12345.pdf',
      });
    });

    it('should reject non-PDF file extensions', async () => {
      const invalidDTO = { ...validDTO, fileExtension: 'docx' };

      await expect(
        controller.requestUpload(mockUser, invalidDTO)
      ).rejects.toMatchObject({
        message: 'Invalid file type. Only PDF files are allowed',
        status: 400,
      });

      expect(mockStorageQuotaService.checkQuota).not.toHaveBeenCalled();
      expect(
        mockGcsUploadService.generateUploadSignedUrl
      ).not.toHaveBeenCalled();
    });

    it('should reject when quota exceeded with details', async () => {
      mockStorageQuotaService.checkQuota.mockResolvedValue({
        allowed: false,
        reason: 'Insufficient storage quota',
        bytesNeeded: 1024 * 1024,
        bytesAvailable: 512 * 1024,
      });

      await expect(
        controller.requestUpload(mockUser, validDTO)
      ).rejects.toMatchObject({
        message: 'Insufficient storage quota',
        status: 400,
        details: {
          bytesNeeded: 1024 * 1024,
          bytesAvailable: 512 * 1024,
        },
      });

      expect(
        mockGcsUploadService.generateUploadSignedUrl
      ).not.toHaveBeenCalled();
    });

    it('should propagate GCS service errors', async () => {
      mockStorageQuotaService.checkQuota.mockResolvedValue({ allowed: true });
      mockGcsUploadService.generateUploadSignedUrl.mockRejectedValue(
        new Error('GCS service unavailable')
      );

      await expect(
        controller.requestUpload(mockUser, validDTO)
      ).rejects.toThrow('GCS service unavailable');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to generate upload URL',
        expect.any(Error)
      );
    });

    it('should handle quota check failure', async () => {
      mockStorageQuotaService.checkQuota.mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        controller.requestUpload(mockUser, validDTO)
      ).rejects.toThrow('Database error');
    });
  });

  describe('completeUpload', () => {
    const validDTO: CompleteUploadDTO = {
      storageKey: 'users/123/application-materials/resume/12345.pdf',
      sizeBytes: 1024 * 1024, // Client-provided size
      filename: 'resume.pdf',
      mimeType: 'application/pdf',
      fileType: 'resume',
    };

    it('should complete upload using actual GCS file size', async () => {
      mockGcsUploadService.completeUpload.mockResolvedValue({
        success: true,
        storageKey: validDTO.storageKey,
        validated: true,
        sizeBytes: 950 * 1024, // Actual size differs from client
      });

      mockStorageQuotaService.checkQuota.mockResolvedValue({ allowed: true });
      mockUserFilesRepository.create.mockResolvedValue({} as any);
      mockStorageQuotaService.updateUsage.mockResolvedValue({} as any);

      const result = await controller.completeUpload(mockUser, validDTO);

      expect(mockGcsUploadService.completeUpload).toHaveBeenCalledWith(
        validDTO.storageKey,
        123
      );
      // Quota check uses actual size, not client size
      expect(mockStorageQuotaService.checkQuota).toHaveBeenCalledWith(
        123,
        950 * 1024
      );
      // DB record uses actual size
      expect(mockUserFilesRepository.create).toHaveBeenCalledWith({
        userId: 123,
        storageKey: validDTO.storageKey,
        filename: 'resume.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 950 * 1024,
        fileType: 'resume',
      });
      // Quota updated with actual size
      expect(mockStorageQuotaService.updateUsage).toHaveBeenCalledWith(
        123,
        950 * 1024
      );
      expect(result).toEqual({
        storageKey: validDTO.storageKey,
        verified: true,
      });
    });

    it('should delete file when actual size exceeds quota', async () => {
      mockGcsUploadService.completeUpload.mockResolvedValue({
        success: true,
        storageKey: validDTO.storageKey,
        validated: true,
        sizeBytes: 10 * 1024 * 1024, // 10MB actual size
      });

      mockStorageQuotaService.checkQuota.mockResolvedValue({
        allowed: false,
        reason: 'File exceeds storage quota',
      });

      mockGcsUploadService.deleteFile.mockResolvedValue({
        success: true,
        deletedKey: 'deleted/' + validDTO.storageKey,
      });

      await expect(
        controller.completeUpload(mockUser, validDTO)
      ).rejects.toMatchObject({
        message: 'File exceeds storage quota',
        status: 400,
      });

      expect(mockGcsUploadService.deleteFile).toHaveBeenCalledWith(
        validDTO.storageKey,
        123
      );
      expect(mockUserFilesRepository.create).not.toHaveBeenCalled();
      expect(mockStorageQuotaService.updateUsage).not.toHaveBeenCalled();
    });

    it('should propagate validation failures from GCS', async () => {
      mockGcsUploadService.completeUpload.mockRejectedValue(
        new Error('File validation failed: invalid file type')
      );

      await expect(
        controller.completeUpload(mockUser, validDTO)
      ).rejects.toThrow('File validation failed: invalid file type');

      expect(mockStorageQuotaService.checkQuota).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to complete upload',
        expect.any(Error)
      );
    });

    it('should propagate repository errors', async () => {
      mockGcsUploadService.completeUpload.mockResolvedValue({
        success: true,
        storageKey: validDTO.storageKey,
        validated: true,
        sizeBytes: 1024 * 1024,
      });

      mockStorageQuotaService.checkQuota.mockResolvedValue({ allowed: true });
      mockUserFilesRepository.create.mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        controller.completeUpload(mockUser, validDTO)
      ).rejects.toThrow('Database error');
    });

    it('should log both client and actual file sizes', async () => {
      mockGcsUploadService.completeUpload.mockResolvedValue({
        success: true,
        storageKey: validDTO.storageKey,
        validated: true,
        sizeBytes: 950 * 1024,
      });

      mockStorageQuotaService.checkQuota.mockResolvedValue({ allowed: true });
      mockUserFilesRepository.create.mockResolvedValue({} as any);
      mockStorageQuotaService.updateUsage.mockResolvedValue({} as any);

      await controller.completeUpload(mockUser, validDTO);

      expect(mockLogger.info).toHaveBeenCalledWith('Upload completed', {
        userId: 123,
        storageKey: validDTO.storageKey,
        sizeBytes: 950 * 1024,
        clientReportedSize: 1024 * 1024,
      });
    });
  });

  describe('deleteFile', () => {
    const storageKey = 'users/123/application-materials/resume/12345.pdf';

    it('should successfully delete file and decrement quota', async () => {
      mockUserFilesRepository.findByStorageKey.mockResolvedValue({
        id: 1,
        userId: 123,
        storageKey,
        filename: 'resume.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024 * 1024,
        fileType: 'resume',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockUserFilesRepository.softDelete.mockResolvedValue({} as any);
      mockGcsUploadService.deleteFile.mockResolvedValue({
        success: true,
        deletedKey: 'deleted/' + storageKey,
      });
      mockStorageQuotaService.updateUsage.mockResolvedValue({} as any);

      const result = await controller.deleteFile(mockUser, storageKey);

      expect(mockUserFilesRepository.findByStorageKey).toHaveBeenCalledWith(
        storageKey
      );
      expect(mockUserFilesRepository.softDelete).toHaveBeenCalledWith(
        storageKey
      );
      expect(mockGcsUploadService.deleteFile).toHaveBeenCalledWith(
        storageKey,
        123
      );
      expect(mockStorageQuotaService.updateUsage).toHaveBeenCalledWith(
        123,
        -1024 * 1024
      );
      expect(result).toEqual({
        success: true,
        deletedKey: 'deleted/' + storageKey,
      });
    });

    it('should return 404 when file not found', async () => {
      mockUserFilesRepository.findByStorageKey.mockResolvedValue(null);

      await expect(
        controller.deleteFile(mockUser, storageKey)
      ).rejects.toMatchObject({
        message: 'File not found',
        status: 404,
      });

      expect(mockUserFilesRepository.softDelete).not.toHaveBeenCalled();
      expect(mockGcsUploadService.deleteFile).not.toHaveBeenCalled();
    });

    it('should return 403 when user does not own file', async () => {
      mockUserFilesRepository.findByStorageKey.mockResolvedValue({
        id: 1,
        userId: 999, // Different user
        storageKey,
        filename: 'resume.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024 * 1024,
        fileType: 'resume',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        controller.deleteFile(mockUser, storageKey)
      ).rejects.toMatchObject({
        message: 'Unauthorized',
        status: 403,
      });

      expect(mockUserFilesRepository.softDelete).not.toHaveBeenCalled();
      expect(mockGcsUploadService.deleteFile).not.toHaveBeenCalled();
    });

    it('should propagate GCS delete errors', async () => {
      mockUserFilesRepository.findByStorageKey.mockResolvedValue({
        id: 1,
        userId: 123,
        storageKey,
        filename: 'resume.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024 * 1024,
        fileType: 'resume',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockUserFilesRepository.softDelete.mockResolvedValue({} as any);
      mockGcsUploadService.deleteFile.mockRejectedValue(
        new Error('GCS delete failed')
      );

      await expect(controller.deleteFile(mockUser, storageKey)).rejects.toThrow(
        'GCS delete failed'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to delete file',
        expect.any(Error)
      );
    });
  });

  describe('getQuota', () => {
    it('should return quota information', async () => {
      mockStorageQuotaService.getQuota.mockResolvedValue({
        bytesUsed: 5 * 1024 * 1024,
        quotaBytes: 100 * 1024 * 1024,
        bytesAvailable: 95 * 1024 * 1024,
        percentUsed: 5.0,
      });

      const result = await controller.getQuota(mockUser);

      expect(mockStorageQuotaService.getQuota).toHaveBeenCalledWith(123);
      expect(result).toEqual({
        bytesUsed: 5 * 1024 * 1024,
        quotaBytes: 100 * 1024 * 1024,
        bytesAvailable: 95 * 1024 * 1024,
        percentUsed: 5.0,
      });
    });

    it('should propagate service errors', async () => {
      mockStorageQuotaService.getQuota.mockRejectedValue(
        new Error('Database error')
      );

      await expect(controller.getQuota(mockUser)).rejects.toThrow(
        'Database error'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get quota',
        expect.any(Error)
      );
    });
  });
});
