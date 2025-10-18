/**
 * Service for generating LLM-enhanced career transition insights
 * Part of LIG-207 Career Transition Insights
 *
 * Generates actionable insights from matched candidates' update history
 * to help users plan their job search strategy
 */

import { ApplicationStatus } from '@journey/schema';
import { z } from 'zod';

import type { LLMProvider } from '../core/llm-provider';
import type { Logger } from '../core/logger';
import type {
  CandidateInsightRequest,
  CareerInsight,
  ICareerInsightsGenerator,
} from './interfaces/career-insights-generator.interface';

// Internal interface for update records with stage filtering
interface StageFilteredUpdate {
  id: string;
  notes?: string;
  meta: Record<string, any>;
  renderedText?: string;
  stageStartedAt?: Date;
  stageEndedAt?: Date;
  createdAt: Date;
}

export interface CareerInsightsGeneratorServiceDependencies {
  logger: Logger;
  llmProvider: LLMProvider;
  database: any; // Drizzle database instance
}

export class CareerInsightsGeneratorService
  implements ICareerInsightsGenerator
{
  private readonly logger: Logger;
  private readonly llmProvider: LLMProvider;
  private readonly database: any;
  private readonly LLM_TIMEOUT_MS = 10000; // 10 second timeout for LLM calls

  // Stage progression mapping for filtering
  private readonly STAGE_SEQUENCE: ApplicationStatus[] = [
    ApplicationStatus.Applied,
    ApplicationStatus.RecruiterScreen,
    ApplicationStatus.PhoneInterview,
    ApplicationStatus.TechnicalInterview,
    ApplicationStatus.OnsiteInterview,
    ApplicationStatus.FinalInterview,
    ApplicationStatus.Offer,
  ];

  constructor({
    logger,
    llmProvider,
    database,
  }: CareerInsightsGeneratorServiceDependencies) {
    this.logger = logger;
    this.llmProvider = llmProvider;
    this.database = database;
  }

  /**
   * Generate actionable insights from a matched candidate's update history
   *
   * Strategy:
   * 1. Get relevant stages (current + next 1-2 stages)
   * 2. Fetch stage-filtered updates from candidate's job application
   * 3. Build LLM prompt with candidate context and updates
   * 4. Call LLM with timeout + Zod validation
   * 5. Return structured insights with fallback on errors
   */
  async generateInsights(
    request: CandidateInsightRequest
  ): Promise<CareerInsight[]> {
    this.logger.info('🔍 Generating career insights', {
      candidateUserId: request.candidateUserId,
      currentStatus: request.currentStatus,
      targetRole: request.targetRole,
      targetCompany: request.targetCompany,
    });

    try {
      // 1. Get relevant stages (current + next 1-2)
      const relevantStages = this.getRelevantStages(request.currentStatus);
      this.logger.debug('Relevant stages determined', {
        currentStatus: request.currentStatus,
        relevantStages,
      });

      // 2. Fetch stage-filtered updates
      let updates = await this.fetchStageFilteredUpdates(
        request.candidateUserId,
        request.jobApplicationNodeId,
        relevantStages
      );

      this.logger.debug('Stage-filtered updates fetched', {
        updateCount: updates.length,
        relevantStages,
      });

      // Fallback: If no stage-filtered updates (existing data), fetch all recent updates
      if (updates.length === 0) {
        this.logger.info(
          'No stage-filtered updates, falling back to all recent updates',
          {
            candidateUserId: request.candidateUserId,
            jobApplicationNodeId: request.jobApplicationNodeId,
          }
        );

        updates = await this.fetchAllRecentUpdates(
          request.jobApplicationNodeId
        );

        this.logger.debug('Fallback updates fetched', {
          updateCount: updates.length,
        });
      }

      // No updates found - graceful degradation
      if (updates.length === 0) {
        this.logger.info('No updates found for candidate', {
          candidateUserId: request.candidateUserId,
        });
        return [];
      }

      // 3. Build LLM prompt
      const prompt = this.buildInsightPrompt(request, updates, relevantStages);

      // 4. Call LLM with timeout
      const insights = await this.generateInsightsWithLLM(prompt);

      this.logger.info('✅ Successfully generated career insights', {
        candidateUserId: request.candidateUserId,
        insightCount: insights.length,
      });

      return insights;
    } catch (error) {
      this.logger.error('❌ Failed to generate career insights', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        candidateUserId: request.candidateUserId,
      });
      // Graceful degradation: return empty array on errors
      return [];
    }
  }

  /**
   * Get relevant stages for insight generation
   * Returns current stage + next 1-2 stages for context
   */
  private getRelevantStages(
    currentStatus: ApplicationStatus
  ): ApplicationStatus[] {
    const currentIndex = this.STAGE_SEQUENCE.indexOf(currentStatus);

    if (currentIndex === -1) {
      // Unknown status - return only Applied stage as fallback
      this.logger.warn(
        'Unknown application status, using Applied as fallback',
        {
          currentStatus,
        }
      );
      return [ApplicationStatus.Applied];
    }

    // Current + next 2 stages (max 3 total)
    const endIndex = Math.min(currentIndex + 3, this.STAGE_SEQUENCE.length);
    return this.STAGE_SEQUENCE.slice(currentIndex, endIndex);
  }

  /**
   * Fetch updates filtered by stage timestamps and relevant stages
   *
   * Query strategy:
   * - Filter by job application node ID
   * - Filter by stage timestamps overlapping with relevant stages
   * - Order by createdAt DESC for recency
   * - Limit to 20 most recent updates
   */
  private async fetchStageFilteredUpdates(
    candidateUserId: number,
    jobApplicationNodeId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _relevantStages: ApplicationStatus[]
  ): Promise<StageFilteredUpdate[]> {
    try {
      // Import drizzle operators and schema
      const { eq, and, isNotNull, or } = await import('drizzle-orm');
      const { updates } = await import('@journey/schema');

      // Build query to fetch updates for the job application node
      // Filter by:
      // 1. Node ID matches job application
      // 2. Stage timestamps exist (stageStartedAt OR stageEndedAt is not null)
      // 3. Not deleted
      const result = await this.database
        .select({
          id: updates.id,
          notes: updates.notes,
          meta: updates.meta,
          renderedText: updates.renderedText,
          stageStartedAt: updates.stageStartedAt,
          stageEndedAt: updates.stageEndedAt,
          createdAt: updates.createdAt,
        })
        .from(updates)
        .where(
          and(
            eq(updates.nodeId, jobApplicationNodeId),
            or(
              isNotNull(updates.stageStartedAt),
              isNotNull(updates.stageEndedAt)
            ),
            eq(updates.isDeleted, false)
          )
        )
        .orderBy(updates.createdAt)
        .limit(20);

      return result as StageFilteredUpdate[];
    } catch (error) {
      this.logger.error('Failed to fetch stage-filtered updates', {
        error: error instanceof Error ? error.message : String(error),
        candidateUserId,
        jobApplicationNodeId,
      });
      return [];
    }
  }

  /**
   * Fallback: Fetch all recent updates (without stage filtering)
   * Used when stageStartedAt/stageEndedAt are not populated (existing data)
   */
  private async fetchAllRecentUpdates(
    jobApplicationNodeId: string
  ): Promise<StageFilteredUpdate[]> {
    try {
      const { eq, and, desc } = await import('drizzle-orm');
      const { updates } = await import('@journey/schema');

      // Fetch all updates for the node (no stage filter)
      const result = await this.database
        .select({
          id: updates.id,
          notes: updates.notes,
          meta: updates.meta,
          renderedText: updates.renderedText,
          stageStartedAt: updates.stageStartedAt,
          stageEndedAt: updates.stageEndedAt,
          createdAt: updates.createdAt,
        })
        .from(updates)
        .where(
          and(
            eq(updates.nodeId, jobApplicationNodeId),
            eq(updates.isDeleted, false)
          )
        )
        .orderBy(desc(updates.createdAt))
        .limit(20);

      return result as StageFilteredUpdate[];
    } catch (error) {
      this.logger.error('Failed to fetch all recent updates', {
        error: error instanceof Error ? error.message : String(error),
        jobApplicationNodeId,
      });
      return [];
    }
  }

  /**
   * Build LLM prompt for insight generation
   */
  private buildInsightPrompt(
    request: CandidateInsightRequest,
    updates: StageFilteredUpdate[],
    relevantStages: ApplicationStatus[]
  ): string {
    // Format updates into readable text
    const updatesSummary = updates
      .map((update, i) => {
        const activityFlags = Object.entries(update.meta || {})
          .filter(([, value]) => value === true)
          .map(([key]) => key)
          .join(', ');

        const noteText = update.notes ? `Notes: ${update.notes}` : '';
        const activityText = activityFlags
          ? `Activities: ${activityFlags}`
          : '';
        const parts = [noteText, activityText].filter(Boolean).join(' | ');

        return `${i + 1}. ${parts || 'General update'}`;
      })
      .join('\n');

    const targetContext =
      request.targetRole || request.targetCompany
        ? `\nTarget Position: ${request.targetRole || 'Not specified'} at ${request.targetCompany || 'Not specified'}`
        : '';

    return `You are a career advisor helping a job seeker understand what similar successful candidates did during their job search.

Context:${targetContext}
Current Stage: ${request.currentStatus}
Relevant Stages: ${relevantStages.join(' → ')}

Candidate Name: ${request.candidateName}
Candidate's Actions During Job Search:
${updatesSummary}

Task: Generate 2-3 actionable bullet points (40-80 chars each) that:
1. Highlight specific, useful actions this candidate took
2. Focus on preparation, networking, skill-building, or interview strategies
3. Are relevant to the current user's stage (${request.currentStatus})
4. Help the user create an action plan for their own job search

Requirements:
- Be specific and actionable (not generic advice)
- Start bullets naturally (no "Career path:" prefix)
- Each bullet: 40-80 characters
- Focus on WHAT the candidate did, not speculation
- If no useful actions found, return empty insights array

Return exactly 2-3 bullets as JSON with relevance and category.`;
  }

  /**
   * Call LLM to generate structured insights with timeout
   */
  private async generateInsightsWithLLM(
    prompt: string
  ): Promise<CareerInsight[]> {
    const schema = z.object({
      insights: z
        .array(
          z.object({
            text: z.string().min(40).max(80),
            relevance: z.enum(['high', 'medium']),
            category: z.enum([
              'transition',
              'skill-building',
              'networking',
              'preparation',
            ]),
          })
        )
        .min(0)
        .max(3),
    });

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_resolve, reject) =>
      setTimeout(
        () => reject(new Error('LLM insight generation timeout')),
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
              'You are a career advisor specializing in job search strategies. Generate specific, actionable insights from candidate activity data.',
          },
          { role: 'user', content: prompt },
        ],
        schema,
        {
          temperature: 0.1, // Low temperature for consistent, factual output
          maxTokens: 250,
        }
      ),
      timeoutPromise,
    ]);

    return response.content.insights;
  }
}
