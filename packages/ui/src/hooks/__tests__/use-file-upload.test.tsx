/**
 * Tests for useFileUpload hook
 */

import { renderHook, waitFor } from '@testing-library/react';
import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { httpClient } from '../../services/http-client';
import { useFileUpload } from '../use-file-upload';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

// Mock httpClient
vi.mock('../../services/http-client', () => ({
  httpClient: {
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('useFileUpload', () => {
  const mockFile = new File(['test content'], 'test.pdf', {
    type: 'application/pdf',
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should start with idle status', () => {
    const { result } = renderHook(() => useFileUpload());

    expect(result.current.status).toBe('idle');
    expect(result.current.progress).toBe(0);
    expect(result.current.error).toBeNull();
    expect(result.current.uploadedFile).toBeNull();
  });

  it('should successfully upload a file through 3-step process', async () => {
    const mockSignedUrl = 'https://storage.googleapis.com/test-bucket/test.pdf';
    const mockStorageKey = 'uploads/123/test.pdf';

    // Step 1: Request upload URL
    vi.mocked(httpClient.post).mockResolvedValueOnce({
      signedUrl: mockSignedUrl,
      storageKey: mockStorageKey,
    });

    // Step 2: Upload to GCS
    mockedAxios.put.mockResolvedValueOnce({ status: 200 });

    // Step 3: Complete upload
    vi.mocked(httpClient.post).mockResolvedValueOnce({
      storageKey: mockStorageKey,
      filename: 'test.pdf',
      mimeType: 'application/pdf',
      sizeBytes: mockFile.size,
    });

    const { result } = renderHook(() => useFileUpload());

    // Start upload
    const uploadPromise = result.current.uploadFile(mockFile);

    await uploadPromise;

    // Verify final state
    await waitFor(() => {
      expect(result.current.status).toBe('success');
      expect(result.current.uploadedFile).toEqual({
        storageKey: mockStorageKey,
        filename: 'test.pdf',
        mimeType: 'application/pdf',
        sizeBytes: mockFile.size,
      });
    });

    // Verify API calls
    expect(httpClient.post).toHaveBeenCalledWith(
      '/api/v2/files/request-upload',
      {
        fileType: 'resume',
        fileExtension: 'pdf',
        mimeType: 'application/pdf',
        sizeBytes: mockFile.size,
      }
    );

    expect(mockedAxios.put).toHaveBeenCalledWith(
      mockSignedUrl,
      mockFile,
      expect.objectContaining({
        headers: {
          'Content-Type': 'application/pdf',
        },
        onUploadProgress: expect.any(Function),
      })
    );

    expect(httpClient.post).toHaveBeenCalledWith(
      '/api/v2/files/complete-upload',
      {
        storageKey: mockStorageKey,
        sizeBytes: mockFile.size,
      }
    );
  });

  it('should track upload progress', async () => {
    const mockSignedUrl = 'https://storage.googleapis.com/test-bucket/test.pdf';
    const mockStorageKey = 'uploads/123/test.pdf';

    vi.mocked(httpClient.post).mockResolvedValueOnce({
      signedUrl: mockSignedUrl,
      storageKey: mockStorageKey,
    });

    // Mock axios to simulate progress
    mockedAxios.put.mockImplementationOnce((url, data, config: any) => {
      // Simulate progress callbacks
      if (config?.onUploadProgress) {
        config.onUploadProgress({ loaded: 50, total: 100 });
        config.onUploadProgress({ loaded: 100, total: 100 });
      }
      return Promise.resolve({ status: 200 });
    });

    vi.mocked(httpClient.post).mockResolvedValueOnce({
      storageKey: mockStorageKey,
      filename: 'test.pdf',
      mimeType: 'application/pdf',
      sizeBytes: mockFile.size,
    });

    const { result } = renderHook(() => useFileUpload());

    result.current.uploadFile(mockFile);

    // Wait for progress to update
    await waitFor(() => {
      expect(result.current.progress).toBeGreaterThan(0);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('success');
      expect(result.current.progress).toBe(100);
    });
  });

  it('should handle errors during request-upload', async () => {
    vi.mocked(httpClient.post).mockRejectedValueOnce(
      new Error('Failed to get signed URL')
    );

    const { result } = renderHook(() => useFileUpload());

    await result.current.uploadFile(mockFile);

    await waitFor(() => {
      expect(result.current.status).toBe('error');
      expect(result.current.error).toBe('Failed to get signed URL');
    });
  });

  it('should handle errors during GCS upload', async () => {
    const mockSignedUrl = 'https://storage.googleapis.com/test-bucket/test.pdf';
    const mockStorageKey = 'uploads/123/test.pdf';

    vi.mocked(httpClient.post).mockResolvedValueOnce({
      signedUrl: mockSignedUrl,
      storageKey: mockStorageKey,
    });

    mockedAxios.put.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useFileUpload());

    await result.current.uploadFile(mockFile);

    await waitFor(() => {
      expect(result.current.status).toBe('error');
      expect(result.current.error).toBe('Network error');
    });
  });

  it('should handle errors during complete-upload', async () => {
    const mockSignedUrl = 'https://storage.googleapis.com/test-bucket/test.pdf';
    const mockStorageKey = 'uploads/123/test.pdf';

    vi.mocked(httpClient.post)
      .mockResolvedValueOnce({
        signedUrl: mockSignedUrl,
        storageKey: mockStorageKey,
      })
      .mockRejectedValueOnce(new Error('Verification failed'));

    mockedAxios.put.mockResolvedValueOnce({ status: 200 });

    const { result } = renderHook(() => useFileUpload());

    await result.current.uploadFile(mockFile);

    await waitFor(() => {
      expect(result.current.status).toBe('error');
      expect(result.current.error).toBe('Verification failed');
    });
  });

  it('should reset state', async () => {
    const { result } = renderHook(() => useFileUpload());

    // Set some state
    vi.mocked(httpClient.post).mockRejectedValueOnce(new Error('Test error'));
    await result.current.uploadFile(mockFile);

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });

    // Reset
    result.current.reset();

    await waitFor(() => {
      expect(result.current.status).toBe('idle');
      expect(result.current.progress).toBe(0);
      expect(result.current.error).toBeNull();
      expect(result.current.uploadedFile).toBeNull();
    });
  });

  it('should delete uploaded file', async () => {
    const mockStorageKey = 'uploads/123/test.pdf';

    vi.mocked(httpClient.delete).mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useFileUpload());

    await result.current.deleteFile(mockStorageKey);

    expect(httpClient.delete).toHaveBeenCalledWith(
      `/api/v2/files/${encodeURIComponent(mockStorageKey)}`
    );
  });
});
