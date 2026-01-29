/**
 * A4-Web Best Practices Agent Graph
 *
 * LangGraph implementation of the Web Best Practices Agent (A4-Web) that:
 * 1. Generates search queries from identified inefficiencies
 * 2. Searches for best practices using Perplexity API
 * 3. Extracts actionable recommendations with citations
 * 4. Maps best practices to user's specific steps with Claude Code prompts
 *
 * Uses Perplexity Search API for external knowledge retrieval.
 * Reference site: https://www.chatprd.ai/how-i-ai/workflows
 */

import { StateGraph, END } from '@langchain/langgraph';
import { v4 as uuidv4 } from 'uuid';
import type { Logger } from '../../../core/logger.js';
import type { LLMProvider } from '../../../core/llm-provider.js';
import { InsightStateAnnotation, type InsightState } from '../state/insight-state.js';
import type {
  StepOptimizationPlan,
  OptimizationBlock,
  StepTransformation,
  CurrentStep,
  OptimizedStep,
  Citation,
  Inefficiency,
  UserToolbox,
} from '../types.js';
import { isToolInUserToolbox, isSuggestionForUserTools } from '../utils/toolbox-utils.js';
import { z } from 'zod';
import { withRetry, isRateLimitError, withTimeout } from '../../../core/retry-utils.js';
import { repairAndParseJson, createBestPracticesFallbackExtractor } from '../utils/json-repair.js';

// LLM call timeout constant
const LLM_TIMEOUT_MS = 60000; // 60 seconds

// ============================================================================
// TYPES
// ============================================================================

export interface WebBestPracticesGraphDeps {
  logger: Logger;
  llmProvider: LLMProvider;
  perplexityApiKey: string;
}

interface PerplexityResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  citations?: string[];
}

interface SearchResult {
  query: string;
  content: string;
  citations: string[];
}

interface BestPractice {
  title: string;
  description: string;
  applicableInefficiencyIds: string[];
  estimatedTimeSavings: number;
  toolSuggestion: string;
  claudeCodeApplicable: boolean;
  claudeCodePrompt?: string;
  sourceUrl?: string;
  confidence: number;
}

// LLM schemas
const searchQueriesSchema = z.object({
  queries: z.array(
    z.object({
      query: z.string(),
      targetInefficiency: z.string(),
      rationale: z.string(),
    })
  ),
});

// Schema with lenient defaults to handle LLM response variations
const bestPracticesExtractionSchema = z.object({
  practices: z.array(
    z.object({
      title: z.string().default('Optimization'),
      description: z.string().default(''),
      applicableInefficiencyIds: z.array(z.string()).default(['general']),
      estimatedTimeSavingsSeconds: z.number().default(60),
      toolSuggestion: z.string().default(''),
      claudeCodeApplicable: z.boolean().default(false),
      claudeCodePrompt: z.string().optional().default(''),
      confidence: z.number().min(0).max(1).default(0.5),
    })
  ).default([]),
});

// ============================================================================
// GRAPH NODES
// ============================================================================

/**
 * Node: Generate search queries from user's inefficiencies
 */
