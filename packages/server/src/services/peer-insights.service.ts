import { createHash } from 'crypto';
import type { Logger } from '../core/logger.js';
import type { LLMProvider } from '../core/llm-provider.js';
import type { UserPreferencesRepository } from '../repositories/user-preferences.repository.js';
import type { SessionMappingRepository } from '../repositories/session-mapping.repository.js';
import type { ArangoDBGraphService } from './arangodb-graph.service.js';

export interface PeerInsightResult {
  userSessionId: string;
  userSessionTitle: string;
  matchedPeerSessions: Array<{
    similarity: number;
    category: string;
    workflowName: string | null;
    highLevelSummary: string | null;
    durationSeconds: number | null;
    sharedEntities: string[];
    matchSources: ('pgvector' | 'graphrag')[];
    learningPoints: string[];
  }>;
}

interface FusedPeerMatch {
  sessionId: string;
  category: string;
  workflowName: string | null;
  highLevelSummary: string | null;
  durationSeconds: number | null;
  hybridScore: number;
  graphScore: number;
  finalScore: number;
  sharedEntities: string[];
  matchSources: ('pgvector' | 'graphrag')[];
}

export interface PeerInsightsServiceDeps {
  sessionMappingRepository: SessionMappingRepository;
  graphService: ArangoDBGraphService;
  userPreferencesRepository: UserPreferencesRepository;
  llmProvider: LLMProvider;
  logger: Logger;
}

export class PeerInsightsService {
  private readonly sessionRepo: SessionMappingRepository;
  private readonly graphService: ArangoDBGraphService;
  private readonly prefsRepo: UserPreferencesRepository;
  private readonly llmProvider: LLMProvider;
  private readonly logger: Logger;

  constructor(deps: PeerInsightsServiceDeps) {
    this.sessionRepo = deps.sessionMappingRepository;
    this.graphService = deps.graphService;
    this.prefsRepo = deps.userPreferencesRepository;
    this.llmProvider = deps.llmProvider;
    this.logger = deps.logger;
  }

