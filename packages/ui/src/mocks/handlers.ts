import { http, HttpResponse } from 'msw';

import { profileHandlers } from './profile-handlers';
import { permissionHandlers } from './permission-handlers';
import { authHandlers } from './auth-handlers';

// Import base URL from shared config
import { MSW_BASE_URL } from './config';

// Import mock data
import { buildOrganizationsResponse, mockTimelineNodesJson } from './mock-data';

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

// Organization and timeline handlers
const organizationHandlers = [
  // GET /api/v2/organizations - List all organizations
  http.get(`${MSW_BASE_URL}/api/v2/organizations`, () => {
    console.log('🎯 MSW intercepted: GET /api/v2/organizations');
    return HttpResponse.json(buildOrganizationsResponse());
  }),

  // Also handle localhost:3000 URLs
  http.get('http://localhost:3000/api/v2/organizations', () => {
    console.log(
      '🎯 MSW intercepted: GET http://localhost:3000/api/v2/organizations'
    );
    return HttpResponse.json(buildOrganizationsResponse());
  }),

  // GET /api/v2/timeline/nodes - List timeline nodes
  http.get(`${MSW_BASE_URL}/api/v2/timeline/nodes`, () => {
    console.log('🎯 MSW intercepted: GET /api/v2/timeline/nodes');
    return HttpResponse.json(mockTimelineNodesJson);
  }),

  // Also handle localhost:3000 URLs
  http.get('http://localhost:3000/api/v2/timeline/nodes', () => {
    console.log(
      '🎯 MSW intercepted: GET http://localhost:3000/api/v2/timeline/nodes'
    );
    return HttpResponse.json(mockTimelineNodesJson);
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

// Debug handler to log all unhandled requests
const debugHandler = http.all('*', ({ request }) => {
  console.log('⚠️ Unhandled request:', request.method, request.url);
  // Let it pass through to see what's happening
  return new HttpResponse(null, { status: 404 });
});

export const handlers = [
  ...authHandlers, // Comprehensive auth handlers (from auth-handlers.ts)
  ...profileHandlers, // New profile API handlers for profile view feature
  ...permissionHandlers, // Permission management handlers for sharing feature
  ...organizationHandlers, // Organization and timeline handlers
  ...legacyHandlers, // Legacy handlers for backward compatibility
  debugHandler, // Catch-all debug handler at the end
];
