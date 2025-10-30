/**
 * GraphRAG Schema Tests
 * Tests for GraphRAG search and experience matching API schemas
 */

import { describe, expect, it } from 'vitest';

import {
  careerInsightSchema,
  experienceMatchSchema,
  getExperienceMatchesParamsSchema,
  getExperienceMatchesQuerySchema,
  graphragNodeInsightSchema,
  graphragSearchResponseSchema,
  matchedTimelineNodeSchema,
  searchProfilesRequestSchema,
} from '../graphrag.schemas';

// Constants
const MIN_LIMIT = 1;
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;
const MIN_SIMILARITY = 0;
const MAX_SIMILARITY = 1;

// Test data factories
const createValidSearchRequest = (
  overrides: Partial<{
    query: string;
    limit?: number;
    tenantId?: string;
    excludeUserId?: number;
    similarityThreshold?: number;
  }> = {}
) => ({
  query: 'software engineer with React experience',
  limit: DEFAULT_LIMIT,
  ...overrides,
});

const createValidNodeInsight = (
  overrides: Partial<{
    text: string;
    category: string;
  }> = {}
) => ({
  text: 'Built scalable microservices architecture',
  category: 'technical-achievement',
  ...overrides,
});

const createValidMatchedNode = (
  overrides: Partial<{
    id: string;
    type: string;
    meta: Record<string, any>;
    score: number;
    insights?: Array<{ text: string; category: string }>;
  }> = {}
) => ({
  id: '123e4567-e89b-12d3-a456-426614174000',
  type: 'job',
  meta: { role: 'Software Engineer', company: 'TechCorp' },
  score: 0.85,
  ...overrides,
});

const createValidCareerInsight = (
  overrides: Partial<{
    text: string;
    relevance: 'high' | 'medium';
    category: 'transition' | 'skill-building' | 'networking' | 'preparation';
  }> = {}
) => ({
  text: 'Successfully transitioned from backend to full-stack development',
  relevance: 'high' as const,
  category: 'transition' as const,
  ...overrides,
});

const createValidExperienceMatch = (
  overrides: Partial<{
    id: string;
    name: string;
    email: string;
    username?: string;
    currentRole?: string;
    company?: string;
    location?: string;
    matchScore: string;
    whyMatched: string[];
    skills: string[];
    matchedNodes: any[];
    careerInsights?: any[];
  }> = {}
) => ({
  id: '123',
  name: 'John Doe',
  email: 'john@example.com',
  matchScore: '85',
  whyMatched: ['React expertise', 'Similar career path'],
  skills: ['React', 'TypeScript', 'Node.js'],
  matchedNodes: [createValidMatchedNode()],
  ...overrides,
});

