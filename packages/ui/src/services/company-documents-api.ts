/**
 * Company Documents API Service
 *
 * Handles communication with company document upload and management endpoints
 * Used for the Insight Assistant RAG feature
 */

import { httpClient } from './http-client';

// ============================================================================
// Types
// ============================================================================

// Note: httpClient automatically unwraps { success, data } responses,
// so these types represent the unwrapped data directly.

export interface RequestDocumentUpload {
  filename: string;
  mimeType: 'application/pdf' | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  sizeBytes: number;
}

export interface RequestDocumentUploadResponse {
  uploadUrl: string;
  storageKey: string;
  expiresAt: string;
}

export interface CompleteDocumentUpload {
  storageKey: string;
  filename: string;
  mimeType: 'application/pdf' | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  sizeBytes: number;
}

export interface CompleteDocumentUploadResponse {
  documentId: number;
  processingStatus: 'pending' | 'processing';
}

export interface CompanyDocument {
  id: number;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  processingError?: string;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
  processedAt?: string;
}

export interface ListDocumentsResponse {
  documents: CompanyDocument[];
  total: number;
}

export interface DocumentStatusResponse {
  documentId: number;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  processingError?: string;
  chunkCount: number;
  processedAt?: string;
}

export interface DeleteDocumentResponse {
  deleted: boolean;
  documentId: number;
}

export interface DocumentStatsResponse {
  totalDocuments: number;
  pendingDocuments: number;
  processingDocuments: number;
  completedDocuments: number;
  failedDocuments: number;
  totalChunks: number;
  totalSizeBytes: number;
}

// ============================================================================
// API Functions
// ============================================================================

const BASE_PATH = '/api/v2/company-docs';

/**
 * Request a signed URL for document upload
 */
export async function requestDocumentUpload(
  data: RequestDocumentUpload
): Promise<RequestDocumentUploadResponse> {
  return httpClient.request<RequestDocumentUploadResponse>(`${BASE_PATH}/request-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

/**
 * Complete upload and trigger processing
 */
export async function completeDocumentUpload(
  data: CompleteDocumentUpload
): Promise<CompleteDocumentUploadResponse> {
  return httpClient.request<CompleteDocumentUploadResponse>(`${BASE_PATH}/complete-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

/**
 * List user's company documents
 */
export async function listCompanyDocuments(): Promise<ListDocumentsResponse> {
  return httpClient.request<ListDocumentsResponse>(BASE_PATH, {
    method: 'GET',
  });
}

/**
 * Get document processing status
 */
export async function getDocumentStatus(documentId: number): Promise<DocumentStatusResponse> {
  return httpClient.request<DocumentStatusResponse>(`${BASE_PATH}/${documentId}/status`, {
    method: 'GET',
  });
}

/**
 * Delete a company document
 */
export async function deleteCompanyDocument(documentId: number): Promise<DeleteDocumentResponse> {
  return httpClient.request<DeleteDocumentResponse>(`${BASE_PATH}/${documentId}`, {
    method: 'DELETE',
  });
}

/**
 * Get document statistics
 */
export async function getDocumentStats(): Promise<DocumentStatsResponse> {
  return httpClient.request<DocumentStatsResponse>(`${BASE_PATH}/stats`, {
    method: 'GET',
  });
}

/**
 * Upload a file to the signed URL
 */
export async function uploadToSignedUrl(uploadUrl: string, file: File): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
    },
    body: file,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }
}

/**
 * Full upload flow: request URL, upload file, complete upload
 */
export async function uploadCompanyDocument(file: File): Promise<CompleteDocumentUploadResponse> {
  // Validate file type
  const validTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  if (!validTypes.includes(file.type)) {
    throw new Error('Invalid file type. Only PDF and DOCX files are supported.');
  }

  // Max size: 1000MB (1GB)
  const maxSize = 1048576000;
  if (file.size > maxSize) {
    throw new Error('File size exceeds 1000MB limit.');
  }

  // Step 1: Request upload URL
  let uploadRequest: RequestDocumentUploadResponse;
  try {
    uploadRequest = await requestDocumentUpload({
      filename: file.name,
      mimeType: file.type as RequestDocumentUpload['mimeType'],
      sizeBytes: file.size,
    });
    console.log('[CompanyDocs] Upload request response:', uploadRequest);
  } catch (error) {
    console.error('[CompanyDocs] Request upload failed:', error);
    // Re-throw with more context
    throw new Error(
      `Failed to request upload URL: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  // Validate response has required data (httpClient already unwraps to data level)
  if (!uploadRequest?.uploadUrl || !uploadRequest?.storageKey) {
    console.error('[CompanyDocs] Invalid upload response - missing uploadUrl or storageKey:', uploadRequest);
    throw new Error(
      'Server did not return upload URL. GCS may not be configured. Check server logs for details.'
    );
  }

  // Step 2: Upload to signed URL
  try {
    await uploadToSignedUrl(uploadRequest.uploadUrl, file);
  } catch (error) {
    throw new Error(
      `Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  // Step 3: Complete upload and trigger processing
  const completeResponse = await completeDocumentUpload({
    storageKey: uploadRequest.storageKey,
    filename: file.name,
    mimeType: file.type as CompleteDocumentUpload['mimeType'],
    sizeBytes: file.size,
  });

  return completeResponse;
}
