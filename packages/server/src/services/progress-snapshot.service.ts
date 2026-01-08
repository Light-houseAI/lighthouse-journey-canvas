/**
 * Progress Snapshot Service
 *
 * Generates outcome-oriented progress snapshots using LLM.
 * Designed for status updates that stakeholders actually need:
 * outcomes, decisions, blockers, and next focus areas.
 */

import {
  progressSnapshotLLMResponseSchema,
  type ProgressSnapshotLLMResponse,
  type ProgressSnapshotSessionInput,
} from '@journey/schema';

import type { LLMProvider } from '../core/llm-provider';
import type { Logger } from '../core/logger';
import type { SessionMappingRepository } from '../repositories/session-mapping.repository';

// ============================================================================
// TYPES
// ============================================================================

export interface ProgressSnapshotServiceDeps {
  sessionMappingRepository: SessionMappingRepository;
  llmProvider: LLMProvider;
  logger: Logger;
}

export interface GenerateSnapshotRequest {
  nodeId: string;
  rangeLabel: string;
  journeyName: string;
  days: number;
}

// ============================================================================
// SERVICE
// ============================================================================

export class ProgressSnapshotService {
  private readonly sessionMappingRepository: SessionMappingRepository;
  private readonly llmProvider: LLMProvider;
  private readonly logger: Logger;
  private readonly LLM_TIMEOUT_MS = 30000; // 30 seconds for snapshot generation

  constructor(deps: ProgressSnapshotServiceDeps) {
    this.sessionMappingRepository = deps.sessionMappingRepository;
    this.llmProvider = deps.llmProvider;
    this.logger = deps.logger;
  }

  /**
   * Generate an outcome-oriented progress snapshot for a node
   */
  async generateSnapshot(
    request: GenerateSnapshotRequest
  ): Promise<ProgressSnapshotLLMResponse> {
    const { nodeId, rangeLabel, journeyName, days } = request;

    this.logger.info('Generating progress snapshot', {
      nodeId,
      rangeLabel,
      journeyName,
      days,
    });

    // 1. Fetch sessions for the time period
    const sessions = await this.fetchSessionsForPeriod(nodeId, days);

    if (sessions.length === 0) {
      this.logger.info('No sessions found for snapshot', { nodeId, days });
      return this.createEmptySnapshot(rangeLabel, journeyName);
    }

    // 2. Prepare session data for LLM
    const sessionInputs = this.prepareSessionInputs(sessions);

    // 3. Generate snapshot via LLM
    const snapshot = await this.generateLLMSnapshot(
      sessionInputs,
      rangeLabel,
      journeyName
    );

    this.logger.info('Progress snapshot generated', {
      nodeId,
      themeCount: snapshot.themes.length,
      headlineCount: snapshot.headlines.length,
      sessionCount: snapshot.metrics.sessionCount,
    });

    return snapshot;
  }

  /**
   * Fetch sessions within the time period
   */
  private async fetchSessionsForPeriod(
    nodeId: string,
    days: number
  ): Promise<ProgressSnapshotSessionInput[]> {
    // Fetch up to 50 sessions (matches current UI limit)
    const result = await this.sessionMappingRepository.getByNodeId(nodeId, {
      page: 1,
      limit: 50,
    });

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Filter by date and map to input format
    return result.sessions
      .filter((session) => {
        if (!session.startedAt) return false;
        return new Date(session.startedAt) >= cutoffDate;
      })
      .map((session) => ({
        sessionId: session.id,
        generatedTitle: session.generatedTitle,
        highLevelSummary: session.highLevelSummary,
        durationSeconds: session.durationSeconds,
        startedAt: session.startedAt?.toISOString() ?? null,
      }));
  }

  /**
   * Prepare session inputs for LLM prompt
   */
  private prepareSessionInputs(
    sessions: ProgressSnapshotSessionInput[]
  ): ProgressSnapshotSessionInput[] {
    // Sort by start time (most recent first)
    return [...sessions].sort((a, b) => {
      if (!a.startedAt || !b.startedAt) return 0;
      return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
    });
  }

