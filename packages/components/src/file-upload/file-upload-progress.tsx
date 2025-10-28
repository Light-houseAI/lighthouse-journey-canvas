/**
 * FileUploadProgress Component
 *
 * Displays upload progress with status indicators
 * Pure presentational component - no hooks or side effects
 */

import { CheckCircle2, FileText, Loader2, XCircle } from 'lucide-react';
import React from 'react';

export type UploadStatus = 'idle' | 'uploading' | 'processing' | 'success' | 'error';

export interface FileUploadProgressProps {
  filename: string;
  sizeBytes: number;
  status: UploadStatus;
  progress: number;
  error?: string | null;
}

export const FileUploadProgress: React.FC<FileUploadProgressProps> = ({
  filename,
  sizeBytes,
  status,
  progress,
  error,
}) => {
  const formatFileSize = (bytes: number): string => {
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(2)} MB`;
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'uploading':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      case 'processing':
        return <Loader2 className="h-5 w-5 animate-spin text-teal-500" />;
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <FileText className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'uploading':
        return 'Uploading...';
      case 'processing':
        return 'Processing...';
      case 'success':
        return 'Upload complete';
      case 'error':
        return error || 'Upload failed';
      default:
        return 'Ready';
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-start gap-3">
        {getStatusIcon()}

        <div className="flex-1">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-900">{filename}</p>
            <span className="text-xs text-gray-500">{formatFileSize(sizeBytes)}</span>
          </div>

          <p className="mt-1 text-xs text-gray-600">{getStatusText()}</p>

          {(status === 'uploading' || status === 'processing') && (
            <div className="mt-2">
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full bg-teal-600 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">{progress}%</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
