import { TimelineNodeType } from '../../../shared/enums';
import type {
  NodeDetailsResponse,
  ProfileData,
  ProfileResponse,
  TimelineNodeView,
  TreeNode,
} from '../types/profile';

// ============================================================================
// PROFILE DATA FACTORIES
// ============================================================================

export const createMockTimelineNode = (
  overrides: Partial<TimelineNodeView> = {}
): TimelineNodeView => ({
  id: `node-${Math.random().toString(36).substr(2, 9)}`,
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
  ...overrides,
});

export const createMockTreeNode = (
  nodeOverrides: Partial<TimelineNodeView> = {},
  treeOverrides: Partial<Omit<TreeNode, 'node'>> = {}
): TreeNode => ({
  node: createMockTimelineNode(nodeOverrides),
  isExpanded: false,
  isSelected: false,
  level: 0,
  hasChildren: false,
  isLastChild: false,
  parentPath: [],
  ...treeOverrides,
});

export const createMockProfileData = (
  overrides: Partial<ProfileData> = {}
): ProfileData => {
  const currentJob = createMockTimelineNode({
    id: 'current-job-1',
    type: TimelineNodeType.Job,
    meta: {
      title: 'Senior Software Engineer',
      company: 'Current Corp',
      startDate: '2024-01-01',
      endDate: null,
    },
    isCurrent: true,
  });

  const pastJob = createMockTimelineNode({
    id: 'past-job-1',
    type: TimelineNodeType.Job,
    meta: {
      title: 'Software Engineer',
      company: 'Previous Corp',
      startDate: '2022-01-01',
      endDate: '2023-12-31',
    },
    isCurrent: false,
  });

  return {
    id: 'user-123',
    userName: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    profileUrl: 'https://app.lighthouse.ai/testuser',
    currentExperiences: [currentJob],
    pastExperiences: [pastJob],
    totalNodes: 2,
    lastUpdated: new Date(),
    ...overrides,
  };
};

export const createMockProfileResponse = (
  overrides: Partial<ProfileResponse> = {}
): ProfileResponse => {
  const profileData = createMockProfileData();
  
  return {
    profile: {
      userName: profileData.userName,
      firstName: profileData.firstName,
      lastName: profileData.lastName,
      profileUrl: profileData.profileUrl,
    },
    timeline: {
      current: profileData.currentExperiences,
      past: profileData.pastExperiences,
      totalCount: profileData.totalNodes,
    },
    permissions: {
      canEdit: true,
      canShare: true,
    },
    ...overrides,
  };
};

export const createMockNodeDetailsResponse = (
  nodeOverrides: Partial<TimelineNodeView> = {},
  overrides: Partial<Omit<NodeDetailsResponse, 'node'>> = {}
): NodeDetailsResponse => ({
  node: createMockTimelineNode(nodeOverrides),
  insights: [
    {
      id: 'insight-1',
      type: 'skill',
      content: 'Developed strong React skills',
      createdAt: new Date('2023-06-01'),
    },
  ],
  skills: [
    { name: 'React', category: 'Frontend' },
    { name: 'TypeScript', category: 'Programming Language' },
  ],
  attachments: [
    {
      id: 'attachment-1',
      name: 'Resume.pdf',
      url: 'https://example.com/resume.pdf',
    },
  ],
  permissions: {
    canView: true,
    canEdit: true,
    canDelete: true,
    canShare: true,
  },
  ...overrides,
});

// ============================================================================
// HIERARCHY DATA FACTORIES
// ============================================================================

export const createMockHierarchy = (): TimelineNodeView[] => {
  const parentJob = createMockTimelineNode({
    id: 'parent-job',
    type: TimelineNodeType.Job,
    meta: {
      title: 'Senior Developer',
      company: 'Tech Company',
      startDate: '2023-01-01',
      endDate: null,
    },
    depth: 0,
    path: [],
  });

  const childProject1 = createMockTimelineNode({
    id: 'child-project-1',
    type: TimelineNodeType.Project,
    parentId: 'parent-job',
    meta: {
      title: 'E-commerce Platform',
      description: 'Built a scalable e-commerce solution',
      startDate: '2023-02-01',
      endDate: '2023-08-01',
    },
    depth: 1,
    path: ['parent-job'],
    isCurrent: false,
  });

  const childProject2 = createMockTimelineNode({
    id: 'child-project-2',
    type: TimelineNodeType.Project,
    parentId: 'parent-job',
    meta: {
      title: 'Mobile App',
      description: 'Developed React Native mobile app',
      startDate: '2023-09-01',
      endDate: null,
    },
    depth: 1,
    path: ['parent-job'],
  });

  return [parentJob, childProject1, childProject2];
};

export const createMockTreeHierarchy = (): TreeNode[] => {
  const hierarchy = createMockHierarchy();
  const [parent, child1, child2] = hierarchy;

  const parentTreeNode: TreeNode = {
    node: parent,
    isExpanded: true,
    isSelected: false,
    level: 0,
    hasChildren: true,
    isLastChild: false,
    parentPath: [],
  };

  const child1TreeNode: TreeNode = {
    node: child1,
    isExpanded: false,
    isSelected: false,
    level: 1,
    hasChildren: false,
    isLastChild: false,
    parentPath: ['parent-job'],
  };

  const child2TreeNode: TreeNode = {
    node: child2,
    isExpanded: false,
    isSelected: false,
    level: 1,
    hasChildren: false,
    isLastChild: true,
    parentPath: ['parent-job'],
  };

  return [parentTreeNode, child1TreeNode, child2TreeNode];
};

// ============================================================================
// TEST HELPER FUNCTIONS
// ============================================================================

export const separateExperiencesByDate = (nodes: TimelineNodeView[]) => {
  return nodes.reduce(
    (acc, node) => {
      const endDate = node.meta.endDate;
      if (!endDate || new Date(endDate) > new Date()) {
        acc.current.push(node);
      } else {
        acc.past.push(node);
      }
      return acc;
    },
    { current: [] as TimelineNodeView[], past: [] as TimelineNodeView[] }
  );
};

export const buildFlatHierarchy = (nodes: TimelineNodeView[]): TreeNode[] => {
  return nodes.map((node, index) => createMockTreeNode(
    node,
    {
      level: node.depth,
      hasChildren: nodes.some(n => n.parentId === node.id),
      isLastChild: index === nodes.length - 1,
      parentPath: node.path,
    }
  ));
};

export const createExpandedNodeSet = (nodeIds: string[]): Set<string> => {
  return new Set(nodeIds);
};

// ============================================================================
// MSW RESPONSE HELPERS
// ============================================================================

export const createSuccessResponse = <T>(data: T) => ({
  ok: true,
  status: 200,
  data,
});

export const createErrorResponse = (status: number, message: string) => ({
  ok: false,
  status,
  error: {
    message,
    code: status.toString(),
  },
});

export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));