describe('GraphRAG Request Schemas', () => {
  describe('searchProfilesRequestSchema', () => {
    it('should validate valid search request', () => {
      const result = searchProfilesRequestSchema.safeParse(
        createValidSearchRequest()
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(DEFAULT_LIMIT);
      }
    });

    it('should apply default limit when not provided', () => {
      const result = searchProfilesRequestSchema.safeParse({
        query: 'software engineer',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(DEFAULT_LIMIT);
      }
    });

    it('should validate with all optional fields', () => {
      const result = searchProfilesRequestSchema.safeParse({
        query: 'software engineer',
        limit: 50,
        tenantId: 'tenant-123',
        excludeUserId: 42,
        similarityThreshold: 0.75,
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty query', () => {
      const result = searchProfilesRequestSchema.safeParse(
        createValidSearchRequest({ query: '' })
      );
      expect(result.success).toBe(false);
    });

    it('should reject limit below minimum', () => {
      const result = searchProfilesRequestSchema.safeParse(
        createValidSearchRequest({ limit: MIN_LIMIT - 1 })
      );
      expect(result.success).toBe(false);
    });

    it('should reject limit above maximum', () => {
      const result = searchProfilesRequestSchema.safeParse(
        createValidSearchRequest({ limit: MAX_LIMIT + 1 })
      );
      expect(result.success).toBe(false);
    });

    it('should validate limit at minimum boundary', () => {
      const result = searchProfilesRequestSchema.safeParse(
        createValidSearchRequest({ limit: MIN_LIMIT })
      );
      expect(result.success).toBe(true);
    });

    it('should validate limit at maximum boundary', () => {
      const result = searchProfilesRequestSchema.safeParse(
        createValidSearchRequest({ limit: MAX_LIMIT })
      );
      expect(result.success).toBe(true);
    });

    it('should reject non-integer limit', () => {
      const result = searchProfilesRequestSchema.safeParse(
        createValidSearchRequest({ limit: 10.5 })
      );
      expect(result.success).toBe(false);
    });

    it('should reject similarityThreshold below minimum', () => {
      const result = searchProfilesRequestSchema.safeParse(
        createValidSearchRequest({ similarityThreshold: MIN_SIMILARITY - 0.1 })
      );
      expect(result.success).toBe(false);
    });

    it('should reject similarityThreshold above maximum', () => {
      const result = searchProfilesRequestSchema.safeParse(
        createValidSearchRequest({ similarityThreshold: MAX_SIMILARITY + 0.1 })
      );
      expect(result.success).toBe(false);
    });

    it('should validate similarityThreshold at boundaries', () => {
      const resultMin = searchProfilesRequestSchema.safeParse(
        createValidSearchRequest({ similarityThreshold: MIN_SIMILARITY })
      );
      expect(resultMin.success).toBe(true);

      const resultMax = searchProfilesRequestSchema.safeParse(
        createValidSearchRequest({ similarityThreshold: MAX_SIMILARITY })
      );
      expect(resultMax.success).toBe(true);
    });

    it('should reject non-integer excludeUserId', () => {
      const result = searchProfilesRequestSchema.safeParse(
        createValidSearchRequest({ excludeUserId: 42.5 })
      );
      expect(result.success).toBe(false);
    });
  });

  describe('getExperienceMatchesParamsSchema', () => {
    it('should validate valid UUID', () => {
      const result = getExperienceMatchesParamsSchema.safeParse({
        nodeId: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID format', () => {
      const result = getExperienceMatchesParamsSchema.safeParse({
        nodeId: 'not-a-uuid',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty nodeId', () => {
      const result = getExperienceMatchesParamsSchema.safeParse({
        nodeId: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing nodeId', () => {
      const result = getExperienceMatchesParamsSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('getExperienceMatchesQuerySchema', () => {
    it('should transform "true" string to boolean true', () => {
      const result = getExperienceMatchesQuerySchema.safeParse({
        forceRefresh: 'true',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.forceRefresh).toBe(true);
      }
    });

    it('should transform "false" string to boolean false', () => {
      const result = getExperienceMatchesQuerySchema.safeParse({
        forceRefresh: 'false',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.forceRefresh).toBe(false);
      }
    });

    it('should transform any non-"true" string to false', () => {
      const result = getExperienceMatchesQuerySchema.safeParse({
        forceRefresh: 'anything-else',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.forceRefresh).toBe(false);
      }
    });

    it('should handle missing forceRefresh parameter', () => {
      const result = getExperienceMatchesQuerySchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });
});

describe('GraphRAG Response Schemas', () => {
  describe('graphragNodeInsightSchema', () => {
    it('should validate valid node insight', () => {
      const result = graphragNodeInsightSchema.safeParse(
        createValidNodeInsight()
      );
      expect(result.success).toBe(true);
    });

    it('should validate with empty category', () => {
      const result = graphragNodeInsightSchema.safeParse(
        createValidNodeInsight({ category: '' })
      );
      expect(result.success).toBe(true);
    });

    it('should reject missing text', () => {
      const result = graphragNodeInsightSchema.safeParse({
        category: 'technical',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing category', () => {
      const result = graphragNodeInsightSchema.safeParse({
        text: 'Some insight',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('matchedTimelineNodeSchema', () => {
    it('should validate valid matched node', () => {
      const result = matchedTimelineNodeSchema.safeParse(
        createValidMatchedNode()
      );
      expect(result.success).toBe(true);
    });

    it('should validate without insights', () => {
      const result = matchedTimelineNodeSchema.safeParse(
        createValidMatchedNode({ insights: undefined })
      );
      expect(result.success).toBe(true);
    });

    it('should validate with empty insights array', () => {
      const result = matchedTimelineNodeSchema.safeParse(
        createValidMatchedNode({ insights: [] })
      );
      expect(result.success).toBe(true);
    });

    it('should validate with multiple insights', () => {
      const result = matchedTimelineNodeSchema.safeParse(
        createValidMatchedNode({
          insights: [
            createValidNodeInsight(),
            createValidNodeInsight({
              text: 'Another insight',
              category: 'leadership',
            }),
          ],
        })
      );
      expect(result.success).toBe(true);
    });

    it('should validate with empty meta object', () => {
      const result = matchedTimelineNodeSchema.safeParse(
        createValidMatchedNode({ meta: {} })
      );
      expect(result.success).toBe(true);
    });

    it('should validate with complex meta object', () => {
      const result = matchedTimelineNodeSchema.safeParse(
        createValidMatchedNode({
          meta: {
            role: 'Senior Engineer',
            company: 'TechCorp',
            startDate: '2020-01-01',
            skills: ['React', 'Node.js'],
            nested: { key: 'value' },
          },
        })
      );
      expect(result.success).toBe(true);
    });

    it('should validate score at boundaries', () => {
      const resultZero = matchedTimelineNodeSchema.safeParse(
        createValidMatchedNode({ score: 0 })
      );
      expect(resultZero.success).toBe(true);

      const resultOne = matchedTimelineNodeSchema.safeParse(
        createValidMatchedNode({ score: 1 })
      );
      expect(resultOne.success).toBe(true);
    });

    it('should reject missing required fields', () => {
      const result = matchedTimelineNodeSchema.safeParse({
        id: '123',
        type: 'job',
        // Missing meta and score
      });
      expect(result.success).toBe(false);
    });
  });

  describe('careerInsightSchema', () => {
    it('should validate valid career insight', () => {
      const result = careerInsightSchema.safeParse(createValidCareerInsight());
      expect(result.success).toBe(true);
    });

    it('should validate all relevance levels', () => {
      const resultHigh = careerInsightSchema.safeParse(
        createValidCareerInsight({ relevance: 'high' })
      );
      expect(resultHigh.success).toBe(true);

      const resultMedium = careerInsightSchema.safeParse(
        createValidCareerInsight({ relevance: 'medium' })
      );
      expect(resultMedium.success).toBe(true);
    });

    it('should validate all category types', () => {
      const categories: Array<
        'transition' | 'skill-building' | 'networking' | 'preparation'
      > = ['transition', 'skill-building', 'networking', 'preparation'];

      categories.forEach((category) => {
        const result = careerInsightSchema.safeParse(
          createValidCareerInsight({ category })
        );
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid relevance', () => {
      const result = careerInsightSchema.safeParse({
        text: 'Some insight',
        relevance: 'low',
        category: 'transition',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid category', () => {
      const result = careerInsightSchema.safeParse({
        text: 'Some insight',
        relevance: 'high',
        category: 'invalid-category',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const result = careerInsightSchema.safeParse({
        text: 'Some insight',
        // Missing relevance and category
      });
      expect(result.success).toBe(false);
    });
  });

  describe('experienceMatchSchema', () => {
    it('should validate valid experience match', () => {
      const result = experienceMatchSchema.safeParse(
        createValidExperienceMatch()
      );
      expect(result.success).toBe(true);
    });

    it('should validate with all optional fields', () => {
      const result = experienceMatchSchema.safeParse(
        createValidExperienceMatch({
          username: 'johndoe',
          currentRole: 'Senior Engineer',
          company: 'TechCorp',
          location: 'San Francisco, CA',
          careerInsights: [createValidCareerInsight()],
        })
      );
      expect(result.success).toBe(true);
    });

    it('should validate without optional fields', () => {
      const result = experienceMatchSchema.safeParse(
        createValidExperienceMatch({
          username: undefined,
          currentRole: undefined,
          company: undefined,
          location: undefined,
          careerInsights: undefined,
        })
      );
      expect(result.success).toBe(true);
    });

    it('should validate with empty arrays', () => {
      const result = experienceMatchSchema.safeParse(
        createValidExperienceMatch({
          whyMatched: [],
          skills: [],
          matchedNodes: [],
          careerInsights: [],
        })
      );
      expect(result.success).toBe(true);
    });

    it('should validate with multiple matched nodes', () => {
      const result = experienceMatchSchema.safeParse(
        createValidExperienceMatch({
          matchedNodes: [
            createValidMatchedNode({ type: 'job' }),
            createValidMatchedNode({ type: 'project' }),
            createValidMatchedNode({ type: 'education' }),
          ],
        })
      );
      expect(result.success).toBe(true);
    });

    it('should validate with multiple career insights', () => {
      const result = experienceMatchSchema.safeParse(
        createValidExperienceMatch({
          careerInsights: [
            createValidCareerInsight({ category: 'transition' }),
            createValidCareerInsight({ category: 'skill-building' }),
            createValidCareerInsight({ category: 'networking' }),
          ],
        })
      );
      expect(result.success).toBe(true);
    });

    it('should reject missing required fields', () => {
      const result = experienceMatchSchema.safeParse({
        id: '123',
        name: 'John Doe',
        // Missing other required fields
      });
      expect(result.success).toBe(false);
    });
  });

  describe('graphragSearchResponseSchema', () => {
    it('should validate valid search response', () => {
      const validData = {
        results: [createValidExperienceMatch()],
        totalResults: 1,
        query: 'software engineer',
      };
      const result = graphragSearchResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate empty results', () => {
      const validData = {
        results: [],
        totalResults: 0,
        query: 'no matches',
      };
      const result = graphragSearchResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate multiple results', () => {
      const validData = {
        results: [
          createValidExperienceMatch({ id: '1' }),
          createValidExperienceMatch({ id: '2' }),
          createValidExperienceMatch({ id: '3' }),
        ],
        totalResults: 3,
        query: 'software engineer',
      };
      const result = graphragSearchResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject missing required fields', () => {
      const result = graphragSearchResponseSchema.safeParse({
        results: [createValidExperienceMatch()],
        // Missing totalResults and query
      });
      expect(result.success).toBe(false);
    });

    it('should reject non-array results', () => {
      const result = graphragSearchResponseSchema.safeParse({
        results: 'not-an-array',
        totalResults: 0,
        query: 'test',
      });
      expect(result.success).toBe(false);
    });

    it('should reject non-number totalResults', () => {
      const result = graphragSearchResponseSchema.safeParse({
        results: [],
        totalResults: '0',
        query: 'test',
      });
      expect(result.success).toBe(false);
    });
  });
});
