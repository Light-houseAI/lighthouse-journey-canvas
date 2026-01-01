/**
 * Entity Extraction Service
 *
 * Extracts entities (technologies, tools, organizations) and concepts
 * from workflow screenshot summaries using LLM.
 *
 * Features:
 * - Batch processing for efficiency
 * - Confidence scoring
 * - Entity classification (technology, tool, person, organization)
 * - Concept extraction with relevance scores
 * - Embedding generation for similarity search
 */

import { z } from 'zod';

import type { LLMProvider } from '../core/llm-provider.js';
import type { Logger } from '../core/logger.js';
import type { EmbeddingService } from './interfaces/embedding.service.interface.js';

// ============================================================================
// TYPES AND SCHEMAS
// ============================================================================

export interface ExtractedEntity {
  name: string;
  type: 'technology' | 'tool' | 'person' | 'organization' | 'other';
  confidence: number;
  context?: string;
}

export interface ExtractedConcept {
  name: string;
  category: string;
  relevanceScore: number;
}

export interface ExtractionResult {
  entities: ExtractedEntity[];
  concepts: ExtractedConcept[];
  processingTimeMs: number;
}

/**
 * Schema for LLM extraction output
 */
const EntityExtractionSchema = z.object({
  entities: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        type: z.enum(['technology', 'tool', 'person', 'organization', 'other']),
        confidence: z.number().min(0).max(1),
        context: z.string().optional(),
      })
    )
    .max(20)
    .describe('List of entities extracted from the text'),
  concepts: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        category: z.string().min(1).max(50),
        relevanceScore: z.number().min(0).max(1),
      })
    )
    .max(10)
    .describe('List of concepts extracted from the text'),
});

// ============================================================================
// ENTITY EXTRACTION SERVICE
// ============================================================================

export class EntityExtractionService {
  private llmProvider: LLMProvider;
  private embeddingService: EmbeddingService;
  private logger: Logger;

  constructor({
    llmProvider,
    openAIEmbeddingService,
    logger,
  }: {
    llmProvider: LLMProvider;
    openAIEmbeddingService: EmbeddingService;
    logger: Logger;
  }) {
    this.llmProvider = llmProvider;
    this.embeddingService = openAIEmbeddingService;
    this.logger = logger;

    // Log service initialization
    this.logger.warn('[ENTITY_EXTRACTION] Service initialized', {
      hasLLMProvider: !!llmProvider,
      hasEmbeddingService: !!openAIEmbeddingService,
    });
  }

