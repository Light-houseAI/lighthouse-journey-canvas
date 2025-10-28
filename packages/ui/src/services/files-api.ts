/**
 * Files API Service
 *
 * Handles communication with file upload and storage quota endpoints
 * Uses schema validation for type safety
 */

import type { StorageQuota } from '@journey/schema';

import { httpClient } from './http-client';

// Helper function to make API requests to files endpoints
async function filesRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `/api/v2/files${path}`;
  return httpClient.request<T>(url, init);
}

/**
 * Get user's storage quota information
 */
export async function getStorageQuota(): Promise<StorageQuota> {
  return filesRequest<StorageQuota>('/quota');
}

/**
 * Request a signed URL for file upload
 */
export async function requestUpload(data: {
  fileType: string;
  fileExtension: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<{
  uploadUrl: string;
  storageKey: string;
  expiresAt: string;
}> {
  return filesRequest('/request-upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

/**
 * Complete file upload after uploading to signed URL
 */
export async function completeUpload(data: {
  storageKey: string;
  sizeBytes: number;
}): Promise<{
  storageKey: string;
  verified: boolean;
}> {
  return filesRequest('/complete-upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

/**
 * Get download URL for a file
 */
export async function getDownloadUrl(
  storageKey: string
): Promise<{ downloadUrl: string; expiresAt: string }> {
  return filesRequest(`/${encodeURIComponent(storageKey)}/download-url`, {
    method: 'GET',
  });
}

/**
 * Delete a file
 */
export async function deleteFile(
  storageKey: string
): Promise<{ deleted: boolean; deletedKey: string }> {
  return filesRequest(`/${encodeURIComponent(storageKey)}`, {
    method: 'DELETE',
  });
}
