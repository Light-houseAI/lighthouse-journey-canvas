/**
 * Company Documents Routes
 *
 * API endpoints for company document upload, status, and management.
 * Documents are used for RAG-based insight generation.
 */

import type { User } from '@journey/schema';
import { Router } from 'express';
import { z } from 'zod';

import type { CompanyDocumentsController } from '../controllers/company-documents.controller.js';
import { CONTAINER_TOKENS } from '../core/container-tokens.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { containerMiddleware } from '../middleware/index.js';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const requestUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.enum([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]),
  sizeBytes: z.number().int().positive().max(1048576000), // Max 1GB for documents
});

const completeUploadSchema = z.object({
  storageKey: z.string().min(1),
  filename: z.string().min(1).max(255),
  mimeType: z.enum([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]),
  sizeBytes: z.number().int().positive(),
});

const documentIdSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

// ============================================================================
// ROUTES
// ============================================================================

/**
 * Create company documents router with dependency injection
 */
export function companyDocumentsRoutes(
  controller?: CompanyDocumentsController
): Router {
  const router = Router();

  /**
   * POST /api/v2/company-docs/request-upload
   * Request a signed URL for document upload
   */
  router.post(
    '/request-upload',
    requireAuth,
    containerMiddleware,
    async (req: any, res: any, next: any) => {
      try {
        const companyDocsController: CompanyDocumentsController =
          controller ||
          req.scope.resolve(CONTAINER_TOKENS.COMPANY_DOCUMENTS_CONTROLLER);
        const user: User = req.user;

        const dto = requestUploadSchema.parse(req.body);
        const result = await companyDocsController.requestUpload(user, dto);

        res.json({
          success: true,
          data: result,
          meta: {
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error: any) {
        next(error);
      }
    }
  );

  /**
   * POST /api/v2/company-docs/complete-upload
   * Complete upload and trigger processing
   */
  router.post(
    '/complete-upload',
    requireAuth,
    containerMiddleware,
    async (req: any, res: any, next: any) => {
      try {
        const companyDocsController: CompanyDocumentsController =
          controller ||
          req.scope.resolve(CONTAINER_TOKENS.COMPANY_DOCUMENTS_CONTROLLER);
        const user: User = req.user;

        const dto = completeUploadSchema.parse(req.body);
        const result = await companyDocsController.completeUpload(user, dto);

        res.status(202).json({
          success: true,
          data: result,
          meta: {
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error: any) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v2/company-docs
   * List user's company documents
   */
  router.get(
    '/',
    requireAuth,
    containerMiddleware,
    async (req: any, res: any, next: any) => {
      try {
        const companyDocsController: CompanyDocumentsController =
          controller ||
          req.scope.resolve(CONTAINER_TOKENS.COMPANY_DOCUMENTS_CONTROLLER);
        const user: User = req.user;

        const result = await companyDocsController.listDocuments(user);

        res.json({
          success: true,
          data: result,
          meta: {
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error: any) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v2/company-docs/:id/status
   * Get document processing status
   */
  router.get(
    '/:id/status',
    requireAuth,
    containerMiddleware,
    async (req: any, res: any, next: any) => {
      try {
        const companyDocsController: CompanyDocumentsController =
          controller ||
          req.scope.resolve(CONTAINER_TOKENS.COMPANY_DOCUMENTS_CONTROLLER);
        const user: User = req.user;

        const { id } = documentIdSchema.parse(req.params);
        const result = await companyDocsController.getDocumentStatus(user, id);

        res.json({
          success: true,
          data: result,
          meta: {
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error: any) {
        next(error);
      }
    }
  );

  /**
   * DELETE /api/v2/company-docs/:id
   * Delete a company document
   */
  router.delete(
    '/:id',
    requireAuth,
    containerMiddleware,
    async (req: any, res: any, next: any) => {
      try {
        const companyDocsController: CompanyDocumentsController =
          controller ||
          req.scope.resolve(CONTAINER_TOKENS.COMPANY_DOCUMENTS_CONTROLLER);
        const user: User = req.user;

        const { id } = documentIdSchema.parse(req.params);
        const result = await companyDocsController.deleteDocument(user, id);

        res.json({
          success: true,
          data: result,
          meta: {
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error: any) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v2/company-docs/stats
   * Get document statistics
   */
  router.get(
    '/stats',
    requireAuth,
    containerMiddleware,
    async (req: any, res: any, next: any) => {
      try {
        const companyDocsController: CompanyDocumentsController =
          controller ||
          req.scope.resolve(CONTAINER_TOKENS.COMPANY_DOCUMENTS_CONTROLLER);
        const user: User = req.user;

        const result = await companyDocsController.getStats(user);

        res.json({
          success: true,
          data: result,
          meta: {
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error: any) {
        next(error);
      }
    }
  );

  return router;
}
