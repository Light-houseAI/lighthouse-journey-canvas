/**
 * Test Data Factories
 *
 * Provides factory functions for creating test data with sensible defaults
 * and flexible override capabilities. Uses plain TypeScript with Partial<T>
 * pattern for type-safe overrides without runtime overhead.
 *
 * @example
 * ```typescript
 * // Use defaults
 * const user = createMockUser();
 *
 * // Override specific fields
 * const customUser = createMockUser({
 *   overrides: { email: 'custom@test.com', firstName: 'Custom' }
 * });
 *
 * // Generate multiple items
 * const users = createMockUsers(5, {
 *   overrides: (index) => ({ email: `user${index}@test.com` })
 * });
 * ```
 */

import type {
  TimelineNode,
  Organization,
  NodePolicy,
  NodeInsight,
  ProfileData,
  InsertProfile
} from '@journey/schema';
import {
  TimelineNodeType,
  VisibilityLevel,
  SubjectType,
  PolicyEffect,
  PermissionAction,
  OrganizationType,
} from '@journey/schema';
import type { User } from '../stores/auth-store';
import type { HierarchyNode } from '../stores/shared-timeline-types';

/**
 * Factory options for creating mock data
 */
export interface FactoryOptions<T> {
  /**
   * Override specific fields of the generated object
   */
  overrides?: Partial<T>;

  /**
   * Seed value for generating consistent random data
   */
  seed?: number;
}

/**
 * Factory options for creating multiple items
 */
export interface MultiFactoryOptions<T> {
  /**
   * Function to generate overrides based on index
   */
  overrides?: (index: number) => Partial<T>;

  /**
   * Base seed value for consistent generation
   */
  seed?: number;
}

// Counter for generating unique IDs
let idCounter = 1;

/**
 * Reset the ID counter (useful between tests)
 */
export function resetIdCounter(): void {
  idCounter = 1;
}

/**
 * Generate a unique ID
 */
function generateId(prefix: string = 'id'): string {
  return `${prefix}-${idCounter++}`;
}

// ============================================================================
// USER FACTORIES
// ============================================================================

/**
 * Create a mock user for auth testing
 */
export function createMockUser(options?: FactoryOptions<User>): User {
  const id = options?.overrides?.id ?? idCounter++;

  return {
    id,
    email: `user${id}@example.com`,
    firstName: 'Test',
    lastName: 'User',
    userName: `testuser${id}`,
    interest: 'find-job',
    hasCompletedOnboarding: true,
    createdAt: new Date().toISOString(),
    ...options?.overrides,
  };
}

/**
 * Create multiple mock users
 */
export function createMockUsers(
  count: number,
  options?: MultiFactoryOptions<User>
): User[] {
  return Array.from({ length: count }, (_, index) =>
    createMockUser({
      overrides: options?.overrides?.(index),
      seed: options?.seed,
    })
  );
}

// ============================================================================
// ORGANIZATION FACTORIES
// ============================================================================

/**
 * Create a mock organization
 */
export function createMockOrganization(
  options?: FactoryOptions<Organization>
): Organization {
  const id = options?.overrides?.id ?? idCounter++;

  return {
    id,
    name: `Organization ${id}`,
    type: OrganizationType.Company,
    description: `Description for organization ${id}`,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...options?.overrides,
  };
}

/**
 * Create multiple mock organizations
 */
export function createMockOrganizations(
  count: number,
  options?: MultiFactoryOptions<Organization>
): Organization[] {
  return Array.from({ length: count }, (_, index) =>
    createMockOrganization({
      overrides: options?.overrides?.(index),
      seed: options?.seed,
    })
  );
}

// ============================================================================
// TIMELINE NODE FACTORIES
// ============================================================================

/**
 * Create a mock timeline node
 */
export function createMockTimelineNode(
  options?: FactoryOptions<TimelineNode>
): TimelineNode {
  const id = options?.overrides?.id ?? generateId('node');
  const type = options?.overrides?.type ?? TimelineNodeType.Job;

  const baseNode: TimelineNode = {
    id,
    type,
    title: `${type} Node ${id}`,
    parentId: null,
    childrenIds: [],
    userId: 1,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    meta: {},
  };

  // Add type-specific meta data
  if (type === TimelineNodeType.Job) {
    baseNode.meta = {
      company: 'Test Company',
      startDate: '2023-01',
      endDate: null,
      location: 'Remote',
      description: 'Job description',
      ...options?.overrides?.meta,
    };
  } else if (type === TimelineNodeType.Education) {
    baseNode.meta = {
      school: 'Test University',
      degree: 'Bachelor',
      field: 'Computer Science',
      startDate: '2019-09',
      endDate: '2023-05',
      ...options?.overrides?.meta,
    };
  }

  return {
    ...baseNode,
    ...options?.overrides,
    meta: {
      ...baseNode.meta,
      ...options?.overrides?.meta,
    },
  };
}

