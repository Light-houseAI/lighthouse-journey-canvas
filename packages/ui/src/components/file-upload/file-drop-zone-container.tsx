/**
 * FileDropZoneContainer
 *
 * Smart wrapper component that provides upload logic via useFileUpload hook
 * to the presentational FileDropZone component from @journey/components
 */

import { FileDropZone, type UploadedFileInfo } from '@journey/components';
import React from 'react';

import type { FileType } from '../../constants/file-upload';
import { useFileUpload } from '../../hooks/use-file-upload';

export interface FileDropZoneContainerProps {
  onUploadComplete: (file: UploadedFileInfo) => void;
  onError: (error: string) => void;
  disabled?: boolean;
  fileType?: FileType;
  filePrefix?: string;
  accept?: string;
}

export const FileDropZoneContainer: React.FC<FileDropZoneContainerProps> = ({
  onUploadComplete,
  onError,
  disabled = false,
  fileType,
  filePrefix,
}) => {
  const { uploadFile, status, progress, error, uploadedFile } = useFileUpload(
    fileType,
    filePrefix
  );

  return (
    <FileDropZone
      onUploadComplete={onUploadComplete}
      onError={onError}
      disabled={disabled}
      uploadFile={uploadFile}
      status={status}
      progress={progress}
      error={error}
      uploadedFile={uploadedFile}
    />
  );
};
