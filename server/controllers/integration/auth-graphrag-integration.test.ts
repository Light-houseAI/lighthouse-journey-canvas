/**
 * Authentication + GraphRAG Search Integration Tests
 * 
 * Comprehensive integration test suite following AAA pattern with real service workflow.
 * Tests the complete authentication → GraphRAG search pipeline using production-like scenarios.
 * 
 * Test Architecture:
 * 1. Authentication Service Tests - JWT token management and validation
 * 2. GraphRAG Search Integration - Authenticated search workflows with real data
 * 3. Security & Authorization - Token validation and access control
 * 4. Error Handling & Edge Cases - Comprehensive error scenarios
 * 5. End-to-End Workflows - Complete user journey validation
 * 
 * Follows advanced integration testing patterns from project memory:
 * - AAA pattern with real service integration
 * - Production-realistic test data generation
 * - Complete workflow testing with proper setup/teardown
 * - Cross-service validation and state management
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { TimelineNodeType } from '../../../shared/enums';
import { createTestApp, createServer } from '../../index';
import type { Server } from 'http';

// ===== TYPE DEFINITIONS =====

interface TestUser {
  email: string;
  password: string;
}

interface AuthResponse {
  success: boolean;
  accessToken: string;
  refreshToken: string;
  user: {
    id: number;
    email: string;
    firstName: string | null;
    lastName: string | null;
    userName: string;
    interest: string;
    hasCompletedOnboarding: boolean;
  };
}

interface GraphRAGSearchResponse {
  query: string;
  totalResults: number;
  profiles: ProfileResult[];
  timestamp: string;
}

interface ProfileResult {
  id: string;
  name: string;
  email: string;
  currentRole?: string;
  company?: string;
  matchScore: string;
  whyMatched: string[];
  skills: string[];
  matchedNodes: MatchedNode[];
  insightsSummary?: string[];
}

interface MatchedNode {
  id: string;
  type: string;
  title: string;
  content: string;
  similarity: number;
}

// ===== TEST SUITE CONFIGURATION =====

describe('Authentication + GraphRAG Integration Tests', () => {
  const BASE_URL = 'http://localhost:5004';
  const TEST_CREDENTIALS: TestUser = {
    email: 'test-user-1@example.com',
    password: 'test123'
  };

  // Shared test state - managed across test suites
  let sharedAccessToken: string;
  const createdNodeIds: string[] = [];

  // ===== SHARED TEST UTILITIES =====

  /**
   * AAA Pattern Helper: Arrange - Get fresh authentication token
   * Follows real service integration pattern from memory
   */
  async function authenticateUser(): Promise<string> {
    const response = await fetch(`${BASE_URL}/api/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_CREDENTIALS),
    });

    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.status}`);
    }

    const authResult: AuthResponse = await response.json();
    return authResult.accessToken;
  }

  /**
   * AAA Pattern Helper: Arrange - Create realistic test timeline data
   * Uses real service workflow pattern from memory
   */
  async function createTestTimelineData(accessToken: string): Promise<string[]> {
    const nodeIds: string[] = [];

    // Create a job node with React experience (realistic professional data)
    const jobNode = {
      type: TimelineNodeType.Job,
      title: 'Senior Software Engineer',
      description: 'Developed large-scale React applications with TypeScript and Node.js. Led frontend architecture decisions and mentored junior developers.',
      meta: {
        company: 'TechCorp Inc',
        position: 'Senior Software Engineer',
        location: 'San Francisco, CA',
        startDate: '2022-01',
        endDate: '2024-01',
        skills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'GraphQL']
      }
    };

    const jobResponse = await fetch(`${BASE_URL}/api/v2/timeline/nodes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(jobNode),
    });

    if (jobResponse.ok) {
      const jobResult = await jobResponse.json();
      nodeIds.push(jobResult.node.id);
    }

    // Create a project node with distributed systems experience
    const projectNode = {
      type: TimelineNodeType.Project,
      title: 'Microservices Architecture Migration',
      description: 'Designed and implemented a distributed microservices architecture using Docker, Kubernetes, and event-driven patterns. Improved system scalability by 300%.',
      meta: {
        technologies: ['Docker', 'Kubernetes', 'Redis', 'RabbitMQ', 'PostgreSQL'],
        projectType: 'professional',
        startDate: '2023-03',
        endDate: '2023-09'
      }
    };

    const projectResponse = await fetch(`${BASE_URL}/api/v2/timeline/nodes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(projectNode),
    });

    if (projectResponse.ok) {
      const projectResult = await projectResponse.json();
      nodeIds.push(projectResult.node.id);
    }

    // Allow time for potential vector processing
    await new Promise(resolve => setTimeout(resolve, 1000));

    return nodeIds;
  }

  /**
   * AAA Pattern Helper: Cleanup - Remove created test data
   * Follows proper cleanup pattern from memory
   */
  async function cleanupTestData(accessToken: string, nodeIds: string[]): Promise<void> {
    for (const nodeId of nodeIds) {
      try {
        await fetch(`${BASE_URL}/api/v2/timeline/nodes/${nodeId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
      } catch (error) {
        // Ignore cleanup errors - test isolation is more important
      }
    }
  }

  // ===== GLOBAL SETUP & TEARDOWN =====

  beforeAll(async () => {
    // Verify server availability before running tests
    try {
      await fetch(`${BASE_URL}/health`).catch(() => {
        console.warn('⚠️ Server health check failed - ensure server is running on port 5004');
      });
    } catch (error) {
      console.log('Server will be tested during actual requests');
    }

    // Pre-authenticate for shared use across test suites
    try {
      sharedAccessToken = await authenticateUser();
    } catch (error) {
      console.warn('⚠️ Pre-authentication failed - individual tests will handle authentication');
    }
  });

  afterAll(async () => {
    // Global cleanup of any remaining test data
    if (sharedAccessToken && createdNodeIds.length > 0) {
      await cleanupTestData(sharedAccessToken, createdNodeIds);
    }
  });

  // ===== 1. AUTHENTICATION SERVICE TESTS =====

  describe('Authentication Service', () => {
    describe('Successful Authentication', () => {
      it('should authenticate user and return valid JWT tokens', async () => {
        // 🔧 ARRANGE - Prepare valid credentials
        const credentials = TEST_CREDENTIALS;

        // ⚡ ACT - Perform authentication
        const response = await fetch(`${BASE_URL}/api/auth/signin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(credentials),
        });

        // ✅ ASSERT - Verify complete authentication response
        expect(response.ok).toBe(true);
        expect(response.status).toBe(200);

        const authResult: AuthResponse = await response.json();

        // Verify response structure
        expect(authResult.success).toBe(true);
        expect(authResult.accessToken).toBeTypeOf('string');
        expect(authResult.refreshToken).toBeTypeOf('string');
        
        // Verify user data structure
        expect(authResult.user).toEqual(
          expect.objectContaining({
            id: expect.any(Number),
            email: credentials.email,
            userName: expect.any(String),
          })
        );

        // Verify JWT token format (header.payload.signature)
        expect(authResult.accessToken.split('.')).toHaveLength(3);
        expect(authResult.refreshToken.split('.')).toHaveLength(3);
      });
    });

    describe('Authentication Failures', () => {
      it('should reject invalid credentials with proper error response', async () => {
        // 🔧 ARRANGE - Prepare invalid credentials
        const invalidCredentials = {
          email: TEST_CREDENTIALS.email,
          password: 'wrong-password'
        };

        // ⚡ ACT - Attempt authentication with invalid credentials
        const response = await fetch(`${BASE_URL}/api/auth/signin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidCredentials),
        });

        // ✅ ASSERT - Verify rejection with appropriate error
        expect(response.ok).toBe(false);
        expect(response.status).toBe(401);

        const errorResult = await response.json();
        expect(errorResult.success).toBe(false);
        expect(errorResult.error).toContain('Invalid email or password');
      });

      it.each([
        { scenario: 'missing email', data: { email: '', password: 'test123' } },
        { scenario: 'missing password', data: { email: TEST_CREDENTIALS.email, password: '' } },
        { scenario: 'invalid email format', data: { email: 'invalid-email', password: 'test123' } },
        { scenario: 'empty payload', data: {} }
      ])('should validate required fields: $scenario', async ({ data }) => {
        // 🔧 ARRANGE - Test case data provided by parameterization

        // ⚡ ACT - Attempt authentication with invalid data
        const response = await fetch(`${BASE_URL}/api/auth/signin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        // ✅ ASSERT - Verify validation failure
        expect(response.ok).toBe(false);
        expect(response.status).toBe(400);
      });
    });
  });

  // ===== 2. GRAPHRAG SEARCH INTEGRATION TESTS =====

  describe('GraphRAG Search Integration', () => {
    let accessToken: string;
    let testNodeIds: string[];

    beforeEach(async () => {
      // 🔧 ARRANGE - Set up authenticated session with test data
      accessToken = await authenticateUser();
      testNodeIds = await createTestTimelineData(accessToken);
      createdNodeIds.push(...testNodeIds);
    });

    afterEach(async () => {
      // 🧹 CLEANUP - Remove test data to maintain test isolation
      await cleanupTestData(accessToken, testNodeIds);
      // Remove from global tracking
      testNodeIds.forEach(id => {
        const index = createdNodeIds.indexOf(id);
        if (index > -1) createdNodeIds.splice(index, 1);
      });
    });

    describe('Search Response Structure Validation', () => {
      it('should return properly structured search results matching PRD specification', async () => {
        // 🔧 ARRANGE - Prepare search query for realistic skill matching
        const searchQuery = {
          query: 'software engineer with React experience',
          limit: 10
        };

        // ⚡ ACT - Perform authenticated GraphRAG search
        const response = await fetch(`${BASE_URL}/api/v2/graphrag/search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify(searchQuery),
        });

        // ✅ ASSERT - Verify response structure and data quality
        expect(response.ok).toBe(true);
        expect(response.status).toBe(200);

        const searchResult: GraphRAGSearchResponse = await response.json();
        
        // Verify top-level response structure (PRD specification)
        expect(searchResult).toEqual(
          expect.objectContaining({
            query: searchQuery.query,
            totalResults: expect.any(Number),
            profiles: expect.any(Array),
            timestamp: expect.any(String),
          })
        );

        // If profiles are found, validate ProfileResult structure
        if (searchResult.profiles.length > 0) {
          const profile = searchResult.profiles[0];
          
          expect(profile).toEqual(
            expect.objectContaining({
              id: expect.any(String),
              name: expect.any(String),
              email: expect.any(String),
              matchScore: expect.any(String),
              whyMatched: expect.any(Array),
              skills: expect.any(Array),
              matchedNodes: expect.any(Array),
            })
          );

          // Verify match score format (should be percentage)
          expect(profile.matchScore).toMatch(/^\d+\.\d+$/);
          
          // Verify whyMatched contains meaningful reasons
          expect(profile.whyMatched.length).toBeGreaterThanOrEqual(1);
          profile.whyMatched.forEach(reason => {
            expect(typeof reason).toBe('string');
            expect(reason.length).toBeGreaterThan(0);
          });

          // Verify skills array contains relevant skills
          expect(profile.skills.length).toBeGreaterThanOrEqual(1);
          profile.skills.forEach(skill => {
            expect(typeof skill).toBe('string');
            expect(skill.length).toBeGreaterThan(0);
          });

          // Verify matched nodes structure if present
          if (profile.matchedNodes.length > 0) {
            const matchedNode = profile.matchedNodes[0];
            expect(matchedNode).toEqual(
              expect.objectContaining({
                id: expect.any(String),
                type: expect.any(String),
                meta: expect.any(Object),
                score: expect.any(Number),
                insights: expect.any(Array),
              })
            );
            
            // Verify similarity score is normalized (0-1 range)
            expect(matchedNode.score).toBeGreaterThanOrEqual(0);
            expect(matchedNode.score).toBeLessThanOrEqual(1);
          }
        }
      });
    });

    describe('Skill-Based Search Scenarios', () => {
      it('should find React-related profiles when searching for frontend skills', async () => {
        // 🔧 ARRANGE - Search query targeting React skills from test data
        const searchQuery = {
          query: 'React TypeScript frontend development',
          limit: 5
        };

        // ⚡ ACT - Perform skill-targeted search
        const response = await fetch(`${BASE_URL}/api/v2/graphrag/search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify(searchQuery),
        });

        // ✅ ASSERT - Verify React skills are matched and highlighted
        expect(response.ok).toBe(true);
        const searchResult: GraphRAGSearchResponse = await response.json();
        
        if (searchResult.profiles.length > 0) {
          const profile = searchResult.profiles[0];
          
          // Should include React in skills or match reasons
          const hasReactSkill = profile.skills.some(skill => 
            skill.toLowerCase().includes('react')
          );
          const hasReactReason = profile.whyMatched.some(reason => 
            reason.toLowerCase().includes('react')
          );
          
          expect(hasReactSkill || hasReactReason).toBe(true);
        }
      });

      it('should find architecture profiles when searching for distributed systems', async () => {
        // 🔧 ARRANGE - Search query targeting architecture skills from test data
        const searchQuery = {
          query: 'distributed systems microservices architecture',
          limit: 5
        };

        // ⚡ ACT - Perform architecture-focused search
        const response = await fetch(`${BASE_URL}/api/v2/graphrag/search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify(searchQuery),
        });

        // ✅ ASSERT - Verify architecture skills are matched
        expect(response.ok).toBe(true);
        const searchResult: GraphRAGSearchResponse = await response.json();
        
        if (searchResult.profiles.length > 0) {
          const profile = searchResult.profiles[0];
          
          // Should include architecture-related content
          const hasArchitectureContent = 
            profile.skills.some(skill => 
              skill.toLowerCase().includes('kubernetes') || 
              skill.toLowerCase().includes('docker') ||
              skill.toLowerCase().includes('microservices')
            ) ||
            profile.whyMatched.some(reason => 
              reason.toLowerCase().includes('architecture') ||
              reason.toLowerCase().includes('distributed') ||
              reason.toLowerCase().includes('microservices')
            );
          
          expect(hasArchitectureContent).toBe(true);
        }
      });
    });

    describe('Search Parameter Validation', () => {
      it.each([
        { query: 'typescript developer', limit: 5, similarityThreshold: 0.7 },
        { query: 'project manager', limit: 20, similarityThreshold: 0.3 },
        { query: 'data scientist python', limit: 15, similarityThreshold: 0.6 }
      ])('should handle various search parameters: $query', async (searchParams) => {
        // 🔧 ARRANGE - Parameterized search configurations

        // ⚡ ACT - Perform search with different parameter combinations
        const response = await fetch(`${BASE_URL}/api/v2/graphrag/search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify(searchParams),
        });

        // ✅ ASSERT - Verify parameter handling
        expect(response.ok).toBe(true);
        
        const searchResult: GraphRAGSearchResponse = await response.json();
        expect(searchResult.query).toBe(searchParams.query);
        expect(searchResult.profiles).toBeInstanceOf(Array);
      });

      it.each([
        { scenario: 'missing query', payload: {} },
        { scenario: 'empty query', payload: { query: '' } },
        { scenario: 'negative limit', payload: { query: 'test', limit: -1 } },
        { scenario: 'zero limit', payload: { query: 'test', limit: 0 } }
      ])('should validate search request payload: $scenario', async ({ payload }) => {
        // 🔧 ARRANGE - Invalid payload provided by parameterization

        // ⚡ ACT - Attempt search with invalid parameters
        const response = await fetch(`${BASE_URL}/api/v2/graphrag/search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify(payload),
        });

        // ✅ ASSERT - Verify validation failure
        expect(response.status).toBe(400);
      });
    });
  });

  // ===== 3. SECURITY & AUTHORIZATION TESTS =====

  describe('Security & Authorization', () => {
    describe('Missing Authorization', () => {
      it('should reject requests without authorization header', async () => {
        // 🔧 ARRANGE - Request without authorization

        // ⚡ ACT - Attempt GraphRAG search without authentication
        const response = await fetch(`${BASE_URL}/api/v2/graphrag/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'test query' }),
        });

        // ✅ ASSERT - Verify authentication requirement
        expect(response.status).toBe(401);
        
        const errorResult = await response.json();
        expect(errorResult).toEqual(
          expect.objectContaining({
            success: false,
            error: expect.objectContaining({
              code: expect.any(String),
            })
          })
        );
      });
    });

    describe('Invalid Token Formats', () => {
      it.each([
        'invalid-token',
        'Bearer',
        'Bearer ',
        'Bearer invalid-token-format',
        'Basic dGVzdDp0ZXN0', // Wrong auth type
      ])('should reject malformed authorization header: %s', async (invalidToken) => {
        // 🔧 ARRANGE - Various invalid token formats

        // ⚡ ACT - Attempt request with malformed token
        const response = await fetch(`${BASE_URL}/api/v2/graphrag/search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': invalidToken
          },
          body: JSON.stringify({ query: 'test query' }),
        });

        // ✅ ASSERT - Verify token format validation
        expect(response.status).toBe(401);
      });
    });

    describe('Token Validity', () => {
      it('should reject expired or invalid JWT tokens', async () => {
        // 🔧 ARRANGE - Crafted expired/invalid token
        const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsImlhdCI6MTYwMDAwMDAwMCwiZXhwIjoxNjAwMDAwMDAwfQ.invalid';
        
        // ⚡ ACT - Attempt request with invalid token
        const response = await fetch(`${BASE_URL}/api/v2/graphrag/search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${expiredToken}`
          },
          body: JSON.stringify({ query: 'test query' }),
        });

        // ✅ ASSERT - Verify token validation
        expect(response.status).toBe(401);
      });
    });
  });

  // ===== 4. ERROR HANDLING & EDGE CASES =====

  describe('Error Handling & Edge Cases', () => {
    let accessToken: string;

    beforeEach(async () => {
      accessToken = await authenticateUser();
    });

    describe('Request Format Errors', () => {
      it('should handle malformed JSON in request body', async () => {
        // 🔧 ARRANGE - Malformed JSON payload

        // ⚡ ACT - Send request with invalid JSON
        const response = await fetch(`${BASE_URL}/api/v2/graphrag/search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: 'invalid-json{',
        });

        // ✅ ASSERT - Verify JSON parsing error handling
        expect(response.status).toBe(400);
      });
    });

    describe('Network & Routing Errors', () => {
      it('should handle requests to non-existent endpoints', async () => {
        // 🔧 ARRANGE - Request to non-existent API endpoint

        // ⚡ ACT - Attempt request to invalid endpoint
        const response = await fetch(`${BASE_URL}/api/v2/graphrag/nonexistent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({ query: 'test' }),
        });

        // ✅ ASSERT - Verify SPA routing behavior (serves HTML for unmatched routes)
        expect(response.status).toBe(200);
        const contentType = response.headers.get('content-type');
        expect(contentType).toContain('text/html');
      });
    });
  });

  // ===== 5. END-TO-END WORKFLOWS =====

  describe('End-to-End Workflows', () => {
    describe('Complete Authentication → Search Journey', () => {
      it('should complete full authentication and search workflow', async () => {
        // 🔧 ARRANGE - No pre-existing authentication

        // ⚡ ACT - Step 1: Authenticate user
        const authResponse = await fetch(`${BASE_URL}/api/auth/signin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(TEST_CREDENTIALS),
        });

        expect(authResponse.ok).toBe(true);
        const authResult: AuthResponse = await authResponse.json();

        // ⚡ ACT - Step 2: Use authentication token for GraphRAG search
        const searchResponse = await fetch(`${BASE_URL}/api/v2/graphrag/search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authResult.accessToken}`
          },
          body: JSON.stringify({
            query: 'full stack developer',
            limit: 10
          }),
        });

        // ✅ ASSERT - Verify complete end-to-end workflow
        expect(searchResponse.ok).toBe(true);
        const searchResult: GraphRAGSearchResponse = await searchResponse.json();

        expect(searchResult.query).toBe('full stack developer');
        expect(searchResult.profiles).toBeInstanceOf(Array);
        expect(typeof searchResult.totalResults).toBe('number');
      });
    });

    describe('Token Persistence Across Requests', () => {
      it('should maintain token validity across multiple sequential requests', async () => {
        // 🔧 ARRANGE - Single authentication for multiple requests
        const authResponse = await fetch(`${BASE_URL}/api/auth/signin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(TEST_CREDENTIALS),
        });

        const { accessToken }: AuthResponse = await authResponse.json();
        const searchQueries = ['react', 'node.js', 'python', 'java'];

        // ⚡ ACT - Perform multiple searches with same token
        for (const query of searchQueries) {
          const searchResponse = await fetch(`${BASE_URL}/api/v2/graphrag/search`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({ query }),
          });

          // ✅ ASSERT - Each request should succeed
          expect(searchResponse.ok).toBe(true);
          
          const result: GraphRAGSearchResponse = await searchResponse.json();
          expect(result.query).toBe(query);
        }
      });
    });

    describe('Concurrent Request Handling', () => {
      it('should handle concurrent authenticated requests efficiently', async () => {
        // 🔧 ARRANGE - Single authentication for concurrent requests
        const authResponse = await fetch(`${BASE_URL}/api/auth/signin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(TEST_CREDENTIALS),
        });

        const { accessToken }: AuthResponse = await authResponse.json();

        // ⚡ ACT - Fire multiple concurrent requests
        const concurrentRequests = Array(5).fill(null).map((_, index) =>
          fetch(`${BASE_URL}/api/v2/graphrag/search`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({ 
              query: `concurrent search ${index}`,
              limit: 5 
            }),
          })
        );

        const results = await Promise.all(concurrentRequests);
        
        // ✅ ASSERT - All concurrent requests should succeed
        results.forEach((response, index) => {
          expect(response.ok).toBe(true);
        });

        // Verify response data integrity
        const searchResults = await Promise.all(
          results.map(r => r.json() as Promise<GraphRAGSearchResponse>)
        );

        searchResults.forEach((result, index) => {
          expect(result.query).toBe(`concurrent search ${index}`);
          expect(result.profiles).toBeInstanceOf(Array);
        });
      });
    });
  });
});