/**
 * Create a mock job node
 */
export function createMockJobNode(
  options?: FactoryOptions<TimelineNode>
): TimelineNode {
  return createMockTimelineNode({
    overrides: {
      type: TimelineNodeType.Job,
      title: options?.overrides?.title ?? 'Software Engineer',
      ...options?.overrides,
    },
  });
}

/**
 * Create a mock education node
 */
export function createMockEducationNode(
  options?: FactoryOptions<TimelineNode>
): TimelineNode {
  return createMockTimelineNode({
    overrides: {
      type: TimelineNodeType.Education,
      title: options?.overrides?.title ?? 'Computer Science',
      ...options?.overrides,
    },
  });
}

/**
 * Create multiple mock timeline nodes
 */
export function createMockTimelineNodes(
  count: number,
  options?: MultiFactoryOptions<TimelineNode>
): TimelineNode[] {
  return Array.from({ length: count }, (_, index) =>
    createMockTimelineNode({
      overrides: options?.overrides?.(index),
      seed: options?.seed,
    })
  );
}

// ============================================================================
// HIERARCHY NODE FACTORIES
// ============================================================================

/**
 * Create a mock hierarchy node (includes UI state)
 */
export function createMockHierarchyNode(
  options?: FactoryOptions<HierarchyNode>
): HierarchyNode {
  const timelineNode = createMockTimelineNode(options);

  return {
    ...timelineNode,
    canAccess: true,
    canShare: true,
    isOwner: true,
    visibility: VisibilityLevel.Private,
    showMatches: false,
    ...options?.overrides,
  } as HierarchyNode;
}

/**
 * Create multiple mock hierarchy nodes
 */
export function createMockHierarchyNodes(
  count: number,
  options?: MultiFactoryOptions<HierarchyNode>
): HierarchyNode[] {
  return Array.from({ length: count }, (_, index) =>
    createMockHierarchyNode({
      overrides: options?.overrides?.(index),
      seed: options?.seed,
    })
  );
}

// ============================================================================
// PERMISSION FACTORIES
// ============================================================================

/**
 * Create a mock node policy
 */
export function createMockNodePolicy(
  options?: FactoryOptions<NodePolicy>
): NodePolicy {
  const id = options?.overrides?.id ?? idCounter++;

  return {
    id,
    nodeId: generateId('node'),
    subjectType: SubjectType.User,
    subjectId: '1',
    effect: PolicyEffect.Allow,
    actions: [PermissionAction.View],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...options?.overrides,
  };
}

// ============================================================================
// INSIGHT FACTORIES
// ============================================================================

/**
 * Create a mock node insight
 */
export function createMockNodeInsight(
  options?: FactoryOptions<NodeInsight>
): NodeInsight {
  const id = options?.overrides?.id ?? generateId('insight');

  return {
    id,
    nodeId: generateId('node'),
    type: 'observation',
    title: 'Test Insight',
    content: 'This is a test insight content',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...options?.overrides,
  };
}

/**
 * Create multiple mock insights
 */
export function createMockNodeInsights(
  count: number,
  options?: MultiFactoryOptions<NodeInsight>
): NodeInsight[] {
  return Array.from({ length: count }, (_, index) =>
    createMockNodeInsight({
      overrides: options?.overrides?.(index),
      seed: options?.seed,
    })
  );
}

// ============================================================================
// PROFILE FACTORIES
// ============================================================================

/**
 * Create a mock profile data
 */
