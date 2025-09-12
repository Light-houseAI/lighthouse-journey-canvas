import { ProfileData, TimelineNode, TreeNode } from '@/types/profile';

// Factory function for creating mock timeline nodes
export function createMockTimelineNode(
  overrides: Partial<TimelineNode> = {}
): TimelineNode {
  return {
    id: Math.random().toString(36).substr(2, 9),
    type: 'experience',
    parentId: null,
    userId: 1,
    meta: {
      title: 'Software Engineer',
      company: 'TechCorp',
      startDate: '2023-01-01',
      endDate: null,
      description: 'Developing web applications',
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
    },
    ...overrides,
  };
}

// Factory function for creating current experience nodes
export function createMockCurrentExperience(
  overrides: Partial<TimelineNode> = {}
): TimelineNode {
  return createMockTimelineNode({
    meta: {
      title: 'Senior Software Engineer',
      company: 'TechCorp',
      startDate: '2023-01-01',
      endDate: null, // No end date = current
      description: 'Leading frontend development team',
    },
    isCurrent: true,
    ...overrides,
  });
}

// Factory function for creating past experience nodes
export function createMockPastExperience(
  overrides: Partial<TimelineNode> = {}
): TimelineNode {
  return createMockTimelineNode({
    meta: {
      title: 'Software Engineer',
      company: 'StartupInc',
      startDate: '2021-01-01',
      endDate: '2022-12-31', // Has end date = past
      description: 'Full-stack development',
    },
    isCurrent: false,
    ...overrides,
  });
}

// Factory function for creating hierarchical node structures
export function createMockNodeHierarchy(): TimelineNode[] {
  const parentNode = createMockCurrentExperience({
    id: 'parent-1',
    meta: {
      title: 'Senior Software Engineer',
      company: 'TechCorp',
      startDate: '2023-01-01',
      endDate: null,
      description: 'Leading development projects',
    },
  });

  const childNode1 = createMockTimelineNode({
    id: 'child-1',
    parentId: 'parent-1',
    type: 'project',
    meta: {
      title: 'React Migration Project',
      company: 'TechCorp',
      startDate: '2023-06-01',
      endDate: '2023-12-01',
      description: 'Migrated legacy system to React',
    },
    isCurrent: false,
    depth: 1,
  });

  const childNode2 = createMockTimelineNode({
    id: 'child-2',
    parentId: 'parent-1',
    type: 'project',
    meta: {
      title: 'Performance Optimization',
      company: 'TechCorp',
      startDate: '2024-01-01',
      endDate: null,
      description: 'Optimizing application performance',
    },
    isCurrent: true,
    depth: 1,
  });

  parentNode.children = [childNode1, childNode2];

  return [parentNode, childNode1, childNode2];
}

// Factory function for creating mock profile data
export function createMockProfileData(
  overrides: Partial<ProfileData> = {}
): ProfileData {
  const currentNodes = [createMockCurrentExperience()];
  const pastNodes = [createMockPastExperience()];

  return {
    id: 'user-1',
    userName: 'johndoe',
    firstName: 'John',
    lastName: 'Doe',
    currentExperiences: currentNodes,
    pastExperiences: pastNodes,
    totalNodes: currentNodes.length + pastNodes.length,
    lastUpdated: new Date(),
    ...overrides,
  };
}

// Factory function for creating tree nodes for UI testing
export function createMockTreeNode(
  overrides: Partial<TreeNode> = {}
): TreeNode {
  const baseNode = createMockTimelineNode();

  return {
    node: baseNode,
    isExpanded: false,
    isSelected: false,
    level: 0,
    hasChildren: false,
    isLastChild: false,
    parentPath: [],
    ...overrides,
  };
}

// Helper function to create tree structure from flat nodes
export function createMockTreeStructure(): TreeNode[] {
  const nodes = createMockNodeHierarchy();
  const [parent, child1, child2] = nodes;

  const parentTreeNode: TreeNode = {
    node: parent,
    isExpanded: false,
    isSelected: false,
    level: 0,
    hasChildren: true,
    isLastChild: false,
    parentPath: [],
    children: [
      {
        node: child1,
        isExpanded: false,
        isSelected: false,
        level: 1,
        hasChildren: false,
        isLastChild: false,
        parentPath: [parent.id],
      },
      {
        node: child2,
        isExpanded: false,
        isSelected: false,
        level: 1,
        hasChildren: false,
        isLastChild: true,
        parentPath: [parent.id],
      },
    ],
  };

  return [parentTreeNode];
}

// Test data generators for different scenarios
export const testScenarios = {
  // Single current experience, no hierarchy
  singleCurrent: () => ({
    current: [createMockCurrentExperience()],
    past: [],
  }),

  // Single past experience, no hierarchy
  singlePast: () => ({
    current: [],
    past: [createMockPastExperience()],
  }),

  // Mixed current and past experiences
  mixedExperiences: () => ({
    current: [
      createMockCurrentExperience({
        id: 'current-1',
        meta: {
          title: 'Senior Engineer',
          company: 'TechCorp',
          startDate: '2023-01-01',
          endDate: null,
        },
      }),
      createMockCurrentExperience({
        id: 'current-2',
        meta: {
          title: 'Consultant',
          company: 'ConsultingFirm',
          startDate: '2024-01-01',
          endDate: null,
        },
      }),
    ],
    past: [
      createMockPastExperience({
        id: 'past-1',
        meta: {
          title: 'Junior Developer',
          company: 'StartupInc',
          startDate: '2021-01-01',
          endDate: '2022-12-31',
        },
      }),
    ],
  }),

  // Complex hierarchy with multiple levels
  complexHierarchy: () => {
    const nodes = createMockNodeHierarchy();
    return {
      current: [nodes[0]], // Parent with children
      past: [],
    };
  },

  // Large dataset for performance testing
  largeDataset: () => {
    const current = Array.from({ length: 25 }, (_, i) =>
      createMockCurrentExperience({
        id: `current-${i}`,
        meta: {
          title: `Position ${i + 1}`,
          company: `Company ${i + 1}`,
          startDate: '2023-01-01',
          endDate: null,
        },
      })
    );

    const past = Array.from({ length: 75 }, (_, i) =>
      createMockPastExperience({
        id: `past-${i}`,
        meta: {
          title: `Previous Role ${i + 1}`,
          company: `Previous Company ${i + 1}`,
          startDate: '2020-01-01',
          endDate: '2022-12-31',
        },
      })
    );

    return { current, past };
  },
};

// Mock API response generators
export const mockApiResponses = {
  profileSuccess: (username = 'johndoe') => ({
    success: true,
    data: {
      user: {
        userName: username,
        firstName: 'John',
        lastName: 'Doe',
        profileUrl: `https://app.lighthouse.ai/${username}`,
      },
      nodes: [
        ...testScenarios.mixedExperiences().current,
        ...testScenarios.mixedExperiences().past,
      ],
    },
  }),

  profileNotFound: () => ({
    error: 'User not found',
    message: 'The specified user profile does not exist',
  }),

  profileUnauthorized: () => ({
    error: 'Unauthorized',
    message: 'You do not have permission to view this profile',
  }),

  nodeDetailsSuccess: (nodeId: string) => ({
    success: true,
    data: {
      ...createMockTimelineNode({ id: nodeId }),
      insights: [],
      skills: ['React', 'TypeScript', 'Node.js'],
      attachments: [],
    },
  }),

  nodeDetailsNotFound: () => ({
    error: 'Node not found',
    message: 'The specified node does not exist',
  }),
};

// Test helpers for assertions
export const testHelpers = {
  // Check if node is properly structured
  isValidTimelineNode: (node: any): node is TimelineNode => {
    return (
      typeof node.id === 'string' &&
      typeof node.type === 'string' &&
      node.meta &&
      typeof node.meta.title === 'string' &&
      typeof node.meta.startDate === 'string' &&
      typeof node.isCurrent === 'boolean'
    );
  },

  // Check if tree node is properly structured
  isValidTreeNode: (treeNode: any): treeNode is TreeNode => {
    return (
      testHelpers.isValidTimelineNode(treeNode.node) &&
      typeof treeNode.isExpanded === 'boolean' &&
      typeof treeNode.isSelected === 'boolean' &&
      typeof treeNode.level === 'number' &&
      typeof treeNode.hasChildren === 'boolean'
    );
  },

  // Get node by ID from flat list
  findNodeById: (
    nodes: TimelineNode[],
    id: string
  ): TimelineNode | undefined => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = testHelpers.findNodeById(node.children, id);
        if (found) return found;
      }
    }
    return undefined;
  },

  // Count total nodes including children
  countTotalNodes: (nodes: TimelineNode[]): number => {
    let count = 0;
    for (const node of nodes) {
      count++;
      if (node.children) {
        count += testHelpers.countTotalNodes(node.children);
      }
    }
    return count;
  },
};
