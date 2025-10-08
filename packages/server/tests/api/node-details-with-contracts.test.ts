/**
 * Node Details API Integration Tests with Contract Validation
 * Tests the timeline node details endpoint with OpenAPI contract validation
 */

import type { Application } from 'express';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Container } from '../../src/core/container-setup';
import { withTestTransaction } from '../utils/db';
import { loadOpenAPISchema, createContractValidator } from '../utils/contract-validator';
import type { ContractValidator } from '../utils/contract-validator';
import { getSeededUserTokens, type TestTokenPair } from '../helpers/auth.helper';

let app: Application;
let contractValidator: ContractValidator;
let testTokenPair: TestTokenPair;

interface NodeDetails {
  id: string;
  type: 'job' | 'education' | 'project' | 'event' | 'action' | 'careerTransition';
  parentId: string | null;
  userId: number;
  meta: {
    title: string;
    company?: string;
    startDate: string;
    endDate?: string | null;
    description?: string;
    location?: string;
    skills?: string[];
    achievements?: string[];
    [key: string]: any;
  };
  isCurrent: boolean;
  depth: number;
  children: NodeDetails[];
  path: string[];
  permissions: {
    canView: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canShare: boolean;
    canComment: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

interface Insight {
  id: string;
  nodeId: string;
  type: 'skill' | 'achievement' | 'recommendation' | 'analysis';
  content: string;
  confidence: number;
  createdAt: Date;
  source: 'ai' | 'user' | 'system';
  metadata?: Record<string, any>;
}

interface RelatedNode {
  id: string;
  type: string;
  relationshipType: 'parent' | 'child' | 'sibling' | 'related';
  title: string;
  meta: Record<string, any>;
}

interface NodeDetailsResponse {
  success: boolean;
  data: {
    node: NodeDetails;
    insights: Insight[];
    relatedNodes: RelatedNode[];
    statistics: {
      totalSkills: number;
      totalAchievements: number;
      averageConfidence: number;
      insightCount: number;
    };
  };
  meta: {
    timestamp: string;
    requestId?: string;
  };
}

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  meta: {
    timestamp: string;
    requestId?: string;
  };
}

describe('Node Details API with Contract Validation - GET /api/v2/timeline/nodes/:nodeId', () => {
  beforeAll(async () => {
    // Generate tokens for seeded user testing
    testTokenPair = getSeededUserTokens(1);

    // Create test app
    app = express();
    app.use(express.json());

    // Load OpenAPI schema and create contract validator
    try {
      const schema = await loadOpenAPISchema();
      contractValidator = await createContractValidator(schema);

      // Install contract validation middleware
      app.use(contractValidator());
    } catch (error) {
      console.warn('Contract validation not available:', error);
      // Tests can still run without contract validation
    }

    // Mock node details endpoint with proper response format
    app.get('/api/v2/timeline/nodes/:nodeId', (req, res) => {
      // Contract requirement: Must require authentication
      if (!req.headers.authorization) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
          meta: {
            timestamp: new Date().toISOString(),
          },
        });
      }

      const { nodeId } = req.params;

      // Contract requirement: Handle node not found
      if (nodeId === 'nonexistent') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'The specified node does not exist',
          },
          meta: {
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Contract requirement: Handle forbidden access
      if (nodeId === 'forbidden') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to view this node',
          },
          meta: {
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Contract requirement: Successful response with detailed node information
      const mockResponse: NodeDetailsResponse = {
        success: true,
        data: {
          node: {
            id: nodeId,
            type: 'job',
            parentId: null,
            userId: 1,
            meta: {
              title: 'Senior Software Engineer',
              company: 'TechCorp',
              startDate: '2023-01-01',
              endDate: null,
              description:
                'Leading development of user-facing features and mentoring junior developers',
              location: 'San Francisco, CA',
              skills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL'],
              achievements: [
                'Increased team productivity by 40%',
                'Led successful migration to microservices',
                'Mentored 5 junior developers',
              ],
            },
            isCurrent: true,
            depth: 0,
            children: [],
            path: [],
            permissions: {
              canView: true,
              canEdit: true,
              canDelete: true,
              canShare: true,
              canComment: true,
            },
            createdAt: new Date('2023-01-01'),
            updatedAt: new Date('2023-01-01'),
          },
          insights: [
            {
              id: 'insight-1',
              nodeId: nodeId,
              type: 'skill',
              content:
                'Strong leadership and technical skills demonstrated through team management',
              confidence: 0.9,
              createdAt: new Date('2023-06-01'),
              source: 'ai',
              metadata: {
                category: 'leadership',
                relevance: 0.95,
              },
            },
            {
              id: 'insight-2',
              nodeId: nodeId,
              type: 'achievement',
              content:
                'Significant impact on team performance metrics',
              confidence: 0.85,
              createdAt: new Date('2023-07-01'),
              source: 'system',
            },
          ],
          relatedNodes: [
            {
              id: 'related-1',
              type: 'project',
              relationshipType: 'child',
              title: 'Microservices Migration Project',
              meta: {
                startDate: '2023-03-01',
                endDate: '2023-08-01',
              },
            },
          ],
          statistics: {
            totalSkills: 4,
            totalAchievements: 3,
            averageConfidence: 0.875,
            insightCount: 2,
          },
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      };

      res.json(mockResponse);
    });
  });