async function generateSearchQueries(
  state: InsightState,
  deps: WebBestPracticesGraphDeps
): Promise<Partial<InsightState>> {
  const { logger, llmProvider } = deps;

  logger.info('A4-Web: Generating search queries');

  if (!state.userDiagnostics || state.userDiagnostics.inefficiencies.length === 0) {
    logger.warn('A4-Web: No inefficiencies to search for');
    return {
      currentStage: 'a4_web_queries_skipped',
      progress: 65,
    };
  }

  const inefficiencies = state.userDiagnostics.inefficiencies;

  try {
    const response = await withTimeout(
      llmProvider.generateStructuredResponse(
        [
          {
            role: 'user',
            content: `Generate search queries to find best practices for these workflow inefficiencies:

${inefficiencies.map((i) => `- [${i.id}] ${i.type}: ${i.description}`).join('\n')}

User's query context: "${state.query}"

Generate 2-3 targeted search queries that would find relevant best practices.
Focus on:
1. Productivity tools and automation
2. Developer workflow optimization
3. AI-assisted workflows (especially Claude Code)

Each query should target a specific inefficiency.`,
          },
        ],
        searchQueriesSchema
      ),
      LLM_TIMEOUT_MS,
      'A4-Web search query generation timed out'
    );

    logger.info('A4-Web: Generated search queries', {
      queryCount: response.content.queries.length,
    });

    // Log detailed output for debugging (only when INSIGHT_DEBUG is enabled)
    if (process.env.INSIGHT_DEBUG === 'true') {
      logger.debug('=== A4-WEB AGENT OUTPUT (Search Queries) ===');
      logger.debug(JSON.stringify({
        agent: 'A4_WEB',
        outputType: 'searchQueries',
        queries: response.content.queries.map(q => ({
          query: q.query,
          targetInefficiency: q.targetInefficiency,
          rationale: q.rationale,
        })),
      }));
      logger.debug('=== END A4-WEB SEARCH QUERIES OUTPUT ===');
    }

    return {
      currentStage: 'a4_web_queries_generated',
      progress: 68,
    };
  } catch (err) {
    logger.error('A4-Web: Query generation failed', err instanceof Error ? err : new Error(String(err)));
    return {
      errors: [`A4-Web query generation failed: ${err}`],
      currentStage: 'a4_web_queries_failed',
    };
  }
}

/**
 * Node: Search for best practices using Perplexity API
 */
async function searchBestPractices(
  state: InsightState,
  deps: WebBestPracticesGraphDeps
): Promise<Partial<InsightState>> {
  const { logger, perplexityApiKey } = deps;

  logger.info('A4-Web: Searching for best practices via Perplexity');

  if (!perplexityApiKey) {
    logger.warn('A4-Web: No Perplexity API key configured');
    return {
      currentStage: 'a4_web_search_skipped',
      progress: 72,
    };
  }

  const inefficiencies = state.userDiagnostics?.inefficiencies || [];
  if (inefficiencies.length === 0) {
    return {
      currentStage: 'a4_web_search_no_inefficiencies',
      progress: 72,
    };
  }

  // Search for each inefficiency type
  const searchQueries = generateSearchQueriesForInefficiencies(inefficiencies, state.query);

  // OPTIMIZATION: Run all Perplexity searches in PARALLEL using Promise.all
  const searchStartTime = Date.now();
  const searchPromises = searchQueries.slice(0, 3).map(async (queryInfo) => {
    try {
      const result = await callPerplexityAPI(
        queryInfo.query,
        perplexityApiKey,
        logger
      );
      return {
        query: queryInfo.query,
        content: result.content,
        citations: result.citations,
      } as SearchResult;
    } catch (error) {
      logger.warn('A4-Web: Search query failed', { query: queryInfo.query, error });
      return null;
    }
  });

  const searchResultsRaw = await Promise.all(searchPromises);
  const searchResults = searchResultsRaw.filter((r): r is SearchResult => r !== null);

  logger.info('A4-Web: Parallel search complete', {
    parallelDurationMs: Date.now() - searchStartTime,
    queriesAttempted: searchQueries.slice(0, 3).length,
  });

  logger.info('A4-Web: Search complete', {
    successfulQueries: searchResults.length,
    totalCitations: searchResults.reduce((sum, r) => sum + r.citations.length, 0),
  });

  // Log detailed output for debugging (only when INSIGHT_DEBUG is enabled)
  if (process.env.INSIGHT_DEBUG === 'true') {
    logger.debug('=== A4-WEB AGENT OUTPUT (Search Results) ===');
    logger.debug(JSON.stringify({
      agent: 'A4_WEB',
      outputType: 'searchResults',
      results: {
        successfulQueries: searchResults.length,
        totalCitations: searchResults.reduce((sum, r) => sum + r.citations.length, 0),
        searchResults: searchResults.map(r => ({
          query: r.query,
          contentLength: r.content.length,
          contentPreview: r.content.slice(0, 200) + '...',
          citationCount: r.citations.length,
          citations: r.citations,
        })),
      },
    }));
    logger.debug('=== END A4-WEB SEARCH RESULTS OUTPUT ===');
  }

  return {
    currentStage: 'a4_web_search_complete',
    progress: 72,
  };
}

