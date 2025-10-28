import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';

import {
  FileDropZone,
  type UploadedFileInfo,
  type UploadStatus,
} from '@journey/components';

/**
 * FileDropZone Component
 *
 * Pure presentational drag-and-drop file upload component.
 * Accepts upload logic via props for dependency injection.
 * Validates: PDF only, max 10MB
 */

// Story wrapper that provides mock upload logic
const FileDropZoneWithMockHook = (
  props: Omit<
    React.ComponentProps<typeof FileDropZone>,
    'uploadFile' | 'status' | 'progress' | 'error' | 'uploadedFile'
  >
) => {
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<UploadedFileInfo | null>(
    null
  );

  const mockUploadFile = async (file: File): Promise<void> => {
    setStatus('uploading');
    setProgress(0);
    setError(null);
    setUploadedFile(null);

    // Simulate upload progress
    for (let i = 0; i <= 100; i += 10) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      setProgress(i);
    }

    // Simulate processing
    setStatus('processing');
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Complete
    const mockFileInfo: UploadedFileInfo = {
      storageKey: `mock-key-${Date.now()}`,
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    };
    setUploadedFile(mockFileInfo);
    setStatus('success');
    setProgress(100);
  };

  return (
    <FileDropZone
      {...props}
      uploadFile={mockUploadFile}
      status={status}
      progress={progress}
      error={error}
      uploadedFile={uploadedFile}
    />
  );
};

const meta: Meta<typeof FileDropZone> = {
  title: 'File Upload/FileDropZone',
  component: FileDropZoneWithMockHook as any,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Drag-and-drop file upload component with validation and progress tracking. Accepts upload logic via props (dependency injection pattern). Validates PDF files up to 10MB.',
      },
    },
  },
  argTypes: {
    disabled: {
      control: 'boolean',
      description: 'Disables the file drop zone',
    },
    onUploadComplete: {
      action: 'uploaded',
      description: 'Callback when file upload completes successfully',
    },
    onError: {
      action: 'error',
      description: 'Callback when an error occurs during upload',
    },
  },
};

export default meta;
type Story = StoryObj<typeof FileDropZoneWithMockHook>;

export const Default: Story = {
  args: {
    disabled: false,
    onUploadComplete: (file) => console.log('Upload complete:', file),
    onError: (error) => console.error('Upload error:', error),
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    onUploadComplete: (file) => console.log('Upload complete:', file),
    onError: (error) => console.error('Upload error:', error),
  },
  parameters: {
    docs: {
      description: {
        story:
          'The file drop zone is disabled and cannot accept files. Useful during form submission or when quota is exceeded.',
      },
    },
  },
};

export const WithErrorHandling: Story = {
  args: {
    disabled: false,
    onUploadComplete: (file) => {
      console.log('Upload complete:', file);
      alert(`Successfully uploaded: ${file.filename}`);
    },
    onError: (error) => {
      console.error('Upload error:', error);
      alert(`Error: ${error}`);
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Demonstrates error handling callbacks. Try uploading a file to see the success/error alerts.',
      },
    },
  },
};

export const InteractiveDemo: Story = {
  args: {
    disabled: true,
  },

  render: () => {
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFileInfo[]>([]);
    const [errors, setErrors] = useState<string[]>([]);

    return (
      <div className="space-y-4">
        <FileDropZoneWithMockHook
          onUploadComplete={(file) => {
            setUploadedFiles((prev) => [...prev, file]);
          }}
          onError={(error) => {
            setErrors((prev) => [...prev, error]);
          }}
        />

        {uploadedFiles.length > 0 && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <h3 className="mb-2 text-sm font-medium text-green-900">
              Uploaded Files
            </h3>
            <ul className="space-y-1 text-xs text-green-800">
              {uploadedFiles.map((file, i) => (
                <li key={i}>
                  {file.filename} ({(file.sizeBytes / 1024 / 1024).toFixed(2)}{' '}
                  MB)
                </li>
              ))}
            </ul>
          </div>
        )}

        {errors.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <h3 className="mb-2 text-sm font-medium text-red-900">Errors</h3>
            <ul className="space-y-1 text-xs text-red-800">
              {errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  },

  parameters: {
    docs: {
      description: {
        story:
          'Interactive demo showing upload history and error tracking. Upload multiple files to see the complete flow.',
      },
    },
  },
};
