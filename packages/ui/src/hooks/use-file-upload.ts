/**
 * useFileUpload Hook
 *
 * Handles 3-step file upload process to GCP Cloud Storage:
 * 1. Request signed URL from backend
 * 2. Upload file directly to GCS with progress tracking
 * 3. Complete upload and verify on backend
 */

import axios from 'axios';
import { useState } from 'react';

import { FILE_TYPES } from '../constants/file-upload';
import {
  completeUpload,
  deleteFile as deleteFileApi,
  getDownloadUrl,
  requestUpload,
} from '../services/files-api';

export type UploadStatus =
  | 'idle'
  | 'uploading'
  | 'processing'
  | 'success'
  | 'error';

export interface UploadedFileInfo {
  storageKey: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  downloadUrl?: string; // Optional download URL fetched after upload
}

export interface UseFileUploadReturn {
  uploadFile: (file: File) => Promise<void>;
  deleteFile: (storageKey: string) => Promise<void>;
  reset: () => void;
  status: UploadStatus;
  progress: number;
  error: string | null;
  uploadedFile: UploadedFileInfo | null;
}

export function useFileUpload(): UseFileUploadReturn {
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<UploadedFileInfo | null>(
    null
  );

  const uploadFile = async (file: File): Promise<void> => {
    try {
      setStatus('uploading');
      setProgress(0);
      setError(null);
      setUploadedFile(null);

      // Step 1: Request signed URL from backend
      const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
      const requestData = {
        fileType: FILE_TYPES.RESUME, // Default to resume type
        fileExtension: fileExtension,
        mimeType: file.type,
        sizeBytes: file.size,
      };

      const { uploadUrl, storageKey } = await requestUpload(requestData);

      // Step 2: Upload file to GCS with progress tracking
      await axios.put(uploadUrl, file, {
        headers: {
          'Content-Type': file.type,
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setProgress(percentCompleted);
          }
        },
      });

      // Step 3: Complete upload and verify
      setStatus('processing');
      await completeUpload({
        storageKey,
        sizeBytes: file.size,
        filename: file.name,
        mimeType: file.type,
        fileType: FILE_TYPES.RESUME,
      });

      // Step 4: Get download URL for the uploaded file
      const { downloadUrl } = await getDownloadUrl(storageKey);

      setUploadedFile({
        storageKey,
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        downloadUrl,
      });
      setStatus('success');
      setProgress(100);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      setStatus('error');
      setProgress(0);
    }
  };

  const deleteFile = async (storageKey: string): Promise<void> => {
    await deleteFileApi(storageKey);
  };

  const reset = (): void => {
    setStatus('idle');
    setProgress(0);
    setError(null);
    setUploadedFile(null);
  };

  return {
    uploadFile,
    deleteFile,
    reset,
    status,
    progress,
    error,
    uploadedFile,
  };
}
