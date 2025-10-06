import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db } from '../../db.js';
import { UnifiedMatchingPipelineService } from '../unified-matching-pipeline.service';
import { LLMSkillExtractionService } from '../llm-skill-extraction.service';
import { OpenAIEmbeddingService } from '../openai-embedding.service';
import { ActivityScoringService } from '../activity-scoring.service';
import { timelineNodes, users, updates, nodeInsights } from '@journey/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * Integration tests for enhanced matching features
 * These tests validate the entire matching pipeline with real data
 */
describe('Enhanced Matching Integration Tests', () => {
  let pipeline: UnifiedMatchingPipelineService;
  let activityService: ActivityScoringService;
  let testUserId: number;
  let testNodeId: string;

  beforeAll(async () => {
    // Initialize services with real implementations
    const llmService = new LLMSkillExtractionService();
    const embeddingService = new OpenAIEmbeddingService(process.env.OPENAI_API_KEY || '');

    pipeline = new UnifiedMatchingPipelineService(db, llmService, embeddingService);
    activityService = new ActivityScoringService(db, llmService);

    // Setup test data
    await setupTestData();
  });

  afterAll(async () => {
    // Clean up test data if needed
    await cleanupTestData();
  });

  async function setupTestData() {
    // Create test users
    const testUser = await db.insert(users).values({
      email: 'test-enhanced@example.com',
      firstName: 'Test',
      lastName: 'Enhanced',
      role: 'user',
    }).returning();
    testUserId = testUser[0].id;

    // Create test job node
    const jobNode = await db.insert(timelineNodes).values({
      userId: testUserId,
      type: 'job',
      title: 'Senior Software Engineer',
      description: 'Working on distributed systems and microservices',
      startDate: new Date('2023-01-01'),
      meta: {
        role: 'Senior Software Engineer',
        company: 'Tech Corp',
        technologies: ['React', 'Node.js', 'AWS'],
        industry: 'Technology',
      },
    }).returning();
    testNodeId = jobNode[0].id;

    // Create updates to simulate job search activity
    await db.insert(updates).values([
      {
        userId: testUserId,
        nodeId: testNodeId,
        updateType: 'job-search',
        content: 'Applied to multiple positions',
        meta: {
          appliedToJobs: true,
          pendingInterviews: true,
        },
      },
      {
        userId: testUserId,
        nodeId: testNodeId,
        updateType: 'interview',
        content: 'Had technical interview',
        meta: {
          hadInterviews: true,
        },
      },
    ]);

    // Create node insights
    await db.insert(nodeInsights).values({
      nodeId: testNodeId,
      description: 'Key learning: System design patterns are crucial for scalability',
      resources: ['https://example.com/system-design'],
    });

    // Create additional test data for comparison
    const otherUsers = await db.insert(users).values([
      {
        email: 'candidate1@example.com',
        firstName: 'Candidate',
        lastName: 'One',
        role: 'user',
      },
      {
        email: 'candidate2@example.com',
        firstName: 'Candidate',
        lastName: 'Two',
        role: 'user',
      },
    ]).returning();

    // Create job nodes for other users
    for (const user of otherUsers) {
      const node = await db.insert(timelineNodes).values({
        userId: user.id,
        type: 'job',
        title: 'Software Engineer',
        description: 'Full stack development',
        startDate: new Date('2023-06-01'),
        meta: {
          role: 'Software Engineer',
          company: 'Another Corp',
          technologies: ['React', 'Python', 'Docker'],
        },
      }).returning();

      // Add varying levels of activity
      if (user.id === otherUsers[0].id) {
        // Active job seeker
        await db.insert(updates).values({
          userId: user.id,
          nodeId: node[0].id,
          updateType: 'job-search',
          content: 'Actively searching',
          meta: {
            appliedToJobs: true,
            receivedOffers: true,
          },
        });
      }

      // Add insights for better matching
      await db.insert(nodeInsights).values({
        nodeId: node[0].id,
        description: 'Experience with microservices and distributed systems',
        resources: [],
      });
    }
  }

  async function cleanupTestData() {
    // Clean up test data
    await db.delete(nodeInsights).where(eq(nodeInsights.nodeId, testNodeId));
    await db.delete(updates).where(eq(updates.userId, testUserId));
    await db.delete(timelineNodes).where(eq(timelineNodes.userId, testUserId));
    await db.delete(users).where(eq(users.email, 'test-enhanced@example.com'));

    // Clean up other test users
    await db.delete(users).where(sql`email LIKE 'candidate%@example.com'`);
  }

  describe('Activity Scoring Integration', () => {
    it('should correctly identify active job seekers from real data', async () => {
      const isActive = await activityService.isActiveJobSeeker(testUserId);
      expect(isActive).toBe(true);

      const activityScore = await activityService.getActivityScore(testUserId);
      expect(activityScore.score).toBeGreaterThan(0);
      expect(activityScore.signals).toContain('Recent job applications');
      expect(activityScore.signals).toContain('Interview activity');
    });

    it('should differentiate between active and inactive users', async () => {
      // Get an inactive user (no updates)
      const inactiveUser = await db.select()
        .from(users)
        .leftJoin(updates, eq(users.id, updates.userId))
        .where(sql`${updates.id} IS NULL`)
        .limit(1);

      if (inactiveUser[0]) {
        const isInactive = await activityService.isActiveJobSeeker(inactiveUser[0].users.id);
        expect(isInactive).toBe(false);

        const score = await activityService.getActivityScore(inactiveUser[0].users.id);
        expect(score.score).toBe(0);
        expect(score.signals).toHaveLength(0);
      }
    });
  });

  describe('Insight Relevance Integration', () => {
    it('should find relevant insights for matching nodes', async () => {
      const candidates = await db.select()
        .from(users)
        .where(sql`email LIKE 'candidate%@example.com'`);

      if (candidates.length > 0) {
        const relevance = await activityService.getInsightRelevance(
          testNodeId,
          candidates[0].id
        );

        expect(relevance.score).toBeGreaterThan(0);
        expect(relevance.relevantInsights.length).toBeGreaterThan(0);

        // Check that insights mention relevant keywords
        const hasRelevantContent = relevance.relevantInsights.some(
          i => i.description.includes('distributed') || i.description.includes('microservices')
        );
        expect(hasRelevantContent).toBe(true);
      }
    });
  });

  describe('Enhanced Matching Pipeline', () => {
    it('should produce better matches with enhanced features enabled', async () => {
      // Standard matching
      const standardResult = await pipeline.findMatches({
        nodeId: testNodeId,
        nodeType: 'job',
        userId: testUserId,
        limit: 10,
      });

      // Enhanced matching
      const enhancedResult = await pipeline.findMatches({
        nodeId: testNodeId,
        nodeType: 'job',
        userId: testUserId,
        limit: 10,
        includeActivitySignals: true,
        includeInsights: true,
      });

      // Enhanced should provide richer results
      expect(enhancedResult.insights.length).toBeGreaterThanOrEqual(standardResult.insights.length);

      // Check that active job seekers are prioritized
      const activeMatches = enhancedResult.matches.filter(
        m => m.activityScore && m.activityScore > 0.5
      );
      if (activeMatches.length > 0) {
        // Active matches should be ranked higher
        const firstActiveIndex = enhancedResult.matches.findIndex(
          m => m.activityScore && m.activityScore > 0.5
        );
        expect(firstActiveIndex).toBeLessThan(5); // Should be in top 5
      }
    });

    it('should handle missing data gracefully', async () => {
      // Create a node without updates or insights
      const bareNode = await db.insert(timelineNodes).values({
        userId: testUserId,
        type: 'job',
        title: 'Bare Job Node',
        description: 'No additional data',
        startDate: new Date(),
        meta: {},
      }).returning();

      const result = await pipeline.findMatches({
        nodeId: bareNode[0].id,
        nodeType: 'job',
        userId: testUserId,
        limit: 5,
        includeActivitySignals: true,
        includeInsights: true,
      });

      // Should still return results without crashing
      expect(result).toBeDefined();
      expect(result.matches).toBeInstanceOf(Array);

      // Clean up
      await db.delete(timelineNodes).where(eq(timelineNodes.id, bareNode[0].id));
    });

    it('should utilize cache for improved performance', async () => {
      // Clear cache first
      pipeline.clearCache();

      // First call - cache miss
      const start1 = Date.now();
      const result1 = await pipeline.findMatches({
        nodeId: testNodeId,
        nodeType: 'job',
        userId: testUserId,
        limit: 10,
      });
      const time1 = Date.now() - start1;

      // Second call - cache hit
      const start2 = Date.now();
      const result2 = await pipeline.findMatches({
        nodeId: testNodeId,
        nodeType: 'job',
        userId: testUserId,
        limit: 10,
      });
      const time2 = Date.now() - start2;

      // Cache hit should be faster
      expect(time2).toBeLessThan(time1 * 0.5); // At least 2x faster
      expect(result2.performance.cacheHit).toBe(true);

      // Results should be identical
      expect(result2.matches.length).toBe(result1.matches.length);
      expect(result2.matches[0]?.nodeId).toBe(result1.matches[0]?.nodeId);
    });
  });

  describe('Score Validation', () => {
    it('should calculate scores within valid ranges', async () => {
      const result = await pipeline.findMatches({
        nodeId: testNodeId,
        nodeType: 'job',
        userId: testUserId,
        limit: 20,
        includeActivitySignals: true,
        includeInsights: true,
      });

      result.matches.forEach(match => {
        // All scores should be between 0 and 1
        expect(match.score).toBeGreaterThanOrEqual(0);
        expect(match.score).toBeLessThanOrEqual(1);

        if (match.skillsSimilarity !== undefined) {
          expect(match.skillsSimilarity).toBeGreaterThanOrEqual(0);
          expect(match.skillsSimilarity).toBeLessThanOrEqual(1);
        }

        if (match.activityScore !== undefined) {
          expect(match.activityScore).toBeGreaterThanOrEqual(0);
          expect(match.activityScore).toBeLessThanOrEqual(1);
        }

        if (match.insightRelevance !== undefined) {
          expect(match.insightRelevance).toBeGreaterThanOrEqual(0);
          expect(match.insightRelevance).toBeLessThanOrEqual(1);
        }
      });
    });

    it('should maintain score ordering', async () => {
      const result = await pipeline.findMatches({
        nodeId: testNodeId,
        nodeType: 'job',
        userId: testUserId,
        limit: 10,
        includeActivitySignals: true,
        includeInsights: true,
      });

      // Matches should be sorted by score in descending order
      for (let i = 1; i < result.matches.length; i++) {
        expect(result.matches[i - 1].score).toBeGreaterThanOrEqual(result.matches[i].score);
      }
    });
  });

  describe('Recommendation Quality', () => {
    it('should generate relevant recommendations based on activity', async () => {
      const result = await pipeline.findMatches({
        nodeId: testNodeId,
        nodeType: 'job',
        userId: testUserId,
        limit: 10,
        includeActivitySignals: true,
        includeInsights: true,
      });

      if (result.recommendations && result.recommendations.length > 0) {
        // Recommendations should be strings with content
        result.recommendations.forEach(rec => {
          expect(typeof rec).toBe('string');
          expect(rec.length).toBeGreaterThan(0);
        });
      }
    });

    it('should provide actionable insights', async () => {
      const result = await pipeline.findMatches({
        nodeId: testNodeId,
        nodeType: 'job',
        userId: testUserId,
        limit: 10,
        includeActivitySignals: true,
        includeInsights: true,
      });

      expect(result.insights.length).toBeGreaterThan(0);

      result.insights.forEach(insight => {
        expect(insight.type).toMatch(/^(pattern|trend|tip|success-factor)$/);
        expect(insight.title).toBeTruthy();
        expect(insight.description).toBeTruthy();
        expect(insight.relevance).toBeGreaterThanOrEqual(0);
        expect(insight.relevance).toBeLessThanOrEqual(1);
      });
    });
  });
});