// Profile-specific types for the Timeline Journey Profile View feature

// Import existing timeline types and enums
import type { TimelineNodeType } from '@shared/enums';
export type { TimelineNodeType } from '@shared/enums';

// Node metadata types (type-specific data for each timeline node)
export interface NodeMetadata {
  title: string;
  company?: string;
  startDate: string; // ISO date string
  endDate?: string; // ISO date string, null means current
  description?: string;
  location?: string;
  skills?: string[];
  achievements?: string[];
  [key: string]: any; // Allow additional type-specific fields
}

// Core timeline node interface (extends existing database schema)
export interface TimelineNode {
  // Database fields
  id: string;
  type: TimelineNodeType;
  parentId: string | null;
  userId: number;
  meta: NodeMetadata;
  createdAt: Date;
  updatedAt: Date;

  // View-specific computed fields
  isCurrent: boolean; // Computed from endDate (null or future date)
  depth: number; // Hierarchy depth for indentation (0-based)
  children?: TimelineNode[]; // Child nodes for tree structure
  path: string[]; // Breadcrumb path from root to current node
  permissions: NodePermissions;
}

// Node permissions for access control
export interface NodePermissions {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canShare?: boolean;
  canComment?: boolean;
}

// Aggregated profile data for the view
export interface ProfileData {
  id: string; // User ID
  userName: string;
  firstName: string;
  lastName: string;
  profileUrl: string;
  currentExperiences: TimelineNode[]; // Nodes without end date or with future end date
  pastExperiences: TimelineNode[]; // Nodes with past end date
  totalNodes: number; // Total count of all nodes (including children)
  lastUpdated: Date;
  permissions: ProfilePermissions;
}

// Profile-level permissions
export interface ProfilePermissions {
  canEdit: boolean; // Can edit any nodes in this profile
  canShare: boolean; // Can share profile publicly
  isOwner: boolean; // Is this the user's own profile
}

// Tree node wrapper for hierarchical display
export interface TreeNode {
  node: TimelineNode; // The actual timeline node data
  isExpanded: boolean; // UI state: is this node expanded to show children
  isSelected: boolean; // UI state: is this node currently selected
  level: number; // Indentation level in tree (0-based)
  hasChildren: boolean; // Does this node have child nodes
  isLastChild: boolean; // Is this the last child at its level (for tree line styling)
  parentPath: string[]; // Path of parent node IDs from root
  children?: TreeNode[]; // Child tree nodes (populated when expanded)
}

// Profile Store (Data Layer) - TanStack Query hooks
export interface ProfileStoreAPI {
  useProfileQuery: (username?: string) => {
    data: ProfileData | undefined;
    isLoading: boolean;
    error: Error | null;
    refetch: () => void;
    isSuccess: boolean;
    isFetching: boolean;
  };

  useNodeDetailsQuery: (
    nodeId: string,
    enabled?: boolean
  ) => {
    data: NodeDetailsResponse | undefined;
    isLoading: boolean;
    error: Error | null;
    isSuccess: boolean;
  };

  useUpdateNodeMutation: () => {
    mutate: (params: { id: string; updates: Partial<NodeMetadata> }) => void;
    mutateAsync: (params: {
      id: string;
      updates: Partial<NodeMetadata>;
    }) => Promise<TimelineNode>;
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
  };

  useDeleteNodeMutation: () => {
    mutate: (id: string) => void;
    mutateAsync: (id: string) => Promise<void>;
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
  };
}

// Profile View Store (UI State Layer) - Zustand store
export interface ProfileViewStore {
  // Selection state
  selectedNodeId: string | null;
  focusedNodeId: string | null; // For keyboard navigation

  // Expansion state
  expandedNodeIds: Set<string>; // Set of expanded node IDs

  // Panel state
  isPanelOpen: boolean;
  panelMode: 'view' | 'edit';
  panelNodeId: string | null; // Which node is displayed in panel

