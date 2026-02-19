/**
 * Fact-Check Validator
 *
 * Replaces the old A6 gap-detection validator with a simpler, targeted approach:
 * 1. Extract factual claims from the answer (time durations, tool names, workflow names, metrics)
 * 2. Cross-reference against actual evidence (gapAnalysis, screenshotDescriptions, workflows)
 * 3. Flag ungrounded claims (hallucinated tools, fabricated durations, non-existent workflows)
 * 4. If issues found: one regeneration attempt with specific fixes flagged (not a recursive loop)
 */

import type { Logger } from '../../../core/logger.js';
import type { LLMProvider } from '../../../core/llm-provider.js';
import type { SessionInfo, UserWorkflow } from '../types.js';

// ============================================================================
// TYPES
// ============================================================================

export interface FactCheckResult {
  passed: boolean;
  issues: FactCheckIssue[];
}

export interface FactCheckIssue {
  type: 'ungrounded_time_claim' | 'ungrounded_tool_claim' | 'fabricated_workflow' | 'unsupported_metric';
  claim: string;
  evidence: string;
  severity: 'critical' | 'warning';
}

export interface FactCheckDeps {
  logger: Logger;
  llmProvider: LLMProvider;
}

// ============================================================================
// FACT-CHECK FUNCTIONS
// ============================================================================

/**
 * Fact-check a generated answer against the evidence that was used to produce it.
 * Returns a list of issues found (empty = passed).
 */
