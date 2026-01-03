/**
 * Hierarchical Top Workflows Service
 *
 * Provides the enhanced "Top Workflows" endpoint that returns:
 * - Level 1: WorkflowPatterns (intent-driven sequences)
 * - Level 2: Blocks (tool-level execution units)
 *
 * Steps (Level 3) are excluded by default and fetched on-demand via drill-down.
 */

import { aql, type Database } from 'arangojs';
import { v4 as uuidv4 } from 'uuid';

import {
  WorkflowIntent,
  EdgeStrength,
  ToolCategory,
  type WorkflowPatternNode,
  type EnrichedWorkflowPattern,
  type EnrichedBlock,
  type BlockConnection,
  type PatternTool,
  type PatternConcept,
  type PatternSession,
  type TopWorkflowsQueryParams,
  type TopWorkflowResponse,
} from '@journey/schema';

import type { Logger } from '../core/logger.js';
import { getManagedPrompt } from '../core/langfuse.js';
import { ArangoDBConnection } from '../config/arangodb.connection.js';
import type { ToolGeneralizationService } from './tool-generalization.service.js';
import type { ConfidenceScoringService } from './confidence-scoring.service.js';
import type { BlockLinkingService } from './block-linking.service.js';

// ============================================================================
// TYPES
// ============================================================================

interface BlockSequenceResult {
  blocks: Array<{
    id: string;
    name: string;
    intent: string;
    tool: string;
  }>;
  frequency: number;
  confidence: number;
  length: number;
}

/**
 * Block sequence info stored alongside pattern for enrichment
 */
interface BlockSequenceInfo {
  id: string;
  name: string;
  intent: string;
  tool: string;
}

/**
 * Map to store block sequences by pattern key
 * Used to preserve the original block sequence during enrichment
 */
type PatternBlockSequenceMap = Map<string, BlockSequenceInfo[]>;

interface LLMProvider {
  complete(prompt: string, options?: { model?: string; responseFormat?: string }): Promise<string>;
}

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

export class HierarchicalTopWorkflowsService {
  private logger: Logger;
  private db: Database | null = null;
  private toolGeneralizationService: ToolGeneralizationService;
  private confidenceScoringService: ConfidenceScoringService;
  private blockLinkingService: BlockLinkingService;
  private llmProvider?: LLMProvider;

  constructor({
    logger,
    toolGeneralizationService,
    confidenceScoringService,
    blockLinkingService,
    llmProvider,
  }: {
    logger: Logger;
    toolGeneralizationService: ToolGeneralizationService;
    confidenceScoringService: ConfidenceScoringService;
    blockLinkingService: BlockLinkingService;
    llmProvider?: LLMProvider;
  }) {
    this.logger = logger;
    this.toolGeneralizationService = toolGeneralizationService;
    this.confidenceScoringService = confidenceScoringService;
    this.blockLinkingService = blockLinkingService;
    this.llmProvider = llmProvider;
  }

  /**
   * Ensure database connection
   */
  private async ensureInitialized(): Promise<Database> {
    if (!this.db) {
      this.db = await ArangoDBConnection.getConnection();
    }
    return this.db;
  }

