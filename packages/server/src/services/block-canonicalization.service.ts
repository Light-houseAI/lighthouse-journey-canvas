/**
 * Block Canonicalization Service
 *
 * Normalizes block names across sessions to enable pattern matching.
 * Uses a multi-strategy approach:
 * 1. Rule-based pattern matching (fast, deterministic)
 * 2. Embedding similarity to existing blocks (accurate for known patterns)
 * 3. LLM fallback for novel blocks
 */

import {
  BlockIntent,
  CanonicalizationMethod,
  type RawExtractedBlock,
  type CanonicalizedBlock,
} from '@journey/schema';

import type { Logger } from '../core/logger.js';
import { getManagedPrompt } from '../core/langfuse.js';
import type { OpenAIEmbeddingService } from './openai-embedding.service.js';

// ============================================================================
// TYPES
// ============================================================================

interface CanonicalBlockMapping {
  patterns: RegExp[];
  canonical: string;
  slug: string;
  intent: BlockIntent;
}

interface ExistingBlockMatch {
  _key: string;
  canonicalName: string;
  canonicalSlug: string;
  intent: BlockIntent;
  similarity: number;
}

interface LLMProvider {
  complete(prompt: string, options?: { model?: string; responseFormat?: string }): Promise<string>;
}

// Generic graph service interface for block canonicalization
interface GraphDBService {
  query<T>(query: any): Promise<T[]>;
}

// ============================================================================
// CANONICAL BLOCK MAPPINGS
// ============================================================================

/**
 * Rule-based mappings for common block patterns
 * These are fast and deterministic
 */
const CANONICAL_BLOCK_MAPPINGS: CanonicalBlockMapping[] = [
  // AI Prompting variants
  {
    patterns: [
      /cursor.*prompt/i,
      /ai.*prompt/i,
      /ai.*draft/i,
      /copilot.*suggest/i,
      /claude.*code/i,
      /windsurf.*edit/i,
      /chatgpt.*code/i,
      /gemini.*generat/i,
      /ai.*assist/i,
      /llm.*prompt/i,
    ],
    canonical: 'AI Code Prompting',
    slug: 'ai-code-prompting',
    intent: BlockIntent.AiPrompt,
  },

  // Code editing variants
  {
    patterns: [
      /manual.*edit/i,
      /code.*modif/i,
      /typing.*code/i,
      /writing.*code/i,
      /implement/i,
      /^editing/i,
      /code.*change/i,
    ],
    canonical: 'Manual Code Editing',
    slug: 'manual-code-editing',
    intent: BlockIntent.CodeEdit,
  },

  // Refactoring
  {
    patterns: [
      /refactor/i,
      /restructur/i,
      /reorganiz/i,
      /code.*cleanup/i,
      /code.*improvement/i,
    ],
    canonical: 'Code Refactoring',
    slug: 'code-refactoring',
    intent: BlockIntent.CodeEdit,
  },

  // Bug fixing
  {
    patterns: [
      /bug.*fix/i,
      /fix.*bug/i,
      /debug.*fix/i,
      /error.*fix/i,
      /issue.*resolv/i,
      /fixing/i,
    ],
    canonical: 'Bug Fixing',
    slug: 'bug-fixing',
    intent: BlockIntent.Debugging,
  },

  // Git operations
  {
    patterns: [
      /git.*commit/i,
      /commit.*change/i,
      /stage.*file/i,
      /push.*remote/i,
      /pull.*request/i,
      /merge.*branch/i,
      /git.*push/i,
      /git.*pull/i,
      /branch.*switch/i,
      /checkout/i,
    ],
    canonical: 'Git Operations',
    slug: 'git-operations',
    intent: BlockIntent.GitOperation,
  },

  // Terminal commands
  {
    patterns: [
      /terminal.*command/i,
      /run.*script/i,
      /npm.*install/i,
      /yarn.*add/i,
      /docker.*run/i,
      /cli.*operation/i,
      /command.*line/i,
      /shell.*command/i,
      /running.*test/i,
      /build.*project/i,
    ],
    canonical: 'Terminal Commands',
    slug: 'terminal-commands',
    intent: BlockIntent.TerminalCommand,
  },

  // Code review
  {
    patterns: [
      /code.*review/i,
      /review.*code/i,
      /pr.*review/i,
      /pull.*request.*review/i,
      /reviewing.*change/i,
      /diff.*review/i,
    ],
    canonical: 'Code Review',
    slug: 'code-review',
    intent: BlockIntent.CodeReview,
  },

  // Web research
  {
    patterns: [
      /web.*research/i,
      /browser.*research/i,
      /googl.*search/i,
      /stack.*overflow/i,
      /documentation.*read/i,
      /reading.*doc/i,
      /searching.*online/i,
      /looking.*up/i,
    ],
    canonical: 'Web Research',
    slug: 'web-research',
    intent: BlockIntent.WebResearch,
  },

  // Testing
  {
    patterns: [
      /writing.*test/i,
      /test.*writ/i,
      /unit.*test/i,
      /integration.*test/i,
      /test.*case/i,
      /testing.*code/i,
      /running.*test/i,
    ],
    canonical: 'Testing',
    slug: 'testing',
    intent: BlockIntent.Testing,
  },

  // Debugging
  {
    patterns: [
      /debug/i,
      /troubleshoot/i,
      /investigat/i,
      /inspect.*variable/i,
      /breakpoint/i,
      /console.*log/i,
    ],
    canonical: 'Debugging',
    slug: 'debugging',
    intent: BlockIntent.Debugging,
  },

  // File navigation
  {
    patterns: [
      /file.*navig/i,
      /finding.*file/i,
      /open.*file/i,
      /switch.*file/i,
      /browse.*project/i,
      /explorer/i,
    ],
    canonical: 'File Navigation',
    slug: 'file-navigation',
    intent: BlockIntent.FileNavigation,
  },

  // Documentation
  {
    patterns: [
      /writ.*doc/i,
      /document/i,
      /readme/i,
      /comment.*code/i,
      /adding.*comment/i,
      /jsdoc/i,
      /api.*doc/i,
    ],
    canonical: 'Documentation',
    slug: 'documentation',
    intent: BlockIntent.Documentation,
  },

  // Communication
  {
    patterns: [
      /slack.*messag/i,
      /email/i,
      /meeting/i,
      /chat/i,
      /discussion/i,
      /communi/i,
      /message/i,
    ],
    canonical: 'Communication',
    slug: 'communication',
    intent: BlockIntent.Communication,
  },
];

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

