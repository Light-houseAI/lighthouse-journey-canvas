import { z } from 'zod';
import type { LLMProvider } from '../../core/llm-provider';
import type { ISkillService } from '../interfaces';

// Enhanced skill schemas
const SkillSchema = z.object({
  name: z.string(),
  category: z.enum(['technical', 'soft', 'domain', 'language', 'certification']),
  level: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).optional(),
  confidence: z.number().min(0).max(1),
  source: z.string(), // Where this skill was mentioned/extracted from
  context: z.string().optional(), // Additional context about how the skill was used
  keywords: z.array(z.string()).default([]), // Related keywords and synonyms
});

const SkillExtractionResultSchema = z.object({
  extractedSkills: z.array(SkillSchema),
  categorizedSkills: z.object({
    technical: z.array(SkillSchema),
    soft: z.array(SkillSchema),
    domain: z.array(SkillSchema),
    language: z.array(SkillSchema),
    certification: z.array(SkillSchema),
  }),
  skillSuggestions: z.array(z.string()).default([]),
  reasoning: z.string().optional(),
});

const SkillAnalysisSchema = z.object({
  userId: z.string(),
  totalSkills: z.number(),
  skillsByCategory: z.record(z.string(), z.number()),
  topSkills: z.array(SkillSchema).max(10),
  skillGaps: z.array(z.string()).default([]),
  careerAlignment: z.object({
    score: z.number().min(0).max(1),
    recommendations: z.array(z.string()),
  }),
  skillTrends: z.array(z.object({
    skill: z.string(),
    frequency: z.number(),
    lastMentioned: z.string(),
  })).default([]),
});

export class SkillExtractor {
  constructor(
    private llmProvider: LLMProvider
  ) {}

  async extractSkillsFromText(
    text: string,
    context: {
      source: string; // 'conversation', 'milestone', 'profile', etc.
      userId?: string;
      existingSkills?: Array<{name: string; category: string}>;
      careerGoal?: string;
    }
  ): Promise<z.infer<typeof SkillExtractionResultSchema>> {
    const contextPrompt = this.buildSkillExtractionPrompt(text, context);

    try {
      const systemPrompt = `You are an expert career consultant and skill analyzer. Your role is to:

1. **Comprehensive Skill Detection**: Extract both explicit and implicit skills from:
   - Job descriptions and responsibilities
   - Project descriptions and achievements
   - Educational experiences and coursework
   - Casual conversations about work
   - Tools, technologies, and methodologies mentioned

2. **Intelligent Categorization**: Classify skills into:
   - Technical: Programming languages, frameworks, tools, platforms
   - Soft: Communication, leadership, problem-solving, creativity
   - Domain: Industry-specific knowledge, business domains, regulations
   - Language: Human languages and communication abilities
   - Certification: Formal certifications, licenses, accreditations

3. **Skill Level Assessment**: When possible, infer skill proficiency from context:
   - Beginner: Learning, studying, basic familiarity
   - Intermediate: Working knowledge, can use with guidance
   - Advanced: Proficient, can work independently
   - Expert: Teaching others, deep expertise, innovation

Be thorough but accurate - extract skills that are genuinely demonstrated or learned.`;

      const response = await this.llmProvider.generateStructuredResponse(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: contextPrompt }
        ],
        SkillExtractionResultSchema
      );

      const result = response.content;
      if (!result) {
        return {
          extractedSkills: [],
          categorizedSkills: {
            technical: [],
            soft: [],
            domain: [],
            language: [],
            certification: []
          },
          skillSuggestions: []
        };
      }

