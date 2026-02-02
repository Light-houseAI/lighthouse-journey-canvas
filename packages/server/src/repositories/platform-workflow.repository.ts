/**
 * Platform Workflow Repository
 *
 * Repository for storing and retrieving anonymized workflow/step patterns
 * used for peer comparison in the insight generation system.
 *
 * Implements dual storage:
 * - PostgreSQL (pgvector) for vector similarity search
 * - Could extend to ArangoDB for graph-based pattern matching
 */

import { eq, sql, and, desc, gt } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { Logger } from '../core/logger.js';
import {
  platformWorkflowPatterns,
  platformStepPatterns,
} from '@journey/schema';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Workflow pattern for storage
 */
export interface WorkflowPatternInput {
  workflowHash: string;
  workflowType: string;
  roleCategory: string | null;
  stepCount: number;
  avgDurationSeconds: number;
  stepSequence: Array<{
    order: number;
    type: string;
    toolCategory: string;
    avgDuration: number;
    description?: string;
  }>;
  toolPatterns: Record<string, number>;
  embedding?: number[];
}

/**
 * Step pattern for storage
 */
export interface StepPatternInput {
  stepHash: string;
  stepType: string;
  toolCategory: string | null;
  avgDurationSeconds: number;
  efficiencyIndicators?: {
    contextSwitches?: number;
    idlePercentage?: number;
    reworkRate?: number;
  };
  embedding?: number[];
}

/**
 * Retrieved workflow pattern
 */
export interface WorkflowPatternResult {
  id: number;
  workflowHash: string;
  workflowType: string;
  roleCategory: string | null;
  stepCount: number;
  avgDurationSeconds: number;
  occurrenceCount: number;
  efficiencyScore: number | null;
  stepSequence: Array<{
    order: number;
    type: string;
    toolCategory: string;
    avgDuration: number;
    description?: string;
  }>;
  toolPatterns: Record<string, number>;
  similarityScore?: number;
  createdAt: Date;
}

/**
 * Retrieved step pattern
 */
export interface StepPatternResult {
  id: number;
  stepHash: string;
  stepType: string;
  toolCategory: string | null;
  avgDurationSeconds: number;
  occurrenceCount: number;
  efficiencyIndicators: {
    contextSwitches?: number;
    idlePercentage?: number;
    reworkRate?: number;
  };
  similarityScore?: number;
  createdAt: Date;
}

/**
 * Search options for workflow patterns
 */
export interface WorkflowSearchOptions {
  workflowType?: string;
  roleCategory?: string;
  minEfficiencyScore?: number;
  limit?: number;
  /** LEVEL 2b: Domain keywords for hybrid search (vector + keyword matching) */
  domainKeywords?: string[];
}

// ============================================================================
// REPOSITORY
// ============================================================================

export interface PlatformWorkflowRepositoryDeps {
  db: PostgresJsDatabase<any>;
  logger: Logger;
}

export class PlatformWorkflowRepository {
  private readonly db: PostgresJsDatabase<any>;
  private readonly logger: Logger;

  constructor(deps: PlatformWorkflowRepositoryDeps) {
    this.db = deps.db;
    this.logger = deps.logger;
  }

  // --------------------------------------------------------------------------
  // WORKFLOW PATTERNS
  // --------------------------------------------------------------------------

