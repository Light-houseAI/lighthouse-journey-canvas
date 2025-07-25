import { z } from 'zod';
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';

// Milestone schema matching the UI expectations
const MilestoneSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(['education', 'job', 'transition', 'skill', 'event', 'project']),
  date: z.string(),
  description: z.string(),
  skills: z.array(z.string()),
  organization: z.string().optional(),
});

const MilestoneExtractionResultSchema = z.object({
  hasMilestone: z.boolean(),
  milestone: MilestoneSchema.optional(),
  isUpdate: z.boolean().default(false),
  parentNodeId: z.string().optional(),
  confidence: z.number().min(0).max(1).default(0.5),
  suggestedQuestions: z.array(z.string()).optional(),
  extractedSkills: z.array(z.string()).default([]),
  extractedDate: z.string().optional(),
  reasoning: z.string().optional(),
});

export class MilestoneExtractor {
  private agent: Agent;

  constructor() {
    this.agent = new Agent({
      name: 'Milestone Extractor',
      instructions: `You are an expert at extracting career milestones from conversational text. Your role is to:

1. **Identify Career-Relevant Content**: Determine if the user's message contains information about:
   - Educational achievements (degrees, courses, certifications)
   - Work experiences (jobs, roles, promotions)
   - Skills learned or developed
   - Significant projects or achievements
   - Career transitions or changes
   - Professional events or milestones

2. **Extract Structured Information**: When a milestone is identified, extract:
   - Title: Clear, concise description of the milestone
   - Type: Categorize as education, job, transition, skill, event, or project
   - Date: Any time reference (year, month, "recently", "last year", etc.)
   - Description: Full context from the user's message
   - Skills: Technical and soft skills mentioned or implied
   - Organization: Company, school, or institution name

3. **Relationship Analysis**: Determine if this relates to existing career nodes:
   - Is this an update to a current role/organization?
   - Is this a sub-milestone under an existing job?
   - Is this a completely new milestone?

4. **Quality Assessment**: Provide confidence score based on:
   - Clarity of career relevance
   - Completeness of information
   - Specificity of details

5. **Engagement**: Suggest follow-up questions to enrich the milestone data.

Be precise but not overly strict - capture meaningful career moments even if they're informal.`,
      model: openai('gpt-4o-mini'),
    });
  }

  async extractMilestone(
    message: string,
    existingNodes: Array<{
      id: string;
      data: {
        title: string;
        organization?: string;
        type: string;
      };
    }> = [],
    userContext?: {
      currentRole?: string;
      recentProjects?: string[];
      interest?: string;
    }
  ) {
    const contextPrompt = this.buildContextPrompt(message, existingNodes, userContext);

    try {
      const response = await this.agent.generate(
        [{ role: 'user', content: contextPrompt }],
        {
          output: MilestoneExtractionResultSchema,
        }
      );

      const result = response.object;
      if (!result) {
        return { hasMilestone: false };
      }

      // Enhance the milestone with generated ID if needed
      if (result.hasMilestone && result.milestone && !result.milestone.id) {
        result.milestone.id = `milestone_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }

      return result;
    } catch (error) {
      console.error('Error extracting milestone:', error);
      return { hasMilestone: false };
    }
  }

  private buildContextPrompt(
    message: string,
    existingNodes: any[],
    userContext?: any
  ): string {
    const existingNodesContext = existingNodes.length > 0
      ? `\n\nExisting career nodes:\n${existingNodes.map(node =>
          `- ${node.id}: "${node.data.title}" at ${node.data.organization || 'Unknown'} (${node.data.type})`
        ).join('\n')}`
      : '';

    const userContextStr = userContext
      ? `\n\nUser context:\n- Current Role: ${userContext.currentRole || 'Unknown'}\n- Career Interest: ${userContext.interest || 'Unknown'}\n- Recent Projects: ${userContext.recentProjects?.join(', ') || 'None'}`
      : '';

    return `Analyze this user message for career milestone information:

MESSAGE: "${message}"
${existingNodesContext}
${userContextStr}

Instructions:
1. Determine if this message contains career milestone information
2. If yes, extract all relevant details and determine if it relates to existing nodes
3. Provide confidence score (0.0-1.0) based on career relevance and information completeness
4. Suggest 2-3 follow-up questions to enrich the milestone
5. Extract any skills mentioned explicitly or implicitly
6. Include reasoning for your analysis

Return your analysis in the specified JSON format.`;
  }

  async generateFollowUpQuestions(
    milestone: z.infer<typeof MilestoneSchema>,
    userInterest: string = 'general'
  ): Promise<string[]> {
    const prompt = `Generate 3 specific, engaging follow-up questions for this career milestone:

Milestone: ${milestone.title}
Type: ${milestone.type}
Organization: ${milestone.organization || 'N/A'}
User's Career Interest: ${userInterest}

Questions should:
1. Help gather more specific details about the milestone
2. Be relevant to their career interest (${userInterest})
3. Focus on impact, skills, or growth opportunities
4. Be conversational and encouraging

Return as a JSON array of 3 questions.`;

    try {
      const response = await this.agent.generate(
        [{ role: 'user', content: prompt }],
        {
          output: z.object({
            questions: z.array(z.string()).length(3),
          }),
        }
      );

      return response.object?.questions || [];
    } catch (error) {
      console.error('Error generating follow-up questions:', error);
      return [
        "What was the most challenging aspect of this experience?",
        "What skills did you develop or strengthen during this time?",
        "How did this experience contribute to your career goals?"
      ];
    }
  }

  async categorizeSkills(skills: string[]): Promise<{
    technical: string[];
    soft: string[];
    domain: string[];
  }> {
    if (skills.length === 0) {
      return { technical: [], soft: [], domain: [] };
    }

    const prompt = `Categorize these skills into technical, soft, and domain-specific categories:

Skills: ${skills.join(', ')}

Return as JSON with three arrays: technical, soft, domain`;

    try {
      const response = await this.agent.generate(
        [{ role: 'user', content: prompt }],
        {
          output: z.object({
            technical: z.array(z.string()),
            soft: z.array(z.string()),
            domain: z.array(z.string()),
          }),
        }
      );

      return response.object || { technical: [], soft: [], domain: [] };
    } catch (error) {
      console.error('Error categorizing skills:', error);
      return {
        technical: skills.filter(s =>
          /^(javascript|python|react|sql|aws|docker|kubernetes|git|java|node|typescript|css|html|angular|vue|swift|kotlin|c\+\+|c#|ruby|php|go|rust|scala)$/i.test(s)
        ),
        soft: skills.filter(s =>
          /^(leadership|communication|teamwork|problem.solving|time.management|creativity|adaptability|critical.thinking)$/i.test(s)
        ),
        domain: skills.filter(s =>
          !/^(javascript|python|react|sql|aws|docker|kubernetes|git|java|node|typescript|css|html|angular|vue|swift|kotlin|c\+\+|c#|ruby|php|go|rust|scala|leadership|communication|teamwork|problem.solving|time.management|creativity|adaptability|critical.thinking)$/i.test(s)
        ),
      };
    }
  }
}

export const milestoneExtractor = new MilestoneExtractor();
