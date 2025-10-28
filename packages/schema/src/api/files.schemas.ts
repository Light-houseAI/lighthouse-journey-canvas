/**
 * Files API Schemas
 * Request/response schemas for file upload and storage quota endpoints
 */

import { z } from 'zod';

import { apiSuccessResponseSchema } from './common.schemas';

// ============================================================================
// Storage Quota Schemas
// ============================================================================

/**
 * Storage quota response schema
 */
export const storageQuotaSchema = z
  .object({
    bytesUsed: z.number().int().nonnegative(),
    quotaBytes: z.number().int().positive(),
    bytesAvailable: z.number().int().nonnegative(),
    percentUsed: z.number().min(0).max(100),
  })
  .strict();

export type StorageQuota = z.infer<typeof storageQuotaSchema>;

/**
 * Get storage quota response
 */
export const getStorageQuotaResponseSchema =
  apiSuccessResponseSchema(storageQuotaSchema);

export type GetStorageQuotaResponse = z.infer<
  typeof getStorageQuotaResponseSchema
>;

// ============================================================================
// File Upload Schemas
// ============================================================================

/**
 * Request upload signed URL request schema
 */
export const requestUploadSchema = z
  .object({
    fileType: z.string(),
    fileExtension: z.string(),
    mimeType: z.string(),
    sizeBytes: z.number().int().positive(),
  })
  .strict();

export type RequestUpload = z.infer<typeof requestUploadSchema>;

/**
 * Request upload signed URL response schema
 */
export const requestUploadResponseSchema = z
  .object({
    uploadUrl: z.string().url(),
    storageKey: z.string(),
    expiresAt: z.string(),
  })
  .strict();

export type RequestUploadResponse = z.infer<typeof requestUploadResponseSchema>;

/**
 * Complete upload request schema
 */
export const completeUploadSchema = z
  .object({
    storageKey: z.string(),
    sizeBytes: z.number().int().positive(),
  })
  .strict();

export type CompleteUpload = z.infer<typeof completeUploadSchema>;

/**
 * Complete upload response schema
 */
export const completeUploadResponseSchema = z
  .object({
    storageKey: z.string(),
    verified: z.boolean(),
  })
  .strict();

export type CompleteUploadResponse = z.infer<
  typeof completeUploadResponseSchema
>;

/**
 * Download URL response schema
 */
export const downloadUrlResponseSchema = z
  .object({
    downloadUrl: z.string().url(),
    expiresAt: z.string(),
  })
  .strict();

export type DownloadUrlResponse = z.infer<typeof downloadUrlResponseSchema>;