  /**
   * Get top hierarchical workflows
   */
  async getTopWorkflows(
    query: TopWorkflowsQueryParams
  ): Promise<TopWorkflowResponse> {
    const db = await this.ensureInitialized();

    this.logger.info('Getting top hierarchical workflows', {
      userId: query.userId,
      nodeId: query.nodeId,
      limit: query.limit,
      minOccurrences: query.minOccurrences,
    });

    // Step 1: Query frequent block sequences
    const blockSequences = await this.queryFrequentBlockSequences(query);

    this.logger.debug('Found block sequences', {
      sequenceCount: blockSequences.length,
    });

    if (blockSequences.length === 0) {
      return {
        workflows: [],
        metadata: {
          totalPatterns: 0,
          queryParams: query,
          generatedAt: new Date().toISOString(),
        },
      };
    }

    // Step 2: Convert sequences to WorkflowPatterns (preserving block sequence info)
    const { patterns, blockSequenceMap } = await this.convertToWorkflowPatterns(
      blockSequences,
      query.userId || ''
    );

    // Step 3: Enrich patterns with tools, concepts, and sessions
    // Pass the blockSequenceMap so we use the actual blocks from the sequence
    const enrichedPatterns = await this.enrichPatterns(patterns, blockSequenceMap);

    // Step 4: Rank and limit
    const rankedPatterns = this.rankPatterns(enrichedPatterns).slice(
      0,
      query.limit
    );

    this.logger.info('Top workflows retrieved', {
      patternCount: rankedPatterns.length,
    });

    return {
      workflows: rankedPatterns,
      metadata: {
        totalPatterns: patterns.length,
        queryParams: query,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Query frequent block sequences from the graph
   */
  private async queryFrequentBlockSequences(
    params: TopWorkflowsQueryParams
  ): Promise<BlockSequenceResult[]> {
    const db = await this.ensureInitialized();

    try {
      const query = aql`
        // Get all blocks for the user
        FOR startBlock IN blocks
          ${params.userId ? aql`FILTER startBlock.userId == ${params.userId} OR startBlock.userId == null` : aql``}
          FILTER startBlock.occurrenceCount >= ${params.minOccurrences}
          ${params.intentFilter?.length ? aql`FILTER startBlock.intentLabel IN ${params.intentFilter}` : aql``}
          ${params.toolFilter?.length ? aql`FILTER startBlock.primaryTool IN ${params.toolFilter}` : aql``}

          // Traverse forward through NEXT_BLOCK edges
          FOR v, e, p IN 1..5 OUTBOUND startBlock NEXT_BLOCK
            OPTIONS { order: 'bfs' }
            FILTER e.frequency >= ${Math.floor(params.minOccurrences / 2)}

            LET pathBlocks = (
              FOR vertex IN p.vertices
                RETURN {
                  id: vertex._key,
                  name: vertex.canonicalName,
                  intent: vertex.intentLabel,
                  tool: vertex.primaryTool
                }
            )

            LET pathFrequency = MIN(
              FOR edge IN p.edges
                RETURN edge.frequency
            )

            LET pathConfidence = AVG(
              FOR vertex IN p.vertices
                RETURN vertex.confidence
            )

            FILTER pathFrequency >= ${params.minOccurrences}
            FILTER pathConfidence >= ${params.minConfidence}

            RETURN DISTINCT {
              blocks: pathBlocks,
              frequency: pathFrequency,
              confidence: pathConfidence,
              length: LENGTH(p.vertices)
            }
      `;

      const cursor = await db.query(query);
      const results = await cursor.all();

      // Deduplicate by block sequence
      const uniqueSequences = new Map<string, BlockSequenceResult>();

      for (const result of results) {
        const key = result.blocks.map((b: any) => b.id).join('->');
        if (
          !uniqueSequences.has(key) ||
          uniqueSequences.get(key)!.frequency < result.frequency
        ) {
          uniqueSequences.set(key, result);
        }
      }

      return Array.from(uniqueSequences.values());
    } catch (error) {
      this.logger.error('Failed to query frequent block sequences', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Convert block sequences to WorkflowPattern nodes
   * Returns both patterns and a map of block sequences for enrichment
   */
  private async convertToWorkflowPatterns(
    sequences: BlockSequenceResult[],
    userId: string
  ): Promise<{ patterns: WorkflowPatternNode[]; blockSequenceMap: PatternBlockSequenceMap }> {
    const patterns: WorkflowPatternNode[] = [];
    const blockSequenceMap: PatternBlockSequenceMap = new Map();

    for (const sequence of sequences) {
      // Generate pattern name using LLM if available, otherwise use heuristic
      const patternName = await this.generatePatternName(sequence);
      const intentCategory = this.inferPatternIntent(sequence);

      const patternKey = `wp_${uuidv4().replace(/-/g, '').slice(0, 12)}`;

      const pattern: WorkflowPatternNode = {
        _key: patternKey,
        _id: '',
        type: 'workflow_pattern',
        canonicalName: patternName,
        intentCategory,
        description: this.generatePatternDescription(sequence),
        occurrenceCount: sequence.frequency,
        sessionCount: Math.ceil(sequence.frequency * 0.8), // Estimate
        userCount: 1,
        confidence: sequence.confidence,
        firstSeenAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        avgDurationSeconds: 0, // Will be calculated
        toolAgnostic: this.isToolAgnostic(sequence),
        toolVariants: this.extractToolVariants(sequence),
        userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      pattern._id = `workflow_patterns/${pattern._key}`;
      patterns.push(pattern);

      // Store the original block sequence for this pattern
      blockSequenceMap.set(patternKey, sequence.blocks);
    }

    return { patterns, blockSequenceMap };
  }

  /**
   * Generate pattern name using LLM or heuristic
   * Uses Langfuse Prompt Management for prompt versioning
   */
  private async generatePatternName(
    sequence: BlockSequenceResult
  ): Promise<string> {
    // Try LLM if available
    if (this.llmProvider) {
      try {
        const blockNames = sequence.blocks.map((b) => b.name).join(' → ');

        // Get prompt from Langfuse (with fallback to default)
        const { prompt, fromLangfuse } = await getManagedPrompt('pattern-name-generation', {
          blockNames,
        });

        if (fromLangfuse) {
          this.logger.debug('Using Langfuse-managed prompt for pattern name generation');
        }

        const response = await this.llmProvider.complete(prompt, {
          model: 'gpt-4o-mini',
        });

        return response.trim().replace(/^["']|["']$/g, '');
      } catch (error) {
        this.logger.warn('Failed to generate pattern name with LLM', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Fallback: Use heuristic
    if (sequence.blocks.length === 1) {
      return sequence.blocks[0].name;
    }

    const firstBlock = sequence.blocks[0].name;
    const lastBlock = sequence.blocks[sequence.blocks.length - 1].name;

    return `${this.shortenBlockName(firstBlock)} to ${this.shortenBlockName(lastBlock)}`;
  }

  /**
   * Shorten a block name for pattern naming
   */
  private shortenBlockName(name: string): string {
    // Remove common suffixes
    return name
      .replace(/ing$/i, '')
      .replace(/tion$/i, '')
      .replace(/Operations?$/i, '')
      .trim();
  }

  /**
   * Generate pattern description
   */
  private generatePatternDescription(sequence: BlockSequenceResult): string {
    const blockNames = sequence.blocks.map((b) => b.name).join(' → ');
    return `Workflow pattern consisting of: ${blockNames}. Observed ${sequence.frequency} times with ${Math.round(sequence.confidence * 100)}% confidence.`;
  }

  /**
   * Infer overall workflow intent from block sequence
   */
  private inferPatternIntent(sequence: BlockSequenceResult): WorkflowIntent {
    // Count intents
    const intentCounts = new Map<string, number>();
    for (const block of sequence.blocks) {
      const count = intentCounts.get(block.intent) || 0;
      intentCounts.set(block.intent, count + 1);
    }

    // Get most common intent
    let maxIntent = 'build';
    let maxCount = 0;
    for (const [intent, count] of intentCounts) {
      if (count > maxCount) {
        maxCount = count;
        maxIntent = intent;
      }
    }

    // Map block intent to workflow intent
    const mapping: Record<string, WorkflowIntent> = {
      ai_prompt: WorkflowIntent.Build,
      code_edit: WorkflowIntent.Build,
      code_review: WorkflowIntent.Review,
      terminal_command: WorkflowIntent.Build,
      file_navigation: WorkflowIntent.Build,
      web_research: WorkflowIntent.Research,
      git_operation: WorkflowIntent.Deploy,
      documentation: WorkflowIntent.Document,
      testing: WorkflowIntent.Test,
      debugging: WorkflowIntent.Debug,
      communication: WorkflowIntent.Communicate,
    };

    return mapping[maxIntent] || WorkflowIntent.Build;
  }

  /**
   * Check if pattern is tool-agnostic
   */
  private isToolAgnostic(sequence: BlockSequenceResult): boolean {
    const tools = new Set(sequence.blocks.map((b) => b.tool));
    if (tools.size <= 1) {
      return false;
    }

    // Check if tools are in the same category
    const categories = new Set<ToolCategory>();
    for (const tool of tools) {
      categories.add(this.toolGeneralizationService.getToolCategory(tool));
    }

    return categories.size < tools.size;
  }

  /**
   * Extract tool variants from sequence
   */
  private extractToolVariants(sequence: BlockSequenceResult): string[] {
    return [...new Set(sequence.blocks.map((b) => b.tool))];
  }

  /**
   * Enrich patterns with tools, concepts, and sessions
   * Now uses the blockSequenceMap to get the actual blocks from the original sequence
   */
  private async enrichPatterns(
    patterns: WorkflowPatternNode[],
    blockSequenceMap: PatternBlockSequenceMap
  ): Promise<EnrichedWorkflowPattern[]> {
    const db = await this.ensureInitialized();
    const enriched: EnrichedWorkflowPattern[] = [];

    for (const pattern of patterns) {
      try {
        // Get the original block sequence for this pattern
        const blockSequence = blockSequenceMap.get(pattern._key) || [];

        // Get blocks for this pattern using the actual block IDs from the sequence
        const blocks = await this.getPatternBlocks(pattern, blockSequence);

        // Get block connections
        const connections = await this.getBlockConnections(blocks);

        // Get tools
        const tools = this.extractPatternTools(blocks);

        // Get concepts
        const concepts = await this.getPatternConcepts(blocks);

        // Get recent sessions
        const sessions = await this.getPatternSessions(pattern);

        enriched.push({
          ...pattern,
          id: pattern._key, // Map _key to id for API schema compatibility
          blocks,
          blockConnections: connections,
          tools,
          concepts,
          recentSessions: sessions,
        });
      } catch (error) {
        this.logger.error('Failed to enrich pattern', {
          patternId: pattern._key,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return enriched;
  }

  /**
   * Get blocks for a pattern using the actual block IDs from the sequence
   * This fixes the bug where we were fetching random blocks by tool instead of
   * the specific blocks that make up this workflow pattern
   */
  private async getPatternBlocks(
    pattern: WorkflowPatternNode,
    blockSequence: BlockSequenceInfo[]
  ): Promise<EnrichedBlock[]> {
    const db = await this.ensureInitialized();

    // If we have the original block sequence, use those specific block IDs
    if (blockSequence.length > 0) {
      const blockIds = blockSequence.map((b) => b.id);

      try {
        const query = aql`
          FOR blockId IN ${blockIds}
            LET block = DOCUMENT(CONCAT('blocks/', blockId))
            FILTER block != null
            RETURN block
        `;

        const cursor = await db.query(query);
        const blocksFromDb = await cursor.all();

        // Create a map for quick lookup
        const blockMap = new Map<string, any>();
        for (const block of blocksFromDb) {
          if (block) {
            blockMap.set(block._key, block);
          }
        }

        // Return blocks in the original sequence order, using sequence data as fallback
        return blockSequence.map((seqBlock, index) => {
          const dbBlock = blockMap.get(seqBlock.id);

          if (dbBlock) {
            return {
              id: dbBlock._key,
              order: index,
              canonicalName: dbBlock.canonicalName || seqBlock.name,
              intent: dbBlock.intentLabel || seqBlock.intent,
              primaryTool: dbBlock.primaryTool || seqBlock.tool,
              toolVariants: dbBlock.toolVariants || [seqBlock.tool],
              avgDurationSeconds: dbBlock.avgDurationSeconds || 0,
              occurrenceCount: dbBlock.occurrenceCount || 1,
              confidence: dbBlock.confidence || 0.7,
              workflowTags: dbBlock.workflowTags || [],
            };
          }

          // Fallback to sequence data if block not found in DB
          return {
            id: seqBlock.id,
            order: index,
            canonicalName: seqBlock.name,
            intent: seqBlock.intent,
            primaryTool: seqBlock.tool,
            toolVariants: [seqBlock.tool],
            avgDurationSeconds: 0,
            occurrenceCount: 1,
            confidence: 0.7,
            workflowTags: [],
          };
        });
      } catch (error) {
        this.logger.error('Failed to get pattern blocks by ID, falling back to sequence data', {
          patternId: pattern._key,
          error: error instanceof Error ? error.message : String(error),
        });

        // Return blocks from sequence data as fallback
        return blockSequence.map((seqBlock, index) => ({
          id: seqBlock.id,
          order: index,
          canonicalName: seqBlock.name,
          intent: seqBlock.intent,
          primaryTool: seqBlock.tool,
          toolVariants: [seqBlock.tool],
          avgDurationSeconds: 0,
          occurrenceCount: 1,
          confidence: 0.7,
          workflowTags: [],
        }));
      }
    }

    // Fallback: query by tool variants (legacy behavior for patterns without sequence data)
    try {
      const query = aql`
        FOR block IN blocks
          FILTER block.primaryTool IN ${pattern.toolVariants}
          FILTER block.occurrenceCount >= 2
          SORT block.occurrenceCount DESC
          LIMIT 10
          RETURN block
      `;

      const cursor = await db.query(query);
      const blocks = await cursor.all();

      return blocks.map((block: any, index: number) => ({
        id: block._key,
        order: index,
        canonicalName: block.canonicalName,
        intent: block.intentLabel,
        primaryTool: block.primaryTool,
        toolVariants: block.toolVariants || [],
        avgDurationSeconds: block.avgDurationSeconds || 0,
        occurrenceCount: block.occurrenceCount || 0,
        confidence: block.confidence || 0,
        workflowTags: block.workflowTags || [],
      }));
    } catch (error) {
      this.logger.error('Failed to get pattern blocks', {
        patternId: pattern._key,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Get connections between blocks
   */
  private async getBlockConnections(
    blocks: EnrichedBlock[]
  ): Promise<BlockConnection[]> {
    const db = await this.ensureInitialized();
    const connections: BlockConnection[] = [];

    if (blocks.length < 2) {
      return connections;
    }

    try {
      const blockIds = blocks.map((b) => `blocks/blk_${b.id.replace('blk_', '')}`);

      const query = aql`
        FOR edge IN NEXT_BLOCK
          FILTER edge._from IN ${blockIds}
          FILTER edge._to IN ${blockIds}
          RETURN {
            from: LAST(SPLIT(edge._from, '/')),
            to: LAST(SPLIT(edge._to, '/')),
            frequency: edge.frequency,
            probability: edge.probability,
            strength: edge.strength
          }
      `;

      const cursor = await db.query(query);
      const results = await cursor.all();

      for (const result of results) {
        connections.push({
          from: result.from,
          to: result.to,
          frequency: result.frequency,
          probability: result.probability,
          strength: result.strength as EdgeStrength,
        });
      }
    } catch (error) {
      this.logger.error('Failed to get block connections', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return connections;
  }

  /**
   * Extract tools from blocks
   */
  private extractPatternTools(blocks: EnrichedBlock[]): PatternTool[] {
    const toolMap = new Map<string, { category: ToolCategory; count: number }>();

    for (const block of blocks) {
      const canonicalized = this.toolGeneralizationService.canonicalizeTool(
        block.primaryTool
      );

      const existing = toolMap.get(canonicalized.canonical);
      if (existing) {
        existing.count += block.occurrenceCount;
      } else {
        toolMap.set(canonicalized.canonical, {
          category: canonicalized.category,
          count: block.occurrenceCount,
        });
      }
    }

    return Array.from(toolMap.entries())
      .map(([name, data]) => ({
        name,
        category: data.category,
        usageCount: data.count,
      }))
      .sort((a, b) => b.usageCount - a.usageCount);
  }

  /**
   * Get concepts related to pattern blocks
   */
  private async getPatternConcepts(
    blocks: EnrichedBlock[]
  ): Promise<PatternConcept[]> {
    const db = await this.ensureInitialized();

    try {
      const blockIds = blocks.map((b) => `blocks/blk_${b.id.replace('blk_', '')}`);

      const query = aql`
        FOR blockId IN ${blockIds}
          FOR edge IN BLOCK_RELATES_CONCEPT
            FILTER edge._from == blockId
            LET concept = DOCUMENT(edge._to)
            COLLECT c = concept INTO grouped
            LET avgRelevance = AVG(grouped[*].edge.relevanceScore)
            SORT avgRelevance DESC
            LIMIT 5
            RETURN {
              name: c.name,
              category: c.category,
              relevance: avgRelevance
            }
      `;

      const cursor = await db.query(query);
      return await cursor.all();
    } catch (error) {
      this.logger.warn('Failed to get pattern concepts', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Get recent sessions where pattern occurred
   */
  private async getPatternSessions(
    pattern: WorkflowPatternNode
  ): Promise<PatternSession[]> {
    const db = await this.ensureInitialized();

    try {
      const query = aql`
        FOR session IN sessions
          FILTER session.user_key == CONCAT('user_', ${pattern.userId})
          SORT session.start_time DESC
          LIMIT 3
          LET node = DOCUMENT(timeline_nodes, session.node_key)
          RETURN {
            id: session._key,
            date: session.start_time,
            nodeTitle: node.title
          }
      `;

      const cursor = await db.query(query);
      return await cursor.all();
    } catch (error) {
      this.logger.warn('Failed to get pattern sessions', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Rank patterns by composite score
   */
  private rankPatterns(
    patterns: EnrichedWorkflowPattern[]
  ): EnrichedWorkflowPattern[] {
    return patterns.sort((a, b) => {
      const scoreA = this.calculatePatternScore(a);
      const scoreB = this.calculatePatternScore(b);
      return scoreB - scoreA;
    });
  }

  /**
   * Calculate pattern ranking score
   */
  private calculatePatternScore(pattern: EnrichedWorkflowPattern): number {
    // Weighted scoring
    const frequencyScore = Math.log(pattern.occurrenceCount + 1) * 0.4;
    const confidenceScore = pattern.confidence * 0.3;
    const recencyScore = this.calculateRecencyScore(pattern.lastSeenAt) * 0.2;
    const diversityScore = (pattern.toolVariants?.length || 1) / 5 * 0.1;

    return frequencyScore + confidenceScore + recencyScore + diversityScore;
  }

  /**
   * Calculate recency score (higher for more recent)
   */
  private calculateRecencyScore(lastSeenAt: string): number {
    const lastSeen = new Date(lastSeenAt).getTime();
    const now = Date.now();
    const daysSinceLastSeen = (now - lastSeen) / (1000 * 60 * 60 * 24);

    // Exponential decay over 30 days
    return Math.exp(-daysSinceLastSeen / 30);
  }

  /**
   * Get a single workflow pattern by ID
   * Note: When fetching by ID, we don't have the original block sequence,
   * so we try to reconstruct it from PATTERN_CONTAINS_BLOCK edges or fall back to tool-based query
   */
  async getPatternById(patternId: string): Promise<EnrichedWorkflowPattern | null> {
    const db = await this.ensureInitialized();

    try {
      const query = aql`
        FOR pattern IN workflow_patterns
          FILTER pattern._key == ${patternId}
          RETURN pattern
      `;

      const cursor = await db.query(query);
      const pattern = await cursor.next();

      if (!pattern) {
        return null;
      }

      // Try to get block sequence from PATTERN_CONTAINS_BLOCK edges
      const blockSequence = await this.getBlockSequenceForPattern(patternId);

      // Create a map with just this pattern's block sequence
      const blockSequenceMap: PatternBlockSequenceMap = new Map();
      if (blockSequence.length > 0) {
        blockSequenceMap.set(patternId, blockSequence);
      }

      // Enrich the pattern
      const enriched = await this.enrichPatterns(
        [pattern as WorkflowPatternNode],
        blockSequenceMap
      );
      return enriched[0] || null;
    } catch (error) {
      this.logger.error('Failed to get pattern by ID', {
        patternId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Get block sequence for a pattern from PATTERN_CONTAINS_BLOCK edges
   */
  private async getBlockSequenceForPattern(patternId: string): Promise<BlockSequenceInfo[]> {
    const db = await this.ensureInitialized();

    try {
      const query = aql`
        FOR edge IN PATTERN_CONTAINS_BLOCK
          FILTER edge._from == CONCAT('workflow_patterns/', ${patternId})
          SORT edge.orderInPattern ASC
          LET block = DOCUMENT(edge._to)
          FILTER block != null
          RETURN {
            id: block._key,
            name: block.canonicalName,
            intent: block.intentLabel,
            tool: block.primaryTool
          }
      `;

      const cursor = await db.query(query);
      return await cursor.all();
    } catch (error) {
      this.logger.debug('No PATTERN_CONTAINS_BLOCK edges found for pattern', {
        patternId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }
}
