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
 * Raw extraction response from LLM (before validation)
 */
interface RawExtractionResponse {
  entities?: Array<{
    name?: string;
    type?: string;
    confidence?: number;
    context?: string;
  }>;
  concepts?: Array<{
    name?: string;
    category?: string;
    relevanceScore?: number;
  }>;
}

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
   * Uses plain text generation with JSON parsing (bypasses Zod schema issues)
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

      // Use generateText instead of generateStructuredResponse to bypass Zod schema issues
      const response = await this.llmProvider.generateText(
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
        {
          temperature: 0.1, // Low temperature for consistent extraction
          maxTokens: 1000,
        }
      );

      // Parse JSON from the response
      const parsed = this.parseJsonResponse(response.content);
      const processingTime = Date.now() - startTime;

      this.logger.warn('[ENTITY_EXTRACTION] LLM response received', {
        entitiesCount: parsed.entities.length,
        conceptsCount: parsed.concepts.length,
        processingTimeMs: processingTime,
        sampleEntities: parsed.entities.slice(0, 2),
        sampleConcepts: parsed.concepts.slice(0, 2),
      });

      return {
        entities: parsed.entities,
        concepts: parsed.concepts,
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
   * Parse JSON response from LLM, handling various formats
   */
  private parseJsonResponse(text: string): { entities: ExtractedEntity[]; concepts: ExtractedConcept[] } {
    try {
      // Try to extract JSON from the response (may be wrapped in markdown code blocks)
      let jsonStr = text.trim();

      // Remove markdown code blocks if present
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      // Parse the JSON
      const raw: RawExtractionResponse = JSON.parse(jsonStr);

      // Validate and transform entities
      const entities: ExtractedEntity[] = (raw.entities || [])
        .filter((e): e is { name: string; type: string; confidence: number; context?: string } =>
          typeof e.name === 'string' &&
          e.name.length > 0 &&
          typeof e.type === 'string' &&
          typeof e.confidence === 'number'
        )
        .map(e => ({
          name: e.name.substring(0, 100),
          type: this.validateEntityType(e.type),
          confidence: Math.min(1, Math.max(0, e.confidence)),
          context: e.context?.substring(0, 200),
        }))
        .slice(0, 20); // Max 20 entities

      // Validate and transform concepts
      const concepts: ExtractedConcept[] = (raw.concepts || [])
        .filter((c): c is { name: string; category: string; relevanceScore: number } =>
          typeof c.name === 'string' &&
          c.name.length > 0 &&
          typeof c.category === 'string' &&
          typeof c.relevanceScore === 'number'
        )
        .map(c => ({
          name: c.name.substring(0, 100),
          category: c.category.substring(0, 50),
          relevanceScore: Math.min(1, Math.max(0, c.relevanceScore)),
        }))
        .slice(0, 10); // Max 10 concepts

      return { entities, concepts };
    } catch (parseError) {
      this.logger.warn('[ENTITY_EXTRACTION] JSON parse failed', {
        error: parseError instanceof Error ? parseError.message : String(parseError),
        textPreview: text.substring(0, 200),
      });
      return { entities: [], concepts: [] };
    }
  }

  /**
   * Validate entity type, defaulting to 'other' if invalid
   */
  private validateEntityType(type: string): ExtractedEntity['type'] {
    const validTypes: ExtractedEntity['type'][] = ['technology', 'tool', 'person', 'organization', 'other'];
    const normalized = type.toLowerCase();
    return validTypes.includes(normalized as ExtractedEntity['type'])
      ? (normalized as ExtractedEntity['type'])
      : 'other';
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
      this.logger.warn('Failed to generate embedding', {
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
      this.logger.warn('Failed to generate batch embeddings', {
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
    return `Analyze the following workflow activity description and extract entities and concepts.

Activity Description:
"${text}"

Extract and return a JSON object with this exact structure:
{
  "entities": [
    {
      "name": "exact name like React, VSCode, PostgreSQL",
      "type": "technology|tool|person|organization|other",
      "confidence": 0.0 to 1.0,
      "context": "brief context (optional)"
    }
  ],
  "concepts": [
    {
      "name": "concept name like API Design, Authentication",
      "category": "programming|methodology|domain|activity",
      "relevanceScore": 0.0 to 1.0
    }
  ]
}

## Entity Types:
- **technology**: Programming languages, frameworks, databases (JavaScript, React, PostgreSQL)
- **tool**: Software applications (VSCode, Chrome, Terminal, Figma, Slack)
- **person**: People mentioned by name
- **organization**: Companies, institutions, groups
- **other**: Anything else specific

## Concept Categories:
- **programming**: API design, authentication, testing, debugging
- **methodology**: Agile, TDD, code review
- **domain**: Frontend development, backend systems, data analysis
- **activity**: Documentation, refactoring, deployment

## Guidelines:
- Only extract clearly mentioned or strongly implied items
- Use canonical names (JavaScript not JS)
- Return empty arrays if nothing is identifiable
- Limit to most important items (max 20 entities, 10 concepts)
- Return ONLY valid JSON, no markdown or explanation`;
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

IMPORTANT: Output ONLY valid JSON. No markdown code blocks, no explanations, just the JSON object.`;
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
