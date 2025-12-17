/**
 * Uploads Routes
 *
 * API endpoints for desktop app screenshot uploads
 * Handles batch signed URL generation for session screenshots
 */

import type { User } from '@journey/schema';
import { Router } from 'express';
import { z } from 'zod';

import { CONTAINER_TOKENS } from '../core/container-tokens';
import { requireAuth } from '../middleware/auth.middleware';
import { containerMiddleware } from '../middleware/index';
import type { GcsUploadService } from '../services/gcs-upload.service';

// Schema for batch signed URL request from desktop app
const batchSignedUrlSchema = z.object({
  sessionId: z.string(),
  files: z.array(
    z.object({
      filename: z.string(),
      contentType: z.string(),
      size: z.number().int().positive().max(10485760), // Max 10MB per file
    })
  ),
});

/**
 * Extract file extension from filename
 */
function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'png';
}

/**
 * Create uploads router
 */
export function uploadsRoutes(): Router {
  const router = Router();

  /**
   * POST /api/v2/uploads/signed-urls
   * Get signed URLs for batch file upload (desktop app screenshots)
   */
  router.post(
    '/signed-urls',
    requireAuth,
    containerMiddleware,
    async (req: any, res: any, next: any) => {
      try {
        const user: User = req.user;

        // Validate request body
        const dto = batchSignedUrlSchema.parse(req.body);

        // Get GCS upload service from container
        const gcsUploadService: GcsUploadService = req.scope.resolve(
          CONTAINER_TOKENS.GCS_UPLOAD_SERVICE
        );

        // Generate signed URLs for each file
        const uploads = await Promise.all(
          dto.files.map(async (file) => {
            const fileExtension = getFileExtension(file.filename);

            // Use sessionId as prefix to organize screenshots by session
            const result = await gcsUploadService.generateUploadSignedUrl(
              user.id,
              'desktop-screenshots', // fileType for organizing in GCS
              fileExtension,
              file.contentType,
              `sessions/${dto.sessionId}` // filePrefix
            );

            return {
              filename: file.filename,
              uploadUrl: result.uploadUrl,
              storageKey: result.storageKey,
              // publicUrl will be available after upload is complete
              // For now, we return the storage key which can be used to get download URL
              publicUrl: `https://storage.googleapis.com/${process.env.GCP_BUCKET_NAME}/${result.storageKey}`,
              expiresAt: result.expiresAt.toISOString(),
            };
          })
        );

        res.json({
          success: true,
          uploads,
          meta: {
            timestamp: new Date().toISOString(),
            sessionId: dto.sessionId,
            fileCount: uploads.length,
          },
        });
      } catch (error: any) {
        // Handle validation errors
        if (error.name === 'ZodError') {
          return res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request body',
              details: error.errors,
            },
          });
        }

        // Handle GCS configuration errors
        if (error.message?.includes('GCP')) {
          console.error('GCS configuration error:', error);
          return res.status(500).json({
            success: false,
            error: {
              code: 'STORAGE_CONFIG_ERROR',
              message: 'Storage service not properly configured',
            },
          });
        }

        next(error);
      }
    }
  );

  return router;
}

// Export default router for standard usage
const router = uploadsRoutes();
export default router;