  /**
   * Upsert a workflow pattern (insert or increment occurrence count)
   */
  async upsertWorkflowPattern(pattern: WorkflowPatternInput): Promise<number> {
    this.logger.debug('Upserting workflow pattern', {
      hash: pattern.workflowHash,
      type: pattern.workflowType,
    });

    // Check if pattern already exists
    const existing = await this.db
      .select()
      .from(platformWorkflowPatterns)
      .where(eq(platformWorkflowPatterns.workflowHash, pattern.workflowHash))
      .limit(1);

    if (existing.length > 0) {
      // Update occurrence count and compute running average duration
      const existingPattern = existing[0];
      const newOccurrenceCount = existingPattern.occurrenceCount + 1;
      const newAvgDuration = Math.round(
        (existingPattern.avgDurationSeconds * existingPattern.occurrenceCount +
          pattern.avgDurationSeconds) /
          newOccurrenceCount
      );

      await this.db
        .update(platformWorkflowPatterns)
        .set({
          occurrenceCount: newOccurrenceCount,
          avgDurationSeconds: newAvgDuration,
          updatedAt: new Date(),
        })
        .where(eq(platformWorkflowPatterns.id, existingPattern.id));

      return existingPattern.id;
    }

    // Insert new pattern
    const result = await this.db
      .insert(platformWorkflowPatterns)
      .values({
        workflowHash: pattern.workflowHash,
        workflowType: pattern.workflowType as any,
        roleCategory: pattern.roleCategory as any,
        stepCount: pattern.stepCount,
        avgDurationSeconds: pattern.avgDurationSeconds,
        occurrenceCount: 1,
        stepSequence: pattern.stepSequence,
        toolPatterns: pattern.toolPatterns,
        embedding: pattern.embedding,
      })
      .returning({ id: platformWorkflowPatterns.id });

    return result[0].id;
  }

