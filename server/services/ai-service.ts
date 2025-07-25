import { z } from 'zod';
import type { Profile } from '../../shared/schema';
import type { SkillRecord, SkillInput } from '../repositories/interfaces';
import type { IAIService, CareerAnalysis } from './interfaces';
import type { LLMProvider } from '../core/llm-provider';

// Skill extraction schema
const SkillExtractionSchema = z.object({
  skills: z.array(z.object({
    name: z.string(),
    category: z.enum(['technical', 'soft', 'domain', 'language', 'certification']),
    level: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).optional(),
    confidence: z.number().min(0).max(1),
    source: z.string(),
    context: z.string().optional(),
    keywords: z.array(z.string()).default([]),
  })),
});

// Milestone extraction schema
const MilestoneExtractionSchema = z.object({
  milestones: z.array(z.object({
    id: z.string(),
    title: z.string(),
    type: z.enum(['education', 'job', 'transition', 'skill', 'event', 'project', 'update']),
    date: z.string(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    description: z.string(),
    skills: z.array(z.string()).default([]),
    organization: z.string().optional(),
    objectives: z.string().optional(),
    technologies: z.array(z.string()).default([]),
    impact: z.string().optional(),
    challenges: z.string().optional(),
    outcomes: z.array(z.string()).default([]),
    lessonsLearned: z.string().optional(),
  })),
});

// Career analysis schema
const CareerAnalysisSchema = z.object({
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  recommendations: z.array(z.string()),
  nextSteps: z.array(z.string()),
  score: z.number().min(0).max(1),
});

export class AIService implements IAIService {
  constructor(private llmProvider: LLMProvider) {}

  async generateResponse(messages: Array<{ role: string; content: string }>): Promise<string> {
    const response = await this.llmProvider.generateText(
      messages as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
    );
    return response.content;
  }

  async generateStructuredResponse<T>(
    messages: Array<{ role: string; content: string }>,
    schema: z.ZodSchema<T>
  ): Promise<T> {
    const response = await this.llmProvider.generateStructuredResponse(
      messages as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
      schema
    );
    return response.content;
  }

  async extractSkills(text: string): Promise<SkillInput[]> {
    const prompt = `Analyze the following text and extract professional skills mentioned. For each skill, determine:
- Name of the skill
- Category (technical, soft, domain, language, certification)
- Proficiency level if mentioned (beginner, intermediate, advanced, expert)
- Confidence score (0-1) based on how clearly the skill is demonstrated
- Context in which it was mentioned
- Related keywords

Text to analyze:
${text}

Focus on concrete skills that demonstrate professional capability. Avoid generic terms unless they represent specific competencies.`;

    const messages = [
      { role: 'system', content: 'You are an expert at extracting and categorizing professional skills from text.' },
      { role: 'user', content: prompt }
    ];

    const result = await this.generateStructuredResponse(messages, SkillExtractionSchema);
    return result.skills.map(skill => ({
      ...skill,
      source: 'conversation_analysis'
    }));
  }

  async generateMilestones(conversationText: string): Promise<import('../../shared/schema').Milestone[]> {
    const prompt = `Analyze this conversation and extract professional milestones, achievements, and significant progress updates. Look for:

1. Completed projects or tasks
2. Career transitions or promotions
3. Skills acquired or demonstrated
4. Educational achievements
5. Significant challenges overcome
6. Recognition or awards received

For each milestone, provide:
- A clear, descriptive title
- Appropriate type (education, job, transition, skill, event, project, update)
- Date context (when it happened or approximate timeframe)
- Detailed description
- Skills demonstrated or learned
- Organization/company if applicable
- Impact or outcomes achieved

Conversation:
${conversationText}

Generate meaningful milestones that would be valuable in a professional journey timeline.`;

    const messages = [
      { role: 'system', content: 'You are an expert at identifying and structuring professional milestones from conversations.' },
      { role: 'user', content: prompt }
    ];

    const result = await this.generateStructuredResponse(messages, MilestoneExtractionSchema);
    return result.milestones;
  }

  async analyzeCareerProgress(profile: Profile, skills: SkillRecord[]): Promise<CareerAnalysis> {
    const skillSummary = skills.map(s => `${s.name} (${s.category}, confidence: ${s.confidence})`).join(', ');
    const experienceSummary = profile.filteredData.experiences?.map(e => 
      `${e.title} at ${e.company} (${e.start || 'Unknown'} - ${e.end || 'Present'})`
    ).join(', ') || 'No experience data';

    const prompt = `Analyze this professional profile and provide career insights:

Profile: ${profile.filteredData.name}
Headline: ${profile.filteredData.headline || 'Not specified'}
About: ${profile.filteredData.about || 'Not provided'}

Experience:
${experienceSummary}

Skills:
${skillSummary}

Provide a comprehensive career analysis including:
1. Key strengths based on experience and skills
2. Potential skill gaps or areas for improvement
3. Specific recommendations for career growth
4. Concrete next steps to advance their career
5. Overall career development score (0-1)

Focus on actionable insights that align with their experience level and career trajectory.`;

    const messages = [
      { role: 'system', content: 'You are a senior career advisor with expertise in professional development and skill assessment.' },
      { role: 'user', content: prompt }
    ];

    return await this.generateStructuredResponse(messages, CareerAnalysisSchema);
  }
}