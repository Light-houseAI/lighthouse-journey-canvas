/**
 * Document Parser Service
 *
 * Parses PDF and DOCX documents into text content with page/section metadata.
 * Uses pdf-parse for PDFs and mammoth for DOCX files.
 */

import { createRequire } from 'module';
import type { Logger } from '../core/logger.js';

// Use createRequire for CommonJS modules in ESM context
const require = createRequire(import.meta.url);

// ============================================================================
// TYPES
// ============================================================================

export interface ParsedDocument {
  content: string;
  pageCount: number;
  metadata: {
    title?: string;
    author?: string;
    createdDate?: string;
    modifiedDate?: string;
  };
  pages: Array<{
    pageNumber: number;
    content: string;
  }>;
}

export interface DocumentParserServiceDeps {
  logger: Logger;
}

// ============================================================================
// SERVICE
// ============================================================================

export class DocumentParserService {
  private readonly logger: Logger;

  constructor(deps: DocumentParserServiceDeps) {
    this.logger = deps.logger;
  }

  /**
   * Parse a document from a buffer
   */
  async parseDocument(
    buffer: Buffer,
    mimeType: string,
    filename: string
  ): Promise<ParsedDocument> {
    this.logger.info('Parsing document', { filename, mimeType, size: buffer.length });

    if (mimeType === 'application/pdf') {
      return this.parsePDF(buffer, filename);
    } else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      filename.endsWith('.docx')
    ) {
      return this.parseDOCX(buffer, filename);
    } else {
      throw new Error(`Unsupported document type: ${mimeType}`);
    }
  }

  /**
   * Parse a PDF document
   */
  private async parsePDF(buffer: Buffer, filename: string): Promise<ParsedDocument> {
    try {
      // Use require for CommonJS module pdf-parse
      const pdfParse = require('pdf-parse');

      const data = await pdfParse(buffer);

      this.logger.info('PDF parsed successfully', {
        filename,
        pageCount: data.numpages,
        contentLength: data.text.length,
      });

      // pdf-parse doesn't provide per-page content directly,
      // so we'll treat the whole document as one "page" for now
      // In production, we could use pdf.js or similar for page-level extraction
      const pages: Array<{ pageNumber: number; content: string }> = [];

      // Simple heuristic: split by form feeds or multiple newlines
      const pageDelimiter = /\f|\n{4,}/g;
      const rawPages = data.text.split(pageDelimiter).filter((p: string) => p.trim());

      for (let i = 0; i < rawPages.length; i++) {
        pages.push({
          pageNumber: i + 1,
          content: rawPages[i].trim(),
        });
      }

      // If no clear page breaks, treat as single page
      if (pages.length === 0) {
        pages.push({
          pageNumber: 1,
          content: data.text.trim(),
        });
      }

      return {
        content: data.text,
        pageCount: data.numpages || pages.length,
        metadata: {
          title: data.info?.Title || filename,
          author: data.info?.Author,
          createdDate: data.info?.CreationDate,
          modifiedDate: data.info?.ModDate,
        },
        pages,
      };
    } catch (error) {
      this.logger.error('Failed to parse PDF', { filename, error });
      throw new Error(`PDF parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse a DOCX document
   */
  private async parseDOCX(buffer: Buffer, filename: string): Promise<ParsedDocument> {
    try {
      // Use require for CommonJS module mammoth
      const mammoth = require('mammoth');

      const result = await mammoth.extractRawText({ buffer });

      this.logger.info('DOCX parsed successfully', {
        filename,
        contentLength: result.value.length,
        messages: result.messages.length,
      });

      // DOCX doesn't have pages in the same way, so we split by section breaks
      // or treat as single page
      const content = result.value;
      const pages: Array<{ pageNumber: number; content: string }> = [];

      // Split by common section delimiters
      const sections = content.split(/\n{3,}/).filter((s: string) => s.trim());

      if (sections.length > 1) {
        for (let i = 0; i < sections.length; i++) {
          pages.push({
            pageNumber: i + 1,
            content: sections[i].trim(),
          });
        }
      } else {
        pages.push({
          pageNumber: 1,
          content: content.trim(),
        });
      }

      return {
        content,
        pageCount: pages.length,
        metadata: {
          title: filename,
        },
        pages,
      };
    } catch (error) {
      this.logger.error('Failed to parse DOCX', { filename, error });
      throw new Error(`DOCX parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get supported MIME types
   */
  getSupportedMimeTypes(): string[] {
    return [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
  }

  /**
   * Check if a MIME type is supported
   */
  isSupportedMimeType(mimeType: string): boolean {
    return this.getSupportedMimeTypes().includes(mimeType);
  }
}
