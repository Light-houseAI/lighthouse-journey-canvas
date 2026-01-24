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
} from '../types.js';
import { z } from 'zod';

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

const bestPracticesExtractionSchema = z.object({
  practices: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      applicableInefficiencyIds: z.array(z.string()),
      estimatedTimeSavingsSeconds: z.number(),
      toolSuggestion: z.string(),
      claudeCodeApplicable: z.boolean(),
      claudeCodePrompt: z.string().optional(),
      confidence: z.number().min(0).max(1),
    })
  ),
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
    const response = await llmProvider.generateStructuredResponse(
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
    );

    logger.info('A4-Web: Generated search queries', {
      queryCount: response.content.queries.length,
    });

    // Log detailed output for debugging
    logger.info('=== A4-WEB AGENT OUTPUT (Search Queries) ===');
    logger.info(JSON.stringify({
      agent: 'A4_WEB',
      outputType: 'searchQueries',
      queries: response.content.queries.map(q => ({
        query: q.query,
        targetInefficiency: q.targetInefficiency,
        rationale: q.rationale,
      })),
    }, null, 2));
    logger.info('=== END A4-WEB SEARCH QUERIES OUTPUT ===');

    return {
      currentStage: 'a4_web_queries_generated',
      progress: 68,
    };
  } catch (error) {
    logger.error('A4-Web: Query generation failed', { error });
    return {
      errors: [`A4-Web query generation failed: ${error}`],
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

  const searchResults: SearchResult[] = [];

  // Search for each inefficiency type
  const searchQueries = generateSearchQueriesForInefficiencies(inefficiencies, state.query);

  for (const queryInfo of searchQueries.slice(0, 3)) {
    try {
      const result = await callPerplexityAPI(
        queryInfo.query,
        perplexityApiKey,
        logger
      );
      searchResults.push({
        query: queryInfo.query,
        content: result.content,
        citations: result.citations,
      });
    } catch (error) {
      logger.warn('A4-Web: Search query failed', { query: queryInfo.query, error });
    }
  }

  logger.info('A4-Web: Search complete', {
    successfulQueries: searchResults.length,
    totalCitations: searchResults.reduce((sum, r) => sum + r.citations.length, 0),
  });

  // Log detailed output for debugging
  logger.info('=== A4-WEB AGENT OUTPUT (Search Results) ===');
  logger.info(JSON.stringify({
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
  }, null, 2));
  logger.info('=== END A4-WEB SEARCH RESULTS OUTPUT ===');

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

  try {
    const response = await llmProvider.generateStructuredResponse(
      [
        {
          role: 'user',
          content: `Extract actionable best practices for these workflow inefficiencies:

Inefficiencies:
${inefficiencies.map((i) => `- [${i.id}] ${i.type}: ${i.description} (~${i.estimatedWastedSeconds}s wasted)`).join('\n')}

Search Results / Knowledge Base:
${searchContext}

User's Context: "${state.query}"

For each best practice:
1. Map it to specific inefficiency IDs it addresses
2. Estimate time savings in seconds
3. Suggest specific tools (prioritize Claude Code for coding tasks)
4. Generate Claude Code prompts where applicable
5. Rate confidence based on evidence quality`,
        },
      ],
      bestPracticesExtractionSchema
    );

    const optimizationPlan = createOptimizationPlanFromPractices(
      response.content.practices,
      state.userDiagnostics!,
      state.userEvidence?.workflows[0]
    );

    logger.info('A4-Web: Best practices extracted', {
      practiceCount: response.content.practices.length,
      blocksCreated: optimizationPlan.blocks.length,
    });

    // Log detailed output for debugging
    logger.info('=== A4-WEB AGENT OUTPUT (Best Practices) ===');
    logger.info(JSON.stringify({
      agent: 'A4_WEB',
      outputType: 'bestPractices',
      practices: response.content.practices.map(p => ({
        title: p.title,
        description: p.description,
        applicableInefficiencyIds: p.applicableInefficiencyIds,
        estimatedTimeSavingsSeconds: p.estimatedTimeSavingsSeconds,
        toolSuggestion: p.toolSuggestion,
        claudeCodeApplicable: p.claudeCodeApplicable,
        claudeCodePrompt: p.claudeCodePrompt,
        confidence: p.confidence,
      })),
    }, null, 2));
    logger.info('=== END A4-WEB BEST PRACTICES OUTPUT ===');

    // Log optimization plan
    logger.info('=== A4-WEB AGENT OUTPUT (Optimization Plan) ===');
    logger.info(JSON.stringify({
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
    }, null, 2));
    logger.info('=== END A4-WEB OPTIMIZATION PLAN OUTPUT ===');

    return {
      webOptimizationPlan: optimizationPlan,
      currentStage: 'a4_web_extraction_complete',
      progress: 75,
    };
  } catch (error) {
    logger.error('A4-Web: Extraction failed', { error });
    return {
      errors: [`A4-Web extraction failed: ${error}`],
      webOptimizationPlan: null,
      currentStage: 'a4_web_extraction_failed',
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
      model: 'llama-3.1-sonar-small-128k-online',
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
  const results: string[] = [];

  for (const queryInfo of queries.slice(0, 2)) {
    try {
      const result = await callPerplexityAPI(queryInfo.query, apiKey, logger);
      results.push(`Query: ${queryInfo.query}\n${result.content}`);
    } catch (error) {
      logger.warn('Search query failed', { error });
    }
  }

  return results.join('\n\n---\n\n') || 'No search results available.';
}

/**
 * Create optimization plan from extracted best practices
 */
function createOptimizationPlanFromPractices(
  practices: any[],
  userDiagnostics: any,
  userWorkflow?: any
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
