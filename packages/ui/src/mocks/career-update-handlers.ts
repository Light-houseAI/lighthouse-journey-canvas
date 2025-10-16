/**
 * MSW Career Update Handlers
 *
 * Handles career transition update endpoints for testing career progress tracking
 */

import { http, HttpResponse } from 'msw';
import type { UpdateResponse, CreateUpdateRequest, UpdateUpdateRequest } from '@journey/schema';

// Types for update operations
interface CareerUpdate extends UpdateResponse {
  id: string;
  nodeId: string;
  notes?: string;
  meta: {
    appliedToJobs?: boolean;
    updatedResumeOrPortfolio?: boolean;
    networked?: boolean;
    developedSkills?: boolean;
    pendingInterviews?: boolean;
    completedInterviews?: boolean;
    practicedMock?: boolean;
    receivedOffers?: boolean;
    receivedRejections?: boolean;
    possiblyGhosted?: boolean;
  };
  renderedText?: string;
  createdAt: string;
  updatedAt: string;
}

interface PaginatedUpdatesResponse {
  updates: CareerUpdate[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Store for managing career updates (useful for testing CRUD operations)
let updatesStore: Map<string, Map<string, CareerUpdate>> = new Map();
let updateIdCounter = 1;

/**
 * Reset updates state (useful between tests)
 */
export function resetCareerUpdatesState() {
  updatesStore = new Map();
  updateIdCounter = 1;
}

/**
 * Generate rendered text from meta flags
 */
function generateRenderedText(meta: CareerUpdate['meta']): string {
  const activities: string[] = [];

  if (meta.appliedToJobs) activities.push('Applied to jobs');
  if (meta.updatedResumeOrPortfolio) activities.push('Updated resume/portfolio');
  if (meta.networked) activities.push('Networked');
  if (meta.developedSkills) activities.push('Developed skills');
  if (meta.pendingInterviews) activities.push('Pending interviews');
  if (meta.completedInterviews) activities.push('Completed interviews');
  if (meta.practicedMock) activities.push('Practiced mock interviews');
  if (meta.receivedOffers) activities.push('Received offers');
  if (meta.receivedRejections) activities.push('Received rejections');
  if (meta.possiblyGhosted) activities.push('Possibly ghosted');

  return activities.length > 0 ? activities.join(', ') : 'No activities';
}

/**
 * Create a mock career update
 */
function createMockUpdate(
  nodeId: string,
  data: CreateUpdateRequest,
  id?: string
): CareerUpdate {
  const updateId = id || `update-${updateIdCounter++}`;
  const now = new Date().toISOString();

  const update: CareerUpdate = {
    id: updateId,
    nodeId,
    notes: data.notes,
    meta: {
      appliedToJobs: data.meta?.appliedToJobs || false,
      updatedResumeOrPortfolio: data.meta?.updatedResumeOrPortfolio || false,
      networked: data.meta?.networked || false,
      developedSkills: data.meta?.developedSkills || false,
      pendingInterviews: data.meta?.pendingInterviews || false,
      completedInterviews: data.meta?.completedInterviews || false,
      practicedMock: data.meta?.practicedMock || false,
      receivedOffers: data.meta?.receivedOffers || false,
      receivedRejections: data.meta?.receivedRejections || false,
      possiblyGhosted: data.meta?.possiblyGhosted || false,
    },
    createdAt: now,
    updatedAt: now,
  };

  update.renderedText = generateRenderedText(update.meta);

  return update;
}

/**
 * Get or create node updates collection
 */
function getNodeUpdates(nodeId: string): Map<string, CareerUpdate> {
  if (!updatesStore.has(nodeId)) {
    updatesStore.set(nodeId, new Map());
  }
  return updatesStore.get(nodeId)!;
}

export const careerUpdateHandlers = [
  // ============================================================================
  // CREATE UPDATE
  // ============================================================================

  // POST /api/nodes/:nodeId/updates - Create new career update
  http.post('/api/nodes/:nodeId/updates', async ({ params, request }) => {
    const { nodeId } = params as { nodeId: string };
    const body = await request.json() as CreateUpdateRequest;

    // Validate nodeId
    if (nodeId === 'non-existent') {
      return HttpResponse.json(
        {
          error: 'Node not found',
          success: false
        },
        { status: 404 }
      );
    }

    // Validate request body
    if (!body.notes && !body.meta) {
      return HttpResponse.json(
        {
          error: 'At least notes or meta must be provided',
          success: false
        },
        { status: 400 }
      );
    }

    // Create update
    const update = createMockUpdate(nodeId, body);
    const nodeUpdates = getNodeUpdates(nodeId);
    nodeUpdates.set(update.id, update);

    return HttpResponse.json({
      success: true,
      data: update
    }, { status: 201 });
  }),

  // ============================================================================
  // GET UPDATES
  // ============================================================================

  // GET /api/nodes/:nodeId/updates - Get all updates for a node (paginated)
  http.get('/api/nodes/:nodeId/updates', ({ params, request }) => {
    const { nodeId } = params as { nodeId: string };
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');

    // Validate nodeId
    if (nodeId === 'non-existent') {
      return HttpResponse.json(
        {
          error: 'Node not found',
          success: false
        },
        { status: 404 }
      );
    }

    // Get updates for node
    const nodeUpdates = getNodeUpdates(nodeId);
    const allUpdates = Array.from(nodeUpdates.values());

    // Sort by createdAt descending (newest first)
    allUpdates.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Paginate
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedUpdates = allUpdates.slice(startIndex, endIndex);

    const response: PaginatedUpdatesResponse = {
      updates: paginatedUpdates,
      total: allUpdates.length,
      page,
      limit,
      hasMore: endIndex < allUpdates.length
    };

    return HttpResponse.json({
      success: true,
      data: response
    });
  }),

  // GET /api/nodes/:nodeId/updates/:updateId - Get specific update
  http.get('/api/nodes/:nodeId/updates/:updateId', ({ params }) => {
    const { nodeId, updateId } = params as { nodeId: string; updateId: string };

    // Validate nodeId
    if (nodeId === 'non-existent') {
      return HttpResponse.json(
        {
          error: 'Node not found',
          success: false
        },
        { status: 404 }
      );
    }

    // Get update
    const nodeUpdates = getNodeUpdates(nodeId);
    const update = nodeUpdates.get(updateId);

    if (!update) {
      return HttpResponse.json(
        {
          error: 'Update not found',
          success: false
        },
        { status: 404 }
      );
    }

    // Validate update belongs to node
    if (update.nodeId !== nodeId) {
      return HttpResponse.json(
        {
          error: 'Update does not belong to this node',
          success: false
        },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      data: update
    });
  }),

  // ============================================================================
  // UPDATE
  // ============================================================================

  // PUT /api/nodes/:nodeId/updates/:updateId - Update existing update
  http.put('/api/nodes/:nodeId/updates/:updateId', async ({ params, request }) => {
    const { nodeId, updateId } = params as { nodeId: string; updateId: string };
    const body = await request.json() as UpdateUpdateRequest;

    // Validate nodeId
    if (nodeId === 'non-existent') {
      return HttpResponse.json(
        {
          error: 'Node not found',
          success: false
        },
        { status: 404 }
      );
    }

    // Get update
    const nodeUpdates = getNodeUpdates(nodeId);
    const existingUpdate = nodeUpdates.get(updateId);

    if (!existingUpdate) {
      return HttpResponse.json(
        {
          error: 'Update not found',
          success: false
        },
        { status: 404 }
      );
    }

    // Validate update belongs to node
    if (existingUpdate.nodeId !== nodeId) {
      return HttpResponse.json(
        {
          error: 'Update does not belong to this node',
          success: false
        },
        { status: 404 }
      );
    }

    // Update fields
    const updatedUpdate: CareerUpdate = {
      ...existingUpdate,
      notes: body.notes !== undefined ? body.notes : existingUpdate.notes,
      meta: {
        ...existingUpdate.meta,
        ...body.meta,
      },
      updatedAt: new Date().toISOString(),
    };

    updatedUpdate.renderedText = generateRenderedText(updatedUpdate.meta);

    // Store updated version
    nodeUpdates.set(updateId, updatedUpdate);

    return HttpResponse.json({
      success: true,
      data: updatedUpdate
    });
  }),

  // ============================================================================
  // DELETE
  // ============================================================================

  // DELETE /api/nodes/:nodeId/updates/:updateId - Delete update
  http.delete('/api/nodes/:nodeId/updates/:updateId', ({ params }) => {
    const { nodeId, updateId } = params as { nodeId: string; updateId: string };

    // Validate nodeId
    if (nodeId === 'non-existent') {
      return HttpResponse.json(
        {
          error: 'Node not found',
          success: false
        },
        { status: 404 }
      );
    }

    // Get update
    const nodeUpdates = getNodeUpdates(nodeId);
    const update = nodeUpdates.get(updateId);

    if (!update) {
      return HttpResponse.json(
        {
          error: 'Update not found',
          success: false
        },
        { status: 404 }
      );
    }

    // Validate update belongs to node
    if (update.nodeId !== nodeId) {
      return HttpResponse.json(
        {
          error: 'Update does not belong to this node',
          success: false
        },
        { status: 404 }
      );
    }

    // Delete update
    nodeUpdates.delete(updateId);

    return HttpResponse.json(
      null,
      { status: 204 }
    );
  }),
];

/**
 * Seed updates for a node (useful for testing)
 */
export function seedCareerUpdates(nodeId: string, count: number = 3): CareerUpdate[] {
  const nodeUpdates = getNodeUpdates(nodeId);
  const created: CareerUpdate[] = [];

  for (let i = 0; i < count; i++) {
    const update = createMockUpdate(nodeId, {
      notes: `Update ${i + 1} for node ${nodeId}`,
      meta: {
        appliedToJobs: i % 2 === 0,
        networked: i % 3 === 0,
        completedInterviews: i % 4 === 0,
        receivedOffers: i === count - 1,
      }
    });
    nodeUpdates.set(update.id, update);
    created.push(update);
  }

  return created;
}
