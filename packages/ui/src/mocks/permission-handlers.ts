/**
 * MSW Handlers for Permission APIs
 * Based on OpenAPI schema from /server/openapi-schema.yaml
 */

import { http, HttpResponse } from 'msw';
import { MSW_BASE_URL } from './config';
import {
  VisibilityLevel,
  SubjectType,
  PolicyEffect,
  PermissionAction,
  OrganizationType,
} from '@journey/schema';
import {
  buildOrganizationsResponse,
  buildBulkPermissionsResponse,
  mockUsers,
  mockOrganizations,
} from './mock-data';

// State management for mock permissions
let currentScenario: 'empty' | 'allOrganizations' | 'usersWithAccess' = 'empty';

/**
 * Set the mock permissions scenario
 */
export function setMockPermissionsScenario(
  scenario: 'empty' | 'allOrganizations' | 'usersWithAccess'
) {
  currentScenario = scenario;
  console.log(`📝 Mock permissions scenario set to: ${scenario}`);
}

/**
 * Reset mock permissions to empty
 */
export function resetMockPermissions() {
  currentScenario = 'empty';
  console.log('🔄 Mock permissions reset to empty');
}

// Mock permission data matching the actual NodePolicy structure
interface MockNodePolicy {
  id: string;
  nodeId: string;
  subjectType: SubjectType;
  subjectId?: number;
  level: VisibilityLevel;
  effect: PolicyEffect;
  action: PermissionAction;
  createdAt: Date;
  expiresAt?: Date;
  // Additional display fields
  principalName?: string;
  principalEmail?: string;
}

// Sample mock permissions for testing - Initially empty to match Figma design
// The Figma shows "No access" for all organizations initially
let mockPermissions: MockNodePolicy[] = [];

