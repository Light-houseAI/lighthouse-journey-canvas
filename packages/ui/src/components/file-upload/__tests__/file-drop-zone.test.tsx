/**
 * Tests for FileDropZoneContainer component
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FileDropZoneContainer } from '../file-drop-zone-container';

// Mock the useFileUpload hook
vi.mock('../../../hooks/use-file-upload', () => ({
  useFileUpload: () => ({
    uploadFile: vi.fn().mockResolvedValue(undefined),
    status: 'idle',
    progress: 0,
    error: null,
    uploadedFile: null,
  }),
}));

describe('FileDropZone', () => {
  const mockOnUploadComplete = vi.fn();
  const mockOnError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render drop zone initially', () => {
    render(
      <FileDropZoneContainer
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
      />
    );

    expect(screen.getByText(/drag.*drop.*pdf file/i)).toBeInTheDocument();
    expect(screen.getByText(/choose file/i)).toBeInTheDocument();
  });

  it('should validate file type - reject invalid file type attribute', () => {
    render(
      <FileDropZoneContainer
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
      />
    );

    const input = screen.getByTestId('file-input');

    // Verify input only accepts PDF
    expect(input).toHaveAttribute('accept', 'application/pdf,.pdf');
  });

  it('should display correct UI text', () => {
    render(
      <FileDropZoneContainer
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
      />
    );

    expect(screen.getByText(/drag.*drop.*pdf file/i)).toBeInTheDocument();
    expect(screen.getByText(/maximum file size: 10mb/i)).toBeInTheDocument();
  });

  it('should have file input with correct attributes', () => {
    render(
      <FileDropZoneContainer
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
      />
    );

    const input = screen.getByTestId('file-input');
    expect(input).toHaveAttribute('type', 'file');
    expect(input).toHaveAttribute('accept', 'application/pdf,.pdf');
  });

  // Note: Component behavior tests (validation, upload progress, success states) are integration tests
  // that would require actual hook behavior. The hook itself is fully tested in use-file-upload.test.tsx
});