/**
 * Node: Extract and map best practices to user's workflow
 */
async function extractBestPractices(
  state: InsightState,
  deps: WebBestPracticesGraphDeps
): Promise<Partial<InsightState>> {
  const { logger, llmProvider, perplexityApiKey } = deps;

  logger.info('A4-Web: Extracting best practices');

  const inefficiencies = state.userDiagnostics?.inefficiencies || [];
  if (inefficiencies.length === 0) {
    return {
      webOptimizationPlan: null,
      currentStage: 'a4_web_extraction_skipped',
      progress: 75,
    };
  }

  // If no Perplexity API, use LLM knowledge directly
  const searchContext = perplexityApiKey
    ? await getSearchContext(inefficiencies, state.query, perplexityApiKey, logger)
    : 'Using built-in knowledge for best practices.';

  // Truncate search context if too long to avoid overwhelming the LLM
  const maxContextLength = 4000;
  const truncatedContext = searchContext.length > maxContextLength
    ? searchContext.slice(0, maxContextLength) + '\n\n[Context truncated for brevity]'
    : searchContext;

  // Format inefficiency IDs for clear reference
  const inefficiencyList = inefficiencies.slice(0, 5).map((i) =>
    `- ID: "${i.id}" | Type: ${i.type} | Issue: ${i.description} | Wasted: ~${i.estimatedWastedSeconds}s`
  ).join('\n');

  try {
    // OPTIMIZATION: Simplified prompt with explicit JSON structure for reliable parsing
    // The key issue was overly complex prompts causing Gemini to output malformed JSON
    const response = await withRetry(
      () => llmProvider.generateStructuredResponse(
        [
          {
            role: 'system',
            content: `You are a workflow optimization expert. Return valid JSON only.`,
          },
          {
            role: 'user',
            content: `Analyze these inefficiencies and provide 2-3 best practices.

INEFFICIENCIES:
${inefficiencies.slice(0, 3).map((i, idx) => `${idx + 1}. [${i.id}] ${i.type}: ${i.description.slice(0, 100)}`).join('\n')}

USER CONTEXT: "${state.query.slice(0, 100)}"

For each practice provide:
- title: Short name (3-5 words)
- description: One sentence explanation
- applicableInefficiencyIds: Array with the inefficiency ID it fixes (e.g., ["${inefficiencies[0]?.id || 'general'}"])
- estimatedTimeSavingsSeconds: Number between 60-180
- toolSuggestion: Tool name (e.g., "Claude Code", "Shell aliases")
- claudeCodeApplicable: true or false
- claudeCodePrompt: Short prompt if applicable, empty string otherwise
- confidence: Number between 0.6-0.9`,
          },
        ],
        bestPracticesExtractionSchema,
        { maxTokens: 1500, temperature: 0.1 } // Very low temp for consistent JSON
      ),
      {
        maxRetries: 2,
        baseDelayMs: 1000,
        perAttemptTimeoutMs: 45000, // 45 seconds per attempt
        totalTimeoutMs: LLM_TIMEOUT_MS * 1.5, // 90 seconds total
        onRetry: (error, attempt, delayMs) => {
          logger.warn('A4-Web: Retrying best practices extraction', {
            attempt,
            delayMs,
            isRateLimit: isRateLimitError(error),
            error: error?.message || String(error),
          });
        },
      }
    );

    const practices = response.content.practices || [];
    const optimizationPlan = createOptimizationPlanFromPractices(
      practices,
      state.userDiagnostics!,
      state.userEvidence?.workflows[0],
      state.userToolbox
    );

    logger.info('A4-Web: Best practices extracted', {
      practiceCount: practices.length,
      blocksCreated: optimizationPlan.blocks.length,
    });

    // Log detailed output for debugging (only when INSIGHT_DEBUG is enabled)
    if (process.env.INSIGHT_DEBUG === 'true') {
      logger.debug('=== A4-WEB AGENT OUTPUT (Best Practices) ===');
      logger.debug(JSON.stringify({
        agent: 'A4_WEB',
        outputType: 'bestPractices',
        practices: practices.map(p => ({
          title: p.title,
          description: p.description,
          applicableInefficiencyIds: p.applicableInefficiencyIds,
          estimatedTimeSavingsSeconds: p.estimatedTimeSavingsSeconds,
          toolSuggestion: p.toolSuggestion,
          claudeCodeApplicable: p.claudeCodeApplicable,
          claudeCodePrompt: p.claudeCodePrompt,
          confidence: p.confidence,
        })),
      }));
      logger.debug('=== END A4-WEB BEST PRACTICES OUTPUT ===');

      // Log optimization plan
      logger.debug('=== A4-WEB AGENT OUTPUT (Optimization Plan) ===');
      logger.debug(JSON.stringify({
        agent: 'A4_WEB',
        outputType: 'webOptimizationPlan',
        plan: {
          totalBlocks: optimizationPlan.blocks.length,
          totalTimeSaved: optimizationPlan.totalTimeSaved,
          totalRelativeImprovement: optimizationPlan.totalRelativeImprovement,
          passesThreshold: optimizationPlan.passesThreshold,
          blocks: optimizationPlan.blocks.map(b => ({
            blockId: b.blockId,
            workflowName: b.workflowName,
            currentTimeTotal: b.currentTimeTotal,
            optimizedTimeTotal: b.optimizedTimeTotal,
            timeSaved: b.timeSaved,
            relativeImprovement: b.relativeImprovement,
            confidence: b.confidence,
            whyThisMatters: b.whyThisMatters,
            source: b.source,
            citations: b.citations,
            transformations: b.stepTransformations.map(t => ({
              timeSavedSeconds: t.timeSavedSeconds,
              confidence: t.confidence,
              rationale: t.rationale,
              optimizedTools: t.optimizedSteps.map(s => s.tool),
              hasClaudeCodePrompt: t.optimizedSteps.some(s => !!s.claudeCodePrompt),
            })),
          })),
        },
      }));
      logger.debug('=== END A4-WEB OPTIMIZATION PLAN OUTPUT ===');
    }

    return {
      webOptimizationPlan: optimizationPlan,
      currentStage: 'a4_web_extraction_complete',
      progress: 75,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isSchemaError = errorMessage.includes('schema') || errorMessage.includes('NoObjectGenerated');

    logger.warn('A4-Web: Schema extraction failed, attempting JSON repair', {
      error: errorMessage,
      isSchemaError,
      isRateLimit: isRateLimitError(error),
    });

    // INTERMEDIATE FALLBACK: Try JSON repair on raw text response
    // This handles cases where the LLM produces valid-ish JSON but schema parsing fails
    try {
      const rawTextResult = await withTimeout(
        deps.llmProvider.generateText(
          [
            {
              role: 'system',
              content: 'You are a workflow optimization expert. Return ONLY valid JSON with practices array.',
            },
            {
              role: 'user',
              content: `Analyze these inefficiencies and provide 2-3 best practices as JSON.

INEFFICIENCIES:
${inefficiencies.slice(0, 3).map((i, idx) => `${idx + 1}. [${i.id}] ${i.type}: ${i.description.slice(0, 100)}`).join('\n')}

Return JSON: {"practices": [{"title": "...", "description": "...", "applicableInefficiencyIds": ["${inefficiencies[0]?.id || 'general'}"], "estimatedTimeSavingsSeconds": 60, "toolSuggestion": "...", "claudeCodeApplicable": false, "claudeCodePrompt": "", "confidence": 0.7}]}`,
            },
          ],
          { temperature: 0.1, maxTokens: 1200 }
        ),
        45000,
        'A4-Web text generation timed out'
      );

      // Use JSON repair utility to parse the response
      const fallbackExtractor = createBestPracticesFallbackExtractor();
      const repairResult = repairAndParseJson<{ practices: any[] }>(
        rawTextResult.content,
        fallbackExtractor
      );

      if (repairResult.success && repairResult.data && repairResult.data.practices.length > 0) {
        logger.info('A4-Web: JSON repair succeeded', {
          practiceCount: repairResult.data.practices.length,
          repairMethod: repairResult.repairMethod,
          wasRepaired: repairResult.repaired,
        });

        const repairedPractices = repairResult.data.practices;
        const optimizationPlan = createOptimizationPlanFromPractices(
          repairedPractices,
          state.userDiagnostics!,
          state.userEvidence?.workflows[0],
          state.userToolbox
        );

        return {
          webOptimizationPlan: optimizationPlan,
          currentStage: 'a4_web_extraction_repaired',
          progress: 75,
        };
      }
    } catch (repairError) {
      logger.warn('A4-Web: JSON repair also failed', {
        error: repairError instanceof Error ? repairError.message : String(repairError),
      });
    }

    // FINAL FALLBACK: Create optimization blocks directly from inefficiencies
    // This ensures we still provide value even when all LLM approaches fail
    const fallbackPlan = createFallbackOptimizationPlan(
      inefficiencies,
      state.userDiagnostics!,
      state.userEvidence?.workflows[0],
      state.userToolbox
    );

    if (fallbackPlan.blocks.length > 0) {
      logger.info('A4-Web: Heuristic fallback plan created', {
        blockCount: fallbackPlan.blocks.length,
        totalTimeSaved: fallbackPlan.totalTimeSaved,
      });

      return {
        webOptimizationPlan: fallbackPlan,
        currentStage: 'a4_web_extraction_fallback',
        progress: 75,
      };
    }

    return {
      errors: [`A4-Web extraction failed: ${errorMessage}`],
      webOptimizationPlan: null,
      currentStage: isSchemaError ? 'a4_web_extraction_schema_error' : 'a4_web_extraction_failed',
    };
  }
}

// ============================================================================
// GRAPH BUILDER
// ============================================================================

/**
 * Create the A4-Web Best Practices Agent graph
 */
export function createWebBestPracticesGraph(deps: WebBestPracticesGraphDeps) {
  const { logger } = deps;

  logger.info('Creating A4-Web Best Practices Graph');

  const graph = new StateGraph(InsightStateAnnotation)
    // Add nodes
    .addNode('generate_queries', (state) => generateSearchQueries(state, deps))
    .addNode('search_best_practices', (state) => searchBestPractices(state, deps))
    .addNode('extract_best_practices', (state) => extractBestPractices(state, deps))

    // Define edges
    .addEdge('__start__', 'generate_queries')
    .addEdge('generate_queries', 'search_best_practices')
    .addEdge('search_best_practices', 'extract_best_practices')
    .addEdge('extract_best_practices', END);

  return graph.compile();
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate search queries for inefficiencies
 */
function generateSearchQueriesForInefficiencies(
  inefficiencies: Inefficiency[],
  userQuery: string
): Array<{ query: string; targetInefficiency: string }> {
  const queries: Array<{ query: string; targetInefficiency: string }> = [];

  // Reference site for workflow best practices
  const referenceSite = 'site:chatprd.ai/how-i-ai/workflows';

  for (const ineff of inefficiencies.slice(0, 3)) {
    let query = '';

    switch (ineff.type) {
      case 'repetitive_search':
        query = `best practices reducing repetitive searches developer workflow ${referenceSite}`;
        break;
      case 'context_switching':
        query = `minimize context switching developer productivity tools ${referenceSite}`;
        break;
      case 'rework_loop':
        query = `prevent rework loops debugging workflow automation ${referenceSite}`;
        break;
      case 'manual_automation':
        query = `automate manual tasks Claude Code AI assistant ${referenceSite}`;
        break;
      case 'idle_time':
        query = `reduce idle time developer workflow optimization ${referenceSite}`;
        break;
      case 'tool_fragmentation':
        query = `consolidate developer tools reduce fragmentation ${referenceSite}`;
        break;
      case 'information_gathering':
        query = `streamline information gathering research workflow AI ${referenceSite}`;
        break;
      default:
        query = `developer workflow optimization best practices ${referenceSite}`;
    }

    queries.push({
      query,
      targetInefficiency: ineff.id,
    });
  }

  // Add a general query based on user's question
  if (userQuery) {
    queries.push({
      query: `${userQuery} workflow optimization best practices`,
      targetInefficiency: 'general',
    });
  }

  return queries;
}

/**
 * Call Perplexity API for search
 */
async function callPerplexityAPI(
  query: string,
  apiKey: string,
  logger: Logger
): Promise<{ content: string; citations: string[] }> {
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful assistant that provides concise, actionable best practices for developer workflows. Focus on practical improvements that save time.',
        },
        {
          role: 'user',
          content: query,
        },
      ],
      temperature: 0.2,
      max_tokens: 1024,
      return_citations: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Perplexity API error: ${response.status}`);
  }

  const data = (await response.json()) as PerplexityResponse;
  const content = data.choices?.[0]?.message?.content || '';
  const citations = data.citations || [];

  logger.debug('Perplexity response received', {
    contentLength: content.length,
    citationCount: citations.length,
  });

  return { content, citations };
}

/**
 * Get search context from Perplexity API calls
 */
async function getSearchContext(
  inefficiencies: Inefficiency[],
  userQuery: string,
  apiKey: string,
  logger: Logger
): Promise<string> {
  const queries = generateSearchQueriesForInefficiencies(inefficiencies, userQuery);

  // OPTIMIZATION: Run all Perplexity searches in PARALLEL using Promise.all
  const searchStartTime = Date.now();
  const searchPromises = queries.slice(0, 2).map(async (queryInfo) => {
    try {
      const result = await callPerplexityAPI(queryInfo.query, apiKey, logger);
      return `Query: ${queryInfo.query}\n${result.content}`;
    } catch (err) {
      logger.warn('Search query failed', err instanceof Error ? err : new Error(String(err)));
      return null;
    }
  });

  const allResults = await Promise.all(searchPromises);
  const results = allResults.filter((r): r is string => r !== null);

  logger.debug('A4-Web: getSearchContext parallel complete', {
    parallelDurationMs: Date.now() - searchStartTime,
    queriesAttempted: queries.slice(0, 2).length,
    successfulQueries: results.length,
  });

  return results.join('\n\n---\n\n') || 'No search results available.';
}

/**
 * Create optimization plan from extracted best practices
 */
function createOptimizationPlanFromPractices(
  practices: any[],
  userDiagnostics: any,
  userWorkflow?: any,
  userToolbox?: UserToolbox | null
): StepOptimizationPlan {
  const blocks: OptimizationBlock[] = [];
  let totalTimeSaved = 0;

  for (const practice of practices) {
    // Find related inefficiencies
    const relatedInefficiencies = userDiagnostics.inefficiencies.filter(
      (i: Inefficiency) =>
        practice.applicableInefficiencyIds.includes(i.id)
    );

    if (relatedInefficiencies.length === 0) continue;

    // Get affected steps from inefficiencies
    const affectedStepIds = relatedInefficiencies.flatMap(
      (i: Inefficiency) => i.stepIds
    );

    // Calculate current time for affected steps
    const currentTimeTotal = affectedStepIds.reduce((sum: number, stepId: string) => {
      const step = userWorkflow?.steps?.find((s: any) => s.stepId === stepId);
      return sum + (step?.durationSeconds || 60); // Default 60s if not found
    }, 0);

    const timeSaved = practice.estimatedTimeSavingsSeconds;
    const optimizedTimeTotal = Math.max(currentTimeTotal - timeSaved, 0);

    totalTimeSaved += timeSaved;

    // Create step transformation
    const transformation: StepTransformation = {
      transformationId: uuidv4(),
      currentSteps: affectedStepIds.map((stepId: string) => {
        const step = userWorkflow?.steps?.find((s: any) => s.stepId === stepId);
        return {
          stepId,
          tool: step?.app || step?.tool || 'unknown',
          durationSeconds: step?.durationSeconds || 60,
          description: step?.description || '',
        } as CurrentStep;
      }),
      optimizedSteps: [
        {
          stepId: `opt-${uuidv4().slice(0, 8)}`,
          tool: practice.toolSuggestion,
          estimatedDurationSeconds: optimizedTimeTotal,
          description: practice.description,
          claudeCodePrompt: practice.claudeCodeApplicable
            ? practice.claudeCodePrompt
            : undefined,
          isNew: true,
          replacesSteps: affectedStepIds,
          // Use smart matching: check both tool name AND description for user's tools
          isInUserToolbox: isToolInUserToolbox(practice.toolSuggestion, userToolbox) ||
            isSuggestionForUserTools(practice.toolSuggestion, userToolbox) ||
            isSuggestionForUserTools(practice.description, userToolbox),
        } as OptimizedStep,
      ],
      timeSavedSeconds: timeSaved,
      confidence: practice.confidence,
      rationale: practice.title,
    };

    blocks.push({
      blockId: uuidv4(),
      workflowName: userWorkflow?.name || userWorkflow?.title || 'Workflow',
      workflowId: userWorkflow?.workflowId || 'unknown',
      currentTimeTotal,
      optimizedTimeTotal,
      timeSaved,
      relativeImprovement: currentTimeTotal > 0 ? (timeSaved / currentTimeTotal) * 100 : 0,
      confidence: practice.confidence,
      whyThisMatters: practice.title,
      metricDeltas: {},
      stepTransformations: [transformation],
      source: 'web_best_practice',
      citations: practice.sourceUrl
        ? [{ title: 'Web Source', excerpt: practice.description, url: practice.sourceUrl }]
        : undefined,
    });
  }

  const totalCurrentTime = blocks.reduce((sum, b) => sum + b.currentTimeTotal, 0);

  return {
    blocks,
    totalTimeSaved,
    totalRelativeImprovement:
      totalCurrentTime > 0 ? (totalTimeSaved / totalCurrentTime) * 100 : 0,
    passesThreshold: false, // Set by orchestrator
  };
}

/**
 * Create fallback optimization plan when LLM extraction fails
 * This generates recommendations directly from inefficiency patterns
 */
function createFallbackOptimizationPlan(
  inefficiencies: Inefficiency[],
  userDiagnostics: any,
  userWorkflow?: any,
  userToolbox?: UserToolbox | null
): StepOptimizationPlan {
  const blocks: OptimizationBlock[] = [];
  let totalTimeSaved = 0;

  // Map inefficiency types to generic recommendations
  const inefficiencyRecommendations: Record<string, { tool: string; title: string; description: string; claudeCodeApplicable: boolean }> = {
    'repetitive_search': {
      tool: 'Browser bookmarks + Alfred/Raycast',
      title: 'Reduce repetitive searches',
      description: 'Create shortcuts for frequently accessed resources and use launcher apps for quick access',
      claudeCodeApplicable: false,
    },
    'context_switching': {
      tool: 'Claude Code',
      title: 'Minimize context switching',
      description: 'Use an AI coding assistant to handle multi-step tasks without switching between tools',
      claudeCodeApplicable: true,
    },
    'rework_loop': {
      tool: 'Claude Code + Linting',
      title: 'Prevent rework cycles',
      description: 'Set up automated linting and use AI review to catch issues before committing',
      claudeCodeApplicable: true,
    },
    'manual_automation': {
      tool: 'Shell scripts + Claude Code',
      title: 'Automate manual tasks',
      description: 'Create scripts or ask Claude Code to automate repetitive command sequences',
      claudeCodeApplicable: true,
    },
    'idle_time': {
      tool: 'Background processing',
      title: 'Utilize idle time',
      description: 'Run long tasks in background terminals; queue up work during waiting periods',
      claudeCodeApplicable: false,
    },
    'tool_fragmentation': {
      tool: 'VS Code + Claude Code',
      title: 'Consolidate tools',
      description: 'Use integrated development environments with built-in terminal and AI assistance',
      claudeCodeApplicable: true,
    },
    'information_gathering': {
      tool: 'Claude Code + web search',
      title: 'Streamline research',
      description: 'Use AI to synthesize information from multiple sources quickly',
      claudeCodeApplicable: true,
    },
  };

  for (const ineff of inefficiencies.slice(0, 3)) {
    const rec = inefficiencyRecommendations[ineff.type] || {
      tool: 'Claude Code',
      title: `Address ${ineff.type}`,
      description: 'Use AI-assisted workflows to improve efficiency',
      claudeCodeApplicable: true,
    };

    const timeSaved = Math.min(ineff.estimatedWastedSeconds * 0.5, 180); // 50% improvement, max 3 min
    const currentTimeTotal = ineff.estimatedWastedSeconds;
    const optimizedTimeTotal = Math.max(currentTimeTotal - timeSaved, 0);

    totalTimeSaved += timeSaved;

    const transformation: StepTransformation = {
      transformationId: uuidv4(),
      currentSteps: ineff.stepIds.slice(0, 3).map((stepId: string) => {
        const step = userWorkflow?.steps?.find((s: any) => s.stepId === stepId);
        return {
          stepId,
          tool: step?.app || step?.tool || 'unknown',
          durationSeconds: step?.durationSeconds || 60,
          description: step?.description || ineff.description,
        } as CurrentStep;
      }),
      optimizedSteps: [
        {
          stepId: `opt-fallback-${uuidv4().slice(0, 8)}`,
          tool: rec.tool,
          estimatedDurationSeconds: optimizedTimeTotal,
          description: rec.description,
          claudeCodePrompt: rec.claudeCodeApplicable
            ? `Help me ${rec.title.toLowerCase()}: ${ineff.description}`
            : undefined,
          isNew: true,
          replacesSteps: ineff.stepIds.slice(0, 3),
          isInUserToolbox: isToolInUserToolbox(rec.tool, userToolbox) ||
            isSuggestionForUserTools(rec.tool, userToolbox),
        } as OptimizedStep,
      ],
      timeSavedSeconds: timeSaved,
      confidence: 0.6, // Lower confidence for fallback
      rationale: rec.title,
    };

    blocks.push({
      blockId: uuidv4(),
      workflowName: userWorkflow?.name || userWorkflow?.title || 'Workflow',
      workflowId: userWorkflow?.workflowId || 'unknown',
      currentTimeTotal,
      optimizedTimeTotal,
      timeSaved,
      relativeImprovement: currentTimeTotal > 0 ? (timeSaved / currentTimeTotal) * 100 : 0,
      confidence: 0.6,
      whyThisMatters: rec.title,
      metricDeltas: {},
      stepTransformations: [transformation],
      source: 'heuristic',
      citations: undefined,
    });
  }

  const totalCurrentTime = blocks.reduce((sum, b) => sum + b.currentTimeTotal, 0);

  return {
    blocks,
    totalTimeSaved,
    totalRelativeImprovement:
      totalCurrentTime > 0 ? (totalTimeSaved / totalCurrentTime) * 100 : 0,
    passesThreshold: false,
  };
}
