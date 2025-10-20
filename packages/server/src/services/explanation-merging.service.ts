/**
 * Service for merging GraphRAG and trajectory-based explanations
 * Part of LIG-207 Career Trajectory Matching
 *
 * Enhanced with LLM-based explanation generation for better context
 */

import { z } from 'zod';

import type { LLMProvider } from '../core/llm-provider';
import type { Logger } from '../core/logger';
import type { IExplanationMergingService } from './interfaces/explanation-merging.interface';
import type { TrajectoryMatchResult } from './job-application-trajectory-matcher/types';

export interface ExplanationMergingServiceDependencies {
  logger: Logger;
  llmProvider: LLMProvider;
}

export class ExplanationMergingService implements IExplanationMergingService {
  private readonly logger: Logger;
  private readonly llmProvider: LLMProvider;
  private readonly MAX_COMBINED_EXPLANATIONS = 5; // Limit to top 5 most relevant
  private readonly LLM_TIMEOUT_MS = 10000; // 10 second timeout for LLM calls

  constructor({ logger, llmProvider }: ExplanationMergingServiceDependencies) {
    this.logger = logger;
    this.llmProvider = llmProvider;
  }

  /**
   * Merge GraphRAG "whyMatched" with trajectory explanations
   *
   * Strategy:
   * 1. Use LLM to generate contextual explanations combining trajectory + GraphRAG data
   * 2. Fall back to simple prepending if LLM fails
   * 3. Include job application context (target role/company) for relevance
   */
  async mergeExplanations(
    graphRAGWhyMatched: string[],
    trajectoryMatch: TrajectoryMatchResult,
    targetRole?: string,
    targetCompany?: string
  ): Promise<string[]> {
    this.logger.info('🎯 ExplanationMergingService.mergeExplanations CALLED', {
      userId: trajectoryMatch?.userId,
      graphRAGCount: graphRAGWhyMatched?.length || 0,
      trajectoryScore: trajectoryMatch?.score || 0,
      targetRole,
      targetCompany,
    });

    // Graceful degradation: no trajectory context
    if (!trajectoryMatch || trajectoryMatch.score === 0) {
      this.logger.info('No trajectory context, using GraphRAG only');
      return graphRAGWhyMatched || [];
    }

    try {
      // Try LLM-enhanced generation
      this.logger.info('🤖 Attempting LLM-enhanced explanation generation...');
      const enhanced = await this.generateEnhancedExplanation(
        graphRAGWhyMatched,
        trajectoryMatch,
        targetRole,
        targetCompany
      );

      if (enhanced && enhanced.length > 0) {
        this.logger.info(
          '✅ Successfully generated LLM-enhanced explanations',
          {
            userId: trajectoryMatch.userId,
            enhancedCount: enhanced.length,
            enhanced,
          }
        );
        return enhanced.slice(0, this.MAX_COMBINED_EXPLANATIONS);
      }
    } catch (error) {
      this.logger.warn(
        '❌ LLM explanation enhancement failed, using fallback',
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          userId: trajectoryMatch.userId,
        }
      );
    }

