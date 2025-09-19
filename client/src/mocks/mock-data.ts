/**
 * Centralized Mock Data for MSW Handlers and Tests
 *
 * This file contains all mock data used by MSW handlers and tests to ensure
 * consistency and single source of truth for test data.
 *
 * Usage patterns:
 * 1. Import mock data directly in tests for assertions:
 *    import { mockOrganizations, mockTimelineNodes } from '@/mocks/mock-data';
 *
 * 2. Use scenario functions in handlers:
 *    const response = buildBulkPermissionsResponse(nodeIds, 'allOrganizations');
 *
 * 3. Set scenarios in tests:
 *    import { setMockPermissionsScenario } from '@/mocks/permission-handlers';
 *    setMockPermissionsScenario('allOrganizations');
 *
 * Benefits:
 * - Single source of truth for all test data
 * - Consistent data between handlers and test assertions
 * - Easy to maintain and update test scenarios
 * - Follows MSW best practices for centralized mock data
 */

import {
  TimelineNodeType,
  VisibilityLevel,
  SubjectType,
  PolicyEffect,
  PermissionAction,
  OrganizationType,
} from '@shared/enums';
import type { TimelineNode, Organization, NodePolicy } from '@shared/schema';

// ============================================================================
// ORGANIZATIONS
// ============================================================================