export function createMockProfileData(
  options?: FactoryOptions<ProfileData>
): ProfileData {
  return {
    name: 'Test User',
    headline: 'Software Engineer at TestCorp',
    location: 'San Francisco, CA',
    about: 'Experienced software engineer with a passion for building great products.',
    avatarUrl: 'https://example.com/avatar.jpg',
    experiences: [
      {
        title: 'Senior Software Engineer',
        company: 'TestCorp',
        location: 'San Francisco, CA',
        startDate: '2020-01',
        endDate: null,
        current: true,
        description: 'Building amazing products',
      },
      {
        title: 'Software Engineer',
        company: 'PrevCorp',
        location: 'New York, NY',
        startDate: '2018-01',
        endDate: '2019-12',
        current: false,
        description: 'Developed web applications',
      },
    ],
    education: [
      {
        degree: 'Bachelor of Science',
        field: 'Computer Science',
        school: 'Test University',
        startDate: '2014-09',
        endDate: '2018-05',
        description: 'Graduated with honors',
      },
    ],
    ...options?.overrides,
  };
}

// ============================================================================
// SEARCH RESULT FACTORIES
// ============================================================================

/**
 * Create a mock search result
 */
export function createMockSearchResult(options?: FactoryOptions<any>): any {
  const id = options?.overrides?.id ?? idCounter++;

  return {
    id,
    userId: 1,
    userName: `user${id}`,
    userEmail: `user${id}@example.com`,
    title: 'Software Engineer',
    company: 'TestCorp',
    location: 'San Francisco, CA',
    avatarUrl: null,
    matchScore: 0.95,
    highlights: ['JavaScript', 'React', 'Node.js'],
    ...options?.overrides,
  };
}

/**
 * Create multiple mock search results
 */
export function createMockSearchResults(
  count: number,
  options?: MultiFactoryOptions<any>
): any[] {
  return Array.from({ length: count }, (_, index) =>
    createMockSearchResult({
      overrides: options?.overrides?.(index),
      seed: options?.seed,
    })
  );
}

// ============================================================================
// UTILITY FACTORIES
// ============================================================================

/**
 * Create a hierarchy tree from nodes
 */
export function createMockHierarchyTree(nodes: HierarchyNode[]) {
  // Build parent-child relationships
  const edges = nodes
    .filter(node => node.parentId)
    .map(node => ({
      id: `${node.parentId}-${node.id}`,
      source: node.parentId!,
      target: node.id,
    }));

  return {
    nodes,
    edges,
  };
}

/**
 * Create a complete timeline with connected nodes
 */
export function createMockTimeline(options?: {
  jobCount?: number;
  educationCount?: number;
  withHierarchy?: boolean;
}): TimelineNode[] | HierarchyNode[] {
  const { jobCount = 2, educationCount = 1, withHierarchy = false } = options || {};

  const nodes: TimelineNode[] = [];

  // Create education nodes
  for (let i = 0; i < educationCount; i++) {
    nodes.push(createMockEducationNode({
      overrides: {
        id: `edu-${i + 1}`,
        title: i === 0 ? 'Bachelor Degree' : 'Master Degree',
      },
    }));
  }

  // Create job nodes with parent relationships
  for (let i = 0; i < jobCount; i++) {
    const node = createMockJobNode({
      overrides: {
        id: `job-${i + 1}`,
        title: i === 0 ? 'Junior Developer' : 'Senior Developer',
        parentId: i > 0 ? `job-${i}` : null,
      },
    });

    if (i > 0) {
      // Update parent's childrenIds
      const parent = nodes.find(n => n.id === `job-${i}`);
      if (parent) {
        parent.childrenIds = [...parent.childrenIds, node.id];
      }
    }

    nodes.push(node);
  }

  if (withHierarchy) {
    return nodes.map(node => createMockHierarchyNode({ overrides: node as any }));
  }

  return nodes;
}

// ============================================================================
// NODE INSIGHT FACTORIES
// ============================================================================

/**
 * Create a mock node insight
 */
export function createMockInsight(
  options?: FactoryOptions<NodeInsight>
): NodeInsight {
  const id = options?.overrides?.id ?? generateId('insight');

  return {
    id,
    nodeId: 'node-1',
    userId: 1,
    content: 'This is an important insight about this experience.',
    category: 'observation',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...options?.overrides,
  };
}

/**
 * Create multiple mock insights
 */
export function createMockInsights(
  count: number,
  options?: MultiFactoryOptions<NodeInsight>
): NodeInsight[] {
  return Array.from({ length: count }, (_, index) =>
    createMockInsight({
      overrides: options?.overrides?.(index),
      seed: options?.seed,
    })
  );
}