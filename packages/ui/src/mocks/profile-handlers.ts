import { http, HttpResponse } from 'msw';

import {
  createMockNodeDetailsResponse,
  createMockProfileResponse,
  createMockProfileData,
} from './test-factories/profile-factories-improved';
import type { NodeDetailsResponse, ProfileResponse } from '../types/profile';
import { mockTimelineNodesJson } from './mock-data';

// Simple delay utility for simulating network latency
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ============================================================================
// PROFILE API HANDLERS
// ============================================================================

export const profileHandlers = [
  // GET /api/v2/timeline/nodes - Profile endpoint with timeline nodes
  http.get('/api/v2/timeline/nodes', async ({ request }) => {
    const url = new URL(request.url);
    const username = url.searchParams.get('username');

    // Simulate network delay
    await delay(200);

    // If no username is provided, return array of nodes for current user
    // This is used by hierarchyApi.listNodes()
    if (!username) {
      return HttpResponse.json(mockTimelineNodesJson);
    }

    // Error scenarios
    if (username === 'nonexistent') {
      return HttpResponse.json(
        { error: 'Profile not found', message: 'User does not exist' },
        { status: 404 }
      );
    }

    if (username === 'unauthorized') {
      return HttpResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    if (username === 'forbidden') {
      return HttpResponse.json(
        { error: 'Forbidden', message: 'No permission to view this profile' },
        { status: 403 }
      );
    }

    // Success response with timeline data
    const profileData = createMockProfileData({
      user: {
        id: 1,
        email: 'test@example.com',
        firstName: username === 'testuser' ? 'Test' : 'Current',
        lastName: 'User',
        userName: username || 'currentuser',
        bio: 'Software engineer',
        avatarUrl: null,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
      },
    });

    const mockResponse: ProfileResponse = {
      profile: {
        userName: profileData.user.userName,
        firstName: profileData.user.firstName,
        lastName: profileData.user.lastName,
        profileUrl: `https://app.lighthouse.ai/${username || 'currentuser'}`,
      },
      timeline: {
        current: profileData.nodes.filter((n) => n.isCurrent),
        past: profileData.nodes.filter((n) => !n.isCurrent),
        totalCount: profileData.nodes.length,
      },
      permissions: {
        canEdit: true,
        canShare: true,
      },
    };

    return HttpResponse.json(mockResponse);
  }),

  // GET /api/v2/timeline/nodes/:nodeId - Node details endpoint
  http.get('/api/v2/timeline/nodes/:nodeId', async ({ params }) => {
    const { nodeId } = params;

    // Simulate network delay
    await delay(100);

    // Error scenarios
    if (nodeId === 'nonexistent') {
      return HttpResponse.json(
        { error: 'Node not found', message: 'Timeline node does not exist' },
        { status: 404 }
      );
    }

    if (nodeId === 'forbidden') {
      return HttpResponse.json(
        { error: 'Forbidden', message: 'No permission to view this node' },
        { status: 403 }
      );
    }

    // Success response
    const mockResponse: NodeDetailsResponse = createMockNodeDetailsResponse(
      { id: nodeId as string },
      {
        insights:
          nodeId === 'node-with-insights'
            ? [
                {
                  id: 'insight-1',
                  type: 'achievement',
                  content: 'Successfully led team of 5 developers',
                  createdAt: new Date('2023-06-01'),
                },
                {
                  id: 'insight-2',
                  type: 'skill',
                  content:
                    'Mastered advanced React patterns and state management',
                  createdAt: new Date('2023-08-15'),
                },
              ]
            : undefined,
      }
    );

    return HttpResponse.json(mockResponse);
  }),

  // PATCH /api/v2/timeline/nodes/:nodeId - Update node endpoint (for future editing)
  http.patch('/api/v2/timeline/nodes/:nodeId', async ({ params, request }) => {
    const { nodeId } = params;
    const updates = await request.json();

    // Simulate network delay
    await delay(300);

    // Error scenarios
    if (nodeId === 'readonly') {
      return HttpResponse.json(
        { error: 'Forbidden', message: 'This node is read-only' },
        { status: 403 }
      );
    }

    // Success response - return updated node
    const updatedNode = createMockNodeDetailsResponse({
      id: nodeId as string,
      ...updates,
    });

    return HttpResponse.json(updatedNode);
  }),

  // DELETE /api/v2/timeline/nodes/:nodeId - Delete node endpoint (for future editing)
  http.delete('/api/v2/timeline/nodes/:nodeId', async ({ params }) => {
    const { nodeId } = params;

    // Simulate network delay
    await delay(200);

    // Error scenarios
    if (nodeId === 'protected') {
      return HttpResponse.json(
        { error: 'Forbidden', message: 'This node cannot be deleted' },
        { status: 403 }
      );
    }

    if (nodeId === 'nonexistent') {
      return HttpResponse.json(
        { error: 'Not found', message: 'Node does not exist' },
        { status: 404 }
      );
    }

    // Success response
    return HttpResponse.json({ success: true, message: 'Node deleted' });
  }),
];

// ============================================================================
// TEST-SPECIFIC HANDLERS
// ============================================================================

export const profileTestHandlers = [
  ...profileHandlers,

  // Slow response for loading state tests
  http.get('/api/v2/timeline/nodes/slow', async () => {
    await delay(2000);
    return HttpResponse.json(createMockProfileResponse());
  }),

  // Large dataset for performance testing
  http.get('/api/v2/timeline/nodes/large', async () => {
    await delay(500);

    const largeResponse = createMockProfileResponse({
      timeline: {
        current: Array.from(
          { length: 25 },
          () => createMockProfileResponse().timeline.current[0]
        ),
        past: Array.from(
          { length: 75 },
          () => createMockProfileResponse().timeline.past[0]
        ),
        totalCount: 100,
      },
    });

    return HttpResponse.json(largeResponse);
  }),

  // Network error simulation
  http.get('/api/v2/timeline/nodes/network-error', () => {
    return HttpResponse.error();
  }),
];