    // Fallback: Simple prepending (original behavior)
    this.logger.info('📋 Using fallback merge strategy');
    return this.fallbackMerge(graphRAGWhyMatched, trajectoryMatch);
  }

  /**
   * Generate enhanced explanations using LLM
   * Combines trajectory structural insights with GraphRAG semantic insights
   */
  private async generateEnhancedExplanation(
    graphRAGWhyMatched: string[],
    trajectoryMatch: TrajectoryMatchResult,
    targetRole?: string,
    targetCompany?: string
  ): Promise<string[]> {
    const prompt = this.buildEnhancementPrompt(
      graphRAGWhyMatched,
      trajectoryMatch,
      targetRole,
      targetCompany
    );

    const schema = z.object({
      explanations: z.array(z.string().min(40).max(80)).min(2).max(3),
    });

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('LLM explanation timeout')),
        this.LLM_TIMEOUT_MS
      )
    );

    // Race LLM call against timeout
    const response = await Promise.race([
      this.llmProvider.generateStructuredResponse(
        [
          {
            role: 'system',
            content:
              'You are a career matching expert. Generate concise, factual explanations for why a candidate matches a job application based on their career trajectory and professional experience.',
          },
          { role: 'user', content: prompt },
        ],
        schema,
        {
          temperature: 0.1, // Very low temperature for consistent, factual output
          maxTokens: 250, // Medium detail level (spec)
        }
      ),
      timeoutPromise,
    ]);

    return response.content.explanations;
  }

  /**
   * Build LLM prompt with trajectory and GraphRAG context
   */
  private buildEnhancementPrompt(
    graphRAGWhyMatched: string[],
    trajectoryMatch: TrajectoryMatchResult,
    targetRole?: string,
    targetCompany?: string
  ): string {
    const targetContext =
      targetRole || targetCompany
        ? `\nTarget Position (what the job seeker is applying for): ${targetRole || 'Not specified'} at ${targetCompany || 'Not specified'}`
        : '';

    return `Generate 2-3 concise bullet points (max 80 chars each) explaining why this MATCHED CANDIDATE's career is similar and helpful for someone applying to the target position.
${targetContext}

CRITICAL INSTRUCTIONS:
1. When mentioning companies or interview processes, ONLY reference the TARGET COMPANY (${targetCompany || 'the target company'})
2. DO NOT mention any other company names from the candidate's experience
3. Focus on how their skills/experience are relevant to ${targetCompany || 'the target role'}, not where they worked
4. The candidate is a peer with similar background, NOT someone at the target company

Trajectory Match Data (how similar their career path is):
- Overall Score: ${Math.round(trajectoryMatch.score * 100)}%
- Role Alignment: ${Math.round((trajectoryMatch.subscores?.roleAlignment || 0) * 100)}%
- Company Experience Match: ${Math.round((trajectoryMatch.subscores?.companyMatch || 0) * 100)}%
- Career Recency: ${Math.round((trajectoryMatch.subscores?.recency || 0) * 100)}%
- Career Path Insights: ${trajectoryMatch.explanation?.join('; ') || 'Not available'}

GraphRAG Semantic Insights (their background and skills):
${graphRAGWhyMatched && graphRAGWhyMatched.length > 0 ? graphRAGWhyMatched.map((insight, i) => `${i + 1}. ${insight}`).join('\n') : 'Not available'}

Requirements:
- Reference ONLY ${targetCompany || 'the target company'} when mentioning interview processes
- Focus on transferable skills and experiences, not specific companies
- Be specific but concise (40-80 characters per bullet)
- Start bullets naturally (no "Career path:" prefix)
- If you mention interview preparation, say "for ${targetCompany || 'this role'}" not other company names

Return exactly 2-3 bullets as JSON.`;
  }

  /**
   * Fallback merge strategy (original simple prepending)
   */
  private fallbackMerge(
    graphRAGWhyMatched: string[],
    trajectoryMatch: TrajectoryMatchResult
  ): string[] {
    const merged: string[] = [];

    // Add trajectory explanations first (structural insights)
    if (trajectoryMatch.explanation && trajectoryMatch.explanation.length > 0) {
      const trajectoryInsights = trajectoryMatch.explanation.map(
        (exp) => `Career path: ${exp}`
      );
      merged.push(...trajectoryInsights);
    }

    // Add GraphRAG explanations (semantic insights)
    if (graphRAGWhyMatched && graphRAGWhyMatched.length > 0) {
      merged.push(...graphRAGWhyMatched);
    }

    const limited = merged.slice(0, this.MAX_COMBINED_EXPLANATIONS);

    this.logger.debug('Fallback merge completed', {
      userId: trajectoryMatch.userId,
      trajectoryCount: trajectoryMatch.explanation?.length || 0,
      graphRAGCount: graphRAGWhyMatched?.length || 0,
      totalCount: merged.length,
      limitedCount: limited.length,
    });

    return limited;
  }
}
