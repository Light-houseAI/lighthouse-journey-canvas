/**
 * Context Stitching Endpoint Service
 *
 * Pre-computes cumulative context stitching when the desktop app finishes
 * analyzing a session. Uses a chain-based O(1) approach: each new session
 * builds on the PREVIOUS session's already-stitched context (rolling accumulator),
 * rather than re-processing all N sessions.
 *
 * Called by: POST /api/v2/sessions/stitch-context (desktop app during "analyzing" phase)
 * Persisted in: session_mappings.stitched_context (JSONB)
 * Read by: A1 Retrieval Agent (instead of on-the-fly stitching)
 *
 * Three tiers:
 * - Tier 1: Outcome-Based Workstreams (LLM-based, reuses identifyWorkstreamForSession)
 * - Tier 2: Tool-Mastery Groups (data merge from previous stitched_context)
 * - Tier 3: Process Pattern Detection (Helix AGGREGATE_BY, incremental merge)
 */

import type { Logger } from '../core/logger.js';
import type { LLMProvider } from '../core/llm-provider.js';
import type { EmbeddingService } from './interfaces/index.js';
import type { SessionMappingRepository } from '../repositories/session-mapping.repository.js';
import type { UserWorkstreamRepository, UserWorkstream } from '../repositories/user-workstream.repository.js';
import type { HelixGraphService } from './helix-graph.service.js';
import {
  createContextStitchingService,
  type SessionForStitching,
  type Workstream,
  type ToolMasteryGroup,
  type ToolUsagePattern,
} from './insight-generation/context-stitching.service.js';
import type { RepetitiveWorkflowPattern } from './insight-generation/types.js';

// ============================================================================
// TYPES
// ============================================================================

export interface StitchContextRequest {
  sessionId: string;
  workflowName: string;
  summary: Record<string, unknown>;
  screenshotDescriptions?: Record<string, { description: string; app: string; category: string }>;
  gapAnalysis?: Record<string, unknown>;
  appsUsed: string[];
  startTime: number;
  endTime: number;
}

export interface PerSessionStitchedContext {
  /** Tier 1: Which workstream/project this session belongs to */
  workstreamAssignment: {
    workstreamId: string;
    workstreamName: string;
    outcomeDescription: string;
    confidence: number;
    evidenceTier: 'F1' | 'F2' | 'F3';
    reason: string;
    relatedSessionIds: string[];
  } | null;

  /** Tier 2: Tool mastery groups this session contributes to */
  toolMasteryGroups: ToolMasteryGroup[];

  /** Tier 3: Repetitive patterns detected involving this session */
  repetitivePatterns: RepetitiveWorkflowPattern[];

  /** Cumulative context from previous sessions */
  cumulativeContext: {
    relatedSessionSummaries: Array<{
      sessionId: string;
      highLevelSummary: string;
      workflowName: string;
      timestamp: string;
    }>;
    relatedScreenshotDescriptions: Array<{
      sessionId: string;
      timestamp: string;
      description: string;
      app: string;
      category: string;
    }>;
    relatedGapAnalysisHighlights: Array<{
      sessionId: string;
      keyRecommendations: string[];
      efficiencyScore: number;
    }>;
    previousSessionCount: number;
  };

  /** Metadata */
  stitchedAt: string;
  stitchingVersion: string;
}

// Maximum number of entries to keep in cumulative context (rolling window)
const MAX_CUMULATIVE_SUMMARIES = 20;
const MAX_CUMULATIVE_SCREENSHOTS = 50;
const MAX_CUMULATIVE_GAP_HIGHLIGHTS = 20;
const STITCHING_VERSION = '1.0.0';

// ============================================================================
// SERVICE
// ============================================================================

export class ContextStitchingEndpointService {
  private readonly logger: Logger;
  private readonly llmProvider: LLMProvider;
  private readonly embeddingService: EmbeddingService;
  private readonly sessionMappingRepository: SessionMappingRepository;
  private readonly userWorkstreamRepository: UserWorkstreamRepository;
  private readonly helixGraphService: HelixGraphService;

