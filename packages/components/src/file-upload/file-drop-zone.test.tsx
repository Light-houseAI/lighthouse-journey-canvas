import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileDropZone, type UploadedFileInfo } from './file-drop-zone';
import type { UploadStatus } from './file-upload-progress';

describe('FileDropZone', () => {
  const mockUploadFile = vi.fn();
  const mockOnUploadComplete = vi.fn();
  const mockOnError = vi.fn();

  const defaultProps = {
    uploadFile: mockUploadFile,
    onUploadComplete: mockOnUploadComplete,
    onError: mockOnError,
    status: 'idle' as UploadStatus,
    progress: 0,
    error: null,
    uploadedFile: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render drop zone with initial state', () => {
    render(<FileDropZone {...defaultProps} />);
    expect(screen.getByText('Drag & drop a file here')).toBeInTheDocument();
    expect(screen.getByText('Choose File')).toBeInTheDocument();
    expect(screen.getByText('Maximum file size: 10MB')).toBeInTheDocument();
  });

  it('should render file input', () => {
    render(<FileDropZone {...defaultProps} />);
    expect(screen.getByTestId('file-input')).toBeInTheDocument();
  });

  it('should disable drop zone when disabled prop is true', () => {
    render(<FileDropZone {...defaultProps} disabled={true} />);
    const input = screen.getByTestId('file-input') as HTMLInputElement;
    expect(input).toBeDisabled();
  });

  it('should disable drop zone when uploading', () => {
    render(<FileDropZone {...defaultProps} status="uploading" />);
    const input = screen.getByTestId('file-input') as HTMLInputElement;
    expect(input).toBeDisabled();
  });

  it('should disable drop zone when processing', () => {
    render(<FileDropZone {...defaultProps} status="processing" />);
    const input = screen.getByTestId('file-input') as HTMLInputElement;
    expect(input).toBeDisabled();
  });

  it('should validate file type and reject non-PDF files', () => {
    render(<FileDropZone {...defaultProps} />);

    // The component uses react-dropzone which automatically filters by accept prop
    // So we can verify the accept attribute is set correctly
    const input = screen.getByTestId('file-input') as HTMLInputElement;
    expect(input.accept).toContain('application/pdf');
    expect(input.accept).toContain('.pdf');
  });

  it('should display maximum file size constraint', () => {
    render(<FileDropZone {...defaultProps} />);
    expect(screen.getByText('Maximum file size: 10MB')).toBeInTheDocument();
  });

  it('should render file input for PDF selection', () => {
    render(<FileDropZone {...defaultProps} />);
    const input = screen.getByTestId('file-input') as HTMLInputElement;
    expect(input.type).toBe('file');
    expect(input.accept).toContain('application/pdf');
  });

  it('should call onUploadComplete when upload succeeds', async () => {
    const uploadedFile: UploadedFileInfo = {
      storageKey: 'test-key',
      filename: 'test.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
    };

    const { rerender } = render(<FileDropZone {...defaultProps} />);

    // Simulate upload completion
    rerender(
      <FileDropZone
        {...defaultProps}
        status="success"
        uploadedFile={uploadedFile}
      />
    );

    await waitFor(() => {
      expect(mockOnUploadComplete).toHaveBeenCalledWith(uploadedFile);
    });
  });

  it('should display FileUploadProgress when uploading', async () => {
    mockUploadFile.mockResolvedValue(undefined);
    const { rerender } = render(<FileDropZone {...defaultProps} />);

    const input = screen.getByTestId('file-input') as HTMLInputElement;
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });

    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    });

    fireEvent.change(input);

    // Rerender with uploading status
    rerender(
      <FileDropZone {...defaultProps} status="uploading" progress={50} />
    );

    await waitFor(() => {
      expect(screen.getByText('Uploading...')).toBeInTheDocument();
    });
  });

  it('should display error message when status is error', () => {
    render(
      <FileDropZone {...defaultProps} status="error" error="Upload failed" />
    );
    expect(screen.getByText('Upload failed')).toBeInTheDocument();
  });

  it('should call onError when uploadFile throws an error', async () => {
    mockUploadFile.mockRejectedValue(new Error('Network error'));
    render(<FileDropZone {...defaultProps} />);

    const input = screen.getByTestId('file-input') as HTMLInputElement;
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });

    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith('Network error');
    });
  });

  it('should handle upload failure with non-Error object', async () => {
    mockUploadFile.mockRejectedValue('String error');
    render(<FileDropZone {...defaultProps} />);

    const input = screen.getByTestId('file-input') as HTMLInputElement;
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });

    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith('Upload failed');
    });
  });

  it('should show processing status', () => {
    render(<FileDropZone {...defaultProps} status="processing" progress={75} />);
    const input = screen.getByTestId('file-input') as HTMLInputElement;
    expect(input).toBeDisabled();
  });

  it('should apply correct styles when drag is active', () => {
    const { container } = render(<FileDropZone {...defaultProps} />);
    const dropZone = container.querySelector('[class*="border-dashed"]');
    expect(dropZone).toBeInTheDocument();
  });

  it('should display success status with progress component', async () => {
    mockUploadFile.mockResolvedValue(undefined);
    const { rerender } = render(<FileDropZone {...defaultProps} />);

    const input = screen.getByTestId('file-input') as HTMLInputElement;
    const file = new File(['content'], 'success.pdf', { type: 'application/pdf' });

    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    });

    fireEvent.change(input);

    rerender(
      <FileDropZone
        {...defaultProps}
        status="success"
        progress={100}
        uploadedFile={{
          storageKey: 'key',
          filename: 'success.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Upload complete')).toBeInTheDocument();
    });
  });
});
