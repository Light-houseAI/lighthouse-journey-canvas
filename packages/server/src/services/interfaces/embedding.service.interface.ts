/**
 * Embedding Service Interface
 */

export interface EmbeddingService {
  generateEmbedding(text: string): Promise<Float32Array>;
  generateEmbeddings(texts: string[]): Promise<Float32Array[]>;
}