  constructor({
    logger,
    llmProvider,
    openAIEmbeddingService,
    sessionMappingRepository,
    userWorkstreamRepository,
    helixGraphService,
  }: {
    logger: Logger;
    llmProvider: LLMProvider;
    openAIEmbeddingService: EmbeddingService;
    sessionMappingRepository: SessionMappingRepository;
    userWorkstreamRepository: UserWorkstreamRepository;
    helixGraphService: HelixGraphService;
  }) {
    this.logger = logger;
    this.llmProvider = llmProvider;
    this.embeddingService = openAIEmbeddingService;
    this.sessionMappingRepository = sessionMappingRepository;
    this.userWorkstreamRepository = userWorkstreamRepository;
    this.helixGraphService = helixGraphService;
  }

  /**
   * Main entry point: stitch context for a new session.
   * Chain-based O(1) — reads only the previous session's stitched_context + user_workstreams.
   */
  async stitchForNewSession(
    sessionData: StitchContextRequest,
    userId: number
  ): Promise<PerSessionStitchedContext> {
    const startTime = Date.now();

    this.logger.info('ContextStitchingEndpoint: Starting stitch for new session', {
      sessionId: sessionData.sessionId,
      userId,
      workflowName: sessionData.workflowName,
    });

    // 1. Fetch the MOST RECENT session's stitched_context (O(1) — single row)
    const previousStitchedContext = await this.sessionMappingRepository.getLatestStitchedContext(userId);

    this.logger.info('ContextStitchingEndpoint: Previous stitched context loaded', {
      hasPrevious: !!previousStitchedContext,
    });

    // 2. Convert new session to SessionForStitching format
    const newSession = this.convertToSessionForStitching(sessionData);

    // 3. Run all three tiers (Tier 2 & 3 don't need LLM, so they're fast)
    const [workstreamAssignment, toolMasteryGroups, repetitivePatterns] = await Promise.all([
      this.executeTier1(newSession, userId),
      this.executeTier2(newSession, previousStitchedContext),
      this.executeTier3(userId),
    ]);

    // 4. Build cumulative context (chain from previous)
    const cumulativeContext = this.buildCumulativeContext(
      sessionData,
      previousStitchedContext
    );

    // 5. Persist workstream updates
    if (workstreamAssignment) {
      await this.persistWorkstreamUpdate(workstreamAssignment, newSession, userId);
    }

    const result: PerSessionStitchedContext = {
      workstreamAssignment,
      toolMasteryGroups,
      repetitivePatterns,
      cumulativeContext,
      stitchedAt: new Date().toISOString(),
      stitchingVersion: STITCHING_VERSION,
    };

    const processingTimeMs = Date.now() - startTime;
    this.logger.info('ContextStitchingEndpoint: Stitch complete', {
      sessionId: sessionData.sessionId,
      userId,
      processingTimeMs,
      hasWorkstream: !!workstreamAssignment,
      toolGroupCount: toolMasteryGroups.length,
      patternCount: repetitivePatterns.length,
      cumulativeSummaryCount: cumulativeContext.relatedSessionSummaries.length,
    });

    return result;
  }

  // ============================================================================
  // TIER 1: Outcome-Based Workstream Assignment
  // ============================================================================

