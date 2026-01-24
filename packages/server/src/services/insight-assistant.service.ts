/**
 * Insight Assistant Service
 *
 * Service for generating AI-powered strategy proposals from workflow analysis.
 * Uses the RAG pipeline to analyze workflows and generate actionable recommendations.
 */

import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import type { Logger } from '../core/logger.js';
import type { LLMProvider } from '../core/llm-provider.js';
import type { NaturalLanguageQueryService } from './natural-language-query.service.js';
import { createTracer } from '../core/langfuse.js';
import type {
  StrategyProposal,
  GenerateProposalsRequest,
  ProposalFeedbackRequest,
} from '@journey/schema';

/**
 * Service dependencies
 */
export interface InsightAssistantServiceDeps {
  logger: Logger;
  llmProvider: LLMProvider;
  naturalLanguageQueryService: NaturalLanguageQueryService;
}

/**
 * LLM response schema for strategy proposal generation
 */
const StrategyProposalResponseSchema = z.object({
  proposals: z.array(z.object({
    title: z.string().describe('A clear, actionable title for the strategy proposal'),
    description: z.string().describe('Detailed description of the strategy and its benefits'),
    workflowCount: z.number().describe('Number of workflows this proposal applies to'),
    stepCount: z.number().describe('Number of steps that could be optimized'),
    costOptimization: z.number().min(0).max(100).describe('Estimated cost optimization percentage'),
    efficiency: z.number().min(0).max(100).describe('Estimated efficiency improvement percentage'),
    confidence: z.number().min(0).max(100).describe('Confidence level in this recommendation'),
  })).max(5).describe('List of strategy proposals (max 5)'),
});

type LLMProposalResponse = z.infer<typeof StrategyProposalResponseSchema>;

/**
 * In-memory storage for proposals (can be replaced with database later)
 */
const proposalStore = new Map<string, StrategyProposal & { userId: number }>();

/**
 * Insight Assistant Service
 */
export class InsightAssistantService {
  private logger: Logger;
  private llmProvider: LLMProvider;
  private nlqService: NaturalLanguageQueryService;

  constructor(deps: InsightAssistantServiceDeps) {
    this.logger = deps.logger;
    this.llmProvider = deps.llmProvider;
    this.nlqService = deps.naturalLanguageQueryService;
  }

  /**
   * Generate strategy proposals based on a user query
   */
  async generateProposals(
    userId: number,
    request: GenerateProposalsRequest
  ): Promise<{ proposals: StrategyProposal[]; queryId: string }> {
    const startTime = Date.now();
    const queryId = uuidv4();

    // Create Langfuse trace
    const tracer = createTracer();
    tracer.startTrace({
      name: 'insight-assistant-proposals',
      userId: String(userId),
      input: {
        query: request.query,
        nodeId: request.nodeId,
      },
      tags: ['insight-assistant', 'strategy-proposals'],
    });

    this.logger.info('Generating strategy proposals', {
      userId,
      query: request.query,
      nodeId: request.nodeId,
    });

    try {
      // First, get context from the natural language query service
      const nlqResult = await this.nlqService.query(userId, {
        query: request.query,
        nodeId: request.nodeId,
        lookbackDays: 90,
        maxResults: 20,
        includeGraph: true,
        includeVectors: true,
      });

      // Build context for proposal generation
      const context = this.buildProposalContext(nlqResult, request);

      // Generate proposals using LLM
      const llmResponse = await this.generateProposalsWithLLM(context, request.query);

      // Convert LLM response to StrategyProposal format
      const now = new Date().toISOString();
      const proposals: StrategyProposal[] = llmResponse.proposals.map((p) => {
        const proposal: StrategyProposal = {
          id: uuidv4(),
          title: p.title,
          description: p.description,
          workflowCount: p.workflowCount,
          stepCount: p.stepCount,
          tags: {
            costOptimization: p.costOptimization,
            efficiency: p.efficiency,
            confidence: p.confidence,
          },
          isBookmarked: false,
          feedback: null,
          sources: nlqResult.sources?.slice(0, 3),
          createdAt: now,
          updatedAt: now,
        };

        // Store proposal for later retrieval
        proposalStore.set(proposal.id, { ...proposal, userId });

        return proposal;
      });

      const elapsed = Date.now() - startTime;
      tracer.endTrace({
        output: { proposalCount: proposals.length, queryId },
        metadata: { elapsedMs: elapsed },
      });

      this.logger.info('Generated strategy proposals', {
        userId,
        proposalCount: proposals.length,
        elapsedMs: elapsed,
      });

      return { proposals, queryId };
    } catch (error) {
      tracer.endTrace({
        output: { error: String(error) },
        level: 'ERROR',
      });
      this.logger.error('Failed to generate proposals', { error, userId });
      throw error;
    }
  }

