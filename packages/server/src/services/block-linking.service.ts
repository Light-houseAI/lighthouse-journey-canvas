/**
 * Block Linking Service
 *
 * Creates NEXT_BLOCK edges between blocks to capture workflow sequences.
 * Manages edge frequencies, probabilities, and pattern detection.
 */

import { aql, type Database } from 'arangojs';

import {
  EdgeStrength,
  type CanonicalizedBlock,
  type NextBlockEdge,
  type BlockNode,
} from '@journey/schema';

import type { Logger } from '../core/logger.js';
import { ArangoDBConnection } from '../config/arangodb.connection.js';

// ============================================================================
// TYPES
// ============================================================================

interface BlockNodeInsert {
  _key: string;
  type: 'block';
  canonicalName: string;
  canonicalSlug: string;
  intentLabel: string;
  primaryTool: string;
  toolVariants: string[];
  occurrenceCount: number;
  avgDurationSeconds: number;
  avgStepCount: number;
  confidence: number;
  embedding: number[] | null;
  workflowTags: string[];
  representativeScreenshotIds: number[];
  userId: string;
  createdAt: string;
  updatedAt: string;
}

interface NextBlockEdgeInsert {
  _from: string;
  _to: string;
  type: 'NEXT_BLOCK';
  frequency: number;
  probability: number;
  avgGapSeconds: number;
  patternIds: string[];
  sessionCount: number;
  strength: EdgeStrength;
}

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

export class BlockLinkingService {
  private logger: Logger;
  private db: Database | null = null;