  /**
   * Generate progress snapshot using LLM with structured output
   */
  private async generateLLMSnapshot(
    sessions: ProgressSnapshotSessionInput[],
    rangeLabel: string,
    journeyName: string
  ): Promise<ProgressSnapshotLLMResponse> {
    const sessionsJson = JSON.stringify(sessions, null, 2);

    const systemPrompt = `You are an expert communications editor for knowledge-worker status updates (consulting/PM/engineering/ops/analysis).
Rewrite raw activity summaries into crisp, outcome-oriented progress updates.`;

    const userPrompt = `Create a progress snapshot for the time range: ${rangeLabel}.
Journey: ${journeyName}.

INPUT SESSIONS (JSON array):
${sessionsJson}

INSTRUCTIONS:
- Output MUST be valid JSON matching the schema below. Output JSON only. No markdown.
- Be concise and non-speculative: never say "likely", "probably", "seems".
- Use first-person voice ("I ...") unless the session text clearly implies "we".
- Do NOT narrate tool switching. Mention tools only if they are the deliverable context (e.g., "configured IAM policy" ok; "opened Gemini" not ok).
- Prefer outcomes, decisions, and measurable progress over process.
- Aggregate into AT MOST 3 themes (workstreams). Suppress the long tail.
- Each theme:
  - name: 2–5 words
  - outcome: 1 sentence
  - keyWork: 1–3 bullets
  - blockers: 0–2 bullets (only if explicitly implied by input)
  - next: 0–2 bullets (only if implied)
  - sessionIds: include the sessionIds that support this theme
  - timeSeconds: sum of durationSeconds for sessions in this theme
- Headlines: 1–3 bullets capturing the most important outcomes across all work.
- NeedsInput: 0–3 bullets for decisions/dependencies, only if clearly implied.
- If many sessions are tiny/administrative, roll them into one theme or omit from top 3.

JSON SCHEMA:
{
  "rangeLabel": string,
  "journeyName": string,
  "metrics": {
    "sessionCount": number,
    "timeSeconds": number,
    "focusAreaCount": number
  },
  "headlines": string[],
  "themes": [
    {
      "name": string,
      "outcome": string,
      "keyWork": string[],
      "blockers": string[],
      "next": string[],
      "sessionIds": string[],
      "timeSeconds": number
    }
  ],
  "needsInput": string[]
}`;

    // Create timeout promise
    let timeoutHandle: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new Error('Progress snapshot LLM generation timeout')),
        this.LLM_TIMEOUT_MS
      );
    });

    try {
      // Race LLM call against timeout
      const response = await Promise.race([
        this.llmProvider.generateStructuredResponse(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          progressSnapshotLLMResponseSchema,
          {
            temperature: 0.2, // Low temperature for consistent output
            maxTokens: 2000,
          }
        ),
        timeoutPromise,
      ]);

      clearTimeout(timeoutHandle!);

      // Validate the response matches our expectations
      const validated = progressSnapshotLLMResponseSchema.parse(
        response.content
      );

      return validated;
    } catch (error) {
      clearTimeout(timeoutHandle!);
      this.logger.error('Progress snapshot LLM generation failed', {
        error: error instanceof Error ? error.message : String(error),
        sessionCount: sessions.length,
      });
      throw error;
    }
  }

  /**
   * Create an empty snapshot when no sessions exist
   */
  private createEmptySnapshot(
    rangeLabel: string,
    journeyName: string
  ): ProgressSnapshotLLMResponse {
    return {
      rangeLabel,
      journeyName,
      metrics: {
        sessionCount: 0,
        timeSeconds: 0,
        focusAreaCount: 0,
      },
      headlines: [],
      themes: [],
      needsInput: [],
    };
  }
}


