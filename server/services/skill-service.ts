import type { ISkillRepository, SkillRecord, SkillInput, SkillStats, SkillQueryOptions } from '../repositories/interfaces';
import type { ISkillService, SkillFilters } from './interfaces';
import type { LLMProvider } from '../core/llm-provider';
import { z } from 'zod';

// Skill extraction schema for AI processing
const SkillExtractionSchema = z.object({
  skills: z.array(z.object({
    name: z.string(),
    category: z.enum(['technical', 'soft', 'domain', 'language', 'certification']),
    level: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).optional(),
    confidence: z.number().min(0).max(1),
    context: z.string().optional(),
    keywords: z.array(z.string()).default([]),
  })),
});

export class SkillService implements ISkillService {
  constructor(
    private skillRepository: ISkillRepository,
    private llmProvider: LLMProvider
  ) {}

  async getUserSkills(userId: number, filters: SkillFilters = {}): Promise<SkillRecord[]> {
    const options: SkillQueryOptions = {
      category: filters.category,
      isActive: filters.isActive,
      minConfidence: filters.minConfidence,
      limit: filters.limit,
    };

    return await this.skillRepository.findByUserId(userId, options);
  }

  async getSkillsByCategory(userId: number): Promise<Record<string, SkillRecord[]>> {
    const skills = await this.skillRepository.findByUserId(userId, { isActive: true });
    
    const categories: Record<string, SkillRecord[]> = {
      technical: [],
      soft: [],
      domain: [],
      language: [],
      certification: []
    };

    skills.forEach(skill => {
      if (categories[skill.category]) {
        categories[skill.category].push(skill);
      }
    });

    return categories;
  }

  async addSkill(userId: number, skill: SkillInput): Promise<SkillRecord> {
    // Validate skill data
    if (!skill.name || !skill.category || skill.confidence < 0 || skill.confidence > 1) {
      throw new Error('Invalid skill data provided');
    }

    return await this.skillRepository.upsert(userId, skill);
  }

  async updateSkill(skillId: number, updates: Partial<SkillRecord>): Promise<SkillRecord | null> {
    return await this.skillRepository.update(skillId, updates);
  }

  async extractAndStoreSkills(userId: number, text: string, source: string): Promise<SkillRecord[]> {
    try {
      // Use LLM to extract skills from text
      const extractedSkills = await this.extractSkillsFromText(text);
      
      const storedSkills: SkillRecord[] = [];
      
      // Store each extracted skill
      for (const skill of extractedSkills) {
        const skillInput: SkillInput = {
          ...skill,
          source,
        };
        
        const storedSkill = await this.skillRepository.upsert(userId, skillInput);
        storedSkills.push(storedSkill);
      }

      return storedSkills;
    } catch (error) {
      console.error('Error extracting and storing skills:', error);
      throw new Error('Failed to extract and store skills from text');
    }
  }

  // Method to store multiple skills for a user
  async storeSkillsForUser(userId: number, skills: SkillInput[]): Promise<SkillRecord[]> {
    const storedSkills: SkillRecord[] = [];
    
    for (const skill of skills) {
      try {
        const storedSkill = await this.skillRepository.upsert(userId, skill);
        storedSkills.push(storedSkill);
      } catch (error) {
        console.error(`Error storing skill ${skill.name}:`, error);
        // Continue with other skills
      }
    }
    
    return storedSkills;
  }

  // Alias method for compatibility with existing code
  async storeSkills(userId: string | number, skills: SkillInput[]): Promise<SkillRecord[]> {
    const userIdNumber = typeof userId === 'string' ? parseInt(userId) : userId;
    return this.storeSkillsForUser(userIdNumber, skills);
  }

  async searchSkills(userId: number, query: string): Promise<SkillRecord[]> {
    return await this.skillRepository.search(userId, query);
  }

  async getSkillStats(userId: number): Promise<SkillStats> {
    return await this.skillRepository.getStats(userId);
  }

  async toggleSkillActivity(userId: number, skillName: string, isActive: boolean): Promise<boolean> {
    return await this.skillRepository.updateActivity(userId, skillName, isActive);
  }

  // Private method to extract skills using LLM
  private async extractSkillsFromText(text: string): Promise<SkillInput[]> {
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
      { role: 'system' as const, content: 'You are an expert at extracting and categorizing professional skills from text.' },
      { role: 'user' as const, content: prompt }
    ];

    const response = await this.llmProvider.generateStructuredResponse(messages, SkillExtractionSchema);
    
    return response.content.skills.map(skill => ({
      name: skill.name,
      category: skill.category,
      level: skill.level,
      confidence: skill.confidence,
      source: 'text_analysis',
      context: skill.context,
      keywords: skill.keywords,
    }));
  }

  // Advanced skill analysis methods
  async analyzeSkillGaps(userId: number, targetRole?: string): Promise<{
    missingSkills: string[];
    skillsToImprove: SkillRecord[];
    recommendations: string[];
  }> {
    const userSkills = await this.getUserSkills(userId, { isActive: true });
    
    // This could be enhanced with AI analysis for specific target roles
    const skillsToImprove = userSkills.filter(skill => skill.confidence < 0.7);
    
    return {
      missingSkills: [], // Could be populated based on target role analysis
      skillsToImprove,
      recommendations: [
        'Consider working on projects that strengthen your lower-confidence skills',
        'Seek mentorship opportunities in areas where you want to grow',
      ]
    };
  }

  async getSkillTrends(userId: number, days: number = 30): Promise<{
    recentlyAdded: SkillRecord[];
    improving: SkillRecord[];
    declining: SkillRecord[];
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const allSkills = await this.getUserSkills(userId);
    
    const recentlyAdded = allSkills.filter(skill => 
      skill.firstMentioned > cutoffDate
    );

    // For now, return basic analysis
    // This could be enhanced with historical confidence tracking
    return {
      recentlyAdded,
      improving: [],
      declining: []
    };
  }

  async bulkUpdateSkills(userId: number, updates: Array<{skillId: number; updates: Partial<SkillRecord>}>): Promise<SkillRecord[]> {
    const updatedSkills: SkillRecord[] = [];
    
    for (const { skillId, updates: skillUpdates } of updates) {
      const updated = await this.updateSkill(skillId, skillUpdates);
      if (updated) {
        updatedSkills.push(updated);
      }
    }
    
    return updatedSkills;
  }
}