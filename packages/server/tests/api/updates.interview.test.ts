import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Application } from 'express';

import { createApp } from '../../src/app';
import { Container } from '../../src/core/container-setup';
import {
  authenticateSeededUser,
  type TestAuthSession,
} from '../helpers/auth.helper';
import { CONTAINER_TOKENS } from '../../src/core/container-tokens';
import type { HierarchyRepository } from '../../src/repositories/hierarchy-repository';
import {
  TimelineNodeType,
  type CreateUpdateRequest,
  type UpdateApiResponse,
  type ApiErrorResponse,
} from '@journey/schema';

let app: Application;
let authSession: TestAuthSession;
let testNodeId: string;
let unauthorizedNodeId: string;

describe('Updates API', () => {
  beforeAll(async () => {
    app = await createApp();
    authSession = await authenticateSeededUser(app);

    // Create actual timeline node using hierarchyRepository
    const container = Container.getContainer();
    const hierarchyRepository = container.resolve<HierarchyRepository>(
      CONTAINER_TOKENS.HIERARCHY_REPOSITORY
    );

    // Create an event node (interview) owned by the authenticated user for testing updates
    const node = await hierarchyRepository.createNode({
      type: TimelineNodeType.Event,
      parentId: null,
      meta: {
        title: 'Technical Interview at Microsoft',
        eventType: 'interview',
        stage: 'onsite',
        status: 'completed',
        scheduledAt: new Date().toISOString(),
      },
      userId: authSession.user.id,
    });

    testNodeId = node.id;
    // Unauthorized node doesn't need to exist - permission check will deny it
    unauthorizedNodeId = '550e8400-e29b-41d4-a716-446655440099';
  });

  afterAll(async () => {
    await Container.dispose();
  });

  describe('POST /api/nodes/:nodeId/updates', () => {
    it('should create update with only checkboxes', async () => {
      const updateData: CreateUpdateRequest = {
        meta: {
          appliedToJobs: true,
          networked: true,
          completedInterviews: true,
        },
      };

      const response = await request(app)
        .post(`/api/nodes/${testNodeId}/updates`)
        .set('Authorization', `Bearer ${authSession.accessToken}`)
        .send(updateData)
        .expect(201);

      const body = response.body as UpdateApiResponse;
      expect(body.success).toBe(true);
      expect(body.data.meta.appliedToJobs).toBe(true);
      expect(body.data.meta.networked).toBe(true);
      expect(body.data.meta.completedInterviews).toBe(true);
    });

    it('should return 404 for non-existent update', async () => {
      const response = await request(app)
        .put(`/api/nodes/${testNodeId}/updates/non-existent-id`)
        .set('Authorization', `Bearer ${authSession.accessToken}`)
        .send({ appliedToJobs: true })
        .expect(404);

      const body = response.body as ApiErrorResponse;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('DELETE /api/nodes/:nodeId/updates/:updateId', () => {
    it('should soft delete update', async () => {
      // First create an update
      const createData: CreateUpdateRequest = {
        appliedToJobs: true,
      };

      const createResponse = await request(app)
        .post(`/api/nodes/${testNodeId}/updates`)
        .set('Authorization', `Bearer ${authSession.accessToken}`)
        .send(createData)
        .expect(201);

      const updateId = createResponse.body.data.id;

      // Then delete it
      const response = await request(app)
        .delete(`/api/nodes/${testNodeId}/updates/${updateId}`)
        .set('Authorization', `Bearer ${authSession.accessToken}`)
        .expect(204);

      expect(response.body).toEqual({});

      // Verify it's not returned in list
      const listResponse = await request(app)
        .get(`/api/nodes/${testNodeId}/updates`)
        .set('Authorization', `Bearer ${authSession.accessToken}`)
        .expect(200);

      const deletedUpdate = listResponse.body.data.updates.find(
        (u: any) => u.id === updateId
      );
      expect(deletedUpdate).toBeUndefined();
    });

    it('should return 404 for non-existent update', async () => {
      const response = await request(app)
        .delete(`/api/nodes/${testNodeId}/updates/non-existent-id`)
        .set('Authorization', `Bearer ${authSession.accessToken}`)
        .expect(404);

      const body = response.body as ApiErrorResponse;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('Create update with interview activity', () => {
    it('should create update with interview activity flags', async () => {
      const updateData: CreateUpdateRequest = {
        meta: {
          appliedToJobs: true,
          completedInterviews: true,
          pendingInterviews: true,
        },
      };

      const response = await request(app)
        .post(`/api/nodes/${testNodeId}/updates`)
        .set('Authorization', `Bearer ${authSession.accessToken}`)
        .send(updateData)
        .expect(201);

      const body = response.body;
      expect(body.success).toBe(true);
      expect(body.data.meta.appliedToJobs).toBe(true);
      expect(body.data.meta.completedInterviews).toBe(true);
      expect(body.data.meta.pendingInterviews).toBe(true);
    });

    it('should handle activity flag updates', async () => {
      // First create an update
      const initialData: CreateUpdateRequest = {
        meta: {
          appliedToJobs: true,
          pendingInterviews: true,
        },
      };

      const createResponse = await request(app)
        .post(`/api/nodes/${testNodeId}/updates`)
        .set('Authorization', `Bearer ${authSession.accessToken}`)
        .send(initialData)
        .expect(201);

      const updateId = createResponse.body.data.id;

      // Update with modified activity flags
      const updateData = {
        meta: {
          appliedToJobs: false,
          pendingInterviews: false,
          completedInterviews: true,
          receivedOffers: true,
        },
      };

      const updateResponse = await request(app)
        .put(`/api/nodes/${testNodeId}/updates/${updateId}`)
        .set('Authorization', `Bearer ${authSession.accessToken}`)
        .send(updateData)
        .expect(200);

      const updatedBody = updateResponse.body;
      expect(updatedBody.data.meta.appliedToJobs).toBe(false);
      expect(updatedBody.data.meta.pendingInterviews).toBe(false);
      expect(updatedBody.data.meta.completedInterviews).toBe(true);
      expect(updatedBody.data.meta.receivedOffers).toBe(true);
    });

    it('should render text for vector database search', async () => {
      const updateData: CreateUpdateRequest = {
        notes: 'Made great progress this week',
        meta: {
          appliedToJobs: true,
          networked: true,
          completedInterviews: true,
          receivedOffers: true,
        },
      };

      const response = await request(app)
        .post(`/api/nodes/${testNodeId}/updates`)
        .set('Authorization', `Bearer ${authSession.accessToken}`)
        .send(updateData)
        .expect(201);

      const body = response.body;
      expect(body.data.renderedText).toBeDefined();
      expect(body.data.renderedText).toContain('applied to jobs');
      expect(body.data.renderedText).toContain('networked');
      expect(body.data.renderedText).toContain('Made great progress this week');
    });
  });

  describe('Permission denial integration', () => {
    it('should deny access to updates for unauthorized node', async () => {
      const updateData: CreateUpdateRequest = {
        meta: {
          appliedToJobs: true,
        },
      };

      const response = await request(app)
        .post(`/api/nodes/${unauthorizedNodeId}/updates`)
        .set('Authorization', `Bearer ${authSession.accessToken}`)
        .send(updateData)
        .expect(403);

      const body = response.body as ApiErrorResponse;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('ACCESS_DENIED');
      expect(body.error.message).toContain('permission');
    });

    it('should deny reading updates for unauthorized node', async () => {
      const response = await request(app)
        .get(`/api/nodes/${unauthorizedNodeId}/updates`)
        .set('Authorization', `Bearer ${authSession.accessToken}`)
        .expect(403);

      const body = response.body as ApiErrorResponse;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('ACCESS_DENIED');
    });

    it('should deny updating specific update for unauthorized node', async () => {
      const response = await request(app)
        .put(`/api/nodes/${unauthorizedNodeId}/updates/550e8400-e29b-41d4-a716-446655440003`)
        .set('Authorization', `Bearer ${authSession.accessToken}`)
        .send({ meta: { appliedToJobs: true } })
        .expect(403);

      const body = response.body as ApiErrorResponse;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('ACCESS_DENIED');
    });

    it('should deny deleting specific update for unauthorized node', async () => {
      const response = await request(app)
        .delete(`/api/nodes/${unauthorizedNodeId}/updates/550e8400-e29b-41d4-a716-446655440004`)
        .set('Authorization', `Bearer ${authSession.accessToken}`)
        .expect(403);

      const body = response.body as ApiErrorResponse;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('ACCESS_DENIED');
    });

    it('should allow update owner to modify their own updates', async () => {
      // Create an update as the authorized user
      const updateData: CreateUpdateRequest = {
        notes: 'My private notes',
        meta: {
          appliedToJobs: true,
        },
      };

      const createResponse = await request(app)
        .post(`/api/nodes/${testNodeId}/updates`)
        .set('Authorization', `Bearer ${authSession.accessToken}`)
        .send(updateData)
        .expect(201);

      const updateId = createResponse.body.data.id;

      // Owner should be able to modify their own update
      const modifyResponse = await request(app)
        .put(`/api/nodes/${testNodeId}/updates/${updateId}`)
        .set('Authorization', `Bearer ${authSession.accessToken}`)
        .send({
          notes: 'Updated private notes',
          meta: {
            appliedToJobs: false,
          },
        })
        .expect(200);

      expect(modifyResponse.body.data.meta.appliedToJobs).toBe(false);
      expect(modifyResponse.body.data.notes).toBe('Updated private notes');

      // Owner should be able to delete their own update
      await request(app)
        .delete(`/api/nodes/${testNodeId}/updates/${updateId}`)
        .set('Authorization', `Bearer ${authSession.accessToken}`)
        .expect(204);
    });
  });
});