import { http, HttpResponse } from 'msw';

import { profileHandlers } from './profile-handlers';

// Legacy mock data - keeping for backward compatibility
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

// Authentication handlers
const authHandlers = [
  // POST /api/auth/login - Login endpoint
  http.post('/api/auth/login', async ({ request }) => {
    const body = await request.json() as any;
    
    // Simple mock authentication
    if (body.email && body.password) {
      return HttpResponse.json({
        success: true,
        user: {
          id: 1,
          email: body.email,
          firstName: 'Test',
          lastName: 'User',
          userName: body.email.split('@')[0],
        },
        token: 'mock-jwt-token',
      });
    }
    
    return HttpResponse.json(
      { error: 'Invalid credentials' },
      { status: 401 }
    );
  }),
];

// Legacy handlers - keeping for backward compatibility
const legacyHandlers = [
  // Legacy profile timeline nodes endpoint (v1)
  http.get('/api/timeline/nodes', ({ request }) => {
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

  // Error scenarios for testing
  http.get('/api/timeline/nodes/error', () => {
    return HttpResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }),
];

export const handlers = [
  ...profileHandlers, // New profile API handlers for profile view feature
  ...authHandlers,    // Authentication handlers for login/logout
  ...legacyHandlers,   // Legacy handlers for backward compatibility
];
