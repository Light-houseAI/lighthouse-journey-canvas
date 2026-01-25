/**
 * Company Docs Upload Modal
 *
 * Modal for uploading company documentation (PDF/DOCX) for RAG-based insights.
 * Shows upload progress, processing status, and document list.
 */

import { Button } from '@journey/components';
import { CheckCircle, FileText, Loader2, Trash2, Upload, X, XCircle } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { useAnalytics, AnalyticsEvents } from '../../hooks/useAnalytics';
import {
  type CompanyDocument,
  deleteCompanyDocument,
  getDocumentStatus,
  listCompanyDocuments,
  uploadCompanyDocument,
} from '../../services/company-documents-api';

interface CompanyDocsUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type UploadState = 'idle' | 'uploading' | 'processing' | 'success' | 'error';

export function CompanyDocsUploadModal({ isOpen, onClose }: CompanyDocsUploadModalProps) {
  const [documents, setDocuments] = useState<CompanyDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [processingDocId, setProcessingDocId] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { track } = useAnalytics();

  // Load documents on open
  useEffect(() => {
    if (isOpen) {
      loadDocuments();
    }
  }, [isOpen]);

  // Poll for processing status
  useEffect(() => {
    if (!processingDocId) return;

    const pollInterval = setInterval(async () => {
      try {
        const status = await getDocumentStatus(processingDocId);
        // httpClient unwraps to data level, so access directly
        if (status.processingStatus === 'completed') {
          setProcessingDocId(null);
          setUploadState('success');
          loadDocuments();
        } else if (status.processingStatus === 'failed') {
          setProcessingDocId(null);
          setUploadState('error');
          setUploadError(status.processingError || 'Processing failed');
          loadDocuments();
        }
      } catch (error) {
        console.error('Failed to poll document status:', error);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [processingDocId]);

  const loadDocuments = async () => {
    setIsLoading(true);
    try {
      const response = await listCompanyDocuments();
      // httpClient unwraps to data level, so access directly
      setDocuments(response.documents);
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const file = files[0];
      setUploadState('uploading');
      setUploadError(null);

      track(AnalyticsEvents.BUTTON_CLICKED, {
        button_name: 'upload_document',
        file_type: file.type,
        file_size: file.size,
      });

      try {
        const response = await uploadCompanyDocument(file);
        setUploadState('processing');
        // httpClient unwraps to data level, so access directly
        setProcessingDocId(response.documentId);
        loadDocuments();
      } catch (error) {
        setUploadState('error');
        setUploadError(error instanceof Error ? error.message : 'Upload failed');
      }
    },
    [track]
  );

  const handleDelete = async (documentId: number) => {
    try {
      await deleteCompanyDocument(documentId);
      track(AnalyticsEvents.BUTTON_CLICKED, {
        button_name: 'delete_document',
        document_id: documentId,
      });
      loadDocuments();
    } catch (error) {
      console.error('Failed to delete document:', error);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusBadge = (status: CompanyDocument['processingStatus']) => {
    switch (status) {
      case 'pending':
        return (
          <span className="flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">
            <Loader2 className="h-3 w-3 animate-spin" />
            Pending
          </span>
        );
      case 'processing':
        return (
          <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
            <Loader2 className="h-3 w-3 animate-spin" />
            Processing
          </span>
        );
      case 'completed':
        return (
          <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
            <CheckCircle className="h-3 w-3" />
            Ready
          </span>
        );
      case 'failed':
        return (
          <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
            <XCircle className="h-3 w-3" />
            Failed
          </span>
        );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Company Documents</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Description */}
        <p className="mb-4 text-sm text-gray-600">
          Upload company documentation (PDF or DOCX) to enhance AI insights with your internal
          knowledge base.
        </p>

        {/* Upload Zone */}
        <div
          className={`mb-4 rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {uploadState === 'uploading' ? (
            <div className="flex flex-col items-center">
              <Loader2 className="mb-2 h-8 w-8 animate-spin text-indigo-600" />
              <p className="text-sm text-gray-600">Uploading...</p>
            </div>
          ) : uploadState === 'processing' ? (
            <div className="flex flex-col items-center">
              <Loader2 className="mb-2 h-8 w-8 animate-spin text-blue-600" />
              <p className="text-sm text-gray-600">Processing document...</p>
              <p className="mt-1 text-xs text-gray-500">
                This may take a few moments for larger files
              </p>
            </div>
          ) : uploadState === 'success' ? (
            <div className="flex flex-col items-center">
              <CheckCircle className="mb-2 h-8 w-8 text-green-600" />
              <p className="text-sm text-green-600">Document uploaded successfully!</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => setUploadState('idle')}
              >
                Upload another
              </Button>
            </div>
          ) : uploadState === 'error' ? (
            <div className="flex flex-col items-center">
              <XCircle className="mb-2 h-8 w-8 text-red-600" />
              <p className="text-sm text-red-600">{uploadError}</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => setUploadState('idle')}
              >
                Try again
              </Button>
            </div>
          ) : (
            <>
              <Upload className="mx-auto mb-2 h-8 w-8 text-gray-400" />
              <p className="text-sm text-gray-600">
                Drag and drop a file here, or{' '}
                <label className="cursor-pointer font-medium text-indigo-600 hover:text-indigo-500">
                  browse
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(e) => handleFileSelect(e.target.files)}
                  />
                </label>
              </p>
              <p className="mt-1 text-xs text-gray-500">PDF or DOCX up to 1GB</p>
            </>
          )}
        </div>

        {/* Document List */}
        <div className="max-h-64 overflow-y-auto">
          <h3 className="mb-2 text-sm font-medium text-gray-700">Uploaded Documents</h3>
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : documents.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">No documents uploaded yet</p>
          ) : (
            <ul className="space-y-2">
              {documents.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{doc.filename}</p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(doc.sizeBytes)}
                        {doc.chunkCount > 0 && ` | ${doc.chunkCount} chunks`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(doc.processingStatus)}
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                      title="Delete document"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  );
}
