import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ActivityScoringService } from '../activity-scoring.service';
import type { Database } from '../../types/database';

describe('ActivityScoringService', () => {
  let service: ActivityScoringService;
  let mockDb: Partial<Database>;

  const mockUpdates = [
    {
      id: 'u1',
      userId: 1,
      nodeId: 'n1',
      updateType: 'job-search',
      content: 'Applied to 5 jobs',
      meta: {
        appliedToJobs: true,
        pendingInterviews: false,
      },
      createdAt: new Date(),
    },
    {
      id: 'u2',
      userId: 1,
      nodeId: 'n2',
      updateType: 'interview',
      content: 'Had interview with Google',
      meta: {
        hadInterviews: true,
        receivedOffers: false,
      },
      createdAt: new Date(),
    },
    {
      id: 'u3',
      userId: 2,
      nodeId: 'n3',
      updateType: 'offer',
      content: 'Received offer from Meta',
      meta: {
        receivedOffers: true,
      },
      createdAt: new Date(),
    },
  ];

  const mockNodeInsights = [
    {
      nodeInsights: {
        id: 'i1',
        nodeId: 'n1',
        description: 'Key learning: System design is crucial for senior roles',
        resources: [],
      },
      timelineNodes: {
        id: 'n1',
        userId: 1,
        title: 'Google Interview',
        description: 'System design interview',
      },
    },
    {
      nodeInsights: {
        id: 'i2',
        nodeId: 'n2',
        description: 'Learned about distributed systems and scalability',
        resources: [],
      },
      timelineNodes: {
        id: 'n2',
        userId: 2,
        title: 'Meta Interview',
        description: 'Technical interview focused on distributed systems',
      },
    },
  ];

  beforeEach(() => {
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(mockUpdates),
    } as any;

    service = new ActivityScoringService(mockDb as Database);
  });

  describe('getActivityScore', () => {
    it('should calculate activity score based on job search signals', async () => {
      const userId = 1;
      const result = await service.getActivityScore(userId);

      expect(result).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
      expect(result.signals).toBeInstanceOf(Array);
    });

    it('should identify active job seekers', async () => {
      const userId = 1;
      const result = await service.getActivityScore(userId);

      expect(result.activeJobSearch).toBe(true);
      expect(result.signals).toContain('Recent job applications');
    });

    it('should boost score for interview activity', async () => {
      mockDb.limit = vi.fn().mockResolvedValue([mockUpdates[1]]); // Interview update

      const result = await service.getActivityScore(1);

      expect(result.interviewActivity).toBe(true);
      expect(result.signals).toContain('Interview activity');
      expect(result.score).toBeGreaterThan(0);
    });

    it('should recognize offer signals', async () => {
      mockDb.limit = vi.fn().mockResolvedValue([mockUpdates[2]]); // Offer update

      const result = await service.getActivityScore(2);

      expect(result.recentOffers).toBe(true);
      expect(result.signals).toContain('Recent offers');
    });

    it('should handle users with no updates', async () => {
      mockDb.limit = vi.fn().mockResolvedValue([]);

      const result = await service.getActivityScore(999);

      expect(result.score).toBe(0);
      expect(result.activeJobSearch).toBe(false);
      expect(result.signals).toHaveLength(0);
    });

    it('should cap score at 1.0', async () => {
      const manyUpdates = Array(10).fill(null).map((_, i) => ({
        id: `u${i}`,
        userId: 1,
        meta: {
          appliedToJobs: true,
          hadInterviews: true,
          receivedOffers: true,
          updatedProfile: true,
        },
        createdAt: new Date(),
      }));

      mockDb.limit = vi.fn().mockResolvedValue(manyUpdates);

      const result = await service.getActivityScore(1);

      expect(result.score).toBe(1.0);
    });
  });

  describe('getInsightRelevance', () => {
    it('should calculate insight relevance score', async () => {
      const queryNode = {
        id: 'q1',
        title: 'Senior Software Engineer',
        description: 'Focus on system design and distributed systems',
      };

      mockDb.limit = vi.fn()
        .mockResolvedValueOnce([queryNode])
        .mockResolvedValueOnce(mockNodeInsights);

      const result = await service.getInsightRelevance('q1', 1);

      expect(result).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
      expect(result.relevantInsights).toBeInstanceOf(Array);
    });

    it('should rank insights by relevance', async () => {
      const queryNode = {
        id: 'q1',
        title: 'System Design Engineer',
        description: 'distributed systems scalability',
      };

      mockDb.limit = vi.fn()
        .mockResolvedValueOnce([queryNode])
        .mockResolvedValueOnce(mockNodeInsights);

      const result = await service.getInsightRelevance('q1', 1);

      if (result.relevantInsights.length > 1) {
        for (let i = 1; i < result.relevantInsights.length; i++) {
          expect(result.relevantInsights[i - 1].relevanceScore)
            .toBeGreaterThanOrEqual(result.relevantInsights[i].relevanceScore);
        }
      }
    });

    it('should filter low relevance insights', async () => {
      const queryNode = {
        id: 'q1',
        title: 'Data Analyst',
        description: 'SQL and reporting',
      };

      mockDb.limit = vi.fn()
        .mockResolvedValueOnce([queryNode])
        .mockResolvedValueOnce(mockNodeInsights); // System design insights - not relevant

      const result = await service.getInsightRelevance('q1', 1);

      // Low relevance due to mismatch
      expect(result.score).toBeLessThan(0.5);
    });

    it('should handle candidates with no insights', async () => {
      mockDb.limit = vi.fn()
        .mockResolvedValueOnce([{ id: 'q1', title: 'Test', description: 'Test' }])
        .mockResolvedValueOnce([]);

      const result = await service.getInsightRelevance('q1', 999);

      expect(result.score).toBe(0);
      expect(result.relevantInsights).toHaveLength(0);
    });
  });

  describe('getActivitySignals', () => {
    it('should return list of activity signals', async () => {
      const signals = await service.getActivitySignals(1);

      expect(signals).toBeInstanceOf(Array);
      expect(signals.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('isActiveJobSeeker', () => {
    it('should identify active job seekers', async () => {
      const isActive = await service.isActiveJobSeeker(1);

      expect(typeof isActive).toBe('boolean');
    });

    it('should return false for inactive users', async () => {
      mockDb.limit = vi.fn().mockResolvedValue([]);

      const isActive = await service.isActiveJobSeeker(999);

      expect(isActive).toBe(false);
    });
  });

  describe('keyword extraction', () => {
    it('should extract meaningful keywords', () => {
      const text = 'Senior Software Engineer with experience in distributed systems and microservices';

      // Access private method through any casting (for testing)
      const keywords = (service as any).extractKeywords(text);

      expect(keywords).toBeInstanceOf(Set);
      expect(keywords.has('senior')).toBe(true);
      expect(keywords.has('software')).toBe(true);
      expect(keywords.has('engineer')).toBe(true);
      expect(keywords.has('distributed')).toBe(true);
      expect(keywords.has('systems')).toBe(true);
      expect(keywords.has('microservices')).toBe(true);

      // Stop words should be filtered
      expect(keywords.has('with')).toBe(false);
      expect(keywords.has('and')).toBe(false);
      expect(keywords.has('in')).toBe(false);
    });

    it('should calculate keyword overlap correctly', () => {
      const set1 = new Set(['react', 'typescript', 'node']);
      const set2 = new Set(['react', 'javascript', 'node']);

      const overlap = (service as any).calculateKeywordOverlap(set1, set2);

      // 2 common (react, node) out of 4 unique total
      expect(overlap).toBeCloseTo(0.5, 2);
    });
  });
});