/**
 * Files Routes
 *
 * API endpoints for file upload/download operations
 */

import type { User } from '@journey/schema';
import { completeUploadSchema, requestUploadSchema } from '@journey/schema';
import { Router } from 'express';
import { z } from 'zod';

import type { FilesController } from '../controllers/files.controller';
import { CONTAINER_TOKENS } from '../core/container-tokens';
import { requireAuth } from '../middleware/auth.middleware';
import { containerMiddleware } from '../middleware/index';

// Additional validation on top of shared schema
const requestUploadSchemaWithValidation = requestUploadSchema.extend({
  fileExtension: z.enum(['pdf']),
  mimeType: z.enum(['application/pdf']),
  sizeBytes: z.number().int().positive().max(10485760), // Max 10MB
});

/**
 * Create files router with dependency injection
 */
export function filesRoutes(controller?: FilesController): Router {
  const router = Router();

  /**
   * POST /api/v2/files/request-upload
   * Request a signed URL for file upload
   */
  router.post(
    '/request-upload',
    requireAuth,
    containerMiddleware,
    async (req: any, res: any, next: any) => {
      try {
        // Get controller from container or use injected one
        const filesController: FilesController =
          controller || req.scope.resolve(CONTAINER_TOKENS.FILES_CONTROLLER);
        const user: User = req.user;

        // Validate request body
        const dto = requestUploadSchemaWithValidation.parse(req.body);

        const result = await filesController.requestUpload(user, dto);

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
   * POST /api/v2/files/complete-upload
   * Complete file upload and validate
   */
  router.post(
    '/complete-upload',
    requireAuth,
    containerMiddleware,
    async (req: any, res: any, next: any) => {
      try {
        const filesController: FilesController =
          controller || req.scope.resolve(CONTAINER_TOKENS.FILES_CONTROLLER);
        const user: User = req.user;

        const dto = completeUploadSchema.parse(req.body);

        const result = await filesController.completeUpload(user, dto);

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
   * GET /api/v2/files/:storageKey/download-url
   * Get download URL for file
   */
  router.get(
    '/:storageKey(*)/download-url',
    requireAuth,
    containerMiddleware,
    async (req: any, res: any, next: any) => {
      try {
        const filesController: FilesController =
          controller || req.scope.resolve(CONTAINER_TOKENS.FILES_CONTROLLER);
        const user: User = req.user;
        const storageKey = decodeURIComponent(req.params.storageKey);

        const result = await filesController.getDownloadUrl(user, storageKey);

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
   * DELETE /api/v2/files/:storageKey
   * Delete file (soft-delete)
   */
  router.delete(
    '/:storageKey(*)',
    requireAuth,
    containerMiddleware,
    async (req: any, res: any, next: any) => {
      try {
        const filesController: FilesController =
          controller || req.scope.resolve(CONTAINER_TOKENS.FILES_CONTROLLER);
        const user: User = req.user;
        const storageKey = decodeURIComponent(req.params.storageKey);

        const result = await filesController.deleteFile(user, storageKey);

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
   * GET /api/v2/files/quota
   * Get storage quota information
   */
  router.get(
    '/quota',
    requireAuth,
    containerMiddleware,
    async (req: any, res: any, next: any) => {
      try {
        const filesController: FilesController =
          controller || req.scope.resolve(CONTAINER_TOKENS.FILES_CONTROLLER);
        const user: User = req.user;

        const result = await filesController.getQuota(user);

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

// Export default router for standard usage
const router = filesRoutes();
export default router;
