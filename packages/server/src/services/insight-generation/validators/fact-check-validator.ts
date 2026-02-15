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

  const prompt = `You are a fact-checker. Given a response and the evidence that was used to generate it, identify any factual claims in the response that are NOT supported by the evidence.

Focus on these claim types:
1. **Time/duration claims** - "you spent 45 minutes on X" — is this in the evidence?
2. **Tool/app claims** - "you used Figma for design" — is Figma in the evidence?
3. **Workflow claims** - "your deployment workflow had 5 steps" — does the evidence show this?
4. **Metric claims** - "your efficiency score is 78%" — is this metric in the evidence?

For each unsupported claim, output a JSON object. If ALL claims are grounded in the evidence, output an empty array.

EVIDENCE:
${evidenceSummary}

RESPONSE TO CHECK:
${answer}

Output ONLY a JSON array (no markdown, no explanation):
[{"type": "ungrounded_time_claim"|"ungrounded_tool_claim"|"fabricated_workflow"|"unsupported_metric", "claim": "the exact claim text", "evidence": "what the evidence actually says or 'none found'", "severity": "critical"|"warning"}]`;

  try {
    const result = await llmProvider.generateText([
      { role: 'system', content: 'You are a precise fact-checker. Output only valid JSON arrays.' },
      { role: 'user', content: prompt },
    ]);

    // Parse the LLM response
    const issues = parseFactCheckResponse(result.content, logger);

    logger.info('Fact-check completed', {
      issueCount: issues.length,
      criticalCount: issues.filter(i => i.severity === 'critical').length,
      types: issues.map(i => i.type),
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

function parseFactCheckResponse(llmOutput: string, logger: Logger): FactCheckIssue[] {
  try {
    // Clean up common LLM output artifacts
    let cleaned = llmOutput.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
    if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
    cleaned = cleaned.trim();

    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item: any) =>
      item.type && item.claim && item.evidence && item.severity
    ) as FactCheckIssue[];
  } catch (error) {
    logger.warn('Failed to parse fact-check response', {
      error: error instanceof Error ? error.message : String(error),
      output: llmOutput.slice(0, 200),
    });
    return [];
  }
}
