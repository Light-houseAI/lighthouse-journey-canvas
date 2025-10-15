import { EventType, TodoStatus } from '@journey/schema';
import { z } from 'zod';

import type { LLMProvider } from '../core/llm-provider.js';
import type { Logger } from '../core/logger.js';

// Schema for the LLM-generated interview summary with reasoning
const InterviewSummarySchema = z.object({
  overallReasoning: z
    .string()
    .describe('Quote exact source text from input for overall context'),
  overallContext: z
    .string()
    .describe('Overall summary based ONLY on quoted source'),
  statusSummaries: z
    .record(
      z.string(),
      z
        .string()
        .describe('Single sentence summary starting with candidate name')
    )
    .describe('Summaries for each status'),
  statusReasoning: z
    .record(
      z.string(),
      z.string().describe('Quote exact source text from input for this status')
    )
    .describe('Reasoning with quoted sources for each status'),
});

// Application status enum - must match frontend
export enum ApplicationStatus {
  Applied = 'Applied',
  RecruiterScreen = 'RecruiterScreen',
  PhoneInterview = 'PhoneInterview',
  TechnicalInterview = 'TechnicalInterview',
  OnsiteInterview = 'OnsiteInterview',
  FinalInterview = 'FinalInterview',
  Offer = 'Offer',
  Accepted = 'Accepted',
  Rejected = 'Rejected',
  Withdrawn = 'Withdrawn',
}

// Status-specific data grouped together
export interface StatusData {
  todos?: Array<{
    id: string;
    description: string;
    status: TodoStatus;
  }>;
  interviewContext?: string; // User-entered interview details for this status
  llmSummary?: string; // LLM-generated summary for this status
}

export interface JobApplicationMeta {
  company?: string;
  jobTitle?: string;
  applicationDate?: string;
  applicationStatus?: ApplicationStatus | string; // Allow string for backwards compatibility
  notes?: string; // General notes about the application
  llmInterviewContext?: string; // LLM-generated overall summary
  // Grouped status data - replaces todosByStatus, interviewContextByStatus, llmSummariesByStatus
  statusData?: Record<ApplicationStatus, StatusData>;
  [key: string]: unknown;
}

export interface UserInfo {
  firstName?: string;
  lastName?: string;
}

export class LLMSummaryService {
  private readonly llmProvider: LLMProvider;
  private readonly logger: Logger;

  constructor({
    llmProvider,
    logger,
  }: {
    llmProvider: LLMProvider;
    logger: Logger;
  }) {
    this.llmProvider = llmProvider;
    this.logger = logger;
  }