  /**
   * Identify which workstream the new session belongs to.
   * Reuses the existing identifyWorkstreamForSession() from ContextStitchingService.
   */
  private async executeTier1(
    newSession: SessionForStitching,
    userId: number
  ): Promise<PerSessionStitchedContext['workstreamAssignment']> {
    try {
      // Fetch active workstreams from DB
      const activeWorkstreams = await this.userWorkstreamRepository.getActiveWorkstreams(userId);

      if (activeWorkstreams.length === 0) {
        this.logger.debug('ContextStitchingEndpoint: No existing workstreams, skipping Tier 1');
        return null;
      }

      // Convert DB workstreams to the Workstream interface expected by identifyWorkstreamForSession
      const workstreamsForMatching: Workstream[] = activeWorkstreams.map(ws => ({
        workstreamId: ws.workstreamId,
        name: ws.name,
        outcomeDescription: ws.outcomeDescription || '',
        confidence: ws.confidence || 0,
        sessionIds: ws.sessionIds || [],
        topics: ws.topics || [],
        toolsUsed: ws.toolsUsed || [],
        firstActivity: ws.firstActivity?.toISOString() || '',
        lastActivity: ws.lastActivity?.toISOString() || '',
        totalDurationSeconds: ws.totalDurationSeconds || 0,
      }));

      // Use the existing ContextStitchingService's identifyWorkstreamForSession
      const stitchingService = createContextStitchingService(
        this.logger,
        this.llmProvider,
        this.embeddingService
      );

      const result = await stitchingService.identifyWorkstreamForSession(
        newSession,
        workstreamsForMatching,
        [] // recentSessions not needed — we use DB workstreams directly
      );

      if (result.workstreamId && result.confidence >= 0.6) {
        // Find the matching workstream for additional details
        const matchedWorkstream = workstreamsForMatching.find(
          ws => ws.workstreamId === result.workstreamId
        );

        return {
          workstreamId: result.workstreamId,
          workstreamName: matchedWorkstream?.name || 'Unknown',
          outcomeDescription: matchedWorkstream?.outcomeDescription || '',
          confidence: result.confidence,
          evidenceTier: result.confidence >= 0.95 ? 'F1' : result.confidence >= 0.80 ? 'F2' : 'F3',
          reason: result.reason,
          relatedSessionIds: matchedWorkstream?.sessionIds || [],
        };
      }

      return null;
    } catch (error) {
      this.logger.warn('ContextStitchingEndpoint: Tier 1 failed (non-blocking)', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  // ============================================================================
  // TIER 2: Tool-Mastery Groups (Data Merge — No LLM)
  // ============================================================================

  /**
   * Merge new session's tools into the previous stitched_context's toolMasteryGroups.
   * Pure data operation — no LLM call needed.
   */
  private async executeTier2(
    newSession: SessionForStitching,
    previousStitchedContext: Record<string, unknown> | null
  ): Promise<ToolMasteryGroup[]> {
    try {
      // Start with previous tool mastery groups
      const previousGroups: ToolMasteryGroup[] =
        (previousStitchedContext?.toolMasteryGroups as ToolMasteryGroup[]) || [];

      // Create a map for fast lookup
      const groupMap = new Map<string, ToolMasteryGroup>();
      for (const group of previousGroups) {
        groupMap.set(group.toolName, { ...group });
      }

      // Merge new session's tools
      for (const tool of newSession.toolsUsed) {
        const normalizedTool = this.normalizeTool(tool);

        if (groupMap.has(normalizedTool)) {
          // Update existing group
          const existing = groupMap.get(normalizedTool)!;
          existing.sessionIds = [...new Set([...existing.sessionIds, newSession.sessionId])];
          existing.totalTimeSeconds += newSession.totalDurationSeconds;

          // Update or add usage pattern for this session's workflow
          for (const workflow of newSession.workflows) {
            if (workflow.tools.some(t => this.normalizeTool(t) === normalizedTool)) {
              const existingPattern = existing.usagePatterns.find(
                p => p.patternName === workflow.intent
              );
              if (existingPattern) {
                existingPattern.frequency += 1;
                existingPattern.sessionIds = [...new Set([...existingPattern.sessionIds, newSession.sessionId])];
              } else {
                existing.usagePatterns.push({
                  patternName: workflow.intent,
                  description: workflow.summary,
                  frequency: 1,
                  avgDurationSeconds: workflow.durationSeconds,
                  sessionIds: [newSession.sessionId],
                });
              }
            }
          }
        } else {
          // Create new tool mastery group
          const patterns: ToolUsagePattern[] = newSession.workflows
            .filter(w => w.tools.some(t => this.normalizeTool(t) === normalizedTool))
            .map(w => ({
              patternName: w.intent,
              description: w.summary,
              frequency: 1,
              avgDurationSeconds: w.durationSeconds,
              sessionIds: [newSession.sessionId],
            }));

          groupMap.set(normalizedTool, {
            toolName: normalizedTool,
            usagePatterns: patterns,
            sessionIds: [newSession.sessionId],
            totalTimeSeconds: newSession.totalDurationSeconds,
            optimizationOpportunities: [],
          });
        }
      }

      return Array.from(groupMap.values());
    } catch (error) {
      this.logger.warn('ContextStitchingEndpoint: Tier 2 merge failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return (previousStitchedContext?.toolMasteryGroups as ToolMasteryGroup[]) || [];
    }
  }

  // ============================================================================
  // TIER 3: Repetitive Pattern Detection (Helix)
  // ============================================================================

  /**
   * Fetch repetitive workflow patterns from Helix.
   * Helix already stores patterns incrementally — just read the latest.
   */
  private async executeTier3(userId: number): Promise<RepetitiveWorkflowPattern[]> {
    try {
      const patterns = await this.helixGraphService.detectRepetitiveWorkflowPatterns(
        userId,
        { minOccurrences: 3 }
      );

      return patterns.map(p => ({
        patternType: p.patternType,
        sequence: p.sequence,
        occurrenceCount: p.occurrenceCount,
        avgDurationSeconds: p.avgDurationSeconds,
        totalTimeSpentSeconds: p.totalTimeSpentSeconds,
        firstSeen: p.firstSeen,
        lastSeen: p.lastSeen,
        sessions: p.sessions,
        optimizationOpportunity: p.optimizationOpportunity,
      }));
    } catch (error) {
      this.logger.warn('ContextStitchingEndpoint: Tier 3 failed (non-blocking)', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  // ============================================================================
  // CUMULATIVE CONTEXT (Chain from Previous)
  // ============================================================================

  /**
   * Build cumulative context by extending the previous session's context.
   * Rolling window: prunes oldest entries when limits are exceeded.
   */
  private buildCumulativeContext(
    sessionData: StitchContextRequest,
    previousStitchedContext: Record<string, unknown> | null
  ): PerSessionStitchedContext['cumulativeContext'] {
    const previous = (previousStitchedContext?.cumulativeContext as PerSessionStitchedContext['cumulativeContext']) || {
      relatedSessionSummaries: [],
      relatedScreenshotDescriptions: [],
      relatedGapAnalysisHighlights: [],
      previousSessionCount: 0,
    };

    // 1. Append new session's summary
    const highLevelSummary = this.extractHighLevelSummary(sessionData.summary);
    const newSummaries = [
      ...previous.relatedSessionSummaries,
      {
        sessionId: sessionData.sessionId,
        highLevelSummary,
        workflowName: sessionData.workflowName,
        timestamp: new Date(sessionData.startTime).toISOString(),
      },
    ].slice(-MAX_CUMULATIVE_SUMMARIES); // Keep most recent N

    // 2. Append new session's screenshot descriptions (limit to top 5 per session)
    const newScreenshots = [...previous.relatedScreenshotDescriptions];
    if (sessionData.screenshotDescriptions) {
      const entries = Object.entries(sessionData.screenshotDescriptions).slice(0, 5);
      for (const [key, value] of entries) {
        newScreenshots.push({
          sessionId: sessionData.sessionId,
          timestamp: key,
          description: value.description,
          app: value.app,
          category: value.category,
        });
      }
    }
    const trimmedScreenshots = newScreenshots.slice(-MAX_CUMULATIVE_SCREENSHOTS);

    // 3. Append new session's gap analysis highlights
    const newGapHighlights = [...previous.relatedGapAnalysisHighlights];
    if (sessionData.gapAnalysis) {
      const recommendations = this.extractGapRecommendations(sessionData.gapAnalysis);
      const efficiencyScore = this.extractEfficiencyScore(sessionData.gapAnalysis);
      if (recommendations.length > 0) {
        newGapHighlights.push({
          sessionId: sessionData.sessionId,
          keyRecommendations: recommendations,
          efficiencyScore,
        });
      }
    }
    const trimmedGapHighlights = newGapHighlights.slice(-MAX_CUMULATIVE_GAP_HIGHLIGHTS);

    return {
      relatedSessionSummaries: newSummaries,
      relatedScreenshotDescriptions: trimmedScreenshots,
      relatedGapAnalysisHighlights: trimmedGapHighlights,
      previousSessionCount: previous.previousSessionCount + 1,
    };
  }

  // ============================================================================
  // WORKSTREAM PERSISTENCE
  // ============================================================================

  /**
   * Persist workstream assignment — either add session to existing or create new.
   */
  private async persistWorkstreamUpdate(
    assignment: NonNullable<PerSessionStitchedContext['workstreamAssignment']>,
    newSession: SessionForStitching,
    userId: number
  ): Promise<void> {
    try {
      await this.userWorkstreamRepository.addSessionToWorkstream(
        userId,
        assignment.workstreamId,
        newSession.sessionId,
        {
          toolsUsed: newSession.toolsUsed,
          lastActivity: new Date(newSession.timestamp),
          additionalDurationSeconds: newSession.totalDurationSeconds,
          confidence: assignment.confidence,
        }
      );

      this.logger.info('ContextStitchingEndpoint: Workstream updated', {
        workstreamId: assignment.workstreamId,
        sessionId: newSession.sessionId,
      });
    } catch (error) {
      this.logger.warn('ContextStitchingEndpoint: Failed to persist workstream update', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  /**
   * Convert the incoming request to the SessionForStitching format
   * used by the existing context-stitching.service.ts methods.
   */
  private convertToSessionForStitching(data: StitchContextRequest): SessionForStitching {
    const summary = data.summary || {};
    const workflows = (summary.workflows as Array<{
      workflow_summary?: string;
      classification?: { level_1_intent?: string };
      approach?: string;
      tools?: string[];
      totalDurationSeconds?: number;
    }>) || [];

    return {
      sessionId: data.sessionId,
      title: data.workflowName || 'Untitled Session',
      highLevelSummary: this.extractHighLevelSummary(data.summary),
      workflows: workflows.map(w => ({
        intent: w.workflow_summary || w.classification?.level_1_intent || 'Unknown',
        approach: w.approach || '',
        tools: w.tools || [],
        summary: w.workflow_summary || '',
        durationSeconds: w.totalDurationSeconds || 0,
      })),
      toolsUsed: data.appsUsed || [],
      totalDurationSeconds: Math.round((data.endTime - data.startTime) / 1000),
      timestamp: new Date(data.startTime).toISOString(),
    };
  }

  private extractHighLevelSummary(summary: Record<string, unknown>): string {
    if (!summary) return '';
    // V2 schema: highLevelSummary or high_level_summary
    if (typeof summary.highLevelSummary === 'string') return summary.highLevelSummary;
    if (typeof summary.high_level_summary === 'string') return summary.high_level_summary;
    // V1 schema: summary might be a string
    if (typeof summary === 'string') return summary;
    return '';
  }

  private extractGapRecommendations(gapAnalysis: Record<string, unknown>): string[] {
    if (!gapAnalysis) return [];
    // Try common shapes
    const improvements = gapAnalysis.improvements as Array<{ suggestion?: string; recommendation?: string }> | undefined;
    if (Array.isArray(improvements)) {
      return improvements
        .map(i => i.suggestion || i.recommendation || '')
        .filter(Boolean)
        .slice(0, 5);
    }
    const recommendations = gapAnalysis.recommendations as string[] | undefined;
    if (Array.isArray(recommendations)) {
      return recommendations.slice(0, 5);
    }
    return [];
  }

  private extractEfficiencyScore(gapAnalysis: Record<string, unknown>): number {
    if (!gapAnalysis) return 0;
    if (typeof gapAnalysis.efficiencyScore === 'number') return gapAnalysis.efficiencyScore;
    if (typeof gapAnalysis.efficiency_score === 'number') return gapAnalysis.efficiency_score;
    if (typeof gapAnalysis.overallScore === 'number') return gapAnalysis.overallScore;
    return 0;
  }

  private normalizeTool(tool: string): string {
    const normalized = tool.trim().toLowerCase();
    const toolMap: Record<string, string> = {
      'chrome': 'Google Chrome',
      'google chrome': 'Google Chrome',
      'vscode': 'VSCode',
      'vs code': 'VSCode',
      'visual studio code': 'VSCode',
      'google slides': 'Google Slides',
      'slides': 'Google Slides',
      'google docs': 'Google Docs',
      'docs': 'Google Docs',
      'notion': 'Notion',
      'slack': 'Slack',
      'figma': 'Figma',
      'terminal': 'Terminal',
      'iterm': 'Terminal',
      'zoom': 'Zoom',
      'github': 'GitHub',
    };
    return toolMap[normalized] || tool;
  }
}