export class BlockCanonicalizationService {
  private logger: Logger;
  private embeddingService?: OpenAIEmbeddingService;
  private llmProvider?: LLMProvider;
  private graphService?: GraphDBService;

  constructor({
    logger,
    openAIEmbeddingService,
    llmProvider,
    graphService,
  }: {
    logger: Logger;
    openAIEmbeddingService?: OpenAIEmbeddingService;
    llmProvider?: LLMProvider;
    graphService?: GraphDBService;
  }) {
    this.logger = logger;
    this.embeddingService = openAIEmbeddingService;
    this.llmProvider = llmProvider;
    this.graphService = graphService;
  }

  /**
   * Canonicalize a batch of raw blocks
   */
  async canonicalizeBlocks(
    rawBlocks: RawExtractedBlock[]
  ): Promise<CanonicalizedBlock[]> {
    this.logger.info('Canonicalizing blocks', { count: rawBlocks.length });

    const canonicalized: CanonicalizedBlock[] = [];

    for (const block of rawBlocks) {
      const result = await this.canonicalizeBlock(block);
      canonicalized.push(result);
    }

    return canonicalized;
  }

  /**
   * Canonicalize a single raw block
   */
  async canonicalizeBlock(
    block: RawExtractedBlock
  ): Promise<CanonicalizedBlock> {
    // Strategy 1: Try rule-based canonicalization
    const ruleMatch = this.matchRuleBasedPattern(block.suggestedName);

    if (ruleMatch) {
      this.logger.debug('Block matched by rule', {
        original: block.suggestedName,
        canonical: ruleMatch.canonical,
      });

      return {
        ...block,
        canonicalName: ruleMatch.canonical,
        canonicalSlug: ruleMatch.slug,
        intentLabel: ruleMatch.intent,
        canonicalizationMethod: CanonicalizationMethod.RuleBased,
      };
    }

    // Strategy 2: Try embedding similarity to existing blocks
    if (this.embeddingService && this.graphService) {
      const similarBlock = await this.findSimilarExistingBlock(
        block.suggestedName
      );

      if (similarBlock && similarBlock.similarity > 0.85) {
        this.logger.debug('Block matched by embedding similarity', {
          original: block.suggestedName,
          canonical: similarBlock.canonicalName,
          similarity: similarBlock.similarity,
        });

        return {
          ...block,
          canonicalName: similarBlock.canonicalName,
          canonicalSlug: similarBlock.canonicalSlug,
          intentLabel: similarBlock.intent,
          canonicalizationMethod: CanonicalizationMethod.EmbeddingMatch,
          matchedBlockId: similarBlock._key,
        };
      }
    }

    // Strategy 3: LLM-based canonicalization (fallback)
    if (this.llmProvider) {
      const llmResult = await this.llmCanonicalize(block);

      if (llmResult) {
        this.logger.debug('Block canonicalized by LLM', {
          original: block.suggestedName,
          canonical: llmResult.canonical,
        });

        return {
          ...block,
          canonicalName: llmResult.canonical,
          canonicalSlug: this.slugify(llmResult.canonical),
          intentLabel: llmResult.intent || block.intentLabel,
          canonicalizationMethod: CanonicalizationMethod.LlmInference,
        };
      }
    }

    // Fallback: Use the suggested name as-is
    this.logger.debug('Using block name as-is (no match found)', {
      name: block.suggestedName,
    });

    return {
      ...block,
      canonicalName: block.suggestedName,
      canonicalSlug: this.slugify(block.suggestedName),
      canonicalizationMethod: CanonicalizationMethod.LlmInference,
    };
  }

