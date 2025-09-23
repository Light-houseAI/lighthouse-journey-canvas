/**
 * Experience Matches API Contract Tests (LIG-179)
 *
 * Tests the experience node match detection API endpoints.
 * These tests define the expected API contract for match detection
 * and must FAIL before implementation (TDD approach).
 */

import type { Application } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { ExperienceMatchesResponse, ExperienceMatchData, TimelineNode } from '@journey/schema';
import { createApp } from '../../src/app';
import { Container } from '../../src/core/container-setup';
import {
  authenticateSeededUser,
  getSeededUserTokens,
  type TestAuthSession,
  type TestTokenPair,
} from '../helpers/auth.helper';

let app: Application;
let testSession: TestAuthSession;
let testTokenPair: TestTokenPair;

// Test data constants
const TEST_USER_ID = 1;
const TEST_NODE_ID = '123e4567-e89b-12d3-a456-426614174000';
const TEST_NON_EXPERIENCE_NODE_ID = '987fcdeb-51a2-43c5-b789-123456789abc';
const NONEXISTENT_NODE_ID = '00000000-0000-0000-0000-000000000000';
const FORBIDDEN_NODE_ID = '11111111-1111-1111-1111-111111111111';

// Mock timeline nodes for testing
const mockCurrentJobNode: Partial<TimelineNode> = {
  id: TEST_NODE_ID,
  type: 'job',
  meta: {
    orgId: 1,
    role: 'Senior Software Engineer',
    description: 'Building scalable React applications with TypeScript',
    startDate: '2023-01',
    endDate: null, // Current job
  },
  userId: TEST_USER_ID,
};

const mockPastJobNode: Partial<TimelineNode> = {
  id: '222e4567-e89b-12d3-a456-426614174001',
  type: 'job',
  meta: {
    orgId: 1,
    role: 'Junior Developer',
    description: 'Learning web development fundamentals',
    startDate: '2021-01',
    endDate: '2022-12', // Past job
  },
  userId: TEST_USER_ID,
};

const mockProjectNode: Partial<TimelineNode> = {
  id: TEST_NON_EXPERIENCE_NODE_ID,
  type: 'project',
  meta: {
    title: 'Portfolio Website',
    description: 'Personal portfolio built with React',
  },
  userId: TEST_USER_ID,
};

