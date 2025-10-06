import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JobMatchingService } from '../job-matching.service';
import type { Database } from '../../types/database';
import type { LLMSkillExtractionService, ExtractedSkills } from '../llm-skill-extraction.service';

describe('JobMatchingService', () => {
  let service: JobMatchingService;
  let mockDb: Partial<Database>;
  let mockSkillExtractor: Partial<LLMSkillExtractionService>;

  const mockExtractedSkills: ExtractedSkills = {
    core: ['TypeScript', 'React', 'Node.js'],
    secondary: ['AWS', 'Docker'],
    domain: ['FinTech', 'Payments'],
    seniority: 'senior',
  };

  const mockJobNodes = [
    {
      id: '1',
      userId: 101,
      type: 'job',
      title: 'Senior Software Engineer',
      meta: {
        role: 'Senior Software Engineer',
        company: 'Tech Corp',
        industry: 'Technology',
      },
    },
    {
      id: '2',
      userId: 102,
      type: 'job',
      title: 'Staff Engineer',
      meta: {
        role: 'Staff Engineer',
        company: 'FinTech Inc',
        industry: 'Financial Services',
      },
    },
    {
      id: '3',
      userId: 103,
      type: 'job',
      title: 'Junior Developer',
      meta: {
        role: 'Junior Developer',
        company: 'Startup',
        industry: 'Technology',
      },
    },
  ];

  beforeEach(() => {
    mockSkillExtractor = {
      extractSkills: vi.fn().mockResolvedValue(mockExtractedSkills),
    };

    mockDb = {
      query: {
        timelineNodes: {
          findFirst: vi.fn().mockResolvedValue(mockJobNodes[0]),
        },
        users: {
          findMany: vi.fn().mockResolvedValue(mockJobNodes.map(n => ({
            id: n.userId,
            firstName: 'Test',
            lastName: `User${n.userId}`,
          }))),
        },
      },
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(mockJobNodes),
      innerJoin: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
    } as any;

    service = new JobMatchingService(
      mockDb as Database,
      mockSkillExtractor as LLMSkillExtractionService
    );
  });

  describe('findMatches', () => {
    it('should find matching jobs based on skills and seniority', async () => {
      const context = {
        nodeId: '1',
        userId: 101,
        limit: 5,
      };

      const result = await service.findMatches(context);

      expect(result).toBeDefined();
      expect(result.matches).toBeInstanceOf(Array);
      expect(result.querySkills).toEqual(mockExtractedSkills);
      expect(mockSkillExtractor.extractSkills).toHaveBeenCalled();
    });

    it('should calculate skill similarity scores', async () => {
      const context = {
        nodeId: '1',
        userId: 101,
      };

      const result = await service.findMatches(context);

      expect(result.matches).toHaveLength(mockJobNodes.length);
      result.matches.forEach(match => {
        expect(match.score).toBeGreaterThanOrEqual(0);
        expect(match.score).toBeLessThanOrEqual(100);
        expect(match.skillsSimilarity).toBeDefined();
        expect(match.roleMatch).toBeDefined();
        expect(match.seniorityMatch).toBeDefined();
      });
    });

    it('should respect limit parameter', async () => {
      const context = {
        nodeId: '1',
        userId: 101,
        limit: 2,
      };

      mockDb.limit = vi.fn().mockResolvedValue(mockJobNodes.slice(0, 2));

      const result = await service.findMatches(context);

      expect(mockDb.limit).toHaveBeenCalledWith(2);
    });

    it('should handle empty results gracefully', async () => {
      const context = {
        nodeId: '1',
        userId: 101,
      };

      mockDb.limit = vi.fn().mockResolvedValue([]);

      const result = await service.findMatches(context);

      expect(result.matches).toEqual([]);
      expect(result.totalCandidates).toBe(0);
    });

    it('should sort matches by score in descending order', async () => {
      const context = {
        nodeId: '1',
        userId: 101,
      };

      const result = await service.findMatches(context);

      for (let i = 1; i < result.matches.length; i++) {
        expect(result.matches[i - 1].score).toBeGreaterThanOrEqual(result.matches[i].score);
      }
    });
  });

  describe('enhanced matching features', () => {
    it('should include activity signals when requested', async () => {
      const context = {
        nodeId: '1',
        userId: 101,
        includeActivitySignals: true,
      };

      const result = await service.findMatches(context);

      result.matches.forEach(match => {
        expect(match.activityScore).toBeDefined();
        expect(match.activityScore).toBeGreaterThanOrEqual(0);
        expect(match.activityScore).toBeLessThanOrEqual(1);
      });
    });

    it('should include insight relevance when requested', async () => {
      const context = {
        nodeId: '1',
        userId: 101,
        includeInsights: true,
      };

      const result = await service.findMatches(context);

      result.matches.forEach(match => {
        expect(match.insightRelevance).toBeDefined();
        expect(match.insightRelevance).toBeGreaterThanOrEqual(0);
        expect(match.insightRelevance).toBeLessThanOrEqual(1);
      });
    });

    it('should use enhanced scoring weights when activity/insights enabled', async () => {
      const context = {
        nodeId: '1',
        userId: 101,
        includeActivitySignals: true,
        includeInsights: true,
      };

      const result = await service.findMatches(context);
      const match = result.matches[0];

      // Enhanced scoring uses different weights
      // Skills: 40%, Role: 20%, Seniority: 15%, Activity: 15%, Insights: 10%
      const expectedMax =
        0.4 * match.skillsSimilarity +
        0.2 * match.roleMatch +
        0.15 * match.seniorityMatch +
        0.15 * (match.activityScore || 0) +
        0.1 * (match.insightRelevance || 0);

      expect(match.score).toBeLessThanOrEqual(expectedMax * 1.01); // Allow 1% tolerance
    });
  });

  describe('score calculation', () => {
    it('should weight skills similarity highest in standard mode', async () => {
      const context = {
        nodeId: '1',
        userId: 101,
      };

      const result = await service.findMatches(context);
      const match = result.matches[0];

      // Standard mode: Skills should contribute 50% to total score
      const expectedSkillsContribution = match.skillsSimilarity * 0.5;
      expect(match.score).toBeGreaterThanOrEqual(expectedSkillsContribution * 0.9); // Allow some tolerance
    });

    it('should penalize large seniority gaps', async () => {
      const context = {
        nodeId: '3', // Junior Developer
        userId: 103,
      };

      mockSkillExtractor.extractSkills = vi.fn().mockResolvedValue({
        ...mockExtractedSkills,
        seniority: 'junior',
      });

      const result = await service.findMatches(context);

      // Staff/Senior roles should have lower seniority match scores
      const seniorMatch = result.matches.find(m => m.title.includes('Senior'));
      const juniorMatch = result.matches.find(m => m.title.includes('Junior'));

      if (seniorMatch && juniorMatch) {
        expect(juniorMatch.seniorityMatch).toBeGreaterThan(seniorMatch.seniorityMatch);
      }
    });
  });
});