export const mockOrganizations: Organization[] = [
  {
    id: 111,
    name: 'Syracuse University',
    type: OrganizationType.EducationalInstitution,
    description: 'Alma mater',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 222,
    name: 'University of Maryland',
    type: OrganizationType.EducationalInstitution,
    description: 'Current school',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 333,
    name: 'PayPal',
    type: OrganizationType.Company,
    description: 'Current employer',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
];

// ============================================================================
// USERS
// ============================================================================

export interface MockUser {
  id: number;
  email: string;
  userName: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  company?: string;
  avatarUrl?: string;
}

export const mockUsers: MockUser[] = [
  {
    id: 1,
    email: 'neil.sayers@google.com',
    userName: 'neil_sayers',
    firstName: 'Neil',
    lastName: 'Sayers',
    title: 'Head of Product',
    company: 'Google',
    avatarUrl: undefined, // Will use default avatar
  },
  {
    id: 2,
    email: 'neil.summers@meta.com',
    userName: 'neil_summers',
    firstName: 'Neil',
    lastName: 'Summers',
    title: 'Account Coordinator',
    company: 'Meta',
    avatarUrl: undefined,
  },
  {
    id: 3,
    email: 'neil.tomas@berkeley.edu',
    userName: 'neil_tomas',
    firstName: 'Neil',
    lastName: 'Tomas',
    title: 'Graduate Student',
    company: 'Berkeley',
    avatarUrl: undefined,
  },
  {
    id: 4,
    email: 'john@example.com',
    userName: 'john_doe',
    firstName: 'John',
    lastName: 'Doe',
    title: 'Software Engineer',
    company: 'TechCorp',
    avatarUrl: undefined,
  },
  {
    id: 5,
    email: 'jane@example.com',
    userName: 'jane_smith',
    firstName: 'Jane',
    lastName: 'Smith',
    title: 'Product Manager',
    company: 'StartupInc',
    avatarUrl: undefined,
  },
  {
    id: 6,
    email: 'bob@example.com',
    userName: 'bob_wilson',
    firstName: 'Bob',
    lastName: 'Wilson',
    title: 'Designer',
    company: 'DesignCorp',
    avatarUrl: undefined,
  },
  {
    id: 7,
    email: 'alice@example.com',
    userName: 'alice_jones',
    firstName: 'Alice',
    lastName: 'Jones',
    title: 'Data Scientist',
    company: 'DataLabs',
    avatarUrl: undefined,
  },
];

// ============================================================================
// TIMELINE NODES
// ============================================================================

export const mockTimelineNodes: TimelineNode[] = [
  {
    id: 'node-1',
    type: TimelineNodeType.Job,
    title: 'Senior Software Engineer',
    parentId: null,
    childrenIds: [],
    userId: 1,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    meta: {
      company: 'PayPal',
      startDate: '2023-01',
      endDate: null,
    },
  },
  {
    id: 'node-2',
    type: TimelineNodeType.Education,
    title: 'Computer Science',
    parentId: null,
    childrenIds: [],
    userId: 1,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    meta: {
      school: 'Syracuse University',
      degree: 'Bachelor',
      startDate: '2015-09',
      endDate: '2019-05',
    },
  },
  {
    id: 'node-3',
    type: TimelineNodeType.Education,
    title: 'Masters in Computer Science',
    parentId: null,
    childrenIds: [],
    userId: 1,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    meta: {
      school: 'University of Maryland',
      degree: 'Masters',
      startDate: '2019-09',
      endDate: '2021-05',
    },
  },
];

// For API responses, we need the nodes in JSON-serializable format
export const mockTimelineNodesJson = mockTimelineNodes.map((node) => ({
  ...node,
  createdAt: node.createdAt.toISOString(),
  updatedAt: node.updatedAt.toISOString(),
}));

// ============================================================================
// NODE POLICIES
// ============================================================================

export const mockNodePolicies: Record<string, NodePolicy[]> = {
  // Empty state - no permissions
  empty: [],

  // Syracuse University has overview access to node-2
  syracuse: [
    {
      id: 'policy-syracuse',
      nodeId: 'node-2',
      subjectType: SubjectType.Organization,
      subjectId: 111, // Syracuse University
      level: VisibilityLevel.Overview,
      effect: PolicyEffect.Allow,
      action: PermissionAction.View,
      createdAt: new Date('2025-01-15'),
      principalName: 'Syracuse University',
    },
  ],

  // University of Maryland has full access to node-3
  maryland: [
    {
      id: 'policy-maryland',
      nodeId: 'node-3',
      subjectType: SubjectType.Organization,
      subjectId: 222, // University of Maryland
      level: VisibilityLevel.Full,
      effect: PolicyEffect.Allow,
      action: PermissionAction.View,
      createdAt: new Date('2025-01-16'),
      principalName: 'University of Maryland',
    },
  ],

  // PayPal has overview access to node-1
  paypal: [
    {
      id: 'policy-paypal',
      nodeId: 'node-1',
      subjectType: SubjectType.Organization,
      subjectId: 333, // PayPal
      level: VisibilityLevel.Overview,
      effect: PolicyEffect.Allow,
      action: PermissionAction.View,
      createdAt: new Date('2025-01-17'),
      principalName: 'PayPal',
    },
  ],

  // User permissions
  usersWithAccess: [
    {
      id: 'policy-user-1',
      nodeId: 'node-1',
      subjectType: SubjectType.User,
      subjectId: 1, // Neil Sayers
      level: VisibilityLevel.Overview,
      effect: PolicyEffect.Allow,
      action: PermissionAction.View,
      createdAt: new Date('2025-01-15'),
      principalName: 'Neil Sayers',
    },
    {
      id: 'policy-user-2',
      nodeId: 'node-2',
      subjectType: SubjectType.User,
      subjectId: 2, // Neil Summers
      level: VisibilityLevel.Full,
      effect: PolicyEffect.Allow,
      action: PermissionAction.View,
      createdAt: new Date('2025-01-16'),
      principalName: 'Neil Summers',
    },
  ],

  // Combined policies for all organizations
  allOrganizations: [
    {
      id: 'policy-syracuse',
      nodeId: 'node-2',
      subjectType: SubjectType.Organization,
      subjectId: 111,
      level: VisibilityLevel.Overview,
      effect: PolicyEffect.Allow,
      action: PermissionAction.View,
      createdAt: new Date('2025-01-15'),
      principalName: 'Syracuse University',
    },
    {
      id: 'policy-maryland',
      nodeId: 'node-3',
      subjectType: SubjectType.Organization,
      subjectId: 222,
      level: VisibilityLevel.Full,
      effect: PolicyEffect.Allow,
      action: PermissionAction.View,
      createdAt: new Date('2025-01-16'),
      principalName: 'University of Maryland',
    },
    {
      id: 'policy-paypal',
      nodeId: 'node-1',
      subjectType: SubjectType.Organization,
      subjectId: 333,
      level: VisibilityLevel.Overview,
      effect: PolicyEffect.Allow,
      action: PermissionAction.View,
      createdAt: new Date('2025-01-17'),
      principalName: 'PayPal',
    },
  ],
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get policies for a specific node
 */
export function getPoliciesForNode(
  nodeId: string,
  scenario: 'empty' | 'allOrganizations' | 'usersWithAccess' = 'empty'
): NodePolicy[] {
  if (scenario === 'empty') {
    return [];
  }

  if (scenario === 'usersWithAccess') {
    return mockNodePolicies.usersWithAccess.filter(
      (policy) => policy.nodeId === nodeId
    );
  }

  return mockNodePolicies.allOrganizations.filter(
    (policy) => policy.nodeId === nodeId
  );
}

/**
 * Get a specific organization by ID
 */
export function getOrganizationById(id: number): Organization | undefined {
  return mockOrganizations.find((org) => org.id === id);
}

/**
 * Get a specific timeline node by ID
 */
export function getTimelineNodeById(id: string): TimelineNode | undefined {
  return mockTimelineNodes.find((node) => node.id === id);
}

// ============================================================================
// MOCK RESPONSE BUILDERS
// ============================================================================

/**
 * Build a bulk permissions response for multiple nodes
 */
export function buildBulkPermissionsResponse(
  nodeIds: string[],
  scenario: 'empty' | 'allOrganizations' | 'usersWithAccess' = 'empty'
) {
  return nodeIds.map((nodeId) => ({
    nodeId,
    policies: getPoliciesForNode(nodeId, scenario).map((policy) => ({
      ...policy,
      createdAt: policy.createdAt.toISOString(),
    })),
  }));
}

/**
 * Build organizations response for API
 */
export function buildOrganizationsResponse() {
  return mockOrganizations.map((org) => ({
    ...org,
    createdAt: org.createdAt.toISOString(),
    updatedAt: org.updatedAt.toISOString(),
  }));
}
