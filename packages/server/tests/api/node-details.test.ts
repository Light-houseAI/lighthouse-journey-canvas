import express from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

// TODO: Client package doesn't exist - types should be in @journey/schema
// import type { NodeDetailsResponse } from '../../../client/src/types/profile';
type NodeDetailsResponse = any; // Temporary type until proper types are defined
import {
  getSeededUserTokens,
  type TestTokenPair,
} from '../helpers/auth.helper';

// Contract Test: Node Details API
// This test defines the expected API contract for individual node details
describe('Node Details API Contract - GET /api/v2/timeline/nodes/:nodeId', () => {
  let app: express.Application;
  let testTokenPair: TestTokenPair;

  beforeAll(() => {
    // Generate tokens for seeded user testing
    testTokenPair = getSeededUserTokens();
    app = express();
    app.use(express.json());

    // Mock node details endpoint to define contract
    app.get('/api/v2/timeline/nodes/:nodeId', (req, res) => {
      // Contract requirement: Must require authentication
      if (!req.headers.authorization) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const { nodeId } = req.params;

      // Contract requirement: Handle node not found
      if (nodeId === 'nonexistent') {
        return res.status(404).json({
          error: 'Node not found',
          message: 'The specified node does not exist',
        });
      }

      // Contract requirement: Handle forbidden access
      if (nodeId === 'forbidden') {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have permission to view this node',
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
            },
            {
              id: 'insight-2',
              nodeId: nodeId,
              type: 'achievement',
              content:
                'Successfully delivered multiple high-impact projects on time',
              confidence: 0.95,
              createdAt: new Date('2023-08-01'),
              source: 'user',
            },
          ],
          skills: [
            {
              id: 'skill-1',
              name: 'React',
              category: 'technical',
              level: 'expert',
              extractedFrom: 'meta.skills',
              confidence: 0.95,
            },
            {
              id: 'skill-2',
              name: 'TypeScript',
              category: 'technical',
              level: 'advanced',
              extractedFrom: 'meta.skills',
              confidence: 0.9,
            },
            {
              id: 'skill-3',
              name: 'Leadership',
              category: 'soft',
              level: 'advanced',
              extractedFrom: 'meta.description',
              confidence: 0.85,
            },
          ],
          attachments: [
            {
              id: 'attachment-1',
              nodeId: nodeId,
              type: 'document',
              name: 'Performance Review 2023.pdf',
              url: 'https://storage.lighthouse.ai/attachments/performance-review-2023.pdf',
              size: 1024000, // 1MB
              uploadedAt: new Date('2023-12-01'),
              uploadedBy: 'user-1',
            },
            {
              id: 'attachment-2',
              nodeId: nodeId,
              type: 'link',
              name: 'Team Project Repository',
              url: 'https://github.com/company/team-project',
              uploadedAt: new Date('2023-06-15'),
              uploadedBy: 'user-1',
            },
          ],
          permissions: {
            canView: true,
            canEdit: true,
            canDelete: true,
            canShare: true,
            canComment: true,
          },
        },
      };

      res.json(mockResponse);
    });
  });

  describe('Authentication Requirements', () => {
    it('should require authentication header', async () => {
      const response = await request(app)
        .get('/api/v2/timeline/nodes/test-node-1')
        .expect(401);

      expect(response.body).toEqual({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    });

    it('should accept valid authentication', async () => {
      const response = await request(app)
        .get('/api/v2/timeline/nodes/test-node-1')
        .set('Authorization', `Bearer ${testTokenPair.accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Response Structure Contract', () => {
    it('should return correct node details response structure', async () => {
      const response = await request(app)
        .get('/api/v2/timeline/nodes/detailed-node')
        .set('Authorization', `Bearer ${testTokenPair.accessToken}`)
        .expect(200);

      // Validate top-level structure
      expect(response.body).toMatchObject({
        success: true,
        data: {
          node: expect.objectContaining({
            id: 'detailed-node',
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
            permissions: expect.objectContaining({
              canView: expect.any(Boolean),
              canEdit: expect.any(Boolean),
              canDelete: expect.any(Boolean),
            }),
          }),
          insights: expect.any(Array),
          skills: expect.any(Array),
          attachments: expect.any(Array),
          permissions: expect.objectContaining({
            canView: expect.any(Boolean),
            canEdit: expect.any(Boolean),
            canDelete: expect.any(Boolean),
          }),
        },
      });
    });

    it('should include comprehensive node metadata', async () => {
      const response = await request(app)
        .get('/api/v2/timeline/nodes/detailed-node')
        .set('Authorization', `Bearer ${testTokenPair.accessToken}`)
        .expect(200);

      const node = response.body.data.node;

      // Validate extended metadata fields
      expect(node.meta).toMatchObject({
        title: expect.any(String),
        startDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}/),
        description: expect.any(String),
        skills: expect.any(Array),
        achievements: expect.any(Array),
      });

      // Validate arrays have expected structure
      if (node.meta.skills && node.meta.skills.length > 0) {
        node.meta.skills.forEach((skill: string) => {
          expect(typeof skill).toBe('string');
        });
      }

      if (node.meta.achievements && node.meta.achievements.length > 0) {
        node.meta.achievements.forEach((achievement: string) => {
          expect(typeof achievement).toBe('string');
        });
      }
    });

    it('should include insights with proper structure', async () => {
      const response = await request(app)
        .get('/api/v2/timeline/nodes/detailed-node')
        .set('Authorization', `Bearer ${testTokenPair.accessToken}`)
        .expect(200);

      const insights = response.body.data.insights;

      if (insights && insights.length > 0) {
        insights.forEach((insight: any) => {
          expect(insight).toMatchObject({
            id: expect.any(String),
            nodeId: 'detailed-node',
            type: expect.stringMatching(
              /^(skill|achievement|learning|impact)$/
            ),
            content: expect.any(String),
            confidence: expect.any(Number),
            createdAt: expect.any(String),
            source: expect.stringMatching(/^(user|ai|external)$/),
          });

          // Validate confidence is between 0 and 1
          expect(insight.confidence).toBeGreaterThanOrEqual(0);
          expect(insight.confidence).toBeLessThanOrEqual(1);
        });
      }
    });

    it('should include extracted skills with proper structure', async () => {
      const response = await request(app)
        .get('/api/v2/timeline/nodes/detailed-node')
        .set('Authorization', `Bearer ${testTokenPair.accessToken}`)
        .expect(200);

      const skills = response.body.data.skills;

      if (skills && skills.length > 0) {
        skills.forEach((skill: any) => {
          expect(skill).toMatchObject({
            id: expect.any(String),
            name: expect.any(String),
            category: expect.stringMatching(
              /^(technical|soft|language|tool|framework)$/
            ),
            level: expect.stringMatching(
              /^(beginner|intermediate|advanced|expert)$/
            ),
            extractedFrom: expect.any(String),
            confidence: expect.any(Number),
          });

          // Validate confidence range
          expect(skill.confidence).toBeGreaterThanOrEqual(0);
          expect(skill.confidence).toBeLessThanOrEqual(1);
        });
      }
    });

    it('should include attachments with proper structure', async () => {
      const response = await request(app)
        .get('/api/v2/timeline/nodes/detailed-node')
        .set('Authorization', `Bearer ${testTokenPair.accessToken}`)
        .expect(200);

      const attachments = response.body.data.attachments;

      if (attachments && attachments.length > 0) {
        attachments.forEach((attachment: any) => {
          expect(attachment).toMatchObject({
            id: expect.any(String),
            nodeId: 'detailed-node',
            type: expect.stringMatching(/^(document|image|link|video)$/),
            name: expect.any(String),
            url: expect.stringMatching(/^https?:\/\/.+/),
            uploadedAt: expect.any(String),
            uploadedBy: expect.any(String),
          });

          // Size is optional and only for file attachments
          if (attachment.type !== 'link' && attachment.size !== undefined) {
            expect(attachment.size).toBeGreaterThan(0);
          }
        });
      }
    });
  });

  describe('Error Scenarios', () => {
    it('should return 404 for non-existent node', async () => {
      const response = await request(app)
        .get('/api/v2/timeline/nodes/nonexistent')
        .set('Authorization', `Bearer ${testTokenPair.accessToken}`)
        .expect(404);

      expect(response.body).toEqual({
        error: 'Node not found',
        message: 'The specified node does not exist',
      });
    });

    it('should return 403 for forbidden nodes', async () => {
      const response = await request(app)
        .get('/api/v2/timeline/nodes/forbidden')
        .set('Authorization', `Bearer ${testTokenPair.accessToken}`)
        .expect(403);

      expect(response.body).toEqual({
        error: 'Forbidden',
        message: 'You do not have permission to view this node',
      });
    });
  });

  describe('Permission Validation', () => {
    it('should have consistent permissions across node and data', async () => {
      const response = await request(app)
        .get('/api/v2/timeline/nodes/detailed-node')
        .set('Authorization', `Bearer ${testTokenPair.accessToken}`)
        .expect(200);

      const { node, permissions } = response.body.data;

      // Node permissions should match top-level permissions
      expect(node.permissions.canView).toBe(permissions.canView);
      expect(node.permissions.canEdit).toBe(permissions.canEdit);
      expect(node.permissions.canDelete).toBe(permissions.canDelete);
    });

    it('should validate permission hierarchy', async () => {
      const response = await request(app)
        .get('/api/v2/timeline/nodes/detailed-node')
        .set('Authorization', `Bearer ${testTokenPair.accessToken}`)
        .expect(200);

      const permissions = response.body.data.permissions;

      // If user can edit, they should also be able to view
      if (permissions.canEdit) {
        expect(permissions.canView).toBe(true);
      }

      // If user can delete, they should be able to edit
      if (permissions.canDelete) {
        expect(permissions.canEdit).toBe(true);
      }
    });
  });

  describe('Data Consistency', () => {
    it('should have valid node ID consistency', async () => {
      const nodeId = 'consistency-test';
      const response = await request(app)
        .get(`/api/v2/timeline/nodes/${nodeId}`)
        .set('Authorization', `Bearer ${testTokenPair.accessToken}`)
        .expect(200);

      const { node, insights, attachments } = response.body.data;

      // Node ID should match parameter
      expect(node.id).toBe(nodeId);

      // All insights should reference this node
      insights.forEach((insight: any) => {
        expect(insight.nodeId).toBe(nodeId);
      });

      // All attachments should reference this node
      attachments.forEach((attachment: any) => {
        expect(attachment.nodeId).toBe(nodeId);
      });
    });

    it('should have valid date formats', async () => {
      const response = await request(app)
        .get('/api/v2/timeline/nodes/date-test')
        .set('Authorization', `Bearer ${testTokenPair.accessToken}`)
        .expect(200);

      const { node, insights, attachments } = response.body.data;

      // Validate ISO date formats
      expect(node.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(node.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(node.meta.startDate).toMatch(/^\d{4}-\d{2}-\d{2}/);

      // Validate insight dates
      insights.forEach((insight: any) => {
        expect(insight.createdAt).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
        );
      });

      // Validate attachment dates
      attachments.forEach((attachment: any) => {
        expect(attachment.uploadedAt).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
        );
      });
    });
  });
});