  /**
   * Find peer insights for all sessions in a work track (node).
   * Uses 3-signal fusion: pgvector+BM25 hybrid + GraphRAG entity overlap.
   */
  async findPeerInsightsForNode(
    userId: number,
    nodeId: string,
    options?: { minSimilarity?: number; limit?: number }
  ): Promise<PeerInsightResult[]> {
    const minSimilarity = options?.minSimilarity ?? 0.5;
    const limit = options?.limit ?? 5;

    try {
      // 1. Check if user has receiving enabled
      const prefs = await this.prefsRepo.findByUserId(userId);
      if (!prefs?.receivePeerInsights) {
        this.logger.info('Peer insights disabled for user', { userId });
        return [];
      }

      // 2. Prep phase: fetch user data + sharing user IDs in parallel
      // GraphRAG is optional — gracefully degrade if ArangoDB is unavailable
      const [userSessions, sharingUserIds, graphContext] = await Promise.all([
        this.sessionRepo.getUserSessionsWithEmbeddings(userId, nodeId),
        this.prefsRepo.getSharingUserIds(),
        this.graphService.getCrossSessionContext(userId, nodeId as any).catch((err) => {
          this.logger.warn('GraphRAG unavailable for peer insights, continuing with vector+BM25 only', {
            error: err instanceof Error ? err.message : String(err),
          });
          return { entities: [], sessions: [] };
        }),
      ]);

      if (userSessions.length === 0) {
        this.logger.info('No user sessions with embeddings found', {
          userId,
          nodeId,
        });
        return [];
      }

      if (sharingUserIds.length === 0) {
        this.logger.info('No users sharing peer data', { userId });
        return [];
      }

      const entityNames = (graphContext?.entities || []).map(
        (e: any) => e.name
      );

      this.logger.info('Starting peer insights search', {
        userId,
        nodeId,
        userSessionCount: userSessions.length,
        sharingUserCount: sharingUserIds.length,
        entityCount: entityNames.length,
      });

      // 3. For each user session, run 2 search signals in parallel
      const results: PeerInsightResult[] = [];

      for (const session of userSessions) {
        const queryText = [session.highLevelSummary, session.workflowName]
          .filter(Boolean)
          .join(' ');

        if (!queryText && !session.summaryEmbedding) continue;

        const [pgvectorResults, graphResults] = await Promise.all([
          // Signal 1: pgvector + BM25 hybrid
          this.sessionRepo.searchPeerSessionsByMultiEmbedding(
            userId,
            queryText || '',
            {
              summary: session.summaryEmbedding as any,
              highLevelSummary: session.highLevelSummaryEmbedding as any,
              screenshotDescriptions:
                session.screenshotDescriptionsEmbedding as any,
              gapAnalysis: session.gapAnalysisEmbedding as any,
            },
            { minSimilarity: 0.3, limit: limit * 3 }
          ),
          // Signal 2: GraphRAG entity matching (optional — gracefully degrade)
          entityNames.length > 0
            ? this.graphService.findPeerSessionsByEntities(userId, entityNames, {
                minSharedEntities: 2,
                limit: 20,
                lookbackDays: 60,
                sharingUserIds,
              }).catch(() => [])
            : Promise.resolve([]),
        ]);

        // 4. Fuse results
        const fused = this.fusePeerResults(
          pgvectorResults,
          graphResults,
          entityNames.length
        );

        // 5. Filter by minSimilarity
        const filtered = fused.filter((m) => m.finalScore >= minSimilarity);
        const topMatches = filtered.slice(0, limit);

        if (topMatches.length === 0) continue;

        // 6. Generate learning points via Gemini
        const matchesWithLearning = await this.generateLearningPoints(
          session,
          topMatches
        );

        results.push({
          userSessionId: session.desktopSessionId,
          userSessionTitle:
            session.workflowName || session.highLevelSummary || 'Untitled Session',
          matchedPeerSessions: matchesWithLearning.map((m) => ({
            similarity: m.finalScore,
            category: m.category,
            workflowName: m.workflowName,
            highLevelSummary: m.highLevelSummary,
            durationSeconds: m.durationSeconds,
            sharedEntities: m.sharedEntities,
            matchSources: m.matchSources,
            learningPoints: m.learningPoints,
          })),
        });
      }

      this.logger.info('Peer insights search complete', {
        userId,
        nodeId,
        resultCount: results.length,
        totalMatches: results.reduce(
          (sum, r) => sum + r.matchedPeerSessions.length,
          0
        ),
      });

      return results;
    } catch (error) {
      this.logger.error('Failed to find peer insights', {
        userId,
        nodeId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Fuse pgvector+BM25 results with GraphRAG results.
   * Weights: pgvector+BM25=0.6, GraphRAG=0.3, sourceBonus=0.1
   */
  private fusePeerResults(
    pgvectorResults: Array<{
      sessionId: string;
      category: string;
      workflowName: string | null;
      durationSeconds: number | null;
      highLevelSummary: string | null;
      similarity: number;
    }>,
    graphResults: Array<{
      sessionId: string;
      workflowType: string;
      durationSeconds: number;
      sharedEntityCount: number;
      sharedEntities: string[];
    }>,
    totalUserEntities: number
  ): FusedPeerMatch[] {
    const map = new Map<string, FusedPeerMatch>();

    // Add pgvector results
    for (const r of pgvectorResults) {
      map.set(r.sessionId, {
        sessionId: this.hashSessionId(r.sessionId),
        category: r.category,
        workflowName: r.workflowName,
        highLevelSummary: r.highLevelSummary,
        durationSeconds: r.durationSeconds,
        hybridScore: r.similarity,
        graphScore: 0,
        finalScore: 0,
        sharedEntities: [],
        matchSources: ['pgvector'],
      });
    }

    // Merge graph results
    for (const g of graphResults) {
      const graphScore =
        totalUserEntities > 0
          ? g.sharedEntityCount / totalUserEntities
          : g.sharedEntityCount / 10;

      const existing = map.get(g.sessionId);
      if (existing) {
        existing.graphScore = graphScore;
        existing.sharedEntities = g.sharedEntities;
        existing.matchSources = ['pgvector', 'graphrag'];
      } else {
        map.set(g.sessionId, {
          sessionId: this.hashSessionId(g.sessionId),
          category: g.workflowType || 'unknown',
          workflowName: null,
          highLevelSummary: null,
          durationSeconds: g.durationSeconds,
          hybridScore: 0,
          graphScore,
          finalScore: 0,
          sharedEntities: g.sharedEntities,
          matchSources: ['graphrag'],
        });
      }
    }

    // Calculate final scores with adaptive weighting
    // When only one signal source has results, normalize weights so scores aren't diluted
    const hasAnyGraph = Array.from(map.values()).some((m) => m.graphScore > 0);
    for (const match of map.values()) {
      const sourceBonus = match.matchSources.length > 1 ? 0.1 : 0;
      if (hasAnyGraph) {
        // Both signals available: standard weights
        match.finalScore =
          0.6 * match.hybridScore + 0.3 * match.graphScore + sourceBonus;
      } else {
        // GraphRAG unavailable: use hybrid score directly (normalized)
        match.finalScore = match.hybridScore;
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => b.finalScore - a.finalScore
    );
  }

  /**
   * Generate learning points for matched peer sessions using Gemini.
   */
  private async generateLearningPoints(
    userSession: {
      highLevelSummary: string | null;
      workflowName: string | null;
      durationSeconds: number | null;
    },
    matches: FusedPeerMatch[]
  ): Promise<(FusedPeerMatch & { learningPoints: string[] })[]> {
    const results: (FusedPeerMatch & { learningPoints: string[] })[] = [];

    for (const match of matches) {
      try {
        const prompt = `Compare these two work sessions and identify what the user can learn and adapt from the peer's approach.

USER SESSION:
- Summary: ${userSession.highLevelSummary || 'N/A'}
- Workflow: ${userSession.workflowName || 'N/A'}
- Duration: ${userSession.durationSeconds ? Math.round(userSession.durationSeconds / 60) + ' minutes' : 'N/A'}

PEER SESSION (anonymized):
- Summary: ${match.highLevelSummary || 'N/A'}
- Workflow: ${match.workflowName || 'N/A'}
- Duration: ${match.durationSeconds ? Math.round(match.durationSeconds / 60) + ' minutes' : 'N/A'}

SHARED ENTITIES: ${match.sharedEntities.length > 0 ? match.sharedEntities.join(', ') : 'None identified'}

Generate 2-4 specific, actionable learning points about techniques, tools, or approaches the peer used and the step by step process followed that could help the user. Return only the learning points as a JSON array of strings.`;

        const response = await this.llmProvider.generateText(
          [{ role: 'user', content: prompt }],
          { temperature: 0.3, maxTokens: 2000 }
        );

        let learningPoints: string[] = [];
        try {
          // Try to parse JSON array from response
          const text = response.content || '';
          const jsonMatch = text.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            learningPoints = JSON.parse(jsonMatch[0]);
          } else {
            // Fallback: split by newlines/bullets
            learningPoints = text
              .split(/[\n•\-]/)
              .map((s: string) => s.trim())
              .filter((s: string) => s.length > 10);
          }
        } catch {
          learningPoints = ['Peer used a similar workflow with potentially different approaches.'];
        }

        results.push({
          ...match,
          learningPoints: learningPoints.slice(0, 4),
        });
      } catch (error) {
        this.logger.error('Failed to generate learning points', {
          error: error instanceof Error ? error.message : String(error),
        });
        results.push({
          ...match,
          learningPoints: ['Unable to generate learning points for this match.'],
        });
      }
    }

    return results;
  }

  /**
   * Hash session ID for anonymization.
   */
  private hashSessionId(sessionId: string): string {
    return createHash('sha256').update(sessionId).digest('hex').slice(0, 16);
  }
}