  // Filter state (future enhancement)
  searchQuery: string;
  filteredNodeTypes: TimelineNodeType[];

  // Actions - Selection
  selectNode: (nodeId: string | null) => void;
  focusNode: (nodeId: string | null) => void;
  clearSelection: () => void;

  // Actions - Expansion
  toggleNodeExpansion: (nodeId: string) => void;
  expandNode: (nodeId: string) => void;
  collapseNode: (nodeId: string) => void;
  expandAllNodes: (nodeIds: string[]) => void;
  collapseAllNodes: () => void;

  // Actions - Panel
  openPanel: (nodeId: string, mode?: 'view' | 'edit') => void;
  closePanel: () => void;
  setPanelMode: (mode: 'view' | 'edit') => void;

  // Actions - Filter (future enhancement)
  setSearchQuery: (query: string) => void;
  setFilteredNodeTypes: (types: TimelineNodeType[]) => void;
  clearFilters: () => void;

  // Actions - Reset
  resetUIState: () => void;
  resetExpandedNodes: () => void;
}

// Share Store (Feature-Specific) - Profile sharing functionality
export interface ProfileShareStore {
  // State
  isShareModalOpen: boolean;
  copiedToClipboard: boolean;
  shareUrl: string | null;
  shareError: string | null;

  // Actions
  openShareModal: (profileUrl: string) => void;
  closeShareModal: () => void;
  copyToClipboard: () => Promise<void>;
  shareViaWebAPI: () => Promise<void>;
  resetShareState: () => void;
}

// Transform Store (Utility Layer) - Pure transformation functions
export interface TimelineTransformStore {
  // Core transformation functions (pure, no side effects)
  separateExperiences: (nodes: TimelineNode[]) => {
    current: TimelineNode[];
    past: TimelineNode[];
  };

  buildHierarchyTree: (
    nodes: TimelineNode[],
    parentId?: string | null,
    level?: number
  ) => TreeNode[];

  flattenTree: (tree: TreeNode[], expandedIds: Set<string>) => TreeNode[];

  // Utility functions
  getNodePath: (nodeId: string, nodes: TimelineNode[]) => string[];
  getNodeDepth: (nodeId: string, nodes: TimelineNode[]) => number;
  findNodeById: (nodeId: string, nodes: TimelineNode[]) => TimelineNode | null;

  // Permission filtering
  filterNodesByPermission: (
    nodes: TimelineNode[],
    permission: keyof NodePermissions
  ) => TimelineNode[];

  // Tree state helpers
  getVisibleNodes: (tree: TreeNode[], expandedIds: Set<string>) => TreeNode[];

  getNodeAncestors: (nodeId: string, nodes: TimelineNode[]) => TimelineNode[];

  isNodeExpanded: (nodeId: string, expandedIds: Set<string>) => boolean;
}

// API Response types
export interface ProfileResponse {
  success: boolean;
  data: {
    user: {
      userName: string;
      firstName: string;
      lastName: string;
      profileUrl: string;
    };
    nodes: TimelineNode[];
    permissions: ProfilePermissions;
  };
}

export interface NodeDetailsResponse {
  success: boolean;
  data: {
    node: TimelineNode;
    insights?: NodeInsight[];
    skills?: ExtractedSkill[];
    attachments?: Attachment[];
    permissions: NodePermissions;
  };
}

// Supporting types for node details
export interface NodeInsight {
  id: string;
  nodeId: string;
  type: 'skill' | 'achievement' | 'learning' | 'impact';
  content: string;
  confidence: number; // 0-1 confidence score
  createdAt: Date;
  source: 'user' | 'ai' | 'external';
}

export interface ExtractedSkill {
  id: string;
  name: string;
  category: 'technical' | 'soft' | 'language' | 'tool' | 'framework';
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  extractedFrom: string; // Which field this was extracted from
  confidence: number;
}

