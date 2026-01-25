/**
 * Company Document Processing Service
 *
 * Orchestrates the full document processing pipeline:
 * 1. Download document from cloud storage
 * 2. Parse document (PDF/DOCX)
 * 3. Chunk document with semantic splitting
 * 4. Generate embeddings for chunks
 * 5. Store chunks in graphrag_chunks
 * 6. Create graph edges between sequential chunks
 */

import { v4 as uuidv4 } from 'uuid';
import type { Logger } from '../core/logger.js';
import type { EmbeddingService } from './interfaces/embedding.service.interface.js';
import type { CompanyDocumentRepository } from '../repositories/company-document.repository.js';
import type { DocumentParserService } from './document-parser.service.js';
import type { DocumentChunkerService, DocumentChunk } from './document-chunker.service.js';
import type { Pool } from 'pg';

// ============================================================================
// TYPES
// ============================================================================

export interface CompanyDocumentProcessingServiceDeps {
  logger: Logger;
  embeddingService: EmbeddingService;
  companyDocumentRepository: CompanyDocumentRepository;
  documentParserService: DocumentParserService;
  documentChunkerService: DocumentChunkerService;
  pool: Pool;
  downloadDocument: (storageKey: string) => Promise<Buffer>;
}

export interface ProcessingResult {
  documentId: number;
  chunkCount: number;
  edgeCount: number;
  processingTimeMs: number;
}

// ============================================================================
// SERVICE
// ============================================================================

export class CompanyDocumentProcessingService {
  private readonly logger: Logger;
  private readonly embeddingService: EmbeddingService;
  private readonly companyDocRepository: CompanyDocumentRepository;
  private readonly documentParser: DocumentParserService;
  private readonly documentChunker: DocumentChunkerService;
  private readonly pool: Pool;
  private readonly downloadDocument: (storageKey: string) => Promise<Buffer>;

  // In-memory job queue for background processing
  private processingQueue: Map<number, { status: string; error?: string }> = new Map();

  constructor(deps: CompanyDocumentProcessingServiceDeps) {
    this.logger = deps.logger;
    this.embeddingService = deps.embeddingService;
    this.companyDocRepository = deps.companyDocumentRepository;
    this.documentParser = deps.documentParserService;
    this.documentChunker = deps.documentChunkerService;
    this.pool = deps.pool;
    this.downloadDocument = deps.downloadDocument;
  }

  /**
   * Queue a document for background processing
   */
  async queueProcessing(documentId: number): Promise<void> {
    this.logger.info('Queueing document for processing', { documentId });

    // Mark as queued
    this.processingQueue.set(documentId, { status: 'queued' });

    // Process in background (don't await)
    this.processDocumentAsync(documentId).catch((error) => {
      this.logger.error('Background processing failed', { documentId, error });
    });
  }

