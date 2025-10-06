import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InterviewMatchingService } from '../interview-matching.service';
import type { Database } from '../../types/database';
import type { OpenAIEmbeddingService } from '../openai-embedding.service';

describe('InterviewMatchingService', () => {
  let service: InterviewMatchingService;
  let mockDb: Partial<Database>;
  let mockEmbeddingService: Partial<OpenAIEmbeddingService>;

  const mockInterviewNodes = [
    {
      id: 'i1',
      userId: 301,
      type: 'event',
      title: 'Google SWE Interview',
      description: 'System design and algorithms',
      meta: {
        eventType: 'interview',
        company: 'Google',
        role: 'Software Engineer',
        outcome: 'offer',
        interviewType: 'technical',
        rounds: 5,
      },
    },
    {
      id: 'i2',
      userId: 302,
      type: 'event',
      title: 'Meta PM Interview',
      description: 'Product sense and execution',
      meta: {
        eventType: 'interview',
        company: 'Meta',
        role: 'Product Manager',
        outcome: 'offer',
        interviewType: 'product',
        rounds: 4,
      },
    },
    {
      id: 'i3',
      userId: 303,
      type: 'event',
      title: 'Amazon SDE Interview',
      description: 'Leadership principles and coding',
      meta: {
        eventType: 'interview',
        company: 'Amazon',
        role: 'SDE II',
        outcome: 'rejected',
        interviewType: 'behavioral',
        rounds: 3,
      },
    },
  ];

  const mockEmbedding = new Array(1536).fill(0.1);

  beforeEach(() => {
    mockEmbeddingService = {
      generateEmbedding: vi.fn().mockResolvedValue(mockEmbedding),
      cosineSimilarity: vi.fn().mockReturnValue(0.85),
    };

    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(mockInterviewNodes),
      innerJoin: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue(mockInterviewNodes),
    } as any;

    service = new InterviewMatchingService(
      mockDb as Database,
      mockEmbeddingService as OpenAIEmbeddingService
    );
  });

  describe('findMatches', () => {
    it('should find matching interview experiences', async () => {
      const context = {
        nodeId: 'i1',
        userId: 301,
        company: 'Google',
        role: 'Software Engineer',
      };

      const result = await service.findMatches(context);

      expect(result).toBeDefined();
      expect(result.matches).toBeInstanceOf(Array);
      expect(result.searchContext).toBeDefined();
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalled();
    });

    it('should prioritize same company interviews', async () => {
      const context = {
        nodeId: 'i1',
        userId: 301,
        company: 'Google',
        role: 'Software Engineer',
      };

      const result = await service.findMatches(context);

      const googleMatch = result.matches.find(m => m.company === 'Google');
      const otherMatch = result.matches.find(m => m.company !== 'Google');

      if (googleMatch && otherMatch) {
        expect(googleMatch.relevanceScore).toBeGreaterThan(otherMatch.relevanceScore);
      }
    });

    it('should include success metrics in results', async () => {
      const context = {
        nodeId: 'i1',
        userId: 301,
        company: 'Google',
      };

      const result = await service.findMatches(context);

      expect(result.successMetrics).toBeDefined();
      expect(result.successMetrics.offerRate).toBeDefined();
      expect(result.successMetrics.averageRounds).toBeDefined();
      expect(result.successMetrics.commonTopics).toBeInstanceOf(Array);
    });

    it('should calculate preparation insights', async () => {
      const context = {
        nodeId: 'i1',
        userId: 301,
        role: 'Software Engineer',
      };

      const result = await service.findMatches(context);

      expect(result.preparationInsights).toBeDefined();
      expect(result.preparationInsights).toBeInstanceOf(Array);

      result.preparationInsights.forEach(insight => {
        expect(insight.category).toBeDefined();
        expect(insight.tips).toBeInstanceOf(Array);
        expect(insight.importance).toBeDefined();
      });
    });

    it('should handle interviews with missing metadata gracefully', async () => {
      const incompleteInterview = [
        {
          id: 'i4',
          userId: 304,
          type: 'event',
          title: 'Interview',
          meta: {
            eventType: 'interview',
          },
        },
      ];

      mockDb.execute = vi.fn().mockResolvedValue(incompleteInterview);

      const context = {
        nodeId: 'i4',
        userId: 304,
      };

      const result = await service.findMatches(context);

      expect(result.matches).toBeDefined();
      expect(result.matches[0].company).toBeUndefined();
      expect(result.matches[0].relevanceScore).toBeGreaterThanOrEqual(0);
    });

    it('should filter by interview outcome when specified', async () => {
      const context = {
        nodeId: 'i1',
        userId: 301,
        outcomeFilter: 'offer',
      };

      const result = await service.findMatches(context);

      const offeredInterviews = result.matches.filter(m => m.outcome === 'offer');
      const rejectedInterviews = result.matches.filter(m => m.outcome === 'rejected');

      expect(offeredInterviews.length).toBeGreaterThan(0);
      // Offers should be prioritized
      if (offeredInterviews.length > 0 && rejectedInterviews.length > 0) {
        expect(offeredInterviews[0].relevanceScore)
          .toBeGreaterThan(rejectedInterviews[0].relevanceScore);
      }
    });

    it('should provide company-specific tips', async () => {
      const context = {
        nodeId: 'i1',
        userId: 301,
        company: 'Google',
      };

      const result = await service.findMatches(context);

      const companyTips = result.preparationInsights
        .find(i => i.category === 'company-specific');

      expect(companyTips).toBeDefined();
      expect(companyTips?.tips.length).toBeGreaterThan(0);
    });
  });

  describe('getInterviewPatterns', () => {
    it('should extract common interview patterns', async () => {
      const company = 'Google';
      const role = 'Software Engineer';

      const patterns = await service.getInterviewPatterns(company, role);

      expect(patterns).toBeDefined();
      expect(patterns.commonQuestions).toBeInstanceOf(Array);
      expect(patterns.typicalProcess).toBeDefined();
      expect(patterns.successFactors).toBeInstanceOf(Array);
    });

    it('should identify interview round patterns', async () => {
      const patterns = await service.getInterviewPatterns('Meta', 'Product Manager');

      expect(patterns.typicalProcess.averageRounds).toBeDefined();
      expect(patterns.typicalProcess.stages).toBeInstanceOf(Array);

      patterns.typicalProcess.stages.forEach(stage => {
        expect(stage.name).toBeDefined();
        expect(stage.focus).toBeDefined();
      });
    });
  });
});