import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LLMProvider } from '../../core/llm-provider.js';
import { LLMSkillExtractionService } from '../llm-skill-extraction.service.js';

describe('LLMSkillExtractionService', () => {
  let service: LLMSkillExtractionService;
  let mockLLMProvider: LLMProvider;

  beforeEach(() => {
    mockLLMProvider = {
      generateStructuredResponse: vi.fn().mockResolvedValue({
        content: {
          technical: ['nodejs', 'postgresql', 'docker'],
          domain: ['backend engineering', 'api development'],
          soft: ['problem solving', 'collaboration'],
          confidence: 0.85,
        },
      }),
      generateText: vi.fn(),
      streamText: vi.fn(),
    } as any;

    service = new LLMSkillExtractionService(mockLLMProvider);
  });

  it('should extract skills from a job node', async () => {
    const context = {
      nodeType: 'job' as const,
      title: 'Senior Backend Engineer',
      role: 'Senior Backend Engineer',
      description:
        'Building scalable APIs with Node.js, PostgreSQL, and Docker',
      technologies: ['Node.js', 'PostgreSQL', 'Docker'],
    };

    const result = await service.extractSkills(context);

    expect(result).toHaveProperty('technical');
    expect(result).toHaveProperty('domain');
    expect(result).toHaveProperty('soft');
    expect(result).toHaveProperty('confidence');
    expect(result.technical).toBeInstanceOf(Array);
    expect(result.technical).toContain('nodejs');
    expect(result.domain).toContain('backend engineering');
    expect(result.confidence).toBe(0.85);
  });

  it('should normalize skills to canonical forms', async () => {
    const context = {
      nodeType: 'job' as const,
      title: 'Frontend Developer',
      technologies: ['React.js', 'JS', 'TypeScript'],
    };

    mockLLMProvider.generateStructuredResponse = vi.fn().mockResolvedValue({
      content: {
        technical: ['React.js', 'JS', 'TypeScript', 'Node'],
        domain: [],
        soft: [],
        confidence: 0.9,
      },
    });

    const result = await service.extractSkills(context);

    expect(result.normalizedSkills).toContain('react');
    expect(result.normalizedSkills).toContain('javascript');
    expect(result.normalizedSkills).toContain('typescript');
    expect(result.normalizedSkills).toContain('nodejs');
    expect(result.normalizedSkills).not.toContain('js');
    expect(result.normalizedSkills).not.toContain('react.js');
  });
});
