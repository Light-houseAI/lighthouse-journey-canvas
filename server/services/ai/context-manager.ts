import { z } from 'zod';
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { db } from '../../db';
import { profiles } from "@shared/schema";
import { eq, and, desc } from 'drizzle-orm';

// Schema for extracted context from conversations
const ConversationContextSchema = z.object({
  challenges: z.array(z.object({
    description: z.string(),
    severity: z.enum(['low', 'medium', 'high']),
    category: z.string(), // 'stakeholder', 'technical', 'time-management', etc.
    firstMentioned: z.string(),
    lastMentioned: z.string(),
    status: z.enum(['ongoing', 'resolved', 'escalating']),
  })),
  decisions: z.array(z.object({
    description: z.string(),
    context: z.string(),
    outcome: z.string().optional(),
    date: z.string(),
    category: z.string(),
  })),
  achievements: z.array(z.object({
    description: z.string(),
    impact: z.string(),
    skills: z.array(z.string()),
    date: z.string(),
  })),
  goals: z.array(z.object({
    description: z.string(),
    status: z.enum(['planned', 'in-progress', 'completed', 'blocked']),
    dueDate: z.string().optional(),
    tasks: z.array(z.string()),
  })),
  patterns: z.array(z.object({
    type: z.string(), // 'recurring_challenge', 'strength', 'growth_area'
    description: z.string(),
    frequency: z.number(),
    lastOccurrence: z.string(),
  })),
});

// Schema for check-in themes and priorities
const CheckInThemeSchema = z.object({
  primaryTheme: z.enum([
    'challenges_insights',
    'decisions_collaboration',
    'learning_reflection',
    'goals_progress',
    'momentum_success'
  ]),
  reasoning: z.string(),
  specificFocus: z.array(z.string()),
  suggestedQuestions: z.array(z.string()),
  contextualReferences: z.array(z.string()),
});

export class ContextManager {
  private agent: Agent;

  constructor() {
    this.agent = new Agent({
      name: 'Context Manager',
      instructions: `You are an expert at analyzing professional conversations to extract meaningful context about:

1. **Challenges**: Ongoing issues, blockers, and difficulties the user faces
2. **Decisions**: Important choices made and their outcomes
3. **Achievements**: Completed work, successes, and milestones reached
4. **Goals**: Future aspirations and planned work
5. **Patterns**: Recurring themes, strengths, and growth areas

Your role is to:
- Extract structured insights from conversation history
- Identify patterns and trends over time
- Generate contextual, relevant check-in questions
- Track progress on goals and challenges
- Suggest actionable next steps

Be precise, empathetic, and focus on actionable insights that help the user grow professionally.`,
      model: openai('gpt-4o-mini'),
    });
  }

  // Extract context from recent conversations using existing database schema
  async extractContext(userId: string, lookbackDays: number = 14) {
    try {
      // TODO: Integrate with Mastra's conversation history
      // For now, return empty context as Mastra handles its own message storage
      return {
        challenges: [],
        decisions: [],
        achievements: [],
        goals: [],
        patterns: []
      };

    } catch (error) {
      console.error('Error extracting context:', error);
      return {
        challenges: [],
        decisions: [],
        achievements: [],
        goals: [],
        patterns: []
      };
    }
  }

  // Generate adaptive check-in theme based on context
  async generateCheckInTheme(userId: string, context: z.infer<typeof ConversationContextSchema>) {
    const prompt = `Based on this user's recent professional context, determine the most valuable check-in theme:

Recent Context:
- Challenges: ${context.challenges.map(c => `${c.description} (${c.severity})`).join(', ')}
- Recent Decisions: ${context.decisions.slice(-3).map(d => d.description).join(', ')}
- Achievements: ${context.achievements.map(a => a.description).join(', ')}
- Goal Status: ${context.goals.map(g => `${g.description} (${g.status})`).join(', ')}
- Patterns: ${context.patterns.map(p => p.description).join(', ')}

Available themes:
1. challenges_insights - Focus on overcoming current blockers
2. decisions_collaboration - Explore decision-making and stakeholder work
3. learning_reflection - Reflect on lessons learned and growth
4. goals_progress - Check progress on objectives and plan next steps
5. momentum_success - Build on positive momentum and replicate success

Choose the most relevant theme and generate:
- Specific focus areas within that theme
- 3-5 contextual questions that reference their actual work
- Reasoning for this choice

Example contextual question: "Last week you mentioned struggling with stakeholder expectations around the dashboard project. How did that evolve this week?"`;

    try {
      const response = await this.agent.generate(
        [{ role: 'user', content: prompt }],
        { output: CheckInThemeSchema }
      );

      return response.object;
    } catch (error) {
      console.error('Error generating check-in theme:', error);
      return null;
    }
  }

