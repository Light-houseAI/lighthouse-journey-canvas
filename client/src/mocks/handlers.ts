import { http, HttpResponse } from 'msw';

// Mock timeline node data
const mockTimelineNodes = [
  {
    id: '1',
    title: 'Senior Software Engineer',
    company: 'TechCorp',
    startDate: '2023-01-01',
    endDate: null, // Current position
    description: 'Lead development of user-facing features',
    type: 'experience',
    isCurrent: true,
    parentId: null,
    children: [
      {
        id: '2',
        title: 'React Migration Project',
        company: 'TechCorp',
        startDate: '2023-06-01',
        endDate: '2023-12-01',
        description: 'Led migration from legacy system to React',
        type: 'project',
        isCurrent: false,
        parentId: '1',
        children: [],
      },
    ],
  },
  {
    id: '3',
    title: 'Software Engineer',
    company: 'StartupInc',
    startDate: '2021-01-01',
    endDate: '2022-12-31',
    description: 'Full-stack development with Node.js and React',
    type: 'experience',
    isCurrent: false,
    parentId: null,
    children: [],
  },
];

const mockUser = {
  id: 1,
  email: 'test@example.com',
  firstName: 'John',
  lastName: 'Doe',
  userName: 'johndoe',
  hasCompletedOnboarding: true,
  createdAt: '2023-01-01T00:00:00Z',
};

export const handlers = [
  // Profile timeline nodes endpoint
  http.get('/api/v2/timeline/nodes', ({ request }) => {
    const url = new URL(request.url);
    const username = url.searchParams.get('username');

    // Simulate different responses based on username
    if (username === 'nonexistent') {
      return HttpResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return HttpResponse.json({
      success: true,
      data: {
        user: mockUser,
        nodes: mockTimelineNodes,
      },
    });
  }),

  // Individual node details endpoint
  http.get('/api/v2/timeline/nodes/:nodeId', ({ params }) => {
    const { nodeId } = params;

    // Find node in mock data
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
      return HttpResponse.json({ error: 'Node not found' }, { status: 404 });
    }

    return HttpResponse.json({
      success: true,
      data: node,
    });
  }),

  // Error scenarios for testing
  http.get('/api/v2/timeline/nodes/error', () => {
    return HttpResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }),

  // Unauthorized access
  http.get('/api/v2/timeline/nodes/unauthorized', () => {
    return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }),

  // Forbidden access
  http.get('/api/v2/timeline/nodes/forbidden', () => {
    return HttpResponse.json({ error: 'Forbidden' }, { status: 403 });
  }),
];