      return result;
    } catch (error) {
      console.error('Error extracting skills:', error);
      return {
        extractedSkills: [],
        categorizedSkills: {
          technical: [],
          soft: [],
          domain: [],
          language: [],
          certification: []
        },
        skillSuggestions: []
      };
    }
  }

  private buildSkillExtractionPrompt(
    text: string,
    context: {
      source: string;
      userId?: string;
      existingSkills?: Array<{name: string; category: string}>;
      careerGoal?: string;
    }
  ): string {
    const existingSkillsContext = context.existingSkills && context.existingSkills.length > 0
      ? `\n\nExisting skills to avoid duplicating:\n${context.existingSkills.map(s =>
          `- ${s.name} (${s.category})`
        ).join('\n')}`
      : '';

    const careerGoalContext = context.careerGoal
      ? `\n\nUser's career goal: ${context.careerGoal}`
      : '';

    return `Extract and analyze all skills mentioned or implied in this text:

TEXT: "${text}"
SOURCE: ${context.source}
${existingSkillsContext}
${careerGoalContext}

Instructions:
1. Extract ALL skills mentioned explicitly or implicitly
2. For each skill, determine:
   - Exact name (standardized form)
   - Category (technical/soft/domain/language/certification)
   - Confidence level (0.0-1.0) based on how clearly it's demonstrated
   - Context of how it was used or mentioned
   - Proficiency level if inferable from context

3. Categorize skills into the five categories
4. Suggest 3-5 related skills they might want to develop based on current skills
5. Provide reasoning for your analysis

Important:
- Include both hard and soft skills
- Extract implied skills (e.g., "led a team" implies leadership)
- Standardize skill names (e.g., "JS" → "JavaScript")
- Consider skill synonyms and variants
- Don't duplicate existing skills unless confidence is higher

Return analysis in the specified JSON format.`;
  }

  async analyzeUserSkillProfile(
    userId: string,
    allUserSkills: Array<z.infer<typeof SkillSchema>>,
    careerGoal?: string
  ): Promise<z.infer<typeof SkillAnalysisSchema>> {
    const prompt = `Analyze this user's complete skill profile:

USER ID: ${userId}
CAREER GOAL: ${careerGoal || 'Not specified'}

SKILLS:
${allUserSkills.map(skill =>
  `- ${skill.name} (${skill.category}${skill.level ? `, ${skill.level}` : ''}, confidence: ${skill.confidence})`
).join('\n')}

Provide comprehensive analysis including:
1. Skill distribution across categories
2. Top 10 strongest skills
3. Skill gaps for their career goal
4. Career alignment score (0.0-1.0)
5. Specific recommendations for skill development
6. Skill usage trends and patterns

Return analysis in the specified JSON format.`;

    try {
      const response = await this.llmProvider.generateStructuredResponse(
        [{ role: 'user', content: prompt }],
        SkillAnalysisSchema
      );

      return response.content || {
        userId,
        totalSkills: allUserSkills.length,
        skillsByCategory: {},
        topSkills: [],
        skillGaps: [],
        careerAlignment: { score: 0.5, recommendations: [] },
        skillTrends: []
      };
    } catch (error) {
      console.error('Error analyzing skill profile:', error);
      return {
        userId,
        totalSkills: allUserSkills.length,
        skillsByCategory: {},
        topSkills: [],
        skillGaps: [],
        careerAlignment: { score: 0.5, recommendations: [] },
        skillTrends: []
      };
    }
  }

  async suggestSkillsForCareerPath(
    currentSkills: string[],
    targetRole: string,
    industry?: string
  ): Promise<{
    required: string[];
    recommended: string[];
    nice_to_have: string[];
    reasoning: string;
  }> {
    const prompt = `Suggest skills for career progression:

CURRENT SKILLS: ${currentSkills.join(', ')}
TARGET ROLE: ${targetRole}
INDUSTRY: ${industry || 'General'}

Analyze and suggest:
1. Required skills (must-have for the target role)
2. Recommended skills (will significantly help)
3. Nice-to-have skills (competitive advantage)
4. Reasoning for recommendations

Focus on practical, achievable skill development paths.`;

    try {
      const schema = z.object({
        required: z.array(z.string()),
        recommended: z.array(z.string()),
        nice_to_have: z.array(z.string()),
        reasoning: z.string(),
      });

      const response = await this.llmProvider.generateStructuredResponse(
        [{ role: 'user', content: prompt }],
        schema
      );

      return response.content || {
        required: [],
        recommended: [],
        nice_to_have: [],
        reasoning: 'Unable to generate skill suggestions at this time.'
      };
    } catch (error) {
      console.error('Error suggesting skills for career path:', error);
      return {
        required: [],
        recommended: [],
        nice_to_have: [],
        reasoning: 'Unable to generate skill suggestions at this time.'
      };
    }
  }

  async extractSkillsFromMilestones(
    milestones: Array<{
      id: string;
      title: string;
      description: string;
      type: string;
      skills: string[];
      organization?: string;
      date?: string;
    }>,
    userId: string
  ): Promise<Array<z.infer<typeof SkillSchema>>> {
    const allSkills: Array<z.infer<typeof SkillSchema>> = [];

    for (const milestone of milestones) {
      const text = `${milestone.title}. ${milestone.description}. Skills: ${milestone.skills.join(', ')}`;

      const result = await this.extractSkillsFromText(text, {
        source: `milestone_${milestone.id}`,
        userId,
      });

      allSkills.push(...result.extractedSkills);
    }

    // Deduplicate and merge similar skills
    return this.deduplicateSkills(allSkills);
  }

  private deduplicateSkills(skills: Array<z.infer<typeof SkillSchema>>): Array<z.infer<typeof SkillSchema>> {
    const skillMap = new Map<string, z.infer<typeof SkillSchema>>();

    for (const skill of skills) {
      const normalizedName = skill.name.toLowerCase().trim();

      if (skillMap.has(normalizedName)) {
        const existing = skillMap.get(normalizedName)!;
        // Keep the skill with higher confidence
        if (skill.confidence > existing.confidence) {
          skillMap.set(normalizedName, {
            ...skill,
            keywords: [...new Set([...existing.keywords, ...skill.keywords])],
          });
        }
      } else {
        skillMap.set(normalizedName, skill);
      }
    }

    return Array.from(skillMap.values());
  }
}

// Remove singleton export - now uses dependency injection
export type { SkillSchema, SkillExtractionResultSchema, SkillAnalysisSchema };