export const permissionHandlers = [
  // GET /api/v2/timeline/nodes/:nodeId/permissions
  // Get all permissions for a specific node
  http.get(
    `${MSW_BASE_URL}/api/v2/timeline/nodes/:nodeId/permissions`,
    ({ params }) => {
      console.log(
        `🎯 MSW intercepted: GET /api/v2/timeline/nodes/${params.nodeId}/permissions`
      );
      const { nodeId } = params;
      const nodePermissions = mockPermissions.filter(
        (p) => p.nodeId === nodeId
      );

      return HttpResponse.json({
        success: true,
        data: nodePermissions,
        count: nodePermissions.length,
      });
    }
  ),

  // POST /api/v2/timeline/nodes/:nodeId/permissions
  // Create a new permission for a node
  http.post(
    `${MSW_BASE_URL}/api/v2/timeline/nodes/:nodeId/permissions`,
    async ({ params, request }) => {
      console.log(
        `🎯 MSW intercepted: POST /api/v2/timeline/nodes/${params.nodeId}/permissions`
      );
      const { nodeId } = params;
      const body = (await request.json()) as any;

      const newPolicy: MockNodePolicy = {
        id: `policy-${Date.now()}`,
        nodeId: nodeId as string,
        subjectType:
          body.subjectType ||
          (body.principalType === 'user'
            ? SubjectType.User
            : SubjectType.Organization),
        subjectId:
          body.subjectId ||
          (typeof body.principalId === 'string'
            ? parseInt(body.principalId)
            : body.principalId),
        level: body.level || body.accessLevel || VisibilityLevel.Overview,
        effect: PolicyEffect.Allow,
        action: PermissionAction.View,
        createdAt: new Date(),
        principalName: body.principalName,
        principalEmail: body.principalEmail,
      };

      mockPermissions.push(newPolicy);

      return HttpResponse.json(
        {
          success: true,
          data: newPolicy,
        },
        { status: 201 }
      );
    }
  ),

  // DELETE /api/v2/timeline/nodes/:nodeId/permissions/:policyId
  // Remove a permission
  http.delete(
    `${MSW_BASE_URL}/api/v2/timeline/nodes/:nodeId/permissions/:policyId`,
    ({ params }) => {
      console.log(
        `🎯 MSW intercepted: DELETE /api/v2/timeline/nodes/${params.nodeId}/permissions/${params.policyId}`
      );
      const { policyId } = params;
      const index = mockPermissions.findIndex((p) => p.id === policyId);

      if (index === -1) {
        return HttpResponse.json(
          {
            success: false,
            error: 'Permission not found',
          },
          { status: 404 }
        );
      }

      mockPermissions.splice(index, 1);

      return HttpResponse.json({
        success: true,
        message: 'Permission removed successfully',
      });
    }
  ),

  // PUT /api/v2/timeline/permissions/:policyId
  // Update a permission's access level
  http.put(
    `${MSW_BASE_URL}/api/v2/timeline/permissions/:policyId`,
    async ({ params, request }) => {
      console.log(
        `🎯 MSW intercepted: PUT /api/v2/timeline/permissions/${params.policyId}`
      );
      const { policyId } = params;
      const body = (await request.json()) as any;

      const permission = mockPermissions.find((p) => p.id === policyId);

      if (!permission) {
        return HttpResponse.json(
          {
            success: false,
            error: 'Permission not found',
          },
          { status: 404 }
        );
      }

      permission.level = body.level || body.accessLevel;

      return HttpResponse.json({
        success: true,
        data: permission,
      });
    }
  ),

  // POST /api/v2/timeline/nodes/permissions/bulk - Get permissions for multiple nodes
  http.post(
    `${MSW_BASE_URL}/api/v2/timeline/nodes/permissions/bulk`,
    async ({ request }) => {
      console.log(
        '🎯 MSW intercepted: POST /api/v2/timeline/nodes/permissions/bulk (absolute URL)'
      );
      const body = (await request.json()) as any;
      console.log('📝 Request body:', body);

      // Check if this is a request to GET permissions for multiple nodes
      if (body.nodeIds && !body.targets) {
        // Use the current scenario set by tests
        const results = buildBulkPermissionsResponse(
          body.nodeIds,
          currentScenario
        );
        console.log(
          '📦 Mock bulk permissions response:',
          JSON.stringify(results, null, 2)
        );
        return HttpResponse.json(results);
      }

      // Otherwise, it's creating permissions (original logic)
      const { nodeIds, targets } = body;

      const newPolicies: MockNodePolicy[] = [];

      for (const nodeId of nodeIds) {
        for (const target of targets) {
          const newPolicy: MockNodePolicy = {
            id: `policy-${Date.now()}-${Math.random()}`,
            nodeId,
            subjectType:
              target.type === 'user'
                ? SubjectType.User
                : SubjectType.Organization,
            subjectId:
              typeof target.id === 'string' ? parseInt(target.id) : target.id,
            level:
              target.level || target.accessLevel || VisibilityLevel.Overview,
            effect: PolicyEffect.Allow,
            action: PermissionAction.View,
            createdAt: new Date(),
            principalName: target.name,
            principalEmail: target.email,
          };
          newPolicies.push(newPolicy);
          mockPermissions.push(newPolicy);
        }
      }

      return HttpResponse.json({
        success: true,
        data: newPolicies,
        count: newPolicies.length,
      });
    }
  ),

  // Handle relative URL version
  http.post(`/api/v2/timeline/nodes/permissions/bulk`, async ({ request }) => {
    console.log(
      '🎯 MSW intercepted: POST /api/v2/timeline/nodes/permissions/bulk (relative URL)'
    );
    const body = (await request.json()) as any;
    console.log('📝 Request body:', body);

    // Check if this is a request to GET permissions for multiple nodes
    if (body.nodeIds && !body.targets) {
      // Use the current scenario set by tests
      const results = buildBulkPermissionsResponse(
        body.nodeIds,
        currentScenario
      );
      console.log(
        '📦 Mock bulk permissions response (absolute):',
        JSON.stringify(results, null, 2)
      );
      return HttpResponse.json(results);
    }

    // Otherwise, it's creating permissions (original logic)
    const { nodeIds, targets } = body;
    const newPolicies: MockNodePolicy[] = [];

    for (const nodeId of nodeIds) {
      for (const target of targets) {
        const newPolicy: MockNodePolicy = {
          id: `policy-${Date.now()}-${Math.random()}`,
          nodeId,
          subjectType:
            target.type === 'user'
              ? SubjectType.User
              : SubjectType.Organization,
          subjectId:
            typeof target.id === 'string' ? parseInt(target.id) : target.id,
          level: target.level || target.accessLevel || VisibilityLevel.Overview,
          effect: PolicyEffect.Allow,
          action: PermissionAction.View,
          createdAt: new Date(),
          principalName: target.name,
          principalEmail: target.email,
        };
        newPolicies.push(newPolicy);
        mockPermissions.push(newPolicy);
      }
    }

    return HttpResponse.json({
      success: true,
      data: newPolicies,
      count: newPolicies.length,
    });
  }),

  // Wildcard pattern to catch any host/port
  http.post('*/api/v2/timeline/nodes/permissions/bulk', async ({ request }) => {
    console.log(
      '🎯 MSW intercepted: POST /api/v2/timeline/nodes/permissions/bulk (wildcard)'
    );
    const body = (await request.json()) as any;
    console.log('📝 Request body:', body);

    if (body.nodeIds && !body.targets) {
      const scenario =
        mockPermissions.length > 0 ? 'allOrganizations' : 'empty';
      const results = buildBulkPermissionsResponse(body.nodeIds, scenario);
      console.log(
        '📦 Mock bulk permissions response (wildcard):',
        JSON.stringify(results, null, 2)
      );
      return HttpResponse.json(results);
    }

    return HttpResponse.json({ success: true, data: [], count: 0 });
  }),

  // User search endpoint - searches by first/last name
  http.get(`${MSW_BASE_URL}/api/v2/users/search`, ({ request }) => {
    console.log('🎯 MSW intercepted: GET /api/v2/users/search');
    const url = new URL(request.url);
    const query = url.searchParams.get('q') || '';

    const filtered = query.toLowerCase()
      ? mockUsers.filter((u) => {
          const fullName = `${u.firstName} ${u.lastName}`.toLowerCase();
          const queryLower = query.toLowerCase();

          // Search by first name, last name, or full name
          return (
            u.firstName?.toLowerCase().includes(queryLower) ||
            u.lastName?.toLowerCase().includes(queryLower) ||
            fullName.includes(queryLower)
          );
        })
      : [];

    return HttpResponse.json(filtered);
  }),

  // Organization search endpoint
  http.get(`${MSW_BASE_URL}/api/v2/organizations/search`, ({ request }) => {
    console.log('🎯 MSW intercepted: GET /api/v2/organizations/search');
    const url = new URL(request.url);
    const query = url.searchParams.get('q') || '';

    const filtered = query.toLowerCase()
      ? mockOrganizations
          .filter((o) => o.name.toLowerCase().includes(query.toLowerCase()))
          .map((org) => ({
            id: org.id,
            name: org.name,
            type: org.type,
          }))
      : [];

    return HttpResponse.json(filtered);
  }),

  // Get user's organizations
  http.get(`${MSW_BASE_URL}/api/v2/organizations/user`, () => {
    console.log('🎯 MSW intercepted: GET /api/v2/organizations/user');
    // Return a subset of organizations that the user belongs to
    return HttpResponse.json([
      {
        id: 333,
        name: 'PayPal',
        type: OrganizationType.Company,
        role: 'member',
      },
      {
        id: 111,
        name: 'Syracuse University',
        type: OrganizationType.EducationalInstitution,
        role: 'alumni',
      },
    ]);
  }),

  // Get all organizations - handle both with and without trailing slash
  http.get('http://localhost:3000/api/v2/organizations', () => {
    console.log(
      '🎯 MSW intercepted: GET /api/v2/organizations (no trailing slash - localhost:3000)'
    );
    const response = buildOrganizationsResponse();
    console.log('📋 Returning organizations:', response);
    return HttpResponse.json(response);
  }),
  http.get('http://localhost:3000/api/v2/organizations/', () => {
    console.log(
      '🎯 MSW intercepted: GET /api/v2/organizations/ (with trailing slash - localhost:3000)'
    );
    const response = buildOrganizationsResponse();
    console.log('📋 Returning organizations:', response);
    return HttpResponse.json(response);
  }),
  http.get(`${MSW_BASE_URL}/api/v2/organizations/`, () => {
    console.log(
      '🎯 MSW intercepted: GET /api/v2/organizations/ (absolute URL localhost:5000)'
    );
    const response = buildOrganizationsResponse();
    console.log('📋 Returning organizations:', response);
    return HttpResponse.json(response);
  }),
  http.get('/api/v2/organizations/', () => {
    console.log(
      '🎯 MSW intercepted: GET /api/v2/organizations/ (relative URL with slash)'
    );
    const response = buildOrganizationsResponse();
    console.log('📋 Returning organizations:', response);
    return HttpResponse.json(response);
  }),
  http.get('/api/v2/organizations', () => {
    console.log(
      '🎯 MSW intercepted: GET /api/v2/organizations (relative URL no slash)'
    );
    const response = buildOrganizationsResponse();
    console.log('📋 Returning organizations:', response);
    return HttpResponse.json(response);
  }),
  http.get('*/api/v2/organizations/', () => {
    console.log('🎯 MSW intercepted: GET /api/v2/organizations/ (wildcard)');
    const response = buildOrganizationsResponse();
    console.log('📋 Returning organizations:', response);
    return HttpResponse.json(response);
  }),

  // Get user by ID
  http.get(`${MSW_BASE_URL}/api/v2/users/:userId`, ({ params }) => {
    console.log(`🎯 MSW intercepted: GET /api/v2/users/${params.userId}`);
    const userId = parseInt(params.userId as string);

    const user = mockUsers.find((u) => u.id === userId);
    if (!user) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json(user);
  }),

  // Get users by IDs - needed for permission display (bulk)
  http.post(`${MSW_BASE_URL}/api/v2/users/by-ids`, async ({ request }) => {
    console.log('🎯 MSW intercepted: POST /api/v2/users/by-ids');
    const body = (await request.json()) as any;
    const ids = body.ids || [];

    return HttpResponse.json(mockUsers.filter((u) => ids.includes(u.id)));
  }),

  // Get organization by ID
  http.get(`${MSW_BASE_URL}/api/v2/organizations/:orgId`, ({ params }) => {
    console.log(
      `🎯 MSW intercepted: GET /api/v2/organizations/${params.orgId}`
    );
    const orgId = parseInt(params.orgId as string);

    const org = mockOrganizations.find((o) => o.id === orgId);
    if (!org) {
      return HttpResponse.json({
        id: orgId,
        name: `Organization ${orgId}`,
        type: OrganizationType.Company,
        description: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    return HttpResponse.json({
      ...org,
      createdAt: org.createdAt.toISOString(),
      updatedAt: org.updatedAt.toISOString(),
    });
  }),

  // Get organizations by IDs - needed for permission display
  http.post(
    `${MSW_BASE_URL}/api/v2/organizations/by-ids`,
    async ({ request }) => {
      console.log('🎯 MSW intercepted: POST /api/v2/organizations/by-ids');
      const body = (await request.json()) as any;
      const ids = body.ids || [];

      const filteredOrgs = mockOrganizations
        .filter((o) => ids.includes(o.id))
        .map((org) => ({
          ...org,
          createdAt: org.createdAt.toISOString(),
          updatedAt: org.updatedAt.toISOString(),
        }));

      return HttpResponse.json(filteredOrgs);
    }
  ),

  // Additional handlers for http://localhost:3000 (the actual client URL)
  http.get('http://localhost:3000/api/v2/users/:userId', ({ params }) => {
    console.log(
      `🎯 MSW intercepted: GET http://localhost:3000/api/v2/users/${params.userId}`
    );
    const userId = parseInt(params.userId as string);

    const user = mockUsers.find((u) => u.id === userId);
    if (!user) {
      return HttpResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return HttpResponse.json(user);
  }),

  // Handle user search on localhost:3000
  http.get('http://localhost:3000/api/v2/users/search', ({ request }) => {
    console.log(
      '🎯 MSW intercepted: GET http://localhost:3000/api/v2/users/search'
    );
    const url = new URL(request.url);
    const query = url.searchParams.get('q') || '';

    const filtered = query.toLowerCase()
      ? mockUsers.filter((u) => {
          const fullName = `${u.firstName} ${u.lastName}`.toLowerCase();
          const queryLower = query.toLowerCase();

          // Search by first name, last name, or full name
          return (
            u.firstName?.toLowerCase().includes(queryLower) ||
            u.lastName?.toLowerCase().includes(queryLower) ||
            fullName.includes(queryLower)
          );
        })
      : [];

    return HttpResponse.json(filtered);
  }),
];