export async function factCheckResponse(
  answer: string,
  evidence: { sessions: SessionInfo[]; workflows: UserWorkflow[] },
  deps: FactCheckDeps
): Promise<FactCheckResult> {
  const { logger, llmProvider } = deps;

  // Build evidence summary for the LLM
  const evidenceSummary = buildEvidenceSummary(evidence);

  const prompt = `Check this response against evidence. Find unsupported factual claims.

Claim types to check: time/duration claims, tool/app claims, workflow claims, metric claims.
If all claims are grounded, output []. Only flag claims with specific numbers, names, or metrics not in evidence.
Report at most 5 issues. Keep claim text SHORT (under 15 words).

EVIDENCE:
${evidenceSummary}

RESPONSE:
${answer}

Output ONLY a valid JSON array, no other text:
[{"type":"ungrounded_time_claim"|"ungrounded_tool_claim"|"fabricated_workflow"|"unsupported_metric","claim":"short claim","evidence":"brief evidence or none found","severity":"critical"|"warning"}]`;

  try {
    const result = await llmProvider.generateText([
      { role: 'system', content: 'Output ONLY valid JSON. No thinking, no explanation, no markdown. Just the JSON array.' },
      { role: 'user', content: prompt },
    ], { maxTokens: 4000 });

    const isTruncated = result.finishReason === 'length';
    if (isTruncated) {
      logger.warn('Fact-check LLM response truncated (finishReason=length)', {
        contentLength: result.content?.length,
        usage: result.usage,
      });
    }

    // Parse the LLM response (with truncation-aware repair)
    const issues = parseFactCheckResponse(result.content, isTruncated, logger);

    logger.info('Fact-check completed', {
      issueCount: issues.length,
      criticalCount: issues.filter(i => i.severity === 'critical').length,
      types: issues.map(i => i.type),
      finishReason: result.finishReason,
    });

    return {
      passed: issues.length === 0,
      issues,
    };
  } catch (error) {
    logger.warn('Fact-check failed, passing by default', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { passed: true, issues: [] };
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function buildEvidenceSummary(evidence: { sessions: SessionInfo[]; workflows: UserWorkflow[] }): string {
  const parts: string[] = [];

  // Sessions with enriched data
  for (const session of evidence.sessions.slice(0, 10)) {
    const sessionParts: string[] = [];
    sessionParts.push(`Session: "${session.highLevelSummary || session.sessionId}"`);
    sessionParts.push(`  Duration: ${session.durationSeconds ? Math.round(session.durationSeconds / 60) + 'min' : 'unknown'}`);
    sessionParts.push(`  Apps: ${session.appsUsed?.join(', ') || 'unknown'}`);

    if (session.gapAnalysis) {
      const ga = session.gapAnalysis as Record<string, unknown>;
      if (ga.overallEfficiencyScore != null) {
        sessionParts.push(`  Efficiency Score: ${ga.overallEfficiencyScore}`);
      }
    }

    parts.push(sessionParts.join('\n'));
  }

  // Workflows
  for (const wf of evidence.workflows.slice(0, 10)) {
    parts.push(`Workflow: "${wf.title}" — ${wf.steps.length} steps, ${Math.round(wf.totalDurationSeconds / 60)}min, tools: ${wf.tools?.join(', ')}`);
  }

  return parts.join('\n\n');
}

function cleanLLMOutput(llmOutput: string): string {
  let cleaned = llmOutput.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  return cleaned.trim();
}

/**
 * Attempt to repair a truncated JSON array by extracting complete objects.
 * E.g. '[{"a":1},{"b":2},{"c":' → tries to parse '[{"a":1},{"b":2}]'
 */
function repairTruncatedJsonArray(truncated: string, logger: Logger): FactCheckIssue[] | null {
  // Find the last complete object boundary ('},')
  const lastCompleteEnd = truncated.lastIndexOf('},');
  if (lastCompleteEnd === -1) {
    // Try single complete object: '[{...}' without trailing comma
    const lastBrace = truncated.lastIndexOf('}');
    if (lastBrace === -1) return null;

    const attempt = truncated.slice(0, lastBrace + 1) + ']';
    try {
      const parsed = JSON.parse(attempt);
      if (Array.isArray(parsed)) {
        logger.info('Repaired truncated fact-check JSON (single object)', { recoveredCount: parsed.length });
        return parsed.filter((item: any) => item.type && item.claim && item.evidence && item.severity);
      }
    } catch {
      return null;
    }
    return null;
  }

  // Slice up to the last complete object and close the array
  const attempt = truncated.slice(0, lastCompleteEnd + 1) + ']';
  try {
    const parsed = JSON.parse(attempt);
    if (Array.isArray(parsed)) {
      logger.info('Repaired truncated fact-check JSON', { recoveredCount: parsed.length });
      return parsed.filter((item: any) => item.type && item.claim && item.evidence && item.severity);
    }
  } catch {
    return null;
  }
  return null;
}

function parseFactCheckResponse(llmOutput: string, isTruncated: boolean, logger: Logger): FactCheckIssue[] {
  const cleaned = cleanLLMOutput(llmOutput);

  // Try normal parse first
  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item: any) =>
      item.type && item.claim && item.evidence && item.severity
    ) as FactCheckIssue[];
  } catch (parseError) {
    // Normal parse failed — try to repair if we know the response was truncated
    logger.warn('Failed to parse fact-check response', {
      error: parseError instanceof Error ? parseError.message : String(parseError),
      isTruncated,
      outputLength: llmOutput.length,
      outputPreview: llmOutput.slice(0, 300),
    });

    if (isTruncated || cleaned.startsWith('[')) {
      const repaired = repairTruncatedJsonArray(cleaned, logger);
      if (repaired && repaired.length > 0) {
        return repaired;
      }
    }

    // Could not recover any issues from the response.
    // If the LLM was clearly trying to output issues (truncated mid-object),
    // return a synthetic issue so the fact-check doesn't silently pass.
    if (isTruncated && cleaned.length > 10) {
      logger.warn('Fact-check response truncated and unrecoverable, returning synthetic issue');
      return [{
        type: 'unsupported_metric',
        claim: 'Fact-check validation incomplete — LLM response was truncated',
        evidence: 'Response cut off at ' + cleaned.length + ' chars; issues may exist but could not be parsed',
        severity: 'warning',
      }];
    }

    return [];
  }
}