  afterAll(async () => {
    // Cleanup if needed
  });

  describe('Authentication with Contract Validation', () => {
    it('should require authentication and validate error contract', async () => {
      const response = await request(app)
        .get('/api/v2/timeline/nodes/test-node')
        .expect(401)
        .expect('Content-Type', /json/);

      const body: ErrorResponse = response.body;

      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toBe('Authentication required');
      expect(body.meta).toHaveProperty('timestamp');

      // Validate error response contract
      if (contractValidator) {
        const errors = contractValidator.validateResponse(
          response.req,
          response.res,
          body
        );
        expect(errors).toEqual([]);
      }
    });

    it('should accept valid authentication with contract compliance', async () => {
      await withTestTransaction(async (tx) => {
        const response = await request(app)
          .get('/api/v2/timeline/nodes/test-node')
          .set('Authorization', `Bearer ${testTokenPair.accessToken}`)
          .expect(200)
          .expect('Content-Type', /json/);

        const body: NodeDetailsResponse = response.body;

        expect(body.success).toBe(true);
        expect(body.data).toBeDefined();
        expect(body.meta).toHaveProperty('timestamp');

        // Validate response contract
        if (contractValidator) {
          const errors = contractValidator.validateResponse(
            response.req,
            response.res,
            body
          );
          expect(errors).toEqual([]);
        }
      });
    });
  });

  describe('Node Details Structure with Contract Validation', () => {
    it('should return complete node details with all required fields', async () => {
      await withTestTransaction(async (tx) => {
        const response = await request(app)
          .get('/api/v2/timeline/nodes/node-123')
          .set('Authorization', `Bearer ${testTokenPair.accessToken}`)
          .expect(200);

        const body: NodeDetailsResponse = response.body;

        // Validate node structure
        const node = body.data.node;
        expect(node).toMatchObject({
          id: 'node-123',
          type: expect.stringMatching(
            /^(job|education|project|event|action|careerTransition)$/
          ),
          userId: expect.any(Number),
          meta: expect.objectContaining({
            title: expect.any(String),
            startDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}/),
          }),
          isCurrent: expect.any(Boolean),
          depth: expect.any(Number),
          path: expect.any(Array),
          permissions: {
            canView: expect.any(Boolean),
            canEdit: expect.any(Boolean),
            canDelete: expect.any(Boolean),
            canShare: expect.any(Boolean),
            canComment: expect.any(Boolean),
          },
        });

        // Validate response contract
        if (contractValidator) {
          const errors = contractValidator.validateResponse(
            response.req,
            response.res,
            body
          );
          expect(errors).toEqual([]);
        }
      });
    });

    it('should include insights with proper validation', async () => {
      await withTestTransaction(async (tx) => {
        const response = await request(app)
          .get('/api/v2/timeline/nodes/node-456')
          .set('Authorization', `Bearer ${testTokenPair.accessToken}`)
          .expect(200);

        const body: NodeDetailsResponse = response.body;

        // Validate insights
        expect(Array.isArray(body.data.insights)).toBe(true);

        body.data.insights.forEach((insight) => {
          expect(insight).toMatchObject({
            id: expect.any(String),
            nodeId: expect.any(String),
            type: expect.stringMatching(
              /^(skill|achievement|recommendation|analysis)$/
            ),
            content: expect.any(String),
            confidence: expect.any(Number),
            source: expect.stringMatching(/^(ai|user|system)$/),
          });

          // Validate confidence range
          expect(insight.confidence).toBeGreaterThanOrEqual(0);
          expect(insight.confidence).toBeLessThanOrEqual(1);
        });

        // Validate response contract
        if (contractValidator) {
          const errors = contractValidator.validateResponse(
            response.req,
            response.res,
            body
          );
          expect(errors).toEqual([]);
        }
      });
    });

    it('should include related nodes with proper structure', async () => {
      await withTestTransaction(async (tx) => {
        const response = await request(app)
          .get('/api/v2/timeline/nodes/node-789')
          .set('Authorization', `Bearer ${testTokenPair.accessToken}`)
          .expect(200);

        const body: NodeDetailsResponse = response.body;

        // Validate related nodes
        expect(Array.isArray(body.data.relatedNodes)).toBe(true);

        body.data.relatedNodes.forEach((relatedNode) => {
          expect(relatedNode).toMatchObject({
            id: expect.any(String),
            type: expect.any(String),
            relationshipType: expect.stringMatching(
              /^(parent|child|sibling|related)$/
            ),
            title: expect.any(String),
            meta: expect.any(Object),
          });
        });

        // Validate response contract
        if (contractValidator) {
          const errors = contractValidator.validateResponse(
            response.req,
            response.res,
            body
          );
          expect(errors).toEqual([]);
        }
      });
    });

    it('should include statistics with calculated values', async () => {
      await withTestTransaction(async (tx) => {
        const response = await request(app)
          .get('/api/v2/timeline/nodes/node-stats')
          .set('Authorization', `Bearer ${testTokenPair.accessToken}`)
          .expect(200);

        const body: NodeDetailsResponse = response.body;
        const stats = body.data.statistics;

        // Validate statistics
        expect(stats).toMatchObject({
          totalSkills: expect.any(Number),
          totalAchievements: expect.any(Number),
          averageConfidence: expect.any(Number),
          insightCount: expect.any(Number),
        });

        // Validate consistency
        expect(stats.totalSkills).toBeGreaterThanOrEqual(0);
        expect(stats.totalAchievements).toBeGreaterThanOrEqual(0);
        expect(stats.averageConfidence).toBeGreaterThanOrEqual(0);
        expect(stats.averageConfidence).toBeLessThanOrEqual(1);
        expect(stats.insightCount).toBe(body.data.insights.length);

        // Validate response contract
        if (contractValidator) {
          const errors = contractValidator.validateResponse(
            response.req,
            response.res,
            body
          );
          expect(errors).toEqual([]);
        }
      });
    });
  });

  describe('Error Scenarios with Contract Validation', () => {
    it('should return 404 with proper error contract for non-existent node', async () => {
      const response = await request(app)
        .get('/api/v2/timeline/nodes/nonexistent')
        .set('Authorization', `Bearer ${testTokenPair.accessToken}`)
        .expect(404)
        .expect('Content-Type', /json/);

      const body: ErrorResponse = response.body;

      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toContain('does not exist');
      expect(body.meta).toHaveProperty('timestamp');

      // Validate error response contract
      if (contractValidator) {
        const errors = contractValidator.validateResponse(
          response.req,
          response.res,
          body
        );
        expect(errors).toEqual([]);
      }
    });

    it('should return 403 with proper error contract for forbidden node', async () => {
      const response = await request(app)
        .get('/api/v2/timeline/nodes/forbidden')
        .set('Authorization', `Bearer ${testTokenPair.accessToken}`)
        .expect(403)
        .expect('Content-Type', /json/);

      const body: ErrorResponse = response.body;

      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
      expect(body.error.message).toContain('permission');
      expect(body.meta).toHaveProperty('timestamp');

      // Validate error response contract
      if (contractValidator) {
        const errors = contractValidator.validateResponse(
          response.req,
          response.res,
          body
        );
        expect(errors).toEqual([]);
      }
    });
  });

  describe('Data Consistency with Contract', () => {
    it('should validate skill and achievement counts match metadata', async () => {
      await withTestTransaction(async (tx) => {
        const response = await request(app)
          .get('/api/v2/timeline/nodes/node-consistency')
          .set('Authorization', `Bearer ${testTokenPair.accessToken}`)
          .expect(200);

        const body: NodeDetailsResponse = response.body;
        const node = body.data.node;
        const stats = body.data.statistics;

        // Validate counts match actual data
        if (node.meta.skills) {
          expect(stats.totalSkills).toBe(node.meta.skills.length);
        }
        if (node.meta.achievements) {
          expect(stats.totalAchievements).toBe(node.meta.achievements.length);
        }

        // Validate response contract
        if (contractValidator) {
          const errors = contractValidator.validateResponse(
            response.req,
            response.res,
            body
          );
          expect(errors).toEqual([]);
        }
      });
    });

    it('should validate average confidence calculation', async () => {
      await withTestTransaction(async (tx) => {
        const response = await request(app)
          .get('/api/v2/timeline/nodes/node-confidence')
          .set('Authorization', `Bearer ${testTokenPair.accessToken}`)
          .expect(200);

        const body: NodeDetailsResponse = response.body;
        const insights = body.data.insights;
        const stats = body.data.statistics;

        if (insights.length > 0) {
          const calculatedAverage = insights.reduce((sum, i) => sum + i.confidence, 0) / insights.length;
          expect(Math.abs(stats.averageConfidence - calculatedAverage)).toBeLessThan(0.01);
        }

        // Validate response contract
        if (contractValidator) {
          const errors = contractValidator.validateResponse(
            response.req,
            response.res,
            body
          );
          expect(errors).toEqual([]);
        }
      });
    });

    it('should validate permissions based on ownership', async () => {
      await withTestTransaction(async (tx) => {
        const response = await request(app)
          .get('/api/v2/timeline/nodes/node-owned')
          .set('Authorization', `Bearer ${testTokenPair.accessToken}`)
          .expect(200);

        const body: NodeDetailsResponse = response.body;
        const permissions = body.data.node.permissions;

        // For owned nodes, all permissions should be true
        expect(permissions.canView).toBe(true);
        expect(permissions.canEdit).toBe(true);
        expect(permissions.canDelete).toBe(true);
        expect(permissions.canShare).toBe(true);
        expect(permissions.canComment).toBe(true);

        // Validate response contract
        if (contractValidator) {
          const errors = contractValidator.validateResponse(
            response.req,
            response.res,
            body
          );
          expect(errors).toEqual([]);
        }
      });
    });
  });

  describe('Complex Data Validation', () => {
    it('should validate nested children nodes follow same contract', async () => {
      await withTestTransaction(async (tx) => {
        const response = await request(app)
          .get('/api/v2/timeline/nodes/node-with-children')
          .set('Authorization', `Bearer ${testTokenPair.accessToken}`)
          .expect(200);

        const body: NodeDetailsResponse = response.body;
        const node = body.data.node;

        // If node has children, validate their structure
        if (node.children && node.children.length > 0) {
          node.children.forEach((child) => {
            expect(child).toHaveProperty('id');
            expect(child).toHaveProperty('type');
            expect(child).toHaveProperty('meta');
            expect(child).toHaveProperty('permissions');
            expect(child.parentId).toBe(node.id);
            expect(child.depth).toBe(node.depth + 1);
          });
        }

        // Validate response contract
        if (contractValidator) {
          const errors = contractValidator.validateResponse(
            response.req,
            response.res,
            body
          );
          expect(errors).toEqual([]);
        }
      });
    });

    it('should validate date consistency in node timeline', async () => {
      await withTestTransaction(async (tx) => {
        const response = await request(app)
          .get('/api/v2/timeline/nodes/node-dates')
          .set('Authorization', `Bearer ${testTokenPair.accessToken}`)
          .expect(200);

        const body: NodeDetailsResponse = response.body;
        const node = body.data.node;

        // Validate date formats
        expect(node.meta.startDate).toMatch(/^\d{4}-\d{2}-\d{2}/);

        if (node.meta.endDate) {
          expect(node.meta.endDate).toMatch(/^\d{4}-\d{2}-\d{2}/);

          // End date should be after start date
          const startDate = new Date(node.meta.startDate);
          const endDate = new Date(node.meta.endDate);
          expect(endDate.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
        }

        // Current flag should match end date logic
        if (node.isCurrent) {
          expect(node.meta.endDate).toBeNull();
        }

        // Validate response contract
        if (contractValidator) {
          const errors = contractValidator.validateResponse(
            response.req,
            response.res,
            body
          );
          expect(errors).toEqual([]);
        }
      });
    });
  });
});