  /**
   * Generate LLM summaries for a job application node
   * Single LLM call generates all summaries in structured format
   * Generates third-person narratives using the user's first name
   */
  async generateApplicationSummaries(
    meta: JobApplicationMeta,
    userInfo: UserInfo,
    userId: number
  ): Promise<Partial<JobApplicationMeta>> {
    try {
      const { company, jobTitle, applicationStatus, statusData } = meta;

      // Only generate summaries if we have relevant data
      if (
        !company ||
        !jobTitle ||
        !statusData ||
        Object.keys(statusData).length === 0
      ) {
        this.logger.debug('Skipping LLM summary - missing required data');
        return {};
      }

      // Capitalize first name
      const rawFirstName = userInfo.firstName || 'The candidate';
      const firstName =
        rawFirstName.charAt(0).toUpperCase() +
        rawFirstName.slice(1).toLowerCase();

      // Build context for all statuses
      const statusContexts: string[] = [];
      for (const [status, data] of Object.entries(statusData)) {
        const interviewContext = data.interviewContext || '';
        const todos = data.todos || [];

        if (!interviewContext && todos.length === 0) {
          continue;
        }

        const todosText =
          todos.length > 0
            ? todos
                .map((t) => {
                  return `  [${t.status}] ${t.description}`;
                })
                .join('\n')
            : '';

        statusContexts.push(
          `${status}:` +
            (interviewContext
              ? `\nInterview context: ${interviewContext}`
              : '') +
            (todosText ? `\nPreparation tasks:\n${todosText}` : '')
        );
      }

      if (statusContexts.length === 0) {
        this.logger.debug('No status data to summarize');
        return {};
      }

      // Single LLM call to generate all summaries
      const systemPrompt = `You are creating professional interview updates that someone's network might read.
Write factual third-person summaries based ONLY on the provided information.
Do not infer, assume, or add details not explicitly stated.`;

      const userPrompt = `Create interview progress summaries for:

Candidate: ${firstName}
Company: ${company}
Position: ${jobTitle}
Current Status: ${applicationStatus || 'Applied'}

Interview rounds and preparation:
${statusContexts.join('\n\n')}

CRITICAL: Provide reasoning by quoting exact source text, then generate summaries.

Task Status Meanings - Use EXACT tense for each status:
[completed] = ALREADY DONE (past tense: "completed", "finished", "reviewed")
[in-progress] = ACTIVELY WORKING NOW (present continuous: "is currently working on", "is reviewing", "is researching")
[pending] = NOT STARTED YET, only planned (future intent: "plans to", "will", "intends to")
[blocked] = BLOCKED/WAITING (blocked language: "needs to", "is waiting to")

Generate 4 fields:
1. overallReasoning: Quote the exact stages and activities from the input above
2. overallContext: 2-3 sentences starting with "${firstName} is interviewing for a ${jobTitle} role at ${company}."
   - First sentence: State the role and company
   - Remaining sentences: Summarize ALL interview rounds mentioned above (both completed and upcoming), showing the progression and current stage
3. statusSummaries: For EACH interview stage listed above (e.g., "Recruiter Screen", "PhoneInterview"), write 1-2 sentences starting with "${firstName}"
   - IMPORTANT: Use the interview stage name as the key (e.g., "Recruiter Screen"), NOT the task status
   - Include BOTH interview context and preparation tasks from the input
   - CRITICAL: Look at EACH task's [status] tag and use the EXACT tense specified above
   - Example for "Recruiter Screen" with [completed] tasks: "${firstName} had a recruiter screen discussing team structure, and completed research on the company and refreshed project details."
   - Example for "PhoneInterview" with [pending] tasks: "${firstName} has a technical phone screen scheduled, and plans to review data structures and prepare system design examples."
   - Example for "TechnicalInterview" with [in-progress] tasks: "${firstName} has an upcoming technical interview and is currently working on system design preparation and reviewing the company's tech stack."
4. statusReasoning: For EACH interview stage, quote the exact interview context and todos from input`;

      // Log the full prompt being sent to LLM
      this.logger.info('=== Input to LLM ===');
      this.logger.info('System Prompt:', { text: systemPrompt });
      this.logger.info('User Prompt:', { text: userPrompt });

      const response = await this.llmProvider.generateStructuredResponse(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        InterviewSummarySchema,
        { temperature: 0.1, maxTokens: 2000 }
      );

      // Log reasoning for overall context
      this.logger.info('=== LLM Reasoning: Overall Context ===');
      this.logger.info('Reasoning:', {
        text: response.content.overallReasoning,
      });
      this.logger.info('Summary:', { text: response.content.overallContext });

      // Map the response back to statusData format
      const updatedStatusData: Record<ApplicationStatus, StatusData> = {
        ...statusData,
      };

      for (const [status, summary] of Object.entries(
        response.content.statusSummaries
      )) {
        const reasoning =
          response.content.statusReasoning[status] || 'No reasoning provided';

        this.logger.info(`=== LLM Reasoning: ${status} ===`);
        this.logger.info('Reasoning:', { text: reasoning });
        this.logger.info('Summary:', { text: summary });

        if (updatedStatusData[status as ApplicationStatus]) {
          updatedStatusData[status as ApplicationStatus] = {
            ...updatedStatusData[status as ApplicationStatus],
            llmSummary: summary,
          };
        }
      }

      this.logger.info(
        'Generated LLM summaries for application (single call)',
        {
          userId,
          company,
          jobTitle,
          hasOverallContext: !!response.content.overallContext,
          summaryCount: Object.keys(response.content.statusSummaries).length,
        }
      );

      return {
        llmInterviewContext: response.content.overallContext,
        statusData: updatedStatusData,
      };
    } catch (error) {
      if (this.logger) {
        this.logger.error(
          'Failed to generate LLM summaries',
          error instanceof Error ? error : new Error(String(error)),
          { userId, company: meta.company }
        );
      } else {
        console.error('Failed to generate LLM summaries:', error);
      }

      // Return empty object on error - don't break the main flow
      return {};
    }
  }

  /**
   * Format status for display
   */
  private formatStatus(status: string): string {
    const statusMap: Record<string, string> = {
      Applied: 'Application Submitted',
      RecruiterScreen: 'Recruiter Screen',
      PhoneInterview: 'Phone Interview',
      TechnicalInterview: 'Technical Interview',
      OnsiteInterview: 'Onsite Interview',
      FinalInterview: 'Final Interview',
      Offer: 'Offer Stage',
      Accepted: 'Offer Accepted',
      Rejected: 'Application Rejected',
      Withdrawn: 'Application Withdrawn',
      Interviewing: 'Interview Process',
    };

    return statusMap[status] || status;
  }

  /**
   * Update existing application meta with LLM summaries
   * This is called during node creation or update
   */
  async enrichApplicationWithSummaries(
    nodeMeta: Record<string, unknown>,
    nodeType: string,
    userId: number,
    userInfo?: UserInfo
  ): Promise<Record<string, unknown>> {
    // Only process event nodes that look like job applications
    if (nodeType !== 'event') {
      return nodeMeta;
    }

    const meta = nodeMeta as JobApplicationMeta;

    // Check if this is a job application event
    const eventType = meta.eventType as string;
    if (eventType !== EventType.JobApplication) {
      return nodeMeta;
    }

    // Check if summaries already exist in statusData
    const hasExistingSummaries =
      meta.statusData &&
      Object.values(meta.statusData).some((data) => data.llmSummary);

    // Don't regenerate if summaries already exist (unless forced)
    if (meta.llmInterviewContext && hasExistingSummaries) {
      this.logger.debug('LLM summaries already exist, skipping regeneration');
      return nodeMeta;
    }

    // Use provided userInfo or create empty object
    const userInfoToUse: UserInfo = userInfo || {};

    // Generate summaries
    const summaries = await this.generateApplicationSummaries(
      meta,
      userInfoToUse,
      userId
    );

    // Merge summaries into meta
    return {
      ...nodeMeta,
      ...summaries,
    };
  }
}