  /**
   * Try to match block name to rule-based patterns
   */
  private matchRuleBasedPattern(
    suggestedName: string
  ): CanonicalBlockMapping | null {
    for (const mapping of CANONICAL_BLOCK_MAPPINGS) {
      if (mapping.patterns.some((p) => p.test(suggestedName))) {
        return mapping;
      }
    }
    return null;
  }

  /**
   * Find similar existing block using embedding similarity
   */
  private async findSimilarExistingBlock(
    suggestedName: string
  ): Promise<ExistingBlockMatch | null> {
    if (!this.embeddingService || !this.graphService) {
      return null;
    }

    try {
      // Generate embedding for suggested name
      const embedding = await this.embeddingService.generateEmbedding(
        suggestedName
      );

      // Query existing blocks by embedding similarity
      // Note: This requires ArangoDB to have vector search capability or we use a simpler approach
      // For now, we'll use a simpler approach: get all blocks and compute similarity in-memory
      // In production, this should use vector search index

      const result = await this.graphService.query<ExistingBlockMatch>(`
        FOR block IN blocks
          LIMIT 100
          RETURN {
            _key: block._key,
            canonicalName: block.canonicalName,
            canonicalSlug: block.canonicalSlug,
            intent: block.intentLabel,
            embedding: block.embedding
          }
      `);

      if (!result || result.length === 0) {
        return null;
      }

      // Find best match by cosine similarity
      let bestMatch: ExistingBlockMatch | null = null;
      let bestSimilarity = 0;

      for (const block of result) {
        const blockEmbedding = (block as any).embedding;
        if (!blockEmbedding) continue;

        const similarity = this.cosineSimilarity(embedding, blockEmbedding);

        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestMatch = {
            _key: block._key,
            canonicalName: block.canonicalName,
            canonicalSlug: block.canonicalSlug,
            intent: block.intent,
            similarity,
          };
        }
      }

      return bestMatch;
    } catch (error) {
      this.logger.warn('Failed to find similar existing block', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Use LLM to canonicalize a block name
   * Uses Langfuse Prompt Management for prompt versioning
   */
  private async llmCanonicalize(
    block: RawExtractedBlock
  ): Promise<{ canonical: string; intent?: BlockIntent } | null> {
    if (!this.llmProvider) {
      return null;
    }

    try {
      // Get prompt from Langfuse (with fallback to default)
      const { prompt, fromLangfuse } = await getManagedPrompt('block-canonicalization', {
        suggestedName: block.suggestedName,
        primaryTool: block.primaryTool,
        durationSeconds: block.durationSeconds,
      });

      if (fromLangfuse) {
        this.logger.debug('Using Langfuse-managed prompt for block canonicalization');
      }

      const response = await this.llmProvider.complete(prompt, {
        model: 'gpt-4o-mini',
        responseFormat: 'json',
      });

      // Clean up response - LLM may wrap JSON in markdown code blocks
      let cleanedResponse = response.trim();
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.slice(7);
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.slice(3);
      }
      if (cleanedResponse.endsWith('```')) {
        cleanedResponse = cleanedResponse.slice(0, -3);
      }
      cleanedResponse = cleanedResponse.trim();

      const parsed = JSON.parse(cleanedResponse);

      return {
        canonical: parsed.canonical,
        intent: this.mapToBlockIntent(parsed.intent),
      };
    } catch (error) {
      this.logger.warn('LLM canonicalization failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Map string to BlockIntent enum
   */
  private mapToBlockIntent(intent?: string): BlockIntent | undefined {
    if (!intent) return undefined;

    const mapping: Record<string, BlockIntent> = {
      ai_prompt: BlockIntent.AiPrompt,
      code_edit: BlockIntent.CodeEdit,
      code_review: BlockIntent.CodeReview,
      terminal_command: BlockIntent.TerminalCommand,
      file_navigation: BlockIntent.FileNavigation,
      web_research: BlockIntent.WebResearch,
      git_operation: BlockIntent.GitOperation,
      documentation: BlockIntent.Documentation,
      testing: BlockIntent.Testing,
      debugging: BlockIntent.Debugging,
      communication: BlockIntent.Communication,
    };

    return mapping[intent.toLowerCase()];
  }

  /**
   * Convert name to URL-safe slug
   */
  private slugify(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) {
      return 0;
    }

    return dotProduct / denominator;
  }

  /**
   * Get canonical name for an intent
   */
  getCanonicalNameForIntent(intent: BlockIntent): string {
    const mapping = CANONICAL_BLOCK_MAPPINGS.find((m) => m.intent === intent);
    return mapping?.canonical || 'Unknown';
  }
}
