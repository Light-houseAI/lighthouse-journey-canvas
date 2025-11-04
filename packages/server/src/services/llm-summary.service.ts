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

      const notesSection = meta.notes?.trim()
        ? `\n\nGeneral notes:\n${meta.notes.trim()}`
        : '';

      const userPrompt = `Create interview progress summaries for:

Candidate: ${firstName}
Company: ${company}
Position: ${jobTitle}
Current Status: ${applicationStatus || 'Applied'}

Interview rounds and preparation:
${statusContexts.join('\n\n')}${notesSection}

CRITICAL: Provide reasoning by quoting exact source text, then generate summaries.

Task Status Meanings - Use EXACT tense for each status:
[completed] = ALREADY DONE (past tense: "completed", "finished", "reviewed")
[in-progress] = ACTIVELY WORKING NOW (present continuous: "is currently working on", "is reviewing", "is researching")
[pending] = NOT STARTED YET, only planned (future intent: "plans to", "will", "intends to")
[blocked] = BLOCKED/WAITING (blocked language: "needs to", "is waiting to")

Generate 4 fields:
1. overallReasoning: Quote the exact stages and activities from the input above, including any general notes if provided
2. overallContext: 2-3 sentences starting with "${firstName} is interviewing for a ${jobTitle} role at ${company}."
   - First sentence: State the role and company
   - Remaining sentences: Summarize ALL interview rounds mentioned above (both completed and upcoming), showing the progression and current stage
   - Include relevant information from general notes if provided and contextually important
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
   * Generate LLM summary of edit history for application materials (resume/LinkedIn)
   * Creates 3-4 bullet points summarizing what the user did
   * Supports incremental updates: if existingSummary is provided, only summarizes new edits
   */
  async generateMaterialEditSummary(
    editHistory: Array<{ editedAt: string; notes: string; editedBy: string }>,
    materialType: string, // e.g., "Technical Resume", "LinkedIn"
    userId: number,
    existingSummary?: string
  ): Promise<string | undefined> {
    try {
      if (!editHistory || editHistory.length === 0) {
        this.logger.debug('No edit history to summarize');
        return undefined;
      }

      // If we have an existing summary, only process the most recent edit (incremental update)
      // Otherwise, process the most recent 5 edits (full summary)
      const editsToProcess = existingSummary
        ? editHistory.slice(-1) // Only the newest edit
        : editHistory.slice(-5); // Most recent 5 edits

      // Format edit history for LLM
      const editsText = editsToProcess
        .map((edit, idx) => {
          const date = new Date(edit.editedAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
          return `${idx + 1}. ${date}: ${edit.notes}`;
        })
        .join('\n');

      const systemPrompt = `You are summarizing edits made to application materials.
Create concise, factual bullet points based ONLY on the edit notes provided.
Do not infer or add details not explicitly stated.`;

      // Different prompts for incremental vs full summary
      const userPrompt = existingSummary
        ? `You previously summarized edits to a ${materialType} as:

${existingSummary}

Now incorporate this new edit and generate an updated 3-4 bullet point summary:

New Edit:
${editsText}

Generate 3-4 concise bullet points (no more than 15 words each) starting with action verbs (e.g., "Updated", "Added", "Refined").
Merge the new edit with the existing summary, combining related changes where appropriate.
Return ONLY the bullet points, one per line, without bullet symbols or numbers.`
        : `Summarize the following edits to a ${materialType} into 3-4 bullet points.
Each bullet should describe what was changed or updated based on the edit notes.

Edit History:
${editsText}