  constructor({ logger }: { logger: Logger }) {
    this.logger = logger;
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
   * Link blocks sequentially with NEXT_BLOCK edges
   */
  async linkBlocksSequentially(
    blocks: CanonicalizedBlock[],
    sessionId: string,
    userId: string
  ): Promise<void> {
    const db = await this.ensureInitialized();

    this.logger.info('Linking blocks sequentially', {
      blockCount: blocks.length,
      sessionId,
    });

    if (blocks.length < 2) {
      this.logger.debug('Not enough blocks to create links', {
        blockCount: blocks.length,
      });
      return;
    }

    // Sort by start time
    const sortedBlocks = [...blocks].sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    // First, ensure all blocks exist in the database
    for (const block of sortedBlocks) {
      await this.upsertBlockNode(block, userId);
    }

    // Create NEXT_BLOCK edges
    for (let i = 0; i < sortedBlocks.length - 1; i++) {
      const fromBlock = sortedBlocks[i];
      const toBlock = sortedBlocks[i + 1];

      await this.createOrUpdateNextBlockEdge(
        fromBlock.canonicalSlug,
        toBlock.canonicalSlug,
        fromBlock,
        toBlock,
        sessionId
      );
    }

    // Recalculate probabilities for all affected blocks
    const affectedSlugs = sortedBlocks.map((b) => b.canonicalSlug);
    await this.recalculateTransitionProbabilities(affectedSlugs);

    this.logger.info('Block linking complete', {
      sessionId,
      edgesCreated: sortedBlocks.length - 1,
    });
  }

  /**
   * Upsert a block node in ArangoDB
   */
  private async upsertBlockNode(
    block: CanonicalizedBlock,
    userId: string
  ): Promise<string> {
    const db = await this.ensureInitialized();
    const blockKey = `blk_${block.canonicalSlug}`;

    try {
      const query = aql`
        UPSERT { _key: ${blockKey} }
        INSERT {
          _key: ${blockKey},
          type: 'block',
          canonicalName: ${block.canonicalName},
          canonicalSlug: ${block.canonicalSlug},
          intentLabel: ${block.intentLabel},
          primaryTool: ${block.primaryTool},
          toolVariants: [${block.primaryTool}],
          occurrenceCount: 1,
          avgDurationSeconds: ${block.durationSeconds},
          avgStepCount: 0,
          confidence: ${block.confidence},
          embedding: null,
          workflowTags: [],
          representativeScreenshotIds: ${block.screenshots.map((s) => s.id).slice(0, 3)},
          userId: ${userId},
          createdAt: DATE_ISO8601(DATE_NOW()),
          updatedAt: DATE_ISO8601(DATE_NOW())
        }
        UPDATE {
          occurrenceCount: OLD.occurrenceCount + 1,
          avgDurationSeconds: (OLD.avgDurationSeconds * OLD.occurrenceCount + ${block.durationSeconds}) / (OLD.occurrenceCount + 1),
          confidence: (OLD.confidence + ${block.confidence}) / 2,
          toolVariants: UNIQUE(APPEND(OLD.toolVariants, ${block.primaryTool})),
          updatedAt: DATE_ISO8601(DATE_NOW())
        }
        IN blocks
        RETURN NEW
      `;

      const cursor = await db.query(query);
      const result = await cursor.next();

      this.logger.debug('Upserted block node', {
        blockKey,
        canonicalName: block.canonicalName,
        isNew: result.occurrenceCount === 1,
      });

      return result._key;
    } catch (error) {
      this.logger.error('Failed to upsert block node', {
        blockKey,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Create or update NEXT_BLOCK edge between two blocks
   */
  private async createOrUpdateNextBlockEdge(
    fromSlug: string,
    toSlug: string,
    fromBlock: CanonicalizedBlock,
    toBlock: CanonicalizedBlock,
    sessionId: string
  ): Promise<void> {
    const db = await this.ensureInitialized();
    const fromKey = `blk_${fromSlug}`;
    const toKey = `blk_${toSlug}`;

    const gapSeconds = this.calculateGapSeconds(
      fromBlock.endTime,
      toBlock.startTime
    );

    try {
      // Check if edge exists
      const existingEdgeQuery = aql`
        FOR edge IN NEXT_BLOCK
          FILTER edge._from == CONCAT('blocks/', ${fromKey})
          FILTER edge._to == CONCAT('blocks/', ${toKey})
          RETURN edge
      `;

      const cursor = await db.query(existingEdgeQuery);
      const existingEdge = await cursor.next();

      if (existingEdge) {
        // Update existing edge
        const updateQuery = aql`
          UPDATE ${existingEdge._key} WITH {
            frequency: ${existingEdge.frequency + 1},
            avgGapSeconds: (${existingEdge.avgGapSeconds} * ${existingEdge.frequency} + ${gapSeconds}) / (${existingEdge.frequency} + 1),
            sessionCount: ${existingEdge.sessionCount + 1},
            updatedAt: DATE_ISO8601(DATE_NOW())
          } IN NEXT_BLOCK
          RETURN NEW
        `;

        await db.query(updateQuery);

        this.logger.debug('Updated NEXT_BLOCK edge', {
          from: fromSlug,
          to: toSlug,
          newFrequency: existingEdge.frequency + 1,
        });
      } else {
        // Create new edge
        const insertQuery = aql`
          INSERT {
            _from: CONCAT('blocks/', ${fromKey}),
            _to: CONCAT('blocks/', ${toKey}),
            type: 'NEXT_BLOCK',
            frequency: 1,
            probability: 0,
            avgGapSeconds: ${gapSeconds},
            patternIds: [],
            sessionCount: 1,
            strength: 'weak',
            createdAt: DATE_ISO8601(DATE_NOW()),
            updatedAt: DATE_ISO8601(DATE_NOW())
          } IN NEXT_BLOCK
          RETURN NEW
        `;

        await db.query(insertQuery);

        this.logger.debug('Created NEXT_BLOCK edge', {
          from: fromSlug,
          to: toSlug,
        });
      }
    } catch (error) {
      this.logger.error('Failed to create/update NEXT_BLOCK edge', {
        from: fromSlug,
        to: toSlug,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - edge creation is non-critical
    }
  }

  /**
   * Recalculate transition probabilities for affected blocks
   */
  private async recalculateTransitionProbabilities(
    blockSlugs: string[]
  ): Promise<void> {
    const db = await this.ensureInitialized();

    // Get unique slugs
    const uniqueSlugs = [...new Set(blockSlugs)];

    for (const slug of uniqueSlugs) {
      try {
        const blockKey = `blk_${slug}`;

        const query = aql`
          LET fromBlock = DOCUMENT(blocks, ${blockKey})

          // Skip if block doesn't exist
          FILTER fromBlock != null

          // Get all outgoing NEXT_BLOCK edges
          LET outEdges = (
            FOR edge IN NEXT_BLOCK
              FILTER edge._from == fromBlock._id
              RETURN edge
          )

          LET totalFrequency = SUM(outEdges[*].frequency)

          // Update each edge with probability and strength
          FOR edge IN outEdges
            LET probability = totalFrequency > 0 ? edge.frequency / totalFrequency : 0
            LET strength = probability > 0.5 ? 'strong' :
                          probability > 0.2 ? 'medium' : 'weak'
            UPDATE edge WITH {
              probability: probability,
              strength: strength
            } IN NEXT_BLOCK
        `;

        await db.query(query);
      } catch (error) {
        this.logger.warn('Failed to recalculate probabilities for block', {
          slug,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.logger.debug('Recalculated transition probabilities', {
      blockCount: uniqueSlugs.length,
    });
  }

  /**
   * Get frequent block sequences for pattern detection
   */
  async getFrequentBlockSequences(
    userId: string,
    minFrequency: number = 3,
    maxLength: number = 5
  ): Promise<Array<{
    blocks: Array<{ id: string; name: string; intent: string }>;
    frequency: number;
    confidence: number;
  }>> {
    const db = await this.ensureInitialized();

    try {
      const query = aql`
        // Get starting blocks (blocks with high occurrence)
        FOR startBlock IN blocks
          FILTER startBlock.userId == ${userId}
          FILTER startBlock.occurrenceCount >= ${minFrequency}

          // Traverse forward through NEXT_BLOCK edges
          FOR v, e, p IN 1..${maxLength} OUTBOUND startBlock NEXT_BLOCK
            OPTIONS { order: 'bfs' }
            FILTER e.frequency >= ${Math.floor(minFrequency / 2)}

            LET pathBlocks = (
              FOR vertex IN p.vertices
                RETURN {
                  id: vertex._key,
                  name: vertex.canonicalName,
                  intent: vertex.intentLabel
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

            FILTER pathFrequency >= ${minFrequency}

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
      const uniqueSequences = new Map<
        string,
        { blocks: any[]; frequency: number; confidence: number }
      >();

      for (const result of results) {
        const key = result.blocks.map((b: any) => b.id).join('->');
        if (!uniqueSequences.has(key) || uniqueSequences.get(key)!.frequency < result.frequency) {
          uniqueSequences.set(key, result);
        }
      }

      const sequences = Array.from(uniqueSequences.values());

      this.logger.info('Found frequent block sequences', {
        userId,
        sequenceCount: sequences.length,
        minFrequency,
      });

      return sequences;
    } catch (error) {
      this.logger.error('Failed to get frequent block sequences', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Get block transitions for a specific block
   */
  async getBlockTransitions(
    blockSlug: string
  ): Promise<{
    outgoing: Array<{
      toBlock: string;
      frequency: number;
      probability: number;
      strength: EdgeStrength;
    }>;
    incoming: Array<{
      fromBlock: string;
      frequency: number;
      probability: number;
      strength: EdgeStrength;
    }>;
  }> {
    const db = await this.ensureInitialized();
    const blockKey = `blk_${blockSlug}`;

    try {
      const query = aql`
        LET block = DOCUMENT(blocks, ${blockKey})

        LET outgoing = (
          FOR edge IN NEXT_BLOCK
            FILTER edge._from == block._id
            LET toBlock = DOCUMENT(edge._to)
            RETURN {
              toBlock: toBlock.canonicalName,
              frequency: edge.frequency,
              probability: edge.probability,
              strength: edge.strength
            }
        )

        LET incoming = (
          FOR edge IN NEXT_BLOCK
            FILTER edge._to == block._id
            LET fromBlock = DOCUMENT(edge._from)
            RETURN {
              fromBlock: fromBlock.canonicalName,
              frequency: edge.frequency,
              probability: edge.probability,
              strength: edge.strength
            }
        )

        RETURN {
          outgoing: outgoing,
          incoming: incoming
        }
      `;

      const cursor = await db.query(query);
      const result = await cursor.next();

      return result || { outgoing: [], incoming: [] };
    } catch (error) {
      this.logger.error('Failed to get block transitions', {
        blockSlug,
        error: error instanceof Error ? error.message : String(error),
      });
      return { outgoing: [], incoming: [] };
    }
  }

  /**
   * Calculate gap in seconds between two timestamps
   */
  private calculateGapSeconds(start: string, end: string): number {
    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();
    return Math.max(0, (endMs - startMs) / 1000);
  }

  /**
   * Determine edge strength from probability
   */
  private getEdgeStrength(probability: number): EdgeStrength {
    if (probability > 0.5) return EdgeStrength.Strong;
    if (probability > 0.2) return EdgeStrength.Medium;
    return EdgeStrength.Weak;
  }
}