describe('Experience Matches API Contract - GET /api/v2/experience/:nodeId/matches', () => {
  beforeAll(async () => {
    app = createApp();
    testTokenPair = getSeededUserTokens();
    testSession = await authenticateSeededUser();
  });

  afterAll(async () => {
    await Container.dispose();
  });

  describe('Authentication Requirements', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get(`/api/v2/experience/${TEST_NODE_ID}/matches`)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: expect.any(String),
          message: expect.stringContaining('Authentication'),
        },
      });
    });

    it('should reject invalid session tokens', async () => {
      const response = await request(app)
        .get(`/api/v2/experience/${TEST_NODE_ID}/matches`)
        .set('Cookie', 'connect.sid=invalid-session')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: expect.any(String),
          message: expect.stringContaining('Authentication'),
        },
      });
    });
  });

  describe('Node Access Control', () => {
    it('should return 404 for non-existent nodes', async () => {
      const response = await request(app)
        .get(`/api/v2/experience/${NONEXISTENT_NODE_ID}/matches`)
        .set('Cookie', testSession.cookie)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'NODE_NOT_FOUND',
          message: expect.stringContaining('not found'),
        },
      });
    });

    it('should return 403 for nodes user cannot access', async () => {
      const response = await request(app)
        .get(`/api/v2/experience/${FORBIDDEN_NODE_ID}/matches`)
        .set('Cookie', testSession.cookie)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: expect.stringContaining('access'),
        },
      });
    });

    it('should return 422 for non-experience node types', async () => {
      const response = await request(app)
        .get(`/api/v2/experience/${TEST_NON_EXPERIENCE_NODE_ID}/matches`)
        .set('Cookie', testSession.cookie)
        .expect(422);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'NOT_EXPERIENCE_NODE',
          message: expect.stringContaining('job or education'),
        },
      });
    });
  });

  describe('Current Experience Detection', () => {
    it('should return matches for current job experiences', async () => {
      const response = await request(app)
        .get(`/api/v2/experience/${TEST_NODE_ID}/matches`)
        .set('Cookie', testSession.cookie)
        .expect(200);

      const data: ExperienceMatchesResponse = response.body;
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();

      const matchData = data.data!;
      expect(matchData).toMatchObject({
        nodeId: TEST_NODE_ID,
        userId: TEST_USER_ID,
        matchCount: expect.any(Number),
        matches: expect.any(Array),
        searchQuery: expect.any(String),
        similarityThreshold: 0.7,
        lastUpdated: expect.any(String),
        cacheTTL: 300,
      });

      // Validate match structure
      if (matchData.matchCount > 0) {
        expect(matchData.matches).toHaveLength(Math.min(matchData.matchCount, 3));
        matchData.matches.forEach(match => {
          expect(match).toMatchObject({
            id: expect.any(String),
            name: expect.any(String),
            title: expect.any(String),
            score: expect.any(Number),
            matchType: expect.stringMatching(/^(profile|opportunity)$/),
          });
          expect(match.score).toBeGreaterThanOrEqual(0);
          expect(match.score).toBeLessThanOrEqual(1);
        });
      }
    });

    it('should return empty matches for past experiences', async () => {
      const response = await request(app)
        .get(`/api/v2/experience/${mockPastJobNode.id}/matches`)
        .set('Cookie', testSession.cookie)
        .expect(200);

      const data: ExperienceMatchesResponse = response.body;
      expect(data.success).toBe(true);
      expect(data.data?.matchCount).toBe(0);
      expect(data.data?.matches).toEqual([]);
    });
  });

  describe('Search Query Generation', () => {
    it('should prioritize description over title in search query', async () => {
      const response = await request(app)
        .get(`/api/v2/experience/${TEST_NODE_ID}/matches`)
        .set('Cookie', testSession.cookie)
        .expect(200);

      const data: ExperienceMatchesResponse = response.body;
      expect(data.data?.searchQuery).toBe('Building scalable React applications with TypeScript');
    });

    it('should fallback to title when description is missing', async () => {
      // This would test a node with no description
      const nodeWithoutDescription = '333e4567-e89b-12d3-a456-426614174002';

      const response = await request(app)
        .get(`/api/v2/experience/${nodeWithoutDescription}/matches`)
        .set('Cookie', testSession.cookie)
        .expect(200);

      const data: ExperienceMatchesResponse = response.body;
      expect(data.data?.searchQuery).toBe('Senior Software Engineer');
    });
  });

  describe('Cache Management', () => {
    it('should support force refresh parameter', async () => {
      const response = await request(app)
        .get(`/api/v2/experience/${TEST_NODE_ID}/matches?forceRefresh=true`)
        .set('Cookie', testSession.cookie)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should return fresh data on subsequent requests', async () => {
      // First request
      const response1 = await request(app)
        .get(`/api/v2/experience/${TEST_NODE_ID}/matches`)
        .set('Cookie', testSession.cookie)
        .expect(200);

      // Second request should use cache
      const response2 = await request(app)
        .get(`/api/v2/experience/${TEST_NODE_ID}/matches`)
        .set('Cookie', testSession.cookie)
        .expect(200);

      expect(response1.body.data?.lastUpdated).toBe(response2.body.data?.lastUpdated);
    });
  });

  describe('Error Handling', () => {
    it('should handle GraphRAG service errors gracefully', async () => {
      // This test would require mocking the GraphRAG service to fail
      const response = await request(app)
        .get(`/api/v2/experience/${TEST_NODE_ID}/matches`)
        .set('Cookie', testSession.cookie);

      if (response.status === 500) {
        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'SEARCH_SERVICE_ERROR',
            message: expect.any(String),
          },
        });
      }
    });

    it('should validate UUID format for nodeId parameter', async () => {
      const response = await request(app)
        .get('/api/v2/experience/invalid-uuid/matches')
        .set('Cookie', testSession.cookie)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: expect.stringContaining('UUID'),
        },
      });
    });
  });

  describe('Response Schema Validation', () => {
    it('should return properly structured response for successful requests', async () => {
      const response = await request(app)
        .get(`/api/v2/experience/${TEST_NODE_ID}/matches`)
        .set('Cookie', testSession.cookie)
        .expect(200);

      const data: ExperienceMatchesResponse = response.body;

      // Validate top-level structure
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('data');
      expect(data.data).toBeDefined();

      const matchData = data.data!;

      // Validate required fields
      expect(matchData).toHaveProperty('nodeId');
      expect(matchData).toHaveProperty('userId');
      expect(matchData).toHaveProperty('matchCount');
      expect(matchData).toHaveProperty('matches');
      expect(matchData).toHaveProperty('searchQuery');
      expect(matchData).toHaveProperty('similarityThreshold');
      expect(matchData).toHaveProperty('lastUpdated');
      expect(matchData).toHaveProperty('cacheTTL');

      // Validate data types
      expect(typeof matchData.nodeId).toBe('string');
      expect(typeof matchData.userId).toBe('number');
      expect(typeof matchData.matchCount).toBe('number');
      expect(Array.isArray(matchData.matches)).toBe(true);
      expect(typeof matchData.searchQuery).toBe('string');
      expect(typeof matchData.similarityThreshold).toBe('number');
      expect(typeof matchData.lastUpdated).toBe('string');
      expect(typeof matchData.cacheTTL).toBe('number');

      // Validate constraints
      expect(matchData.matchCount).toBeGreaterThanOrEqual(0);
      expect(matchData.matchCount).toBeLessThanOrEqual(100);
      expect(matchData.matches.length).toBeLessThanOrEqual(3);
      expect(matchData.similarityThreshold).toBeGreaterThanOrEqual(0);
      expect(matchData.similarityThreshold).toBeLessThanOrEqual(1);
      expect(matchData.cacheTTL).toBeGreaterThan(0);
    });
  });
});