  /**
   * Process a document asynchronously
   */
  private async processDocumentAsync(documentId: number): Promise<void> {
    const startTime = Date.now();

    try {
      const result = await this.processDocument(documentId);
      this.processingQueue.set(documentId, { status: 'completed' });

      this.logger.info('Document processing completed', {
        documentId,
        chunkCount: result.chunkCount,
        edgeCount: result.edgeCount,
        processingTimeMs: result.processingTimeMs,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.processingQueue.set(documentId, { status: 'failed', error: errorMessage });

      this.logger.error('Document processing failed', {
        documentId,
        error: errorMessage,
        processingTimeMs: Date.now() - startTime,
      });
    }
  }

  /**
   * Process a document (main pipeline)
   */
  async processDocument(documentId: number): Promise<ProcessingResult> {
    const startTime = Date.now();

    // 1. Get document metadata
    const document = await this.companyDocRepository.findById(documentId);
    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    this.logger.info('Processing document', {
      documentId,
      filename: document.filename,
      mimeType: document.mimeType,
    });

    // 2. Update status to processing
    await this.companyDocRepository.updateProcessingStatus(documentId, 'processing');

    try {
      // 3. Download document from storage
      const buffer = await this.downloadDocument(document.storageKey);

      // 4. Parse document
      const parsed = await this.documentParser.parseDocument(
        buffer,
        document.mimeType,
        document.filename
      );

      // 5. Chunk document
      const chunks = this.documentChunker.chunkDocument(parsed, {
        chunkSize: 1000,
        chunkOverlap: 200,
        minChunkSize: 100,
      });

      // 6. Generate embeddings in batches
      const embeddings = await this.generateEmbeddingsBatch(chunks);

      // 7. Store chunks in database
      const chunkIds = await this.storeChunks(
        document.userId,
        documentId,
        document.filename,
        chunks,
        embeddings
      );

      // 8. Create edges between sequential chunks
      const edgeCount = await this.createChunkEdges(chunkIds);

      // 9. Update document status to completed
      await this.companyDocRepository.updateProcessingStatus(
        documentId,
        'completed',
        undefined,
        chunks.length
      );

      const processingTimeMs = Date.now() - startTime;

      return {
        documentId,
        chunkCount: chunks.length,
        edgeCount,
        processingTimeMs,
      };
    } catch (error) {
      // Update status to failed
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.companyDocRepository.updateProcessingStatus(
        documentId,
        'failed',
        errorMessage
      );
      throw error;
    }
  }

  /**
   * Generate embeddings for chunks in batches
   */
  private async generateEmbeddingsBatch(
    chunks: DocumentChunk[]
  ): Promise<Float32Array[]> {
    this.logger.info('Generating embeddings for chunks', { chunkCount: chunks.length });

    const texts = chunks.map((c) => c.text);
    const batchSize = 20; // Process in batches to avoid rate limits
    const embeddings: Float32Array[] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchEmbeddings = await this.embeddingService.generateEmbeddings(batch);
      embeddings.push(...batchEmbeddings);

      this.logger.debug('Embedding batch processed', {
        batchStart: i,
        batchSize: batch.length,
        totalProcessed: embeddings.length,
      });
    }

    return embeddings;
  }

  /**
   * Store chunks in graphrag_chunks table
   */
  private async storeChunks(
    userId: number,
    documentId: number,
    filename: string,
    chunks: DocumentChunk[],
    embeddings: Float32Array[]
  ): Promise<number[]> {
    this.logger.info('Storing chunks in database', { chunkCount: chunks.length });

    const chunkIds: number[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = embeddings[i];

      // Convert Float32Array to string format for pgvector
      const embeddingStr = `[${Array.from(embedding).join(',')}]`;

      const result = await this.pool.query<{ id: number }>(
        `INSERT INTO graphrag_chunks (
          user_id,
          chunk_text,
          embedding,
          node_type,
          meta,
          tenant_id
        ) VALUES ($1, $2, $3::vector, $4, $5, $6)
        RETURNING id`,
        [
          userId,
          chunk.text,
          embeddingStr,
          'company_document',
          JSON.stringify({
            documentId,
            documentType: filename.endsWith('.pdf') ? 'pdf' : 'docx',
            pageNumber: chunk.pageNumber,
            sectionTitle: chunk.metadata.sectionTitle,
            chunkIndex: chunk.chunkIndex,
            isCompanyDoc: true,
            filename,
          }),
          'default',
        ]
      );

      chunkIds.push(result.rows[0].id);
    }

    return chunkIds;
  }

  /**
   * Create edges between sequential chunks
   */
  private async createChunkEdges(chunkIds: number[]): Promise<number> {
    if (chunkIds.length < 2) {
      return 0;
    }

    this.logger.info('Creating chunk edges', { chunkCount: chunkIds.length });

    let edgeCount = 0;

    for (let i = 0; i < chunkIds.length - 1; i++) {
      const srcChunkId = chunkIds[i];
      const dstChunkId = chunkIds[i + 1];

      await this.pool.query(
        `INSERT INTO graphrag_edges (
          src_chunk_id,
          dst_chunk_id,
          rel_type,
          weight,
          directed,
          meta
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          srcChunkId,
          dstChunkId,
          'sequential', // Sequential relationship
          1.0,
          true,
          JSON.stringify({ documentSequence: true }),
        ]
      );

      edgeCount++;
    }

    return edgeCount;
  }

  /**
   * Get processing status for a document
   */
  getProcessingStatus(documentId: number): { status: string; error?: string } | null {
    return this.processingQueue.get(documentId) || null;
  }
}
