/**
 * Flow Persistence Service
 *
 * CRUD operations for nano agent flows with org-based sharing.
 * Flows are stored in PostgreSQL nano_agent_flows table.
 */

import { eq, and, or, sql, ilike, inArray, desc } from 'drizzle-orm';
import type { Logger } from '../../core/logger.js';
import {
  nanoAgentFlows,
  nanoAgentExecutions,
  NanoAgentFlowSourceType,
  type NanoAgentFlow,
  type InsertNanoAgentFlow,
} from '@journey/schema';
import type { ExecutableAction } from './types.js';

// ============================================================================
// TYPES
// ============================================================================

export interface FlowServiceDeps {
  logger: Logger;
  database: any; // Drizzle database instance
}

export interface CreateFlowInput {
  name: string;
  description?: string;
  actions: ExecutableAction[];
  tags?: string[];
  sourceType?: 'custom' | 'workflow_pattern' | 'hybrid';
  sourcePatternId?: string;
}

export interface UpdateFlowInput {
  name?: string;
  description?: string;
  actions?: ExecutableAction[];
  tags?: string[];
}

export interface ListFlowsOptions {
  search?: string;
  tags?: string[];
  includeShared?: boolean;
  limit?: number;
  offset?: number;
}

// ============================================================================
// SERVICE
// ============================================================================

export class FlowService {
  private logger: Logger;
  private db: any;

  constructor({ logger, database }: FlowServiceDeps) {
    this.logger = logger;
    this.db = database;
  }

  /**
   * Create a new flow
   */
  async createFlow(userId: number, input: CreateFlowInput): Promise<NanoAgentFlow> {
    this.logger.info('[FlowService] Creating flow', { userId, name: input.name });

    const [flow] = await this.db
      .insert(nanoAgentFlows)
      .values({
        userId,
        name: input.name,
        description: input.description || '',
        actions: input.actions as any,
        tags: input.tags || [],
        sourceType: (input.sourceType || 'custom') as NanoAgentFlowSourceType,
        sourcePatternId: input.sourcePatternId || null,
      } satisfies Partial<InsertNanoAgentFlow>)
      .returning();

    return flow;
  }

  /**
   * Get a flow by ID with permission check
   */
  async getFlow(flowId: string, userId: number): Promise<NanoAgentFlow | null> {
    const [flow] = await this.db
      .select()
      .from(nanoAgentFlows)
      .where(eq(nanoAgentFlows.id, flowId))
      .limit(1);

    if (!flow) return null;

    // Owner can always access
    if (flow.userId === userId) return flow;

    // Shared flows accessible to org members (checked at controller level)
    if (flow.isTemplate && flow.orgId) return flow;

    return null;
  }

  /**
   * Update a flow (owner only)
   */
  async updateFlow(
    flowId: string,
    userId: number,
    input: UpdateFlowInput
  ): Promise<NanoAgentFlow | null> {
    const existing = await this.getFlow(flowId, userId);
    if (!existing || existing.userId !== userId) return null;

    const updateData: Record<string, any> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.actions !== undefined) updateData.actions = input.actions;
    if (input.tags !== undefined) updateData.tags = input.tags;

    if (Object.keys(updateData).length === 0) return existing;

    const [updated] = await this.db
      .update(nanoAgentFlows)
      .set(updateData)
      .where(and(eq(nanoAgentFlows.id, flowId), eq(nanoAgentFlows.userId, userId)))
      .returning();

    return updated || null;
  }

  /**
   * Delete a flow (owner only)
   */
  async deleteFlow(flowId: string, userId: number): Promise<boolean> {
    const result = await this.db
      .delete(nanoAgentFlows)
      .where(and(eq(nanoAgentFlows.id, flowId), eq(nanoAgentFlows.userId, userId)))
      .returning({ id: nanoAgentFlows.id });

    return result.length > 0;
  }

  /**
   * List user's own flows + optionally shared flows
   */
  async listFlows(
    userId: number,
    userOrgIds: number[],
    options: ListFlowsOptions = {}
  ): Promise<{ flows: NanoAgentFlow[]; total: number }> {
    const { search, tags, includeShared = true, limit = 50, offset = 0 } = options;

    // Build conditions: user's own flows OR shared org flows
    const conditions: any[] = [eq(nanoAgentFlows.userId, userId)];

    if (includeShared && userOrgIds.length > 0) {
      conditions.push(
        and(eq(nanoAgentFlows.isTemplate, true), inArray(nanoAgentFlows.orgId, userOrgIds))
      );
    }

    let whereClause = or(...conditions);

    // Optional search filter
    if (search) {
      whereClause = and(whereClause, ilike(nanoAgentFlows.name, `%${search}%`));
    }

    // Optional tag filter
    if (tags && tags.length > 0) {
      whereClause = and(
        whereClause,
        sql`${nanoAgentFlows.tags} && ARRAY[${sql.join(tags.map((t) => sql`${t}`), sql`, `)}]::text[]`
      );
    }

    const flows = await this.db
      .select()
      .from(nanoAgentFlows)
      .where(whereClause)
      .orderBy(desc(nanoAgentFlows.updatedAt))
      .limit(limit)
      .offset(offset);

    // Count total for pagination
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(nanoAgentFlows)
      .where(whereClause);

    return { flows, total: count };
  }

  /**
   * Share a flow with an organization
   */
  async shareWithOrg(flowId: string, userId: number, orgId: number): Promise<NanoAgentFlow | null> {
    const existing = await this.getFlow(flowId, userId);
    if (!existing || existing.userId !== userId) return null;

    const [updated] = await this.db
      .update(nanoAgentFlows)
      .set({ isTemplate: true, orgId })
      .where(and(eq(nanoAgentFlows.id, flowId), eq(nanoAgentFlows.userId, userId)))
      .returning();

    return updated || null;
  }

  /**
   * Fork (copy) a shared flow to user's own collection
   */
  async forkFlow(flowId: string, userId: number): Promise<NanoAgentFlow | null> {
    const source = await this.getFlow(flowId, userId);
    if (!source) return null;

    const [forked] = await this.db
      .insert(nanoAgentFlows)
      .values({
        userId,
        name: `${source.name} (copy)`,
        description: source.description,
        actions: source.actions,
        tags: source.tags,
        sourceType: source.sourceType,
        sourcePatternId: source.sourcePatternId,
      } satisfies Partial<InsertNanoAgentFlow>)
      .returning();

    return forked;
  }

  /**
   * Record an execution (increment runCount and set lastRunAt)
   */
  async recordExecution(flowId: string): Promise<void> {
    await this.db
      .update(nanoAgentFlows)
      .set({
        runCount: sql`${nanoAgentFlows.runCount} + 1`,
        lastRunAt: new Date(),
      })
      .where(eq(nanoAgentFlows.id, flowId));
  }
}
