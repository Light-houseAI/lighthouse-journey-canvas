/**
 * Company Documents Controller
 *
 * Handles company document upload, processing status, and deletion.
 * Uses the existing GCS upload pattern with async processing.
 */

import type { User } from '@journey/schema';

import type { Logger } from '../core/logger.js';
import type { CompanyDocumentRepository } from '../repositories/company-document.repository.js';
import type { CompanyDocumentProcessingService } from '../services/company-document-processing.service.js';
import type { CompanyDocumentSearchService } from '../services/company-document-search.service.js';
import type { GcsUploadService } from '../services/gcs-upload.service.js';
import type { StorageQuotaService } from '../services/storage-quota.service.js';
import { BaseController } from './base.controller.js';

// ============================================================================
// TYPES
// ============================================================================

export interface RequestUploadDTO {
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export interface CompleteUploadDTO {
  storageKey: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

// ============================================================================
// CONTROLLER
// ============================================================================

export class CompanyDocumentsController extends BaseController {
  private readonly logger: Logger;
  private readonly companyDocRepository: CompanyDocumentRepository;
  private readonly processingService: CompanyDocumentProcessingService;
  private readonly searchService: CompanyDocumentSearchService;
  private readonly gcsUploadService: GcsUploadService | undefined;
  private readonly storageQuotaService: StorageQuotaService;

  constructor({
    logger,
    companyDocumentRepository,
    companyDocumentProcessingService,
    companyDocumentSearchService,
    gcsUploadService,
    storageQuotaService,
  }: {
    logger: Logger;
    companyDocumentRepository: CompanyDocumentRepository;
    companyDocumentProcessingService: CompanyDocumentProcessingService;
    companyDocumentSearchService: CompanyDocumentSearchService;
    gcsUploadService?: GcsUploadService;
    storageQuotaService: StorageQuotaService;
  }) {
    super();
    this.logger = logger;
    this.companyDocRepository = companyDocumentRepository;
    this.processingService = companyDocumentProcessingService;
    this.searchService = companyDocumentSearchService;
    this.gcsUploadService = gcsUploadService;
    this.storageQuotaService = storageQuotaService;
  }

  /**
   * Request a signed URL for document upload
   */
  async requestUpload(user: User, dto: RequestUploadDTO) {
    try {
      // Check if GCS is configured
      if (!this.gcsUploadService) {
        const error = new Error(
          'Document upload is not available. GCP storage is not configured. ' +
            'Please set GCP_SERVICE_ACCOUNT_KEY and GCP_BUCKET_NAME environment variables.'
        );
        (error as any).status = 503;
        throw error;
      }

      // Validate mime type
      const allowedMimeTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];

      if (!allowedMimeTypes.includes(dto.mimeType)) {
        const error = new Error(
          'Invalid file type. Only PDF and DOCX files are allowed.'
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

      // Get file extension from mime type
      const extension = dto.mimeType === 'application/pdf' ? 'pdf' : 'docx';

      // Generate signed URL
      const result = await this.gcsUploadService.generateUploadSignedUrl(
        user.id,
        'company_document',
        extension,
        dto.mimeType,
        'company-docs'
      );

      this.logger.info('Generated company document upload URL', {
        userId: user.id,
        filename: dto.filename,
        storageKey: result.storageKey,
      });

      return {
        uploadUrl: result.uploadUrl,
        storageKey: result.storageKey,
        expiresAt: result.expiresAt,
      };
    } catch (error) {
      this.logger.error('Failed to generate upload URL', {
        userId: user.id,
        error,
      });
      throw error;
    }
  }

  /**
   * Complete upload and trigger processing
   */
  async completeUpload(user: User, dto: CompleteUploadDTO) {
    try {
      // Create document record
      const document = await this.companyDocRepository.create({
        userId: user.id,
        storageKey: dto.storageKey,
        filename: dto.filename,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
        processingStatus: 'pending',
      });

      this.logger.info('Company document upload completed', {
        userId: user.id,
        documentId: document.id,
        filename: dto.filename,
      });

      // Queue for background processing
      await this.processingService.queueProcessing(document.id);

      return {
        documentId: document.id,
        status: 'pending',
        message: 'Document uploaded successfully. Processing started.',
      };
    } catch (error) {
      this.logger.error('Failed to complete upload', {
        userId: user.id,
        error,
      });
      throw error;
    }
  }

  /**
   * List user's company documents
   */
  async listDocuments(user: User) {
    try {
      const documents = await this.companyDocRepository.findByUserId(user.id);

      return {
        documents: documents.map((doc) => ({
          id: doc.id,
          filename: doc.filename,
          mimeType: doc.mimeType,
          sizeBytes: doc.sizeBytes,
          processingStatus: doc.processingStatus,
          processingError: doc.processingError,
          chunkCount: doc.chunkCount,
          createdAt: doc.createdAt,
          processedAt: doc.processedAt,
        })),
        total: documents.length,
      };
    } catch (error) {
      this.logger.error('Failed to list documents', {
        userId: user.id,
        error,
      });
      throw error;
    }
  }

  /**
   * Get document processing status
   */
  async getDocumentStatus(user: User, documentId: number) {
    try {
      const document = await this.companyDocRepository.findById(documentId);

      if (!document || document.userId !== user.id) {
        const error = new Error('Document not found');
        (error as any).status = 404;
        throw error;
      }

      // Also check in-memory processing status
      const processingStatus = this.processingService.getProcessingStatus(documentId);

      return {
        id: document.id,
        filename: document.filename,
        processingStatus: processingStatus?.status || document.processingStatus,
        processingError: processingStatus?.error || document.processingError,
        chunkCount: document.chunkCount,
        processedAt: document.processedAt,
      };
    } catch (error) {
      this.logger.error('Failed to get document status', {
        userId: user.id,
        documentId,
        error,
      });
      throw error;
    }
  }

  /**
   * Delete a company document
   */
  async deleteDocument(user: User, documentId: number) {
    try {
      const deleted = await this.companyDocRepository.delete(documentId, user.id);

      if (!deleted) {
        const error = new Error('Document not found');
        (error as any).status = 404;
        throw error;
      }

      this.logger.info('Company document deleted', {
        userId: user.id,
        documentId,
      });

      return {
        success: true,
        message: 'Document deleted successfully',
      };
    } catch (error) {
      this.logger.error('Failed to delete document', {
        userId: user.id,
        documentId,
        error,
      });
      throw error;
    }
  }

  /**
   * Get document statistics
   */
  async getStats(user: User) {
    try {
      return await this.searchService.getDocumentStats(user.id);
    } catch (error) {
      this.logger.error('Failed to get document stats', {
        userId: user.id,
        error,
      });
      throw error;
    }
  }
}
