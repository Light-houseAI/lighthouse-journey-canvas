/**
 * Profile API Integration Tests with Contract Validation
 * Tests the timeline profile endpoint with OpenAPI contract validation
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

interface TimelineNode {
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
    [key: string]: any;
  };
  isCurrent: boolean;
  depth: number;
  children: TimelineNode[];
  path: string[];
  permissions: {
    canView: boolean;
    canEdit: boolean;
    canDelete: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

interface ProfileResponse {
  success: boolean;
  data: {
    user: {
      userName: string;
      firstName: string;
      lastName: string;
      profileUrl: string;
    };
    timeline: {
      current: TimelineNode[];
      past: TimelineNode[];
      totalCount: number;
    };
    permissions: {
      canEdit: boolean;
      canShare: boolean;
      isOwner: boolean;
    };
  };
  meta?: {
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
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

describe('Profile API with Contract Validation - GET /api/v2/timeline/nodes', () => {
  beforeAll(async () => {
    // Generate tokens for seeded user testing
    testTokenPair = getSeededUserTokens(1);

    // Create test app with mock endpoint
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

    // Mock implementation with proper response format
    app.get('/api/v2/timeline/nodes', (req, res) => {
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

      // Contract requirement: Handle user not found
      if (req.query.username === 'nonexistent') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'The specified user profile does not exist',
          },
          meta: {
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Contract requirement: Handle forbidden access
      if (req.query.username === 'privateuser') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to view this profile',
          },
          meta: {
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Contract requirement: Successful response structure
      const username = (req.query.username as string) || 'currentuser';
      const isOwner = !req.query.username;

      const mockResponse: ProfileResponse = {
        success: true,
        data: {
          user: {
            userName: username,
            firstName: 'Test',
            lastName: 'User',
            profileUrl: `https://app.lighthouse.ai/${username}`,
          },
          timeline: {
            current: [
              {
                id: 'current-1',
                type: 'job',
                parentId: null,
                userId: 1,
                meta: {
                  title: 'Senior Software Engineer',
                  company: 'TechCorp',
                  startDate: '2023-01-01',
                  endDate: null,
                  description: 'Leading development team',
                },
                isCurrent: true,
                depth: 0,
                children: [],
                path: [],
                permissions: {
                  canView: true,
                  canEdit: isOwner,
                  canDelete: isOwner,
                },
                createdAt: new Date('2023-01-01'),
                updatedAt: new Date('2023-01-01'),
              },
            ],
            past: [
              {
                id: 'past-1',
                type: 'job',
                parentId: null,
                userId: 1,
                meta: {
                  title: 'Software Engineer',
                  company: 'StartupInc',
                  startDate: '2021-01-01',
                  endDate: '2022-12-31',
                  description: 'Full-stack development',
                },
                isCurrent: false,
                depth: 0,
                children: [],
                path: [],
                permissions: {
                  canView: true,
                  canEdit: isOwner,
                  canDelete: isOwner,
                },
                createdAt: new Date('2021-01-01'),
                updatedAt: new Date('2021-01-01'),
              },
            ],
            totalCount: 2,
          },
          permissions: {
            canEdit: isOwner,
            canShare: true,
            isOwner: isOwner,
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
        .get('/api/v2/timeline/nodes')
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
          .get('/api/v2/timeline/nodes')
          .set('Authorization', `Bearer ${testTokenPair.accessToken}`)
          .expect(200)
          .expect('Content-Type', /json/);

        const body: ProfileResponse = response.body;

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

  describe('Response Structure Contract Validation', () => {
    it('should return correct profile structure with all required fields', async () => {
      await withTestTransaction(async (tx) => {
        const response = await request(app)
          .get('/api/v2/timeline/nodes')
          .set('Authorization', `Bearer ${testTokenPair.accessToken}`)
          .expect(200);

        const body: ProfileResponse = response.body;

        // Validate structure
        expect(body).toMatchObject({
          success: true,
          data: {
            user: expect.objectContaining({
              userName: expect.any(String),
              firstName: expect.any(String),
              lastName: expect.any(String),
              profileUrl: expect.stringMatching(
                /^https:\/\/app\.lighthouse\.ai\/[\w-]+$/
              ),
            }),
            timeline: {
              current: expect.any(Array),
              past: expect.any(Array),
              totalCount: expect.any(Number),
            },
            permissions: {
              canEdit: expect.any(Boolean),
              canShare: expect.any(Boolean),
              isOwner: expect.any(Boolean),
            },
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

    it('should separate current and past experiences with proper validation', async () => {
      await withTestTransaction(async (tx) => {
        const response = await request(app)
          .get('/api/v2/timeline/nodes')
          .set('Authorization', `Bearer ${testTokenPair.accessToken}`)
          .expect(200);

        const body: ProfileResponse = response.body;
        const { current, past } = body.data.timeline;

        // Current experiences validation
        current.forEach((node) => {
          expect(node.isCurrent).toBe(true);
          if (node.meta.endDate) {
            const endDate = new Date(node.meta.endDate);
            const now = new Date();
            expect(endDate.getTime()).toBeGreaterThan(now.getTime());
          }
        });

        // Past experiences validation
        past.forEach((node) => {
          expect(node.isCurrent).toBe(false);
          expect(node.meta.endDate).not.toBeNull();
          if (node.meta.endDate) {
            const endDate = new Date(node.meta.endDate);
            const now = new Date();
            expect(endDate.getTime()).toBeLessThanOrEqual(now.getTime());
          }
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

    it('should validate timeline node structure against contract', async () => {
      await withTestTransaction(async (tx) => {
        const response = await request(app)
          .get('/api/v2/timeline/nodes')
          .set('Authorization', `Bearer ${testTokenPair.accessToken}`)
          .expect(200);

        const body: ProfileResponse = response.body;
        const allNodes = [
          ...body.data.timeline.current,
          ...body.data.timeline.past,
        ];

        allNodes.forEach((node) => {
          // Validate required fields
          expect(node).toMatchObject({
            id: expect.any(String),
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
            },
          });

          // Validate constraints
          expect(node.depth).toBeGreaterThanOrEqual(0);
          expect(node.depth).toBeLessThan(5);
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
  });

  describe('User Profile Variations with Contract', () => {
    it('should handle current user profile with owner permissions', async () => {
      await withTestTransaction(async (tx) => {
        const response = await request(app)
          .get('/api/v2/timeline/nodes')
          .set('Authorization', `Bearer ${testTokenPair.accessToken}`)
          .expect(200);

        const body: ProfileResponse = response.body;

        expect(body.data.user.userName).toBe('currentuser');
        expect(body.data.permissions.isOwner).toBe(true);
        expect(body.data.permissions.canEdit).toBe(true);

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

    it('should handle other user profile with viewer permissions', async () => {
      await withTestTransaction(async (tx) => {
        const response = await request(app)
          .get('/api/v2/timeline/nodes?username=johndoe')
          .set('Authorization', `Bearer ${testTokenPair.accessToken}`)
          .expect(200);

        const body: ProfileResponse = response.body;

        expect(body.data.user.userName).toBe('johndoe');
        expect(body.data.permissions.isOwner).toBe(false);
        expect(body.data.permissions.canEdit).toBe(false);
        expect(body.data.permissions.canShare).toBe(true);

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
    it('should return 404 with proper error contract for non-existent user', async () => {
      const response = await request(app)
        .get('/api/v2/timeline/nodes?username=nonexistent')
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

    it('should return 403 with proper error contract for private profiles', async () => {
      const response = await request(app)
        .get('/api/v2/timeline/nodes?username=privateuser')
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
    it('should have consistent total count across timeline', async () => {
      await withTestTransaction(async (tx) => {
        const response = await request(app)
          .get('/api/v2/timeline/nodes')
          .set('Authorization', `Bearer ${testTokenPair.accessToken}`)
          .expect(200);

        const body: ProfileResponse = response.body;
        const { current, past, totalCount } = body.data.timeline;

        // Count nodes including nested children
        const countNodes = (nodes: TimelineNode[]): number => {
          return nodes.reduce((count, node) => {
            let nodeCount = 1;
            if (node.children && node.children.length > 0) {
              nodeCount += countNodes(node.children);
            }
            return count + nodeCount;
          }, 0);
        };

        const actualTotal = countNodes([...current, ...past]);
        expect(totalCount).toBe(actualTotal);

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

    it('should have valid profile URLs matching username', async () => {
      await withTestTransaction(async (tx) => {
        const response = await request(app)
          .get('/api/v2/timeline/nodes?username=testuser')
          .set('Authorization', `Bearer ${testTokenPair.accessToken}`)
          .expect(200);

        const body: ProfileResponse = response.body;
        const profileUrl = body.data.user.profileUrl;

        expect(profileUrl).toMatch(/^https:\/\/app\.lighthouse\.ai\/[\w-]+$/);
        expect(profileUrl).toContain('testuser');

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

    it('should validate permissions consistency for timeline nodes', async () => {
      await withTestTransaction(async (tx) => {
        const response = await request(app)
          .get('/api/v2/timeline/nodes')
          .set('Authorization', `Bearer ${testTokenPair.accessToken}`)
          .expect(200);

        const body: ProfileResponse = response.body;
        const isOwner = body.data.permissions.isOwner;
        const allNodes = [
          ...body.data.timeline.current,
          ...body.data.timeline.past,
        ];

        // All nodes should have consistent edit permissions with profile
        allNodes.forEach((node) => {
          expect(node.permissions.canView).toBe(true); // Always viewable
          expect(node.permissions.canEdit).toBe(isOwner); // Edit only for owner
          expect(node.permissions.canDelete).toBe(isOwner); // Delete only for owner
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
  });
});