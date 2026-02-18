/**
 * Session Context Chunker
 *
 * Map-reduce strategy for handling 50-500 sessions without blowing up LLM context.
 * - @tagged sessions: Always pass full JSONB (user explicitly selected, bypass chunking)
 * - NLQ-retrieved sessions: Go through map-reduce chunking
 *   1. Split into chunks of ~20 sessions
 *   2. Per-chunk LLM call: summarize key patterns, issues, recommendations
 *   3. Merge all chunk summaries into one consolidated context
 */

import type { Logger } from '../../../core/logger.js';
import type { LLMProvider } from '../../../core/llm-provider.js';
import type { SessionInfo } from '../types.js';
import { withTimeout } from '../../../core/retry-utils.js';

const CHUNK_SIZE = 20;
const CHUNK_SUMMARIZE_TIMEOUT_MS = 30000; // 30s per chunk
const MAX_SESSION_JSON_CHARS = 2000; // Truncate per-session JSONB to this length

/**
 * Format a single session's enriched JSONB data as a context string
 */
function formatSessionContext(session: SessionInfo): string {
  const parts: string[] = [];
  const duration = session.durationSeconds
    ? `${Math.round(session.durationSeconds / 60)}m`
    : 'unknown duration';
  const apps = session.appsUsed?.join(', ') || 'unknown apps';

  parts.push(`--- Session: "${session.highLevelSummary || session.startActivity || session.sessionId}" (${duration}, ${apps}) ---`);

  if (session.gapAnalysis) {
    const ga = session.gapAnalysis as Record<string, unknown>;
    const score = ga.overallEfficiencyScore != null ? `Score: ${ga.overallEfficiencyScore}/100` : '';
    const recs = Array.isArray(ga.stepByStepRecommendations)
      ? ga.stepByStepRecommendations.slice(0, 3).map((r: any) => `    - ${typeof r === 'string' ? r : r?.recommendation || JSON.stringify(r)}`).join('\n')
      : '';
    const improvements = Array.isArray(ga.significantImprovements)
      ? ga.significantImprovements.slice(0, 2).map((i: any) => `    - ${typeof i === 'string' ? i : JSON.stringify(i)}`).join('\n')
      : '';
    parts.push(`  Gap Analysis: ${score}`);
    if (recs) parts.push(`  Recommendations:\n${recs}`);
    if (improvements) parts.push(`  Key Improvements:\n${improvements}`);
  }

  if (session.insights) {
    const ins = session.insights as Record<string, unknown>;
    if (ins.at_a_glance) parts.push(`  At a Glance: ${truncate(String(ins.at_a_glance), 200)}`);
    if (Array.isArray(ins.issues) && ins.issues.length > 0) {
      parts.push(`  Issues: ${ins.issues.slice(0, 3).map((i: any) => typeof i === 'string' ? i : JSON.stringify(i)).join('; ')}`);
    }
    if (Array.isArray(ins.improvements) && ins.improvements.length > 0) {
      parts.push(`  Improvements: ${ins.improvements.slice(0, 3).map((i: any) => typeof i === 'string' ? i : JSON.stringify(i)).join('; ')}`);
    }
  }

  if (session.peerInsights && Array.isArray(session.peerInsights) && session.peerInsights.length > 0) {
    const peerSummary = session.peerInsights.slice(0, 2).map((p: any) => {
      return typeof p === 'string' ? p : (p?.summary || p?.learningPoint || JSON.stringify(p));
    }).join('; ');
    parts.push(`  Peer Insights: ${truncate(peerSummary, 200)}`);
  }

  if (session.screenshotDescriptions) {
    const screenshots = session.screenshotDescriptions as Record<string, any>;
    const entries = Object.entries(screenshots).slice(0, 3);
    if (entries.length > 0) {
      const screenshotSummary = entries.map(([ts, desc]) => {
        const d = typeof desc === 'string' ? desc : desc?.description || '';
        const app = typeof desc === 'object' ? (desc?.appName || desc?.app || '') : '';
        const windowInfo = desc?.windowTitle ? ` "${truncate(desc.windowTitle, 60)}"` : '';
        const urlInfo = desc?.browserUrl ? ` (${truncate(desc.browserUrl, 80)})` : '';
        return `    - [${app}]${windowInfo}${urlInfo} ${truncate(d, 100)}`;
      }).join('\n');
      parts.push(`  Screenshots:\n${screenshotSummary}`);
    }
  }

  return parts.join('\n');
}

function truncate(s: string, maxLen: number): string {
  return s.length > maxLen ? s.slice(0, maxLen) + '...' : s;
}

/**
 * Format @tagged sessions with full JSONB detail (bypasses chunking)
 */
export function formatTaggedSessionsContext(sessions: SessionInfo[]): string {
  if (!sessions || sessions.length === 0) return '';
  return sessions.map(formatSessionContext).join('\n\n');
}

/**
 * Map-reduce chunking for NLQ-retrieved sessions.
 * Splits sessions into chunks, summarizes each chunk via LLM, then merges.
 *
 * If no LLM provider is available, falls back to simple truncation.
 */
export async function chunkAndSummarizeSessions(
  sessions: SessionInfo[],
  deps: { logger: Logger; llmProvider?: LLMProvider }
): Promise<string> {
  const { logger, llmProvider } = deps;

  if (!sessions || sessions.length === 0) return '';

  // For small session counts, just format directly (no chunking needed)
  if (sessions.length <= CHUNK_SIZE) {
    return sessions.map(formatSessionContext).join('\n\n');
  }

  // Split into chunks
  const chunks: SessionInfo[][] = [];
  for (let i = 0; i < sessions.length; i += CHUNK_SIZE) {
    chunks.push(sessions.slice(i, i + CHUNK_SIZE));
  }

  logger.info('Session chunker: splitting sessions for map-reduce', {
    totalSessions: sessions.length,
    chunkCount: chunks.length,
    chunkSize: CHUNK_SIZE,
  });

  // If no LLM provider, fall back to truncated formatting
  if (!llmProvider) {
    logger.warn('Session chunker: no LLM provider, using truncated format');
    return sessions
      .slice(0, CHUNK_SIZE * 2) // Limit to 40 sessions
      .map(formatSessionContext)
      .join('\n\n');
  }

  // Map: summarize each chunk
  const chunkSummaries: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkContext = chunk.map(formatSessionContext).join('\n\n');

    try {
      const summary = await withTimeout(
        summarizeChunk(chunkContext, chunk.length, llmProvider),
        CHUNK_SUMMARIZE_TIMEOUT_MS,
        `Chunk ${i + 1} summarization timed out`
      );
      chunkSummaries.push(summary);
    } catch (error) {
      logger.warn(`Session chunker: chunk ${i + 1} summarization failed, using raw`, { error });
      // Fallback: include first 5 sessions from this chunk as raw context
      chunkSummaries.push(chunk.slice(0, 5).map(formatSessionContext).join('\n'));
    }
  }

  logger.info('Session chunker: map-reduce complete', {
    chunkCount: chunks.length,
    summaryCount: chunkSummaries.length,
    totalChars: chunkSummaries.reduce((sum, s) => sum + s.length, 0),
  });

  // Reduce: merge all chunk summaries
  return chunkSummaries.join('\n\n---\n\n');
}

/**
 * Summarize a chunk of sessions via a fast LLM call
 */
async function summarizeChunk(
  chunkContext: string,
  sessionCount: number,
  llmProvider: LLMProvider
): Promise<string> {
  const prompt = `You are analyzing ${sessionCount} work sessions. Summarize the key patterns, issues, and recommendations across these sessions in a concise format.

Focus on:
1. Common tools and workflows used
2. Efficiency scores and gap analysis findings
3. Recurring issues or bottlenecks
4. Top recommendations for improvement
5. Notable peer insights (if any)

Keep the summary to 400-600 words. Use bullet points. Be specific about tools, durations, and patterns.

Sessions data:
${chunkContext}`;

  const result = await llmProvider.generateText([
    { role: 'system', content: 'You are a concise analyst summarizing work session data. Output bullet points only.' },
    { role: 'user', content: prompt },
  ]);

  return `[Summary of ${sessionCount} sessions]\n${result.content}`;
}
