/**
 * Company Docs Upload Button
 *
 * Sidebar button that opens the document upload modal.
 * Used to upload company documentation for RAG-based insights.
 */

import { Button } from '@journey/components';
import { FileUp } from 'lucide-react';
import React, { useState } from 'react';

import { useAnalytics, AnalyticsEvents } from '../../hooks/useAnalytics';
import { CompanyDocsUploadModal } from './CompanyDocsUploadModal';

interface CompanyDocsUploadButtonProps {
  className?: string;
}

export function CompanyDocsUploadButton({ className = '' }: CompanyDocsUploadButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { track } = useAnalytics();

  const handleClick = () => {
    track(AnalyticsEvents.BUTTON_CLICKED, {
      button_name: 'company_docs_upload',
      button_location: 'sidebar',
    });
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
  };

  return (
    <>
      <Button
        onClick={handleClick}
        variant="ghost"
        className={`flex h-10 w-10 items-center justify-center rounded-lg p-0 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700 ${className}`}
        aria-label="Upload Company Documents"
        title="Upload Company Documents"
      >
        <FileUp className="h-5 w-5" />
      </Button>

      <CompanyDocsUploadModal isOpen={isModalOpen} onClose={handleModalClose} />
    </>
  );
}