  /**
   * Extract entities and concepts from a single text
   */
  async extractFromText(text: string): Promise<ExtractionResult> {
    const startTime = Date.now();

    // Skip empty or very short texts
    if (!text || text.trim().length < 10) {
      this.logger.warn('[ENTITY_EXTRACTION] Skipping empty/short text', {
        textLength: text?.length || 0,
        textPreview: text?.substring(0, 50) || 'empty',
      });
      return {
        entities: [],
        concepts: [],
        processingTimeMs: Date.now() - startTime,
      };
    }

    this.logger.warn('[ENTITY_EXTRACTION] Starting extraction', {
      textLength: text.length,
      textPreview: text.substring(0, 100),
    });

    try {
      const prompt = this.buildExtractionPrompt(text);

      this.logger.warn('[ENTITY_EXTRACTION] Calling LLM', {
        promptLength: prompt.length,
      });

      const response = await this.llmProvider.generateStructuredResponse(
        [
          {
            role: 'system',
            content: this.getSystemPrompt(),
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        EntityExtractionSchema,
        {
          temperature: 0.1, // Low temperature for consistent extraction
          maxTokens: 500,
        }
      );

      const processingTime = Date.now() - startTime;

      this.logger.warn('[ENTITY_EXTRACTION] LLM response received', {
        entitiesCount: response.content.entities.length,
        conceptsCount: response.content.concepts.length,
        processingTimeMs: processingTime,
        sampleEntities: response.content.entities.slice(0, 2),
        sampleConcepts: response.content.concepts.slice(0, 2),
      });

      return {
        entities: response.content.entities,
        concepts: response.content.concepts,
        processingTimeMs: processingTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.warn('[ENTITY_EXTRACTION] FAILED - LLM error', {
        error: errorMessage,
        errorStack: errorStack?.substring(0, 500),
        textLength: text.length,
        textPreview: text.substring(0, 100),
      });

      // Return empty result on error
      return {
        entities: [],
        concepts: [],
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Extract entities and concepts from multiple texts in batch
   * Processes in chunks for efficiency
   */
  async extractBatch(
    texts: string[],
    batchSize: number = 10
  ): Promise<ExtractionResult[]> {
    const results: ExtractionResult[] = [];

    // Log batch start with sample data
    const nonEmptyTexts = texts.filter(t => t && t.trim().length >= 10);
    this.logger.warn('[ENTITY_EXTRACTION] Starting batch extraction', {
      totalTexts: texts.length,
      nonEmptyTexts: nonEmptyTexts.length,
      batchSize,
      sampleText: texts[0]?.substring(0, 150) || 'empty',
    });

    // Process in batches
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      this.logger.warn('[ENTITY_EXTRACTION] Processing batch', {
        batchIndex: Math.floor(i / batchSize) + 1,
        totalBatches: Math.ceil(texts.length / batchSize),
        batchSize: batch.length,
      });

      // Process batch items in parallel
      const batchResults = await Promise.all(
        batch.map((text) => this.extractFromText(text))
      );

      results.push(...batchResults);

      // Log batch results
      const batchEntities = batchResults.reduce((sum, r) => sum + r.entities.length, 0);
      const batchConcepts = batchResults.reduce((sum, r) => sum + r.concepts.length, 0);
      this.logger.warn('[ENTITY_EXTRACTION] Batch complete', {
        batchIndex: Math.floor(i / batchSize) + 1,
        batchEntities,
        batchConcepts,
      });
    }

    const totalEntities = results.reduce(
      (sum, r) => sum + r.entities.length,
      0
    );
    const totalConcepts = results.reduce(
      (sum, r) => sum + r.concepts.length,
      0
    );
    const avgProcessingTime =
      results.reduce((sum, r) => sum + r.processingTimeMs, 0) / results.length;

    this.logger.warn('[ENTITY_EXTRACTION] Batch extraction complete', {
      textsProcessed: texts.length,
      totalEntities,
      totalConcepts,
      avgProcessingTimeMs: Math.round(avgProcessingTime),
    });

    return results;
  }

  /**
   * Generate embedding for an entity or concept
   */
  async generateEmbedding(text: string): Promise<Float32Array> {
    try {
      const embedding = await this.embeddingService.generateEmbedding(text);
      return new Float32Array(embedding);
    } catch (error) {
      this.logger.error('Failed to generate embedding', {
        error: error instanceof Error ? error.message : String(error),
        text: text.substring(0, 100),
      });
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateEmbeddings(texts: string[]): Promise<Float32Array[]> {
    try {
      this.logger.debug('Generating batch embeddings', { count: texts.length });
      const embeddings = await this.embeddingService.generateEmbeddings(texts);
      this.logger.debug('Batch embeddings generated', { count: embeddings.length });
      return embeddings;
    } catch (error) {
      this.logger.error('Failed to generate batch embeddings', {
        error: error instanceof Error ? error.message : String(error),
        count: texts.length,
      });
      throw error;
    }
  }

  /**
   * Build extraction prompt for LLM
   */
  private buildExtractionPrompt(text: string): string {
    return `Analyze the following workflow activity description and extract:
1. **Entities**: Technologies, tools, people, organizations mentioned
2. **Concepts**: High-level concepts, methodologies, or activities being performed

Activity Description:
"${text}"

## Instructions

### Entities
Extract specific technologies, tools, people, or organizations mentioned:
- **Technologies**: Programming languages (JavaScript, Python), frameworks (React, Django), databases (PostgreSQL, MongoDB), etc.
- **Tools**: Software applications (VSCode, Chrome, Terminal, Figma, Slack, etc.)
- **People**: Specific people mentioned by name
- **Organizations**: Companies, institutions, or groups mentioned

For each entity, provide:
- **name**: The exact name (e.g., "React", "VSCode", "PostgreSQL")
- **type**: One of: technology, tool, person, organization, other
- **confidence**: 0.0 to 1.0 (how confident you are this is correctly identified)
- **context**: Optional brief context (e.g., "used for frontend development")

### Concepts
Extract high-level concepts or activities:
- Programming concepts (e.g., "API design", "authentication", "testing", "debugging")
- Work activities (e.g., "code review", "documentation", "refactoring")
- Methodologies (e.g., "agile", "test-driven development")
- Domain areas (e.g., "frontend development", "backend systems", "data analysis")

For each concept, provide:
- **name**: The concept name (e.g., "Authentication", "API Design")
- **category**: Category like "programming", "methodology", "domain", "activity"
- **relevanceScore**: 0.0 to 1.0 (how relevant this concept is to the description)

## Guidelines
- Only extract entities/concepts that are clearly mentioned or strongly implied
- Prefer specific names over generic terms (e.g., "React" over "framework")
- Use standard/canonical names (e.g., "JavaScript" not "JS")
- Confidence should reflect certainty of extraction
- If nothing is clearly identifiable, return empty arrays
- Limit to the most important/relevant items`;
  }

  /**
   * Get system prompt for entity extraction
   */
  private getSystemPrompt(): string {
    return `You are an expert at extracting structured information from workflow activity descriptions.

Your task is to identify:
1. Specific entities (technologies, tools, people, organizations)
2. High-level concepts (programming concepts, activities, methodologies)

Be precise and conservative - only extract items that are clearly present in the text.
Provide confidence scores based on how certain you are about each extraction.

Output valid JSON that matches the required schema exactly.`;
  }

  /**
   * Deduplicate entities by name (case-insensitive)
   * Keeps the one with highest confidence
   */
  deduplicateEntities(entities: ExtractedEntity[]): ExtractedEntity[] {
    const entityMap = new Map<string, ExtractedEntity>();

    for (const entity of entities) {
      const key = `${entity.name.toLowerCase()}_${entity.type}`;
      const existing = entityMap.get(key);

      if (!existing || entity.confidence > existing.confidence) {
        entityMap.set(key, entity);
      }
    }

    return Array.from(entityMap.values());
  }

  /**
   * Deduplicate concepts by name (case-insensitive)
   * Keeps the one with highest relevance score
   */
  deduplicateConcepts(concepts: ExtractedConcept[]): ExtractedConcept[] {
    const conceptMap = new Map<string, ExtractedConcept>();

    for (const concept of concepts) {
      const key = concept.name.toLowerCase();
      const existing = conceptMap.get(key);

      if (!existing || concept.relevanceScore > existing.relevanceScore) {
        conceptMap.set(key, concept);
      }
    }

    return Array.from(conceptMap.values());
  }

  /**
   * Filter entities by minimum confidence threshold
   */
  filterByConfidence(
    entities: ExtractedEntity[],
    minConfidence: number = 0.5
  ): ExtractedEntity[] {
    return entities.filter((e) => e.confidence >= minConfidence);
  }

  /**
   * Filter concepts by minimum relevance score
   */
  filterByRelevance(
    concepts: ExtractedConcept[],
    minRelevance: number = 0.5
  ): ExtractedConcept[] {
    return concepts.filter((c) => c.relevanceScore >= minRelevance);
  }

  /**
   * Aggregate entities from multiple extraction results
   * Merges and deduplicates
   */
  aggregateEntities(results: ExtractionResult[]): ExtractedEntity[] {
    const allEntities = results.flatMap((r) => r.entities);
    return this.deduplicateEntities(allEntities);
  }

  /**
   * Aggregate concepts from multiple extraction results
   * Merges and deduplicates
   */
  aggregateConcepts(results: ExtractionResult[]): ExtractedConcept[] {
    const allConcepts = results.flatMap((r) => r.concepts);
    return this.deduplicateConcepts(allConcepts);
  }
}