Generate 3-4 concise bullet points (no more than 15 words each) starting with action verbs (e.g., "Updated", "Added", "Refined").
Return ONLY the bullet points, one per line, without bullet symbols or numbers.`;

      this.logger.info('=== Generating Material Edit Summary ===');
      this.logger.info('Material Type:', { text: materialType });
      this.logger.info('Incremental Update:', { value: !!existingSummary });
      if (existingSummary) {
        this.logger.info('Existing Summary:', { text: existingSummary });
      }
      this.logger.info('Edit History:', { text: editsText });

      const response = await this.llmProvider.generateText(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.1, maxTokens: 200 }
      );

      // Clean up the response - remove any bullet symbols or numbers
      const summary = response.content
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => line.replace(/^[-•*\d.)\s]+/, '').trim())
        .slice(0, 4) // Max 4 bullets
        .join('\n');

      this.logger.info('Generated Edit Summary:', { text: summary });

      return summary;
    } catch (error) {
      this.logger.error(
        'Failed to generate material edit summary',
        error instanceof Error ? error : new Error(String(error)),
        { userId, materialType }
      );
      return undefined;
    }
  }

  /**
   * Enrich application materials with LLM edit summaries
   * Generates summaries for each resume and LinkedIn profile based on edit history
   */
  async enrichApplicationMaterialsWithSummaries(
    nodeMeta: Record<string, unknown>,
    nodeType: string,
    userId: number
  ): Promise<Record<string, unknown>> {
    // Only process careerTransition nodes
    if (nodeType !== 'careerTransition') {
      return nodeMeta;
    }

    const materials = (nodeMeta as any).applicationMaterials;
    if (!materials || !materials.items || materials.items.length === 0) {
      return nodeMeta;
    }

    try {
      // Enrich each item with edit history summary
      const enrichedItems = await Promise.all(
        materials.items.map(async (item: any) => {
          // Skip if no edit history
          if (
            !item.resumeVersion?.editHistory ||
            item.resumeVersion.editHistory.length === 0
          ) {
            return item;
          }

          // Generate summary
          const materialType =
            item.type === 'Linkedin'
              ? 'LinkedIn Profile'
              : `${item.type} Resume`;

          // Use existing summary + new edit for incremental update if available
          const existingSummary = item.resumeVersion.editHistorySummary;
          const summary = await this.generateMaterialEditSummary(
            item.resumeVersion.editHistory,
            materialType,
            userId,
            existingSummary
          );

          // Return enriched item
          return {
            ...item,
            resumeVersion: {
              ...item.resumeVersion,
              editHistorySummary: summary,
            },
          };
        })
      );

      this.logger.info('Enriched application materials with LLM summaries', {
        userId,
        itemCount: enrichedItems.length,
      });

      return {
        ...nodeMeta,
        applicationMaterials: {
          ...materials,
          items: enrichedItems,
        },
      };
    } catch (error) {
      this.logger.error(
        'Failed to enrich application materials',
        error instanceof Error ? error : new Error(String(error)),
        { userId }
      );
      return nodeMeta;
    }
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

  /**
   * Generate LLM summaries and key points for networking activities grouped by type
   * Single LLM call generates overall summary + per-type summaries and key points
   */
  async generateNetworkingSummaries(
    activities: any[],
    userInfo: UserInfo,
    userId: number
  ): Promise<{
    overallSummary?: string;
    summaries?: Record<string, string>;
    keyPoints?: Record<string, string[]>;
  }> {
    try {
      if (!activities || activities.length === 0) {
        this.logger.debug('No networking activities to summarize');
        return {};
      }

      // Group activities by type
      const activitiesByType: Record<string, any[]> = {};
      for (const activity of activities) {
        const type = activity.networkingType;
        if (!activitiesByType[type]) {
          activitiesByType[type] = [];
        }
        activitiesByType[type].push(activity);
      }

      const firstName = userInfo.firstName || 'The candidate';

      // Build context for each networking type
      const networkingContexts: string[] = [];
      for (const [type, typeActivities] of Object.entries(activitiesByType)) {
        const activitiesText = typeActivities
          .map((act, idx) => {
            let details = '';
            switch (type) {
              case 'Cold outreach':
                details = `Contacted: ${act.whom?.join(', ') || 'unknown'}\nChannels: ${act.channels?.join(', ') || 'unknown'}\nMessage: ${act.exampleOnHow || 'N/A'}`;
                break;
              case 'Reconnected with someone':
                details = `Contacts: ${act.contacts?.join(', ') || 'unknown'}\nNotes: ${act.notes || 'N/A'}`;
                break;
              case 'Attended networking event':
                details = `Event: ${act.event || 'unknown'}\nNotes: ${act.notes || 'N/A'}`;
                break;
              case 'Informational interview':
                details = `Contact: ${act.contact || 'unknown'}\nNotes: ${act.notes || 'N/A'}`;
                break;
            }
            return `  Activity ${idx + 1}:\n  ${details.split('\n').join('\n  ')}`;
          })
          .join('\n\n');

        networkingContexts.push(
          `${type} (${typeActivities.length} activities):\n${activitiesText}`
        );
      }

      const systemPrompt = `You are creating factual networking summaries based ONLY on the provided data.
Do not infer, assume, make suggestions, or add any details not explicitly stated in the activities.
Simply describe what the candidate actually did.`;

      // Build type-specific instructions
      const typeInstructions: string[] = [];
      for (const type of Object.keys(activitiesByType)) {
        let instruction = '';
        switch (type) {
          case 'Cold outreach':
            instruction = `- Cold outreach: Focus on channels used (LinkedIn, Email, etc.) and the approach in their messages. Describe the tone, what they mentioned, and how they reached out.`;
            break;
          case 'Reconnected with someone':
            instruction = `- Reconnected with someone: Focus on how they reconnected and what was discussed. Describe the context and purpose of reconnection.`;
            break;
          case 'Attended networking event':
            instruction = `- Attended networking event: Focus on which events they attended and what they did there. Describe participation and any follow-up actions.`;
            break;
          case 'Informational interview':
            instruction = `- Informational interview: Focus on the nature of the interview and what was discussed. Describe the purpose and key topics covered.`;
            break;
        }
        if (instruction) typeInstructions.push(instruction);
      }

      const userPrompt = `Summarize the networking activities for ${firstName}:

${networkingContexts.join('\n\n')}

Generate 3 fields:
1. overallSummary: 2-3 sentences describing what ${firstName} did across all networking types
   - Mention number of activities per type and channels/methods used
   - Do NOT include specific names or add advice

2. typeSummaries: For EACH networking type, write 1-2 short paragraphs describing what ${firstName} did
   - Do NOT include specific names
   - Do NOT add advice or best practices
   ${typeInstructions.join('\n   ')}

3. typeKeyPoints: For EACH networking type, extract 3-4 specific approaches ${firstName} used
   - Describe their actual approach from the data
   - Do NOT include specific names
   - Each point should be 10-15 words max
   - Focus on HOW they did it, not generic advice
   ${typeInstructions.join('\n   ')}

Return as JSON:
{
  "overallSummary": "string",
  "typeSummaries": { "Cold outreach": "string", ... },
  "typeKeyPoints": { "Cold outreach": ["point1", "point2", ...], ... }
}`;

      this.logger.info('=== Generating Networking Summaries ===');
      this.logger.info('User Prompt:', { text: userPrompt });

      // Schema for networking summaries
      const NetworkingSummarySchema = z.object({
        overallSummary: z.string(),
        typeSummaries: z.record(z.string(), z.string()),
        typeKeyPoints: z.record(z.string(), z.array(z.string())),
      });

      const response = await this.llmProvider.generateStructuredResponse(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        NetworkingSummarySchema,
        { temperature: 0.1, maxTokens: 2000 }
      );

      this.logger.info('Generated networking summaries', {
        userId,
        activityCount: activities.length,
        typeCount: Object.keys(activitiesByType).length,
      });

      return {
        overallSummary: response.content.overallSummary,
        summaries: response.content.typeSummaries,
        keyPoints: response.content.typeKeyPoints,
      };
    } catch (error) {
      this.logger.error(
        'Failed to generate networking summaries',
        error instanceof Error ? error : new Error(String(error)),
        { userId }
      );
      return {};
    }
  }
}