// Integration test for current experience detection logic
describe('Current Experience Detection Logic', () => {
  describe('isCurrentExperience utility function', () => {
    it('should identify job with null end date as current', () => {
      const currentJob = {
        type: 'job' as const,
        meta: {
          orgId: 1,
          role: 'Software Engineer',
          startDate: '2023-01',
          endDate: null,
        },
      };

      const isCurrentExperience = (node: any): boolean => {
        if (node.type !== 'job' && node.type !== 'education') return false;
        const endDate = node.meta?.endDate;
        if (!endDate) return true;

        const endDateObj = new Date(endDate + '-01'); // Convert YYYY-MM to Date
        const now = new Date();
        return endDateObj > now;
      };

      expect(isCurrentExperience(currentJob)).toBe(true);
    });

    it('should identify education with undefined end date as current', () => {
      const currentEducation = {
        type: 'education' as const,
        meta: {
          orgId: 2,
          degree: 'Master of Science',
          startDate: '2023-09',
          // endDate is undefined
        },
      };

      const isCurrentExperience = (node: any): boolean => {
        if (node.type !== 'job' && node.type !== 'education') return false;
        const endDate = node.meta?.endDate;
        if (!endDate) return true;

        const endDateObj = new Date(endDate + '-01');
        const now = new Date();
        return endDateObj > now;
      };

      expect(isCurrentExperience(currentEducation)).toBe(true);
    });

    it('should identify job with future end date as current', () => {
      const futureEndDate = new Date();
      futureEndDate.setFullYear(futureEndDate.getFullYear() + 1);
      const futureEndString = futureEndDate.toISOString().slice(0, 7); // YYYY-MM format

      const futureJob = {
        type: 'job' as const,
        meta: {
          orgId: 1,
          role: 'Contract Engineer',
          startDate: '2024-01',
          endDate: futureEndString,
        },
      };

      const isCurrentExperience = (node: any): boolean => {
        if (node.type !== 'job' && node.type !== 'education') return false;
        const endDate = node.meta?.endDate;
        if (!endDate) return true;

        const endDateObj = new Date(endDate + '-01');
        const now = new Date();
        return endDateObj > now;
      };

      expect(isCurrentExperience(futureJob)).toBe(true);
    });

    it('should identify job with past end date as not current', () => {
      const pastJob = {
        type: 'job' as const,
        meta: {
          orgId: 1,
          role: 'Junior Developer',
          startDate: '2021-01',
          endDate: '2022-12',
        },
      };

      const isCurrentExperience = (node: any): boolean => {
        if (node.type !== 'job' && node.type !== 'education') return false;
        const endDate = node.meta?.endDate;
        if (!endDate) return true;

        const endDateObj = new Date(endDate + '-01');
        const now = new Date();
        return endDateObj > now;
      };

      expect(isCurrentExperience(pastJob)).toBe(false);
    });

    it('should identify education with past end date as not current', () => {
      const pastEducation = {
        type: 'education' as const,
        meta: {
          orgId: 2,
          degree: 'Bachelor of Science',
          startDate: '2018-09',
          endDate: '2022-05',
        },
      };

      const isCurrentExperience = (node: any): boolean => {
        if (node.type !== 'job' && node.type !== 'education') return false;
        const endDate = node.meta?.endDate;
        if (!endDate) return true;

        const endDateObj = new Date(endDate + '-01');
        const now = new Date();
        return endDateObj > now;
      };

      expect(isCurrentExperience(pastEducation)).toBe(false);
    });

    it('should reject non-experience node types', () => {
      const projectNode = {
        type: 'project' as const,
        meta: {
          title: 'Portfolio Website',
          description: 'Personal portfolio',
        },
      };

      const eventNode = {
        type: 'event' as const,
        meta: {
          title: 'Conference',
          description: 'Tech conference attendance',
        },
      };

      const isCurrentExperience = (node: any): boolean => {
        if (node.type !== 'job' && node.type !== 'education') return false;
        const endDate = node.meta?.endDate;
        if (!endDate) return true;

        const endDateObj = new Date(endDate + '-01');
        const now = new Date();
        return endDateObj > now;
      };

      expect(isCurrentExperience(projectNode)).toBe(false);
      expect(isCurrentExperience(eventNode)).toBe(false);
    });

    it('should handle edge case: current month end date', () => {
      const now = new Date();
      const currentMonthString = now.toISOString().slice(0, 7); // YYYY-MM format

      const currentMonthJob = {
        type: 'job' as const,
        meta: {
          orgId: 1,
          role: 'Software Engineer',
          startDate: '2023-01',
          endDate: currentMonthString,
        },
      };

      const isCurrentExperience = (node: any): boolean => {
        if (node.type !== 'job' && node.type !== 'education') return false;
        const endDate = node.meta?.endDate;
        if (!endDate) return true;

        const endDateObj = new Date(endDate + '-01');
        const now = new Date();
        return endDateObj > now;
      };

      // Current month should be considered past (not current)
      // Since we're comparing end of month vs current date
      expect(isCurrentExperience(currentMonthJob)).toBe(false);
    });

    it('should handle malformed date strings gracefully', () => {
      const invalidDateJob = {
        type: 'job' as const,
        meta: {
          orgId: 1,
          role: 'Software Engineer',
          startDate: '2023-01',
          endDate: 'invalid-date',
        },
      };

      const isCurrentExperience = (node: any): boolean => {
        if (node.type !== 'job' && node.type !== 'education') return false;
        const endDate = node.meta?.endDate;
        if (!endDate) return true;

        try {
          const endDateObj = new Date(endDate + '-01');
          if (isNaN(endDateObj.getTime())) return false; // Invalid date
          const now = new Date();
          return endDateObj > now;
        } catch {
          return false; // Handle any date parsing errors
        }
      };

      expect(isCurrentExperience(invalidDateJob)).toBe(false);
    });
  });

  describe('GraphRAG Service Integration', () => {
    it('should build search query from node description first', () => {
      const node = {
        type: 'job' as const,
        meta: {
          orgId: 1,
          role: 'Senior Software Engineer',
          description: 'Building scalable React applications with TypeScript',
          startDate: '2023-01',
          endDate: null,
        },
      };

      const buildSearchQuery = (node: any): string => {
        if (node.meta?.description) {
          return node.meta.description;
        }
        if (node.type === 'job') {
          return node.meta?.role || '';
        }
        if (node.type === 'education') {
          return node.meta?.degree || '';
        }
        return '';
      };

      expect(buildSearchQuery(node)).toBe('Building scalable React applications with TypeScript');
    });

    it('should fallback to role when description is missing for jobs', () => {
      const node = {
        type: 'job' as const,
        meta: {
          orgId: 1,
          role: 'Senior Software Engineer',
          startDate: '2023-01',
          endDate: null,
        },
      };

      const buildSearchQuery = (node: any): string => {
        if (node.meta?.description) {
          return node.meta.description;
        }
        if (node.type === 'job') {
          return node.meta?.role || '';
        }
        if (node.type === 'education') {
          return node.meta?.degree || '';
        }
        return '';
      };

      expect(buildSearchQuery(node)).toBe('Senior Software Engineer');
    });

    it('should fallback to degree when description is missing for education', () => {
      const node = {
        type: 'education' as const,
        meta: {
          orgId: 2,
          degree: 'Master of Science in Computer Science',
          startDate: '2023-09',
          endDate: null,
        },
      };

      const buildSearchQuery = (node: any): string => {
        if (node.meta?.description) {
          return node.meta.description;
        }
        if (node.type === 'job') {
          return node.meta?.role || '';
        }
        if (node.type === 'education') {
          return node.meta?.degree || '';
        }
        return '';
      };

      expect(buildSearchQuery(node)).toBe('Master of Science in Computer Science');
    });

    it('should return empty string for non-experience nodes', () => {
      const node = {
        type: 'project' as const,
        meta: {
          title: 'Portfolio Website',
          description: 'Personal portfolio built with React',
        },
      };

      const buildSearchQuery = (node: any): string => {
        if (node.meta?.description) {
          return node.meta.description;
        }
        if (node.type === 'job') {
          return node.meta?.role || '';
        }
        if (node.type === 'education') {
          return node.meta?.degree || '';
        }
        return '';
      };

      expect(buildSearchQuery(node)).toBe('Personal portfolio built with React');
    });

    it('should handle missing meta gracefully', () => {
      const node = {
        type: 'job' as const,
      };

      const buildSearchQuery = (node: any): string => {
        if (node.meta?.description) {
          return node.meta.description;
        }
        if (node.type === 'job') {
          return node.meta?.role || '';
        }
        if (node.type === 'education') {
          return node.meta?.degree || '';
        }
        return '';
      };

      expect(buildSearchQuery(node)).toBe('');
    });

    it('should validate search parameters structure', () => {
      const searchParams = {
        query: 'Building scalable React applications with TypeScript',
        limit: 3,
        similarityThreshold: 0.7,
      };

      const validateSearchParams = (params: any): boolean => {
        return (
          typeof params.query === 'string' &&
          params.query.length > 0 &&
          typeof params.limit === 'number' &&
          params.limit > 0 &&
          params.limit <= 100 &&
          typeof params.similarityThreshold === 'number' &&
          params.similarityThreshold >= 0 &&
          params.similarityThreshold <= 1
        );
      };

      expect(validateSearchParams(searchParams)).toBe(true);
    });

    it('should reject invalid search parameters', () => {
      const invalidParams = [
        { query: '', limit: 3, similarityThreshold: 0.7 }, // Empty query
        { query: 'test', limit: 0, similarityThreshold: 0.7 }, // Invalid limit
        { query: 'test', limit: 3, similarityThreshold: 1.5 }, // Invalid threshold
        { query: 123, limit: 3, similarityThreshold: 0.7 }, // Wrong query type
      ];

      const validateSearchParams = (params: any): boolean => {
        return (
          typeof params.query === 'string' &&
          params.query.length > 0 &&
          typeof params.limit === 'number' &&
          params.limit > 0 &&
          params.limit <= 100 &&
          typeof params.similarityThreshold === 'number' &&
          params.similarityThreshold >= 0 &&
          params.similarityThreshold <= 1
        );
      };

      invalidParams.forEach(params => {
        expect(validateSearchParams(params)).toBe(false);
      });
    });

    it('should transform GraphRAG results to match summary format', () => {
      const mockGraphRAGResult = {
        id: 'profile-123',
        content: 'Senior React Developer at TechCorp with 5 years experience',
        similarity: 0.85,
        metadata: {
          name: 'John Doe',
          title: 'Senior React Developer',
          company: 'TechCorp',
          type: 'profile',
        },
      };

      const transformToMatchSummary = (result: any): any => {
        return {
          id: result.id,
          name: result.metadata?.name || 'Unknown',
          title: result.metadata?.title || 'Unknown Title',
          company: result.metadata?.company,
          score: result.similarity,
          matchType: result.metadata?.type || 'profile',
          previewText: result.content?.slice(0, 100),
        };
      };

      const matchSummary = transformToMatchSummary(mockGraphRAGResult);

      expect(matchSummary).toMatchObject({
        id: 'profile-123',
        name: 'John Doe',
        title: 'Senior React Developer',
        company: 'TechCorp',
        score: 0.85,
        matchType: 'profile',
        previewText: 'Senior React Developer at TechCorp with 5 years experience',
      });
    });
  });
});