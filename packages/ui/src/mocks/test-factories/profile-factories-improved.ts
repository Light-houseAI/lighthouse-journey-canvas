/**
 * Improved Profile Factory Functions
 * Following MSW best practices with proper TypeScript typing
 */

import type {
  TimelineNodeView,
  TreeNode,
  ProfileData,
  ProfileResponse,
  NodeDetailsResponse,
  TimelineNodeType,
} from '../../types/profile';

/**
 * Type-safe factory with generic typing for better IDE support
 */
function createFactory<T>(defaults: () => T): (overrides?: Partial<T>) => T {
  return (overrides = {}) => ({
    ...defaults(),
    ...overrides,
  });
}

/**
 * Primary key generator for consistent IDs
 */
const generateId = {
  node: () => `node-${Math.random().toString(36).substr(2, 9)}`,
  user: () => `user-${Math.random().toString(36).substr(2, 9)}`,
  insight: () => `insight-${Math.random().toString(36).substr(2, 9)}`,
};

/**
 * Default values as functions for lazy evaluation
 */
const defaults = {
  timelineNode: (): TimelineNodeView => ({
    id: generateId.node(),
    type: TimelineNodeType.Job,
    parentId: null,
    userId: 1,
    meta: {
      title: 'Software Engineer',
      company: 'Tech Corp',
      startDate: '2023-01-01',
      endDate: null,
      description: 'Working on exciting projects',
    },
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
    isCurrent: true,
    depth: 0,
    children: [],
    path: [],
    permissions: {
      canView: true,
      canEdit: true,
      canDelete: true,
      canShare: true,
    },
  }),

  treeNode: (): Omit<TreeNode, 'node'> => ({
    isExpanded: false,
    isSelected: false,
    level: 0,
  }),

  profileUser: () => ({
    id: 1,
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    userName: 'johndoe',
    bio: 'Software engineer passionate about building great products',
    avatarUrl: null as string | null,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
  }),

  nodeDetails: (): NodeDetailsResponse => ({
    success: true,
    data: {
      node: defaults.timelineNode(),
      ancestors: [],
      children: [],
      siblings: [],
    },
  }),
};

/**
 * Create mock timeline node with proper typing
 */
export const createMockTimelineNode = createFactory(defaults.timelineNode);

/**
 * Create mock tree node with composite pattern
 */
export const createMockTreeNode = (
  nodeOverrides?: Partial<TimelineNodeView>,
  treeOverrides?: Partial<Omit<TreeNode, 'node'>>
): TreeNode => ({
  node: createMockTimelineNode(nodeOverrides),
  ...defaults.treeNode(),
  ...treeOverrides,
});

/**
 * Create mock profile data with relationships
 */
export const createMockProfileData = (
  overrides?: Partial<ProfileData>
): ProfileData => {
  const defaultNodes = [
    createMockTimelineNode({
      id: 'node-1',
      type: TimelineNodeType.Job,
      meta: {
        title: 'Senior Software Engineer',
        company: 'Tech Corp',
        startDate: '2023-01-01',
        endDate: null,
      },
    }),
    createMockTimelineNode({
      id: 'node-2',
      type: TimelineNodeType.Education,
      meta: {
        title: 'Computer Science',
        institution: 'University',
        degree: 'Bachelor',
        startDate: '2018-09-01',
        endDate: '2022-05-01',
      },
    }),
  ];

  return {
    user: defaults.profileUser(),
    nodes: defaultNodes,
    canEdit: false,
    ...overrides,
  };
};

/**
 * Create mock profile response with consistent structure
 */
export const createMockProfileResponse = (
  overrides?: Partial<ProfileResponse>
): ProfileResponse => ({
  success: true,
  data: createMockProfileData(),
  ...overrides,
});

/**
 * Create mock node details response with optional insights
 */
export const createMockNodeDetailsResponse = (
  nodeOverrides?: Partial<TimelineNodeView>,
  dataOverrides?: {
    ancestors?: TimelineNodeView[];
    children?: TimelineNodeView[];
    siblings?: TimelineNodeView[];
    insights?: Array<{
      id: string;
      type: string;
      content: string;
      createdAt: Date;
    }>;
  }
): NodeDetailsResponse => ({
  success: true,
  data: {
    node: createMockTimelineNode(nodeOverrides),
    ancestors: dataOverrides?.ancestors || [],
    children: dataOverrides?.children || [],
    siblings: dataOverrides?.siblings || [],
    ...(dataOverrides?.insights && { insights: dataOverrides.insights }),
  },
});

/**
 * Create hierarchy data for testing tree structures
 */
export const createMockHierarchyData = (config?: {
  depth?: number;
  childrenPerNode?: number;
}): TimelineNodeView[] => {
  const { depth = 3, childrenPerNode = 2 } = config || {};

  const createNodeTree = (
    level: number,
    parentId: string | null = null
  ): TimelineNodeView[] => {
    if (level >= depth) return [];

    const nodes: TimelineNodeView[] = [];

    for (let i = 0; i < childrenPerNode; i++) {
      const node = createMockTimelineNode({
        id: `node-${level}-${i}`,
        parentId,
        depth: level,
        type: level === 0 ? TimelineNodeType.Job : TimelineNodeType.Project,
      });

      nodes.push(node);

      // Recursively create children
      const children = createNodeTree(level + 1, node.id);
      node.children = children;
      nodes.push(...children);
    }

    return nodes;
  };

  return createNodeTree(0);
};

/**
 * Test scenario factories for common testing patterns
 */
export const testScenarios = {
  /**
   * Empty profile with no nodes
   */
  emptyProfile: (): ProfileData =>
    createMockProfileData({
      nodes: [],
    }),

  /**
   * Profile with only current experiences
   */
  currentExperiencesOnly: (): ProfileData =>
    createMockProfileData({
      nodes: [
        createMockTimelineNode({
          id: 'current-1',
          isCurrent: true,
          meta: {
            title: 'Current Role',
            company: 'Current Company',
            startDate: '2024-01-01',
            endDate: null,
          },
        }),
      ],
    }),

  /**
   * Profile with complex hierarchy
   */
  complexHierarchy: (): ProfileData => ({
    ...createMockProfileData(),
    nodes: createMockHierarchyData({ depth: 4, childrenPerNode: 3 }),
  }),

  /**
   * Profile with various permission levels
   */
  mixedPermissions: (): ProfileData =>
    createMockProfileData({
      nodes: [
        createMockTimelineNode({
          id: 'view-only',
          permissions: {
            canView: true,
            canEdit: false,
            canDelete: false,
            canShare: false,
          },
        }),
        createMockTimelineNode({
          id: 'full-access',
          permissions: {
            canView: true,
            canEdit: true,
            canDelete: true,
            canShare: true,
          },
        }),
        createMockTimelineNode({
          id: 'no-access',
          permissions: {
            canView: false,
            canEdit: false,
            canDelete: false,
            canShare: false,
          },
        }),
      ],
    }),
};

/**
 * Type guard utilities
 */
export const typeGuards = {
  isJobNode: (node: TimelineNodeView): boolean =>
    node.type === TimelineNodeType.Job,

  isEducationNode: (node: TimelineNodeView): boolean =>
    node.type === TimelineNodeType.Education,

  isCurrentNode: (node: TimelineNodeView): boolean => node.isCurrent === true,

  hasEditPermission: (node: TimelineNodeView): boolean =>
    node.permissions?.canEdit === true,
};