  /**
   * Submit feedback for a proposal
   */
  async submitFeedback(
    userId: number,
    proposalId: string,
    feedback: ProposalFeedbackRequest
  ): Promise<{ proposalId: string; feedback: 'up' | 'down' | null; isBookmarked: boolean }> {
    const proposal = proposalStore.get(proposalId);

    if (!proposal || proposal.userId !== userId) {
      throw new Error('Proposal not found');
    }

    if (feedback.feedback !== undefined) {
      proposal.feedback = feedback.feedback;
    }
    if (feedback.isBookmarked !== undefined) {
      proposal.isBookmarked = feedback.isBookmarked;
    }
    proposal.updatedAt = new Date().toISOString();

    proposalStore.set(proposalId, proposal);

    this.logger.info('Updated proposal feedback', {
      userId,
      proposalId,
      feedback: proposal.feedback,
      isBookmarked: proposal.isBookmarked,
    });

    return {
      proposalId,
      feedback: proposal.feedback,
      isBookmarked: proposal.isBookmarked,
    };
  }

  /**
   * Get saved/bookmarked proposals for a user
   */
  async getProposals(
    userId: number,
    options: { bookmarkedOnly?: boolean; limit?: number; offset?: number }
  ): Promise<{ proposals: StrategyProposal[]; total: number; hasMore: boolean }> {
    const { bookmarkedOnly = false, limit = 50, offset = 0 } = options;

    // Filter proposals by user
    let userProposals = Array.from(proposalStore.values())
      .filter((p) => p.userId === userId);

    // Filter by bookmarked if requested
    if (bookmarkedOnly) {
      userProposals = userProposals.filter((p) => p.isBookmarked);
    }

    // Sort by creation date (newest first)
    userProposals.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const total = userProposals.length;
    const paginatedProposals = userProposals.slice(offset, offset + limit);

    // Remove userId from returned proposals
    const proposals: StrategyProposal[] = paginatedProposals.map(({ userId: _, ...p }) => p);

    return {
      proposals,
      total,
      hasMore: offset + limit < total,
    };
  }

  /**
   * Build context for proposal generation from NLQ result
   */
  private buildProposalContext(nlqResult: any, request: GenerateProposalsRequest): string {
    const parts: string[] = [];

    parts.push(`User Query: ${request.query}`);
    parts.push('');
    parts.push('Workflow Analysis Context:');
    parts.push(nlqResult.answer);

    if (nlqResult.sources && nlqResult.sources.length > 0) {
      parts.push('');
      parts.push('Relevant Sources:');
      nlqResult.sources.slice(0, 5).forEach((source: any, idx: number) => {
        parts.push(`${idx + 1}. ${source.title} (${source.type}) - ${source.description || 'No description'}`);
      });
    }

    if (request.conversationContext && request.conversationContext.length > 0) {
      parts.push('');
      parts.push('Previous Conversation Context:');
      request.conversationContext.forEach((msg) => {
        parts.push(`- ${msg}`);
      });
    }

    return parts.join('\n');
  }

  /**
   * Generate proposals using LLM
   */
  private async generateProposalsWithLLM(
    context: string,
    query: string
  ): Promise<LLMProposalResponse> {
    const systemPrompt = `You are an AI workflow optimization expert. Your task is to analyze workflow patterns and generate actionable strategy proposals to improve efficiency and reduce costs.

Based on the provided context and user query, generate up to 5 strategy proposals. Each proposal should:
1. Have a clear, actionable title
2. Include a detailed description of the strategy and its benefits
3. Estimate the number of workflows and steps affected
4. Provide realistic estimates for cost optimization and efficiency improvements
5. Include your confidence level in the recommendation

Focus on practical, implementable suggestions that can deliver measurable results.`;

    const userPrompt = `Context:
${context}

Based on this workflow analysis, generate strategy proposals to address the user's query: "${query}"

Provide actionable recommendations with realistic estimates.`;

    try {
      const result = await this.llmProvider.generateStructuredResponse<LLMProposalResponse>(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        StrategyProposalResponseSchema,
        { temperature: 0.7 }
      );
      const response = result.content;

      return response;
    } catch (error) {
      this.logger.error('LLM proposal generation failed', { error });

      // Return fallback proposals if LLM fails
      return {
        proposals: [
          {
            title: 'Analyze Workflow Patterns',
            description: 'Based on your query, we recommend analyzing your current workflow patterns to identify optimization opportunities.',
            workflowCount: 1,
            stepCount: 5,
            costOptimization: 15,
            efficiency: 20,
            confidence: 70,
          },
        ],
      };
    }
  }
}
