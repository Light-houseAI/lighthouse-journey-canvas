/**
 * Download File Block Component
 *
 * Renders a downloadable file with preview, copy, and download functionality.
 * Used within AI chat messages to display generated files.
 */

import React, { useState, useCallback } from 'react';
import { Download, Check, FileText, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { downloadFile } from '../../utils/download-file-parser';

interface DownloadFileBlockProps {
  filename: string;
  content: string;
  mimeType: string;
  language?: string;
}

export function DownloadFileBlock({
  filename,
  content,
  mimeType,
  language,
}: DownloadFileBlockProps) {
  const [downloaded, setDownloaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleDownload = useCallback(() => {
    downloadFile(filename, content, mimeType);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  }, [filename, content, mimeType]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-indigo-200 bg-indigo-50">
      {/* Header with filename and action buttons */}
      <div className="flex items-center justify-between border-b border-indigo-200 bg-indigo-100 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-indigo-600" />
          <span className="text-sm font-medium text-indigo-900">{filename}</span>
          {language && (
            <span className="rounded bg-indigo-200 px-1.5 py-0.5 text-xs font-medium text-indigo-700">
              {language}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-indigo-600 transition-colors hover:bg-indigo-200"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>Copy</span>
              </>
            )}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-700"
          >
            {downloaded ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Downloaded!</span>
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                <span>Download</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Preview toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-1 px-4 py-2 text-left text-xs text-indigo-600 hover:bg-indigo-100"
      >
        {isExpanded ? (
          <>
            <ChevronUp className="h-3 w-3" />
            <span>Hide preview</span>
          </>
        ) : (
          <>
            <ChevronDown className="h-3 w-3" />
            <span>Show preview</span>
          </>
        )}
      </button>

      {/* Collapsible content preview */}
      {isExpanded && (
        <div className="max-h-60 overflow-auto border-t border-indigo-200 bg-gray-900 p-4">
          <pre className="text-sm text-gray-100 whitespace-pre-wrap">
            <code>{content}</code>
          </pre>
        </div>
      )}
    </div>
  );
}

export default DownloadFileBlock;
