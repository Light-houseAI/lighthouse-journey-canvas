/**
 * Web Search Skill (wraps A4-Web Best Practices Agent)
 *
 * This skill searches the web for industry best practices, expert recommendations,
 * and established workflows using the Perplexity API.
 */

import { createWebBestPracticesGraph, type WebBestPracticesGraphDeps } from '../graphs/web-best-practices-graph.js';
import { createAgentLLMProvider } from '../utils/model-provider-factory.js';
import type { Skill, SkillDependencies } from './skill-types.js';
import type { SkillInput, SkillExecutionResult } from '../types.js';
import type { InsightState } from '../state/insight-state.js';

// ============================================================================
// SKILL DEFINITION
// ============================================================================

export const webSearchSkill: Skill = {
  // =========================================================================
  // DESCRIPTION (for LLM reasoning)
  // =========================================================================

  id: 'search_web_best_practices',

  name: 'Search Web Best Practices',

  description: `This skill searches the web for industry best practices, expert recommendations, and established workflows using the Perplexity API. It finds external knowledge to supplement internal analysis.

The skill generates targeted search queries from identified inefficiencies, extracts actionable recommendations with source citations, and maps best practices to the user's specific workflow steps.

This is typically used when the user asks for industry best practices or external knowledge.`,

  whenToUse: [
    'User explicitly asks for industry best practices',
    'Looking for tool-specific tips',
    'Need external validation for recommendations',
    'User mentions unfamiliar tools or techniques',
    'User asks "what do experts recommend?"',
    'Need up-to-date information about tools or workflows',
  ],

  capabilities: [
    'Generates targeted search queries from identified inefficiencies',
    'Searches via Perplexity API for relevant articles/documentation',
    'Extracts actionable recommendations with source citations',
    'Maps external best practices to user-specific workflow steps',
    'Generates Claude Code prompts for applicable suggestions',
    'Filters for relevance and quality',
    'Provides URLs for further reading',
  ],

  produces: ['webOptimizationPlan'],

  requires: [], // No hard prerequisites — can run standalone for TOOL_INTEGRATION or with userEvidence for context

  // =========================================================================
  // EXECUTION (callable function)
  // =========================================================================

  async execute(
    input: SkillInput,
    state: InsightState,
    deps: SkillDependencies
  ): Promise<SkillExecutionResult> {
    const { logger, modelConfig, perplexityApiKey } = deps;
    const startTime = Date.now();

    // Check if user provided URLs that need to be fetched
    const userUrls = state.userProvidedUrls || [];
    const hasUrlsToFetch = userUrls.length > 0 && !state.urlFetchedContent;

    logger.info('Web Search Skill: Starting execution', {
      hasUserEvidence: !!state.userEvidence,
      hasPerplexityApiKey: !!perplexityApiKey,
      userId: state.userId,
      userUrlCount: userUrls.length,
      hasUrlsToFetch,
    });

    // Check prerequisites
    if (!perplexityApiKey) {
      return {
        success: false,
        observation: 'Cannot search web: Perplexity API key not configured.',
        stateUpdates: {},
        error: 'Missing configuration: perplexityApiKey',
        executionTimeMs: Date.now() - startTime,
      };
    }

    // =========================================================================
    // URL FETCHING MODE: If user provided URLs, fetch and analyze them first
    // =========================================================================
    if (hasUrlsToFetch) {
      logger.info('Web Search Skill: Fetching user-provided URLs via Perplexity', {
        urlCount: userUrls.length,
        urls: userUrls,
      });

      try {
        const urlContent = await fetchUrlsWithPerplexity(
          userUrls,
          state.query,
          perplexityApiKey,
          logger
        );

        const executionTimeMs = Date.now() - startTime;

        logger.info('Web Search Skill: URL fetch complete', {
          contentLength: urlContent.length,
          executionTimeMs,
        });

        return {
          success: true,
          observation: `Fetched and analyzed content from ${userUrls.length} URL(s). Content length: ${urlContent.length} characters.`,
          stateUpdates: {
            urlFetchedContent: urlContent,
          },
          executionTimeMs,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Web Search Skill: URL fetch failed', error instanceof Error ? error : new Error(errorMessage));

        return {
          success: false,
          observation: `Failed to fetch URL content: ${errorMessage}`,
          stateUpdates: {},
          error: errorMessage,
          executionTimeMs: Date.now() - startTime,
        };
      }
    }

    // =========================================================================
    // STANDARD MODE: Search for best practices based on user evidence
    // =========================================================================
    if (!state.userEvidence) {
      logger.info('Web Search Skill: No user evidence available, using query directly');
    }

    try {
      // Get agent-specific LLM provider
      let llmProvider;
      try {
        llmProvider = createAgentLLMProvider('A4_WEB', modelConfig);
      } catch {
        logger.warn('Web Search Skill: Failed to create A4-Web-specific provider, using default');
        llmProvider = deps.llmProvider;
      }

      // Prepare graph dependencies
      const graphDeps: WebBestPracticesGraphDeps = {
        logger,
        llmProvider,
        perplexityApiKey,
      };

      // Create and invoke the A4-Web graph
      const graph = createWebBestPracticesGraph(graphDeps);
      const result = await graph.invoke(state);

      const executionTimeMs = Date.now() - startTime;

      // Build observation
      const blockCount = result.webOptimizationPlan?.blocks?.length ?? 0;
      const citationCount = result.webOptimizationPlan?.blocks?.reduce(
        (sum, b) => sum + (b.citations?.length ?? 0),
        0
      ) ?? 0;

      let observation = `Found ${blockCount} optimization recommendations from web research.`;
      if (citationCount > 0) {
        observation += ` Includes ${citationCount} source citations.`;
      }

      if (blockCount === 0) {
        observation = 'Web search complete but no actionable recommendations found. The search may not have returned relevant results for the identified inefficiencies.';
      }

      logger.info('Web Search Skill: Execution complete', {
        blockCount,
        citationCount,
        executionTimeMs,
      });

      return {
        success: blockCount > 0,
        observation,
        stateUpdates: {
          webOptimizationPlan: result.webOptimizationPlan,
        },
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('Web Search Skill: Execution failed', error instanceof Error ? error : new Error(errorMessage));

      return {
        success: false,
        observation: `Failed to search web best practices: ${errorMessage}`,
        stateUpdates: {},
        error: errorMessage,
        executionTimeMs,
      };
    }
  },

  // =========================================================================
  // METADATA
  // =========================================================================

  wrapsAgent: 'A4_WEB',
  canRunInParallel: true, // Can run in parallel with A4-Company
  estimatedExecutionMs: 10000, // Web search can be slow
};

// ============================================================================
// URL FETCHING HELPER
// ============================================================================

interface PerplexityUrlResponse {
  choices?: Array<{
    message: {
      content: string;
    };
  }>;
  citations?: string[];
}

/**
 * Fetch and analyze content from user-provided URLs using Perplexity API
 * Perplexity's sonar model can browse and summarize web content
 */
async function fetchUrlsWithPerplexity(
  urls: string[],
  userQuery: string,
  apiKey: string,
  logger: { info: (msg: string, meta?: object) => void; warn: (msg: string, meta?: object) => void; debug: (msg: string, meta?: object) => void }
): Promise<string> {
  const urlList = urls.join('\n');

  const prompt = `Please read, analyze, and summarize the content at these URLs:

${urlList}

User's question about this content: "${userQuery}"

Provide a comprehensive response that includes:
1. **Summary**: What is this content about? What does it contain?
2. **Key Information**: The most important details, features, or concepts
3. **Structure/Organization**: How is the content organized (if it's a repository, documentation, etc.)
4. **Examples**: Any code examples, templates, or practical guidance found
5. **How to Use**: Step-by-step instructions if applicable
6. **Relevance to User's Question**: How this content relates to what the user asked

Be thorough and specific. Include actual content, code snippets, and examples from the URLs when relevant.`;

  logger.info('Fetching URLs with Perplexity', {
    urlCount: urls.length,
    promptLength: prompt.length,
  });

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
          content: 'You are a helpful assistant that reads and analyzes web content. When given URLs, fetch their content and provide detailed, accurate summaries. Include specific details, code examples, and actionable information.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 4096, // Allow longer responses for comprehensive URL analysis
      return_citations: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Perplexity API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as PerplexityUrlResponse;
  const content = data.choices?.[0]?.message?.content || '';
  const citations = data.citations || [];

  logger.info('Perplexity URL fetch response received', {
    contentLength: content.length,
    citationCount: citations.length,
  });

  // Format the response with citations
  let formattedContent = content;
  if (citations.length > 0) {
    formattedContent += '\n\n**Sources:**\n' + citations.map((c, i) => `${i + 1}. ${c}`).join('\n');
  }

  return formattedContent;
}
