/**
 * FileDropZone Component
 *
 * Pure presentational drag-and-drop file upload component
 * Accepts upload logic as props for dependency injection
 * Validates: PDF and images (PNG, JPG, JPEG, GIF, WEBP), max 10MB
 */

import { Upload } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

import { FileUploadProgress, type UploadStatus } from './file-upload-progress';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const SUPPORTED_MIME_TYPES = {
  PDF: 'application/pdf',
  PNG: 'image/png',
  JPEG: 'image/jpeg',
  GIF: 'image/gif',
  WEBP: 'image/webp',
};
const SUPPORTED_EXTENSIONS = {
  PDF: 'pdf',
  PNG: 'png',
  JPG: 'jpg',
  JPEG: 'jpeg',
  GIF: 'gif',
  WEBP: 'webp',
};

const ACCEPTED_FILE_TYPES = {
  [SUPPORTED_MIME_TYPES.PDF]: [`.${SUPPORTED_EXTENSIONS.PDF}`],
  [SUPPORTED_MIME_TYPES.PNG]: [`.${SUPPORTED_EXTENSIONS.PNG}`],
  [SUPPORTED_MIME_TYPES.JPEG]: [`.${SUPPORTED_EXTENSIONS.JPG}`, `.${SUPPORTED_EXTENSIONS.JPEG}`],
  [SUPPORTED_MIME_TYPES.GIF]: [`.${SUPPORTED_EXTENSIONS.GIF}`],
  [SUPPORTED_MIME_TYPES.WEBP]: [`.${SUPPORTED_EXTENSIONS.WEBP}`],
};

export interface UploadedFileInfo {
  storageKey: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export interface FileDropZoneProps {
  /** Callback when upload completes successfully */
  onUploadComplete: (file: UploadedFileInfo) => void;
  /** Callback when an error occurs */
  onError: (error: string) => void;
  /** Disable the drop zone */
  disabled?: boolean;
  /** Upload function injected from parent */
  uploadFile: (file: File) => Promise<void>;
  /** Upload status from parent hook */
  status: UploadStatus;
  /** Upload progress percentage (0-100) */
  progress: number;
  /** Error message from upload hook */
  error: string | null;
  /** Uploaded file info from hook */
  uploadedFile: UploadedFileInfo | null;
}

export const FileDropZone: React.FC<FileDropZoneProps> = ({
  onUploadComplete,
  onError,
  disabled = false,
  uploadFile,
  status,
  progress,
  error,
  uploadedFile,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const validateFile = useCallback((file: File): string | null => {
    // Check file type
    const validTypes = Object.keys(ACCEPTED_FILE_TYPES);
    if (!validTypes.includes(file.type)) {
      return 'Only PDF and image files (PNG, JPG, GIF, WEBP) are allowed';
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `File size must be less than 10MB (current: ${(file.size / 1024 / 1024).toFixed(2)}MB)`;
    }

    return null;
  }, []);

  const handleFileDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      const file = acceptedFiles[0];
      setSelectedFile(file);

      // Validate file
      const validationError = validateFile(file);
      if (validationError) {
        onError(validationError);
        setSelectedFile(null);
        return;
      }

      try {
        await uploadFile(file);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Upload failed';
        onError(errorMessage);
      }
    },
    [uploadFile, validateFile, onError]
  );

  // Call onUploadComplete when upload succeeds
  React.useEffect(() => {
    if (status === 'success' && uploadedFile) {
      onUploadComplete(uploadedFile);
    }
  }, [status, uploadedFile, onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFileDrop,
    accept: ACCEPTED_FILE_TYPES,
    maxFiles: 1,
    disabled: disabled || status === 'uploading' || status === 'processing',
  });

  const isUploading = status === 'uploading' || status === 'processing';

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`relative flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
          isDragActive
            ? 'border-teal-500 bg-teal-50'
            : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
        } ${isUploading || disabled ? 'cursor-not-allowed opacity-60' : ''} `}
      >
        <input
          {...getInputProps()}
          data-testid="file-input"
          disabled={isUploading || disabled}
        />

        <Upload className="mb-4 h-12 w-12 text-gray-400" />

        <p className="mb-2 text-center text-sm font-medium text-gray-700">
          {isDragActive ? 'Drop the file here' : 'Drag & drop a file here'}
        </p>

        <p className="mb-4 text-center text-xs text-gray-500">or</p>

        <button
          type="button"
          className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          disabled={isUploading || disabled}
        >
          Choose File
        </button>

        <p className="mt-4 text-center text-xs text-gray-500">
          Maximum file size: 10MB
        </p>
      </div>

      {/* Progress display */}
      {selectedFile &&
        (status === 'uploading' ||
          status === 'processing' ||
          status === 'success') && (
          <FileUploadProgress
            filename={selectedFile.name}
            sizeBytes={selectedFile.size}
            status={status}
            progress={progress}
            error={error}
          />
        )}

      {/* Error message */}
      {status === 'error' && error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
    </div>
  );
};
