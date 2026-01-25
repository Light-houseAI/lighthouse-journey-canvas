/**
 * Document Chunker Service
 *
 * Implements semantic chunking with overlap for RAG document processing.
 * Uses a recursive character splitter approach with configurable chunk size and overlap.
 */

import type { Logger } from '../core/logger.js';
import type { ParsedDocument } from './document-parser.service.js';

// ============================================================================
// TYPES
// ============================================================================

export interface DocumentChunk {
  text: string;
  pageNumber: number;
  chunkIndex: number;
  metadata: {
    sectionTitle?: string;
    startPosition: number;
    endPosition: number;
    wordCount: number;
  };
}

export interface ChunkingOptions {
  chunkSize?: number; // Target chunk size in characters
  chunkOverlap?: number; // Overlap between chunks in characters
  minChunkSize?: number; // Minimum chunk size to keep
}

export interface DocumentChunkerServiceDeps {
  logger: Logger;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CHUNK_SIZE = 1000; // characters (~200-250 tokens)
const DEFAULT_CHUNK_OVERLAP = 200; // characters (~40-50 tokens)
const DEFAULT_MIN_CHUNK_SIZE = 100; // characters

// Separators for recursive splitting (in order of preference)
const SEPARATORS = [
  '\n\n\n', // Triple newline (major section break)
  '\n\n',   // Double newline (paragraph break)
  '\n',     // Single newline
  '. ',     // Sentence end
  '? ',     // Question end
  '! ',     // Exclamation end
  '; ',     // Semicolon
  ', ',     // Comma
  ' ',      // Space
  '',       // Character-level fallback
];

// ============================================================================
// SERVICE
// ============================================================================

export class DocumentChunkerService {
  private readonly logger: Logger;

  constructor(deps: DocumentChunkerServiceDeps) {
    this.logger = deps.logger;
  }

  /**
   * Chunk a parsed document into overlapping chunks
   */
  chunkDocument(
    document: ParsedDocument,
    options: ChunkingOptions = {}
  ): DocumentChunk[] {
    const {
      chunkSize = DEFAULT_CHUNK_SIZE,
      chunkOverlap = DEFAULT_CHUNK_OVERLAP,
      minChunkSize = DEFAULT_MIN_CHUNK_SIZE,
    } = options;

    this.logger.info('Chunking document', {
      pageCount: document.pageCount,
      totalLength: document.content.length,
      chunkSize,
      chunkOverlap,
    });

    const allChunks: DocumentChunk[] = [];
    let globalChunkIndex = 0;

    // Process each page separately to preserve page information
    for (const page of document.pages) {
      const pageChunks = this.chunkText(
        page.content,
        chunkSize,
        chunkOverlap,
        minChunkSize
      );

      for (const chunk of pageChunks) {
        // Extract section title from first line if it looks like a header
        const sectionTitle = this.extractSectionTitle(chunk.text);

        allChunks.push({
          text: chunk.text,
          pageNumber: page.pageNumber,
          chunkIndex: globalChunkIndex++,
          metadata: {
            sectionTitle,
            startPosition: chunk.startPosition,
            endPosition: chunk.endPosition,
            wordCount: this.countWords(chunk.text),
          },
        });
      }
    }

    this.logger.info('Document chunked successfully', {
      totalChunks: allChunks.length,
      avgChunkSize: Math.round(
        allChunks.reduce((sum, c) => sum + c.text.length, 0) / allChunks.length
      ),
    });

    return allChunks;
  }

  /**
   * Chunk a single text using recursive character splitting
   */
  private chunkText(
    text: string,
    chunkSize: number,
    chunkOverlap: number,
    minChunkSize: number
  ): Array<{ text: string; startPosition: number; endPosition: number }> {
    const chunks: Array<{ text: string; startPosition: number; endPosition: number }> = [];

    if (!text || text.length === 0) {
      return chunks;
    }

    // If text is small enough, return as single chunk
    if (text.length <= chunkSize) {
      if (text.length >= minChunkSize) {
        chunks.push({
          text: text.trim(),
          startPosition: 0,
          endPosition: text.length,
        });
      }
      return chunks;
    }

    // Split text recursively using separators
    const splits = this.recursiveSplit(text, SEPARATORS, chunkSize);

    // Merge splits into chunks with overlap
    let currentChunk = '';
    let currentStart = 0;
    let position = 0;

    for (let i = 0; i < splits.length; i++) {
      const split = splits[i];

      // If adding this split exceeds chunk size, save current chunk and start new one
      if (currentChunk.length + split.length > chunkSize && currentChunk.length > 0) {
        if (currentChunk.trim().length >= minChunkSize) {
          chunks.push({
            text: currentChunk.trim(),
            startPosition: currentStart,
            endPosition: position,
          });
        }

        // Start new chunk with overlap
        const overlapText = this.getOverlapText(currentChunk, chunkOverlap);
        currentChunk = overlapText + split;
        currentStart = position - overlapText.length;
      } else {
        currentChunk += split;
      }

      position += split.length;
    }

    // Add final chunk
    if (currentChunk.trim().length >= minChunkSize) {
      chunks.push({
        text: currentChunk.trim(),
        startPosition: currentStart,
        endPosition: position,
      });
    }

    return chunks;
  }

  /**
   * Recursively split text using separators
   */
  private recursiveSplit(
    text: string,
    separators: string[],
    chunkSize: number
  ): string[] {
    if (separators.length === 0 || text.length <= chunkSize) {
      return [text];
    }

    const separator = separators[0];
    const remainingSeparators = separators.slice(1);

    // If separator is empty string, split by character
    if (separator === '') {
      return text.split('');
    }

    const parts = text.split(separator);
    const results: string[] = [];

    for (let i = 0; i < parts.length; i++) {
      let part = parts[i];

      // Add separator back (except for last part)
      if (i < parts.length - 1) {
        part += separator;
      }

      // If part is still too large, recursively split with next separator
      if (part.length > chunkSize && remainingSeparators.length > 0) {
        results.push(...this.recursiveSplit(part, remainingSeparators, chunkSize));
      } else {
        results.push(part);
      }
    }

    return results;
  }

  /**
   * Get overlap text from the end of a chunk
   */
  private getOverlapText(text: string, overlapSize: number): string {
    if (text.length <= overlapSize) {
      return text;
    }

    // Try to break at word boundary
    const overlapStart = text.length - overlapSize;
    const substring = text.substring(overlapStart);

    // Find first space to avoid breaking mid-word
    const firstSpaceIndex = substring.indexOf(' ');
    if (firstSpaceIndex !== -1 && firstSpaceIndex < overlapSize / 2) {
      return substring.substring(firstSpaceIndex + 1);
    }

    return substring;
  }

  /**
   * Extract section title from first line if it looks like a header
   */
  private extractSectionTitle(text: string): string | undefined {
    const firstLine = text.split('\n')[0]?.trim();

    if (!firstLine) {
      return undefined;
    }

    // Heuristics for detecting headers:
    // - Short line (less than 100 chars)
    // - Ends without period
    // - May start with number or be all caps
    const isLikelyHeader =
      firstLine.length < 100 &&
      !firstLine.endsWith('.') &&
      (
        /^\d+\.?\s+/.test(firstLine) || // Numbered header
        firstLine === firstLine.toUpperCase() || // All caps
        /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*$/.test(firstLine) // Title case
      );

    return isLikelyHeader ? firstLine : undefined;
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    return text.split(/\s+/).filter((word) => word.length > 0).length;
  }

  /**
   * Estimate token count (rough approximation)
   */
  estimateTokenCount(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters for English
    return Math.ceil(text.length / 4);
  }
}