export interface Attachment {
  id: string;
  nodeId: string;
  type: 'document' | 'image' | 'link' | 'video';
  name: string;
  url: string;
  size?: number; // in bytes
  uploadedAt: Date;
  uploadedBy: string;
}

// Error types
export interface ProfileError {
  code: 'NOT_FOUND' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'INTERNAL_ERROR';
  message: string;
  details?: Record<string, any>;
}

export interface APIError extends Error {
  status: number;
  code: string;
  details?: Record<string, any>;
}

// Component prop types
export interface ProfileHeaderProps {
  firstName: string;
  lastName: string;
  userName: string;
  profileUrl: string;
  canShare: boolean;
  onShare?: () => void;
  onCopy?: () => void;
}

export interface ExperienceSectionProps {
  title: string;
  nodes: TimelineNode[];
  expandedIds: Set<string>;
  selectedId: string | null;
  onNodeClick: (nodeId: string) => void;
  onToggleExpand: (nodeId: string) => void;
  emptyMessage?: string;
}

export interface TreeListProps {
  nodes: TreeNode[];
  selectedId: string | null;
  onNodeClick: (nodeId: string) => void;
  onToggleExpand: (nodeId: string) => void;
  virtualized?: boolean; // Enable virtual scrolling for large lists
  maxHeight?: string; // CSS max-height when virtualized
}

export interface NodeListItemProps {
  treeNode: TreeNode;
  isSelected: boolean;
  onNodeClick: (nodeId: string) => void;
  onToggleExpand: (nodeId: string) => void;
}

export interface ProfileListViewProps {
  username?: string; // If undefined, show current user's profile
  className?: string;
}

// Query key factories for TanStack Query
export const queryKeys = {
  all: ['profile'] as const,
  profile: (username: string) => ['profile', username] as const,
  nodeDetails: (nodeId: string) => ['profile', 'node', nodeId] as const,
  userNodes: (userId: number) => ['profile', 'nodes', userId] as const,
} as const;

// Constants
export const PROFILE_CONFIG = {
  // Performance thresholds
  VIRTUAL_SCROLLING_THRESHOLD: 50, // Enable virtual scrolling above this many nodes
  MAX_TREE_DEPTH: 5, // Maximum allowed hierarchy depth
  MAX_NODES_PER_PROFILE: 1000, // Maximum nodes per user profile

  // Cache settings
  PROFILE_STALE_TIME: 5 * 60 * 1000, // 5 minutes
  NODE_DETAILS_STALE_TIME: 1 * 60 * 1000, // 1 minute

  // UI settings
  DEFAULT_PANEL_WIDTH: 400, // pixels
  TREE_INDENT_SIZE: 24, // pixels per level
  ANIMATION_DURATION: 200, // milliseconds

  // Validation rules
  MIN_SEARCH_QUERY_LENGTH: 2,
  MAX_SEARCH_RESULTS: 100,
} as const;

// Type guards
export const isTimelineNode = (obj: any): obj is TimelineNode => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'string' &&
    typeof obj.type === 'string' &&
    typeof obj.userId === 'number' &&
    obj.meta &&
    typeof obj.meta.title === 'string' &&
    typeof obj.isCurrent === 'boolean'
  );
};

export const isTreeNode = (obj: any): obj is TreeNode => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    isTimelineNode(obj.node) &&
    typeof obj.isExpanded === 'boolean' &&
    typeof obj.isSelected === 'boolean' &&
    typeof obj.level === 'number' &&
    typeof obj.hasChildren === 'boolean'
  );
};

export const isProfileData = (obj: any): obj is ProfileData => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'string' &&
    typeof obj.userName === 'string' &&
    typeof obj.firstName === 'string' &&
    typeof obj.lastName === 'string' &&
    Array.isArray(obj.currentExperiences) &&
    Array.isArray(obj.pastExperiences) &&
    typeof obj.totalNodes === 'number'
  );
};
