/**
 * Context Stitching Persistence Service
 *
 * Persists context stitching results (Tier 1, 2, 3) to ArangoDB graph
 * - Tier 1: Workstreams (outcome-based groupings)
 * - Tier 2: Tool Mastery (tool usage patterns)
 * - Tier 3: Process Patterns (repetitive cross-tool sequences)
 */

import type { Workstream, ToolMasteryGroup, ProcessPattern } from './insight-generation/types.js';
import type { ArangoDBGraphService } from './arangodb-graph.service.js';
import type { Logger } from '../core/logger.js';

export class ContextStitchingPersistenceService {
  constructor(
    private readonly arangoDBGraphService: ArangoDBGraphService,
    private readonly logger: Logger
  ) {}

  /**
   * Persist workstreams from context stitching to ArangoDB (Tier 1)
   * Creates workstream nodes + edges to sessions
   */
  async persistWorkstreams(
    userId: number,
    workstreams: Workstream[]
  ): Promise<void> {
    for (const ws of workstreams) {
      // Upsert workstream node
      await this.arangoDBGraphService.upsertWorkstream({
        workstreamId: ws.workstreamId,
        userId,
        name: ws.name,
        outcomeDescription: ws.outcomeDescription,
        confidence: ws.confidence,
        topics: ws.topics,
        toolsUsed: ws.toolsUsed,
        firstActivity: ws.firstActivity,
        lastActivity: ws.lastActivity,
        totalDurationSeconds: ws.totalDurationSeconds,
      });

      // Create edges: session -> workstream
      // Note: sessionIds from StitchedContext are external_id format
      for (const sessionExternalId of ws.sessionIds) {
        await this.arangoDBGraphService.createSessionInWorkstreamEdge(
          sessionExternalId,
          ws.workstreamId,
          userId,
          ws.confidence
        );
      }
    }

    this.logger.info('Persisted workstreams to graph', {
      count: workstreams.length,
      userId,
    });
  }

  /**
   * Persist tool mastery groups to ArangoDB (Tier 2)
   */
  async persistToolMasteryGroups(
    userId: number,
    groups: ToolMasteryGroup[]
  ): Promise<void> {
    for (const group of groups) {
      await this.arangoDBGraphService.upsertToolMasteryGroup({
        userId,
        toolName: group.toolName,
        usagePatterns: group.usagePatterns,
        totalTimeSeconds: group.totalTimeSeconds,
        optimizationOpportunities: group.optimizationOpportunities,
      });

      // Create edges: tool_mastery -> sessions (PATTERN_OBSERVED)
      for (const sessionExternalId of group.sessionIds) {
        const normalizedTool = group.toolName.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
        const masteryKey = `mastery_${userId}_${normalizedTool}`;
        const sessionKey = `session_${sessionExternalId.replace(/[^a-zA-Z0-9]/g, '_')}`;

        await this.arangoDBGraphService.createEdge(
          'PATTERN_OBSERVED',
          `tool_mastery/${masteryKey}`,
          `sessions/${sessionKey}`,
          {
            tool_name: group.toolName,
            created_at: new Date().toISOString(),
          }
        );
      }
    }

    this.logger.info('Persisted tool mastery groups to graph', {
      count: groups.length,
      userId,
    });
  }

  /**
   * Persist process patterns (Tier 3) to ArangoDB
   * Persists repetitive cross-tool workflow sequences
   */
  async persistProcessPatterns(
    userId: number,
    patterns: ProcessPattern[]
  ): Promise<void> {
    for (const pattern of patterns) {
      await this.arangoDBGraphService.upsertProcessPattern({
        patternId: pattern.patternId,
        userId,
        patternName: pattern.patternName,
        workflow: pattern.workflow,
        frequency: pattern.frequency,
        avgDurationSeconds: pattern.avgDurationSeconds,
        firstSeen: pattern.firstSeen,
        lastSeen: pattern.lastSeen,
        automationPotential: pattern.optimization.automationPotential,
        suggestions: pattern.optimization.suggestions,
      });

      // Create edges to sessions (PATTERN_INSTANCE)
      for (const sessionExternalId of pattern.sessionIds) {
        const sessionKey = `session_${sessionExternalId.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const patternKey = `pattern_${userId}_${pattern.patternId}`;

        await this.arangoDBGraphService.createEdge(
          'PATTERN_INSTANCE',
          `process_patterns/${patternKey}`,
          `sessions/${sessionKey}`,
          {
            pattern_name: pattern.patternName,
            created_at: new Date().toISOString(),
          }
        );
      }
    }

    this.logger.info('Persisted process patterns to graph', {
      count: patterns.length,
      userId,
    });
  }

  /**
   * Retrieve workstreams for a user (Tier 1)
   */
  async getWorkstreamsByUser(
    userId: number,
    options?: { minConfidence?: number; limit?: number }
  ): Promise<Workstream[]> {
    const results = await this.arangoDBGraphService.getWorkstreamsByUser(userId, options);
    return results as Workstream[];
  }

  /**
   * Get tool mastery data for a user (Tier 2)
   */
  async getToolMasteryByUser(
    userId: number,
    toolName?: string
  ): Promise<ToolMasteryGroup[]> {
    const results = await this.arangoDBGraphService.getToolMasteryGroupsByUser(userId, toolName);
    return results as ToolMasteryGroup[];
  }

  /**
   * Get process patterns for a user (Tier 3)
   */
  async getProcessPatternsByUser(
    userId: number,
    options?: { minFrequency?: number; limit?: number }
  ): Promise<ProcessPattern[]> {
    const results = await this.arangoDBGraphService.getProcessPatternsByUser(userId, options);
    return results as ProcessPattern[];
  }
}
