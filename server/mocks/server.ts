import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import type { ProfileResponse } from '../../client/src/types/profile';

// Mock data for testing
const mockUsers = {
  johndoe: {
    userName: 'johndoe',
    firstName: 'John',
    lastName: 'Doe',
    profileUrl: 'https://app.lighthouse.ai/johndoe',
  },
  currentuser: {
    userName: 'currentuser',
    firstName: 'Current',
    lastName: 'User',
    profileUrl: 'https://app.lighthouse.ai/currentuser',
  },
};

const mockTimelineNodes = [
  {
    id: 'node-1',
    type: 'job' as const,
    parentId: null,
    userId: 1,
    meta: {
      title: 'Senior Software Engineer',
      company: 'TechCorp',
      startDate: '2023-01-01',
      endDate: null, // Current job
      description: 'Leading development team',
    },
    isCurrent: true,
    depth: 0,
    children: [
      {
        id: 'node-2',
        type: 'project' as const,
        parentId: 'node-1',
        userId: 1,
        meta: {
          title: 'React Migration Project',
          company: 'TechCorp',
          startDate: '2023-06-01',
          endDate: '2023-12-01',
          description: 'Migrated legacy system to React',
        },
        isCurrent: false,
        depth: 1,
        children: [],
        path: ['node-1'],
        permissions: {
          canView: true,
          canEdit: true,
          canDelete: true,
        },
        createdAt: '2023-06-01T00:00:00Z',
        updatedAt: '2023-06-01T00:00:00Z',
      },
    ],
    path: [],
    permissions: {
      canView: true,
      canEdit: true,
      canDelete: true,
    },
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
  },
  {
    id: 'node-3',
    type: 'job' as const,
    parentId: null,
    userId: 1,
    meta: {
      title: 'Software Engineer',
      company: 'StartupInc',
      startDate: '2021-01-01',
      endDate: '2022-12-31', // Past job
      description: 'Full-stack development',
    },
    isCurrent: false,
    depth: 0,
    children: [],
    path: [],
    permissions: {
      canView: true,
      canEdit: true,
      canDelete: true,
    },
    createdAt: '2021-01-01T00:00:00Z',
    updatedAt: '2021-01-01T00:00:00Z',
  },
];

// MSW request handlers for server testing
export const handlers = [
  // Profile timeline nodes endpoint
  http.get('/api/v2/timeline/nodes', ({ request }) => {
    const url = new URL(request.url);
    const username = url.searchParams.get('username');

    // Check for authentication header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Handle different user scenarios
    if (username === 'nonexistent') {
      return HttpResponse.json(
        {
          error: 'User not found',
          message: 'The specified user profile does not exist',
        },
        { status: 404 }
      );
    }

    if (username === 'privateuser') {
      return HttpResponse.json(
        {
          error: 'Forbidden',
          message: 'You do not have permission to view this profile',
        },
        { status: 403 }
      );
    }

    // Determine user and permissions
    const targetUser = username ? mockUsers.johndoe : mockUsers.currentuser;
    const isOwner = !username || username === 'currentuser';

    // Separate current and past experiences
    const currentNodes = mockTimelineNodes.filter((node) => node.isCurrent);
    const pastNodes = mockTimelineNodes.filter((node) => !node.isCurrent);

    const response: ProfileResponse = {
      success: true,
      data: {
        user: targetUser,
        timeline: {
          current: currentNodes,
          past: pastNodes,
          totalCount:
            mockTimelineNodes.length +
            currentNodes.reduce(
              (count, node) => count + (node.children?.length || 0),
              0
            ),
        },
        permissions: {
          canEdit: isOwner,
          canShare: true,
          isOwner: isOwner,
        },
      },
    };

    return HttpResponse.json(response);
  }),

  // Individual node details endpoint
  http.get('/api/v2/timeline/nodes/:nodeId', ({ params, request }) => {
    const { nodeId } = params;

    // Check authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Find node (including nested children)
    const findNode = (nodes: any[], id: string): any => {
      for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children) {
          const found = findNode(node.children, id);
          if (found) return found;
        }
      }
      return null;
    };

    const node = findNode(mockTimelineNodes, nodeId as string);

    if (!node) {
      return HttpResponse.json(
        {
          error: 'Node not found',
          message: 'The specified node does not exist',
        },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      data: {
        node,
        insights: [],
        skills: ['React', 'TypeScript', 'Node.js'],
        attachments: [],
        permissions: node.permissions,
      },
    });
  }),

  // Error scenarios for testing
  http.get('/api/v2/timeline/nodes/error', () => {
    return HttpResponse.json(
      {
        error: 'Internal server error',
        message: 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }),
];

// Create and export the mock server
export const server = setupServer(...handlers);