  /**
   * Search workflow patterns by vector similarity
   */
  async searchByEmbedding(
    embedding: number[],
    options: WorkflowSearchOptions = {}
  ): Promise<WorkflowPatternResult[]> {
    const limit = options.limit || 10;

    this.logger.debug('Searching workflow patterns by embedding', {
      workflowType: options.workflowType,
      limit,
    });

    // Convert to proper array format for pgvector (handles Float32Array and other typed arrays)
    const embeddingArray = Array.isArray(embedding) ? embedding : Array.from(embedding);
    const vectorString = `[${embeddingArray.join(',')}]`;

    // Build query with optional filters
    let query = sql`
      SELECT
        id,
        workflow_hash as "workflowHash",
        workflow_type as "workflowType",
        role_category as "roleCategory",
        step_count as "stepCount",
        avg_duration_seconds as "avgDurationSeconds",
        occurrence_count as "occurrenceCount",
        efficiency_score as "efficiencyScore",
        step_sequence as "stepSequence",
        tool_patterns as "toolPatterns",
        1 - (embedding <=> ${vectorString}::vector) as "similarityScore",
        created_at as "createdAt"
      FROM platform_workflow_patterns
      WHERE embedding IS NOT NULL
    `;

    // Add optional filters
    if (options.workflowType) {
      query = sql`${query} AND workflow_type = ${options.workflowType}`;
    }
    if (options.roleCategory) {
      query = sql`${query} AND role_category = ${options.roleCategory}`;
    }
    if (options.minEfficiencyScore) {
      query = sql`${query} AND efficiency_score >= ${options.minEfficiencyScore}`;
    }

    // LEVEL 2b: Add domain keyword filter for hybrid search
    // This ensures platform workflow patterns match at least one domain-specific keyword
    if (options.domainKeywords && options.domainKeywords.length > 0) {
      const keywordPattern = options.domainKeywords
        .map(kw => kw.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|');

      query = sql`${query} AND (
        LOWER(COALESCE(workflow_type, '')) ~* ${keywordPattern}
        OR LOWER(COALESCE(step_sequence::text, '')) ~* ${keywordPattern}
        OR LOWER(COALESCE(tool_patterns::text, '')) ~* ${keywordPattern}
      )`;

      this.logger.debug('Applied domain keyword filter to platform workflow search', {
        domainKeywords: options.domainKeywords,
        keywordPattern,
      });
    }

    query = sql`${query} ORDER BY embedding <=> ${vectorString}::vector LIMIT ${limit}`;

    const results = await this.db.execute(query);

    return results.rows as WorkflowPatternResult[];
  }

  /**
   * Search workflow patterns by type and role
   */
  async searchByTypeAndRole(
    workflowType: string,
    roleCategory?: string,
    limit: number = 10
  ): Promise<WorkflowPatternResult[]> {
    this.logger.debug('Searching workflow patterns by type', {
      workflowType,
      roleCategory,
    });

    const conditions = [
      eq(platformWorkflowPatterns.workflowType, workflowType as any),
    ];

    if (roleCategory) {
      conditions.push(
        eq(platformWorkflowPatterns.roleCategory, roleCategory as any)
      );
    }

    const results = await this.db
      .select()
      .from(platformWorkflowPatterns)
      .where(and(...conditions))
      .orderBy(desc(platformWorkflowPatterns.efficiencyScore))
      .limit(limit);

    return results.map((r) => ({
      id: r.id,
      workflowHash: r.workflowHash,
      workflowType: r.workflowType,
      roleCategory: r.roleCategory,
      stepCount: r.stepCount,
      avgDurationSeconds: r.avgDurationSeconds,
      occurrenceCount: r.occurrenceCount,
      efficiencyScore: r.efficiencyScore ? parseFloat(r.efficiencyScore) : null,
      stepSequence: r.stepSequence as any,
      toolPatterns: r.toolPatterns as Record<string, number>,
      createdAt: r.createdAt!,
    }));
  }

  /**
   * Get top efficient workflows for a given type
   */
  async getTopEfficientWorkflows(
    workflowType: string,
    limit: number = 5
  ): Promise<WorkflowPatternResult[]> {
    this.logger.debug('Getting top efficient workflows', { workflowType, limit });

    const results = await this.db
      .select()
      .from(platformWorkflowPatterns)
      .where(
        and(
          eq(platformWorkflowPatterns.workflowType, workflowType as any),
          gt(platformWorkflowPatterns.occurrenceCount, 2) // Only patterns seen multiple times
        )
      )
      .orderBy(desc(platformWorkflowPatterns.efficiencyScore))
      .limit(limit);

    return results.map((r) => ({
      id: r.id,
      workflowHash: r.workflowHash,
      workflowType: r.workflowType,
      roleCategory: r.roleCategory,
      stepCount: r.stepCount,
      avgDurationSeconds: r.avgDurationSeconds,
      occurrenceCount: r.occurrenceCount,
      efficiencyScore: r.efficiencyScore ? parseFloat(r.efficiencyScore) : null,
      stepSequence: r.stepSequence as any,
      toolPatterns: r.toolPatterns as Record<string, number>,
      createdAt: r.createdAt!,
    }));
  }

  /**
   * Update efficiency score for a workflow pattern
   */
  async updateEfficiencyScore(
    workflowHash: string,
    efficiencyScore: number
  ): Promise<void> {
    await this.db
      .update(platformWorkflowPatterns)
      .set({
        efficiencyScore: String(efficiencyScore),
        updatedAt: new Date(),
      })
      .where(eq(platformWorkflowPatterns.workflowHash, workflowHash));
  }

  // --------------------------------------------------------------------------
  // STEP PATTERNS
  // --------------------------------------------------------------------------

  /**
   * Upsert a step pattern
   */
  async upsertStepPattern(pattern: StepPatternInput): Promise<number> {
    this.logger.debug('Upserting step pattern', {
      hash: pattern.stepHash,
      type: pattern.stepType,
    });

    // Check if pattern already exists
    const existing = await this.db
      .select()
      .from(platformStepPatterns)
      .where(eq(platformStepPatterns.stepHash, pattern.stepHash))
      .limit(1);

    if (existing.length > 0) {
      // Update occurrence count and running average duration
      const existingPattern = existing[0];
      const newOccurrenceCount = existingPattern.occurrenceCount + 1;
      const newAvgDuration = Math.round(
        (existingPattern.avgDurationSeconds * existingPattern.occurrenceCount +
          pattern.avgDurationSeconds) /
          newOccurrenceCount
      );

      await this.db
        .update(platformStepPatterns)
        .set({
          occurrenceCount: newOccurrenceCount,
          avgDurationSeconds: newAvgDuration,
          updatedAt: new Date(),
        })
        .where(eq(platformStepPatterns.id, existingPattern.id));

      return existingPattern.id;
    }

    // Insert new pattern
    const result = await this.db
      .insert(platformStepPatterns)
      .values({
        stepHash: pattern.stepHash,
        stepType: pattern.stepType as any,
        toolCategory: pattern.toolCategory,
        avgDurationSeconds: pattern.avgDurationSeconds,
        occurrenceCount: 1,
        efficiencyIndicators: pattern.efficiencyIndicators || {},
        embedding: pattern.embedding,
      })
      .returning({ id: platformStepPatterns.id });

    return result[0].id;
  }

  /**
   * Search step patterns by vector similarity
   */
  async searchStepsByEmbedding(
    embedding: number[],
    stepType?: string,
    limit: number = 10
  ): Promise<StepPatternResult[]> {
    this.logger.debug('Searching step patterns by embedding', { stepType, limit });

    // Convert to proper array format for pgvector (handles Float32Array and other typed arrays)
    const embeddingArray = Array.isArray(embedding) ? embedding : Array.from(embedding);
    const vectorString = `[${embeddingArray.join(',')}]`;

    let query = sql`
      SELECT
        id,
        step_hash as "stepHash",
        step_type as "stepType",
        tool_category as "toolCategory",
        avg_duration_seconds as "avgDurationSeconds",
        occurrence_count as "occurrenceCount",
        efficiency_indicators as "efficiencyIndicators",
        1 - (embedding <=> ${vectorString}::vector) as "similarityScore",
        created_at as "createdAt"
      FROM platform_step_patterns
      WHERE embedding IS NOT NULL
    `;

    if (stepType) {
      query = sql`${query} AND step_type = ${stepType}`;
    }

    query = sql`${query} ORDER BY embedding <=> ${vectorString}::vector LIMIT ${limit}`;

    const results = await this.db.execute(query);

    return results.rows as StepPatternResult[];
  }

  /**
   * Get average duration for a step type
   */
  async getAverageStepDuration(stepType: string): Promise<number | null> {
    const result = await this.db
      .select({
        avgDuration: sql<number>`AVG(avg_duration_seconds)`,
      })
      .from(platformStepPatterns)
      .where(eq(platformStepPatterns.stepType, stepType as any));

    return result[0]?.avgDuration || null;
  }

  // --------------------------------------------------------------------------
  // STATISTICS
  // --------------------------------------------------------------------------

  /**
   * Get platform statistics
   */
  async getStatistics(): Promise<{
    totalWorkflowPatterns: number;
    totalStepPatterns: number;
    workflowTypeDistribution: Record<string, number>;
    avgEfficiencyScore: number | null;
  }> {
    const [workflowCount, stepCount, typeDistribution, avgEfficiency] =
      await Promise.all([
        this.db
          .select({ count: sql<number>`COUNT(*)` })
          .from(platformWorkflowPatterns),
        this.db
          .select({ count: sql<number>`COUNT(*)` })
          .from(platformStepPatterns),
        this.db
          .select({
            type: platformWorkflowPatterns.workflowType,
            count: sql<number>`COUNT(*)`,
          })
          .from(platformWorkflowPatterns)
          .groupBy(platformWorkflowPatterns.workflowType),
        this.db
          .select({
            avg: sql<number>`AVG(efficiency_score)`,
          })
          .from(platformWorkflowPatterns),
      ]);

    const distribution: Record<string, number> = {};
    for (const row of typeDistribution) {
      distribution[row.type] = Number(row.count);
    }

    return {
      totalWorkflowPatterns: Number(workflowCount[0]?.count || 0),
      totalStepPatterns: Number(stepCount[0]?.count || 0),
      workflowTypeDistribution: distribution,
      avgEfficiencyScore: avgEfficiency[0]?.avg || null,
    };
  }
}
