import { z } from 'zod';

import type { LLMProvider } from '../core/llm-provider.js';

export interface SkillExtractionContext {
  nodeType: 'job' | 'project' | 'education' | 'event';
  title: string;
  role?: string;
  description?: string;
  technologies?: string[];
  fieldOfStudy?: string;
  degree?: string;
  institution?: string;
}

const ExtractedSkillsSchema = z.object({
  technical: z.array(z.string()),
  domain: z.array(z.string()),
  soft: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export interface ExtractedSkills {
  technical: string[];
  domain: string[];
  soft: string[];
  confidence: number;
  normalizedSkills: string[];
}

const SKILL_ALIASES: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  node: 'nodejs',
  'react.js': 'react',
  reactjs: 'react',
  'vue.js': 'vue',
  vuejs: 'vue',
  'next.js': 'nextjs',
  nextjs: 'next',
  postgres: 'postgresql',
  mongo: 'mongodb',
  k8s: 'kubernetes',
  tf: 'tensorflow',
  py: 'python',
  cpp: 'c++',
  cs: 'c#',
};

export class LLMSkillExtractionService {
  constructor(private llmProvider: LLMProvider) {}

  async extractSkills(
    context: SkillExtractionContext
  ): Promise<ExtractedSkills> {
    const prompt = this.buildPrompt(context);

    const response = await this.llmProvider.generateStructuredResponse(
      [
        {
          role: 'system',
          content:
            'You are a career skills extraction expert. Extract ONLY skills that are explicitly mentioned in the provided text. Do NOT infer, assume, or add any skills that are not directly stated. Do NOT add related or similar skills. Only extract what is clearly and explicitly present in the input text. Categorize them into technical, domain, and soft skills.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      ExtractedSkillsSchema,
      {
        temperature: 0.1,
        maxTokens: 1000,
      }
    );

    const allSkills = [
      ...response.content.technical,
      ...response.content.domain,
      ...response.content.soft,
    ];

    const normalizedSkills = this.normalizeSkills(allSkills);

    return {
      ...response.content,
      normalizedSkills,
    };
  }

  private normalizeSkills(skills: string[]): string[] {
    const normalized = new Set<string>();

    for (const skill of skills) {
      let canonicalSkill = skill.toLowerCase().trim();

      // Apply alias mapping FIRST (for patterns like "react.js" or "React.js")
      if (SKILL_ALIASES[canonicalSkill]) {
        canonicalSkill = SKILL_ALIASES[canonicalSkill];
      }

      // Strip version numbers (e.g., "React 18" -> "react")
      canonicalSkill = canonicalSkill.replace(/\s+\d+(\.\d+)?(\.\d+)?$/, '');

      // Remove punctuation
      canonicalSkill = canonicalSkill.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '');

      // Apply alias mapping AGAIN after cleanup (for patterns like "js", "ts")
      if (SKILL_ALIASES[canonicalSkill]) {
        canonicalSkill = SKILL_ALIASES[canonicalSkill];
      }

      if (canonicalSkill) {
        normalized.add(canonicalSkill);
      }
    }

    return Array.from(normalized).sort();
  }

  private buildPrompt(context: SkillExtractionContext): string {
    const parts: string[] = [];

    parts.push(
      'Extract ONLY the skills explicitly mentioned in this ' +
        context.nodeType +
        ':'
    );
    parts.push('Title: ' + context.title);

    if (context.role) parts.push('Role: ' + context.role);
    if (context.description) parts.push('Description: ' + context.description);
    if (context.technologies && context.technologies.length) {
      parts.push('Technologies: ' + context.technologies.join(', '));
    }
    if (context.fieldOfStudy) parts.push('Field: ' + context.fieldOfStudy);
    if (context.degree) parts.push('Degree: ' + context.degree);
    if (context.institution) parts.push('Institution: ' + context.institution);

    parts.push(
      '\nIMPORTANT: Extract ONLY skills explicitly stated above. Do not infer or add related skills.'
    );
    parts.push('\nCategorize into:');
    parts.push(
      '- Technical: programming languages, frameworks, tools, technologies'
    );
    parts.push(
      '- Domain: industry knowledge, specializations, application domains'
    );
    parts.push(
      '- Soft: communication, leadership, problem-solving, collaboration'
    );
    parts.push(
      '\nProvide a confidence score (0.0-1.0) based on clarity of information.'
    );

    return parts.join('\n');
  }
}
