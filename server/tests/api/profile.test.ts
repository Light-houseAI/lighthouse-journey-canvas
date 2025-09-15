import express from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import type { ProfileResponse } from '../../../client/src/types/profile';

// Contract Test: Profile API
// This test defines the expected API contract and will drive implementation (TDD)
describe('Profile API Contract - GET /api/v2/timeline/nodes', () => {
  let app: express.Application;

  beforeAll(() => {
    // Create test app with mock endpoint to define contract
    app = express();
    app.use(express.json());

    // Mock implementation that defines the expected contract
    app.get('/api/v2/timeline/nodes', (req, res) => {
      // Contract requirement: Must require authentication
      if (!req.headers.authorization) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      // Contract requirement: Handle user not found
      if (req.query.username === 'nonexistent') {
        return res.status(404).json({
          error: 'User not found',
          message: 'The specified user profile does not exist',
        });
      }

      // Contract requirement: Handle forbidden access
      if (req.query.username === 'privateuser') {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have permission to view this profile',
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
                  endDate: null, // null = current
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
                  endDate: '2022-12-31', // past date
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
      };

      res.json(mockResponse);
    });
  });

  describe('Authentication Requirements', () => {
    it('should require authentication header', async () => {
      const response = await request(app)
        .get('/api/v2/timeline/nodes')
        .expect(401);

      expect(response.body).toEqual({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    });

    it('should accept valid authentication', async () => {
      const response = await request(app)
        .get('/api/v2/timeline/nodes')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Response Structure Contract', () => {
    it('should return correct profile response structure', async () => {
      const response = await request(app)
        .get('/api/v2/timeline/nodes')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      // Validate top-level structure
      expect(response.body).toMatchObject({
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
    });

    it('should separate current and past experiences correctly', async () => {
      const response = await request(app)
        .get('/api/v2/timeline/nodes')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      const { current, past } = response.body.data.timeline;

      // Current experiences should not have end dates or have future end dates
      current.forEach((node: any) => {
        expect(node.isCurrent).toBe(true);
        if (node.meta.endDate) {
          const endDate = new Date(node.meta.endDate);
          const now = new Date();
          expect(endDate.getTime()).toBeGreaterThan(now.getTime());
        }
      });

      // Past experiences should have past end dates
      past.forEach((node: any) => {
        expect(node.isCurrent).toBe(false);
        expect(node.meta.endDate).not.toBeNull();
        if (node.meta.endDate) {
          const endDate = new Date(node.meta.endDate);
          const now = new Date();
          expect(endDate.getTime()).toBeLessThanOrEqual(now.getTime());
        }
      });
    });

    it('should include required node properties', async () => {
      const response = await request(app)
        .get('/api/v2/timeline/nodes')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      const allNodes = [
        ...response.body.data.timeline.current,
        ...response.body.data.timeline.past,
      ];

      allNodes.forEach((node: any) => {
        expect(node).toMatchObject({
          id: expect.any(String),
          type: expect.stringMatching(
            /^(job|education|project|event|action|careerTransition)$/
          ),
          userId: expect.any(Number),
          meta: {
            title: expect.any(String),
            startDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}/),
          },
          isCurrent: expect.any(Boolean),
          depth: expect.any(Number),
          path: expect.any(Array),
          permissions: {
            canView: expect.any(Boolean),
            canEdit: expect.any(Boolean),
            canDelete: expect.any(Boolean),
          },
        });

        // Validate depth constraints
        expect(node.depth).toBeGreaterThanOrEqual(0);
        expect(node.depth).toBeLessThan(5);
      });
    });
  });

  describe('User Profile Variations', () => {
    it('should handle current user profile (no username parameter)', async () => {
      const response = await request(app)
        .get('/api/v2/timeline/nodes')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.data.user.userName).toBe('currentuser');
      expect(response.body.data.permissions.isOwner).toBe(true);
      expect(response.body.data.permissions.canEdit).toBe(true);
    });

    it('should handle other user profile (with username parameter)', async () => {
      const response = await request(app)
        .get('/api/v2/timeline/nodes?username=johndoe')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.data.user.userName).toBe('johndoe');
      expect(response.body.data.permissions.isOwner).toBe(false);
      expect(response.body.data.permissions.canEdit).toBe(false);
    });
  });

  describe('Error Scenarios', () => {
    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .get('/api/v2/timeline/nodes?username=nonexistent')
        .set('Authorization', 'Bearer valid-token')
        .expect(404);

      expect(response.body).toEqual({
        error: 'User not found',
        message: 'The specified user profile does not exist',
      });
    });

    it('should return 403 for private profiles', async () => {
      const response = await request(app)
        .get('/api/v2/timeline/nodes?username=privateuser')
        .set('Authorization', 'Bearer valid-token')
        .expect(403);

      expect(response.body).toEqual({
        error: 'Forbidden',
        message: 'You do not have permission to view this profile',
      });
    });
  });

  describe('Data Consistency', () => {
    it('should have consistent total count', async () => {
      const response = await request(app)
        .get('/api/v2/timeline/nodes')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      const { current, past, totalCount } = response.body.data.timeline;

      // Count nodes including nested children
      const countNodes = (nodes: any[]): number => {
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
    });

    it('should have valid profile URLs', async () => {
      const response = await request(app)
        .get('/api/v2/timeline/nodes?username=testuser')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      const profileUrl = response.body.data.user.profileUrl;
      expect(profileUrl).toMatch(/^https:\/\/app\.lighthouse\.ai\/[\w-]+$/);
      expect(profileUrl).toContain('testuser');
    });
  });
});