  // Extract milestones from a specific conversation
  async extractMilestonesFromConversation(conversationText: string, existingContext?: any) {
    const prompt = `Analyze this conversation for professional milestones:

${conversationText}

${existingContext ? `Existing context: ${JSON.stringify(existingContext, null, 2)}` : ''}

Extract:
1. Completed milestones (achievements, project completions, skill acquisitions)
2. Progress updates on existing goals/projects
3. New goals or commitments made
4. Challenges overcome or identified
5. Skills demonstrated or learned

For each milestone, provide:
- Clear description
- Category (technical, leadership, project, learning, etc.)
- Impact/significance
- Related skills
- Date context (when it happened or was discussed)

Focus on concrete, measurable achievements and meaningful progress updates.`;

    const MilestoneExtractionSchema = z.object({
      completedMilestones: z.array(z.object({
        description: z.string(),
        category: z.string(),
        impact: z.string(),
        skills: z.array(z.string()),
        dateContext: z.string(),
        significance: z.enum(['minor', 'moderate', 'major']),
      })),
      progressUpdates: z.array(z.object({
        project: z.string(),
        previousStatus: z.string(),
        currentStatus: z.string(),
        nextSteps: z.array(z.string()),
      })),
      newGoals: z.array(z.object({
        description: z.string(),
        timeframe: z.string(),
        requiredTasks: z.array(z.string()),
      })),
      challengesIdentified: z.array(z.object({
        description: z.string(),
        impact: z.string(),
        potentialSolutions: z.array(z.string()),
      })),
    });

    try {
      const response = await this.agent.generate(
        [{ role: 'user', content: prompt }],
        { output: MilestoneExtractionSchema }
      );

      return response.object;
    } catch (error) {
      console.error('Error extracting milestones:', error);
      return null;
    }
  }

  // Generate future tasks for reaching milestones
  async generateTasksForGoals(goals: Array<{ description: string; timeframe: string; }>, userContext: any) {
    const prompt = `Based on these goals and user context, generate specific, actionable tasks:

Goals:
${goals.map(g => `- ${g.description} (${g.timeframe})`).join('\n')}

User Context:
- Current Role: ${userContext.currentRole}
- Recent Challenges: ${userContext.challenges?.slice(-3).map((c: any) => c.description).join(', ')}
- Skills: ${userContext.skills?.join(', ')}

For each goal, generate:
1. 3-5 specific, actionable tasks
2. Priority order (high/medium/low)
3. Dependencies between tasks
4. Estimated timeframe for each task
5. Success criteria

Tasks should be:
- Specific and measurable
- Achievable within the timeframe
- Relevant to their role and context
- Sequenced logically`;

    const TaskGenerationSchema = z.object({
      goalTasks: z.array(z.object({
        goal: z.string(),
        tasks: z.array(z.object({
          description: z.string(),
          priority: z.enum(['high', 'medium', 'low']),
          timeframe: z.string(),
          dependencies: z.array(z.string()),
          successCriteria: z.array(z.string()),
        })),
      })),
    });

    try {
      const response = await this.agent.generate(
        [{ role: 'user', content: prompt }],
        { output: TaskGenerationSchema }
      );

      return response.object;
    } catch (error) {
      console.error('Error generating tasks:', error);
      return null;
    }
  }

  // Generate contextual check-in questions
  async generateContextualCheckIn(userId: string) {
    const context = await this.extractContext(userId);

    if (!context) {
      // Fallback to general questions
      return {
        theme: 'general',
        questions: [
          "What was the most significant challenge you faced this week?",
          "What achievement are you most proud of recently?",
          "What would you like to focus on improving next week?"
        ],
        reasoning: "No previous context available, using general check-in questions."
      };
    }

    const theme = await this.generateCheckInTheme(userId, context);
    return theme;
  }

  // Update progress based on check-in conversation
  async updateProgressFromCheckIn(userId: string, checkInConversation: string) {
    const existingContext = await this.extractContext(userId);
    const milestones = await this.extractMilestonesFromConversation(checkInConversation, existingContext);

    // Store extracted milestones in the existing profiles table
    if (milestones && milestones.completedMilestones && milestones.completedMilestones.length > 0) {
      try {
        // Get user's profile to append new milestones
        const userProfile = await db
          .select()
          .from(profiles)
          .where(eq(profiles.userId, parseInt(userId)))
          .limit(1);

        if (userProfile.length > 0) {
          const currentProjects = userProfile[0].projects || [];

          // Convert extracted milestones to the expected format
          const newMilestones = milestones.completedMilestones.map(milestone => ({
            id: `milestone_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: milestone.description,
            type: 'project' as const,
            date: new Date().toISOString().split('T')[0],
            description: milestone.description,
            skills: milestone.skills || [],
            organization: milestone.impact || '',
          }));

          // Update the profile with new milestones
          await db
            .update(profiles)
            .set({
              projects: [...currentProjects, ...newMilestones],
            })
            .where(eq(profiles.userId, parseInt(userId)));

          console.log(`Successfully stored ${newMilestones.length} milestones for user ${userId}`);
        }
      } catch (error) {
        console.error('Error storing milestones:', error);
      }
    }

    return milestones;
  }
}

export const contextManager = new ContextManager();
