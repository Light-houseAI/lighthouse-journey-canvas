# Data Model: Timeline Journey Profile View

**Date**: 2025-01-12  
**Feature**: Timeline Journey Profile View  
**Branch**: 001-lets-revamp-journey

## Overview

Data structures and models for the profile view feature, focusing on transforming existing timeline node data into a profile-oriented presentation.

## Core Entities

### 1. ProfileData

Aggregated profile information including user details and timeline nodes.

```typescript
interface ProfileData {
  id: string;
  userName: string;
  firstName: string;
  lastName: string;
  email?: string; // Only for own profile
  profileUrl: string;
  currentExperiences: TimelineNode[];
  pastExperiences: TimelineNode[];
  totalNodes: number;
  lastUpdated: Date;
}
```

### 2. TimelineNode (Existing, Extended)

Reusing existing timeline node structure with view-specific extensions.

```typescript
interface TimelineNode {
  // Existing fields
  id: string;
  type: TimelineNodeType;
  parentId: string | null;
  userId: number;
  meta: NodeMetadata;
  createdAt: Date;
  updatedAt: Date;

  // View-specific computed fields
  isCurrent: boolean; // Computed from endDate
  depth: number; // Hierarchy depth for indentation
  children?: TimelineNode[]; // Child nodes for tree structure
  path: string[]; // Breadcrumb path from root
  permissions: NodePermissions;
}
```

### 3. NodeMetadata (Type-Specific)

Type-specific metadata remains unchanged from existing schema.

```typescript
type NodeMetadata =
  | JobMetadata
  | EducationMetadata
  | ProjectMetadata
  | EventMetadata
  | ActionMetadata
  | CareerTransitionMetadata;

interface JobMetadata {
  title: string;
  company: string;
  role?: string;
  location?: string;
  description?: string;
  startDate: string;
  endDate?: string; // Missing = current
}
// ... other metadata types follow same pattern
```

### 4. TreeNode

Wrapper for hierarchical display in list view.

```typescript
interface TreeNode {
  node: TimelineNode;
  isExpanded: boolean;
  isSelected: boolean;
  level: number; // Indentation level
  hasChildren: boolean;
  isLastChild: boolean; // For tree line rendering
  parentPath: string[]; // IDs of all parents
}
```

### 5. Store Architecture (Improved Organization)

Better organized stores with clear separation of concerns, replacing the existing mixed-responsibility stores.

#### 5.1 Profile Store (Data Layer)

Handles profile data fetching and caching using TanStack Query.

```typescript
// stores/profile/useProfileStore.ts
interface ProfileStore {
  // Profile data query hooks
  useProfileQuery: (username?: string) => {
    data: ProfileData | undefined;
    isLoading: boolean;
    error: Error | null;
    refetch: () => void;
  };

  useNodeDetailsQuery: (nodeId: string) => {
    data: NodeDetailsResponse | undefined;
    isLoading: boolean;
    error: Error | null;
  };

  // Mutations
  useUpdateNodeMutation: () => {
    mutate: (params: { id: string; updates: Partial<TimelineNode> }) => void;
    isLoading: boolean;
  };

  useDeleteNodeMutation: () => {
    mutate: (id: string) => void;
    isLoading: boolean;
  };
}
```

#### 5.2 Profile View Store (UI State Layer)

Manages UI-specific state for the profile view, completely separate from data fetching.

```typescript
// stores/profile/useProfileViewStore.ts
interface ProfileViewStore {
  // Selection state
  selectedNodeId: string | null;
  focusedNodeId: string | null;

  // Expansion state
  expandedNodeIds: Set<string>;

  // Panel state
  isPanelOpen: boolean;
  panelMode: 'view' | 'edit';
  panelNodeId: string | null;

  // Actions
  selectNode: (nodeId: string | null) => void;
  focusNode: (nodeId: string | null) => void;
  toggleNodeExpansion: (nodeId: string) => void;
  expandAllNodes: () => void;
  collapseAllNodes: () => void;

  // Panel actions
  openPanel: (nodeId: string, mode?: 'view' | 'edit') => void;
  closePanel: () => void;
  setPanelMode: (mode: 'view' | 'edit') => void;

  // Reset
  resetUIState: () => void;
}
```

#### 5.3 Profile Insights Store (Feature-Specific)

Dedicated store for managing insights functionality.

```typescript
// stores/profile/useProfileInsightsStore.ts
interface ProfileInsightsStore {
  // Insights queries
  useNodeInsightsQuery: (nodeId: string) => {
    data: NodeInsight[] | undefined;
    isLoading: boolean;
    error: Error | null;
  };

  // Mutations
  useCreateInsightMutation: () => {
    mutate: (params: { nodeId: string; data: InsightCreateDTO }) => void;
    isLoading: boolean;
  };

  useUpdateInsightMutation: () => {
    mutate: (params: { id: string; data: InsightUpdateDTO }) => void;
    isLoading: boolean;
  };

  useDeleteInsightMutation: () => {
    mutate: (id: string) => void;
    isLoading: boolean;
  };
}
```

#### 5.4 Profile Share Store (Feature-Specific)

Handles sharing and copying profile URLs.

```typescript
// stores/profile/useProfileShareStore.ts
interface ProfileShareStore {
  // State
  isShareModalOpen: boolean;
  copiedToClipboard: boolean;
  shareUrl: string | null;

  // Actions
  openShareModal: (profileUrl: string) => void;
  closeShareModal: () => void;
  copyToClipboard: () => Promise<void>;
  shareViaWebAPI: () => Promise<void>;

  // Reset
  resetShareState: () => void;
}
```

#### 5.5 Timeline Transform Store (Utility Layer)

Pure functions for data transformations, used by multiple stores.

```typescript
// stores/profile/useTimelineTransform.ts
interface TimelineTransformStore {
  // Transform functions (pure, no side effects)
  separateExperiences: (nodes: TimelineNode[]) => {
    current: TimelineNode[];
    past: TimelineNode[];
  };

  buildHierarchyTree: (
    nodes: TimelineNode[],
    parentId?: string | null
  ) => TreeNode[];

  flattenTree: (tree: TreeNode[], expandedIds: Set<string>) => TreeNode[];

  getNodePath: (nodeId: string, nodes: TimelineNode[]) => string[];

  getNodeDepth: (nodeId: string, nodes: TimelineNode[]) => number;

  filterNodesByPermission: (
    nodes: TimelineNode[],
    permission: 'view' | 'edit'
  ) => TimelineNode[];
}
```

## API Response Schemas

### GET /api/profile/:username

```typescript
interface ProfileResponse {
  profile: {
    userName: string;
    firstName: string;
    lastName: string;
    profileUrl: string;
  };
  timeline: {
    current: TimelineNode[];
    past: TimelineNode[];
    totalCount: number;
  };
  permissions: {
    canEdit: boolean;
    canShare: boolean;
  };
}
```

### GET /api/nodes/:nodeId/details

```typescript
interface NodeDetailsResponse {
  node: TimelineNode;
  insights?: NodeInsight[];
  skills?: ExtractedSkill[];
  attachments?: Attachment[];
  permissions: NodePermissions;
}
```

## State Transformations

### 1. Separate Current vs Past

```typescript
function separateExperiences(nodes: TimelineNode[]): {
  current: TimelineNode[];
  past: TimelineNode[];
} {
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
    { current: [], past: [] }
  );
}
```

### 2. Build Hierarchy Tree

```typescript
function buildHierarchyTree(
  nodes: TimelineNode[],
  parentId: string | null = null,
  level: number = 0
): TreeNode[] {
  return nodes
    .filter((node) => node.parentId === parentId)
    .map((node) => ({
      node,
      level,
      hasChildren: nodes.some((n) => n.parentId === node.id),
      isExpanded: false,
      isSelected: false,
      isLastChild: false,
      parentPath: [],
    }));
}
```

### 3. Flatten Tree for Display

```typescript
function flattenTree(tree: TreeNode[], expandedIds: Set<string>): TreeNode[] {
  const result: TreeNode[] = [];

  function traverse(nodes: TreeNode[]) {
    nodes.forEach((treeNode) => {
      result.push(treeNode);
      if (treeNode.hasChildren && expandedIds.has(treeNode.node.id)) {
        traverse(treeNode.children || []);
      }
    });
  }

  traverse(tree);
  return result;
}
```

## Validation Rules

### Profile View Validation

- Username must exist in system
- User must have permission to view profile
- Private nodes excluded based on permissions

### Node Hierarchy Rules

- Max depth: 5 levels
- Parent must exist before child
- Circular references prevented
- Type-specific parent-child rules enforced

### Date Validation

- Start date required for all nodes
- End date optional (indicates current)
- End date must be after start date
- Future dates allowed for planned items

## Cache Strategy

### TanStack Query Keys

```typescript
const queryKeys = {
  profile: (username: string) => ['profile', username],
  nodeDetails: (nodeId: string) => ['node', nodeId],
  userNodes: (userId: number) => ['nodes', userId],
};
```

### Cache Invalidation

- Profile query invalidated on node mutations
- Node details invalidated on specific node update
- Stale time: 5 minutes for profile, 1 minute for details

## Performance Considerations

### Data Limits

- Max 1000 nodes per profile
- Virtual scrolling above 50 nodes
- Pagination for insights/attachments

### Optimization Strategies

- Lazy load child nodes on expand
- Memoize tree calculations
- Batch API calls for multiple nodes
- Compress large description fields

## Security & Privacy

### Data Access Rules

- Own profile: Full access
- Public profile: Filtered by permissions
- Private nodes: Never sent to unauthorized users

### Sensitive Field Handling

- Email only visible to profile owner
- Salary/compensation data excluded
- Personal notes filtered out

## Store Organization Benefits

### Separation of Concerns

1. **Data Layer** (Profile Store) - TanStack Query for server state
2. **UI Layer** (View Store) - Zustand for client state
3. **Feature Layers** (Insights, Share) - Isolated feature-specific logic
4. **Utility Layer** (Transform) - Pure functions, no side effects

### Advantages Over Current Architecture

- **Clear Responsibilities**: Each store has a single, well-defined purpose
- **Better Testing**: Isolated stores are easier to test independently
- **Reduced Coupling**: UI state doesn't mix with data fetching logic
- **Reusability**: Transform utilities can be used across different views
- **Performance**: Selective subscriptions to only needed state slices
- **Maintainability**: Easy to understand and modify individual stores

### Migration Strategy from Existing Stores

#### Phase 1: Create New Stores Alongside Existing

```typescript
// Keep existing stores operational
import { useCurrentUserTimelineStore } from '@/stores/current-user-timeline-store';
import { useOtherUserTimelineStore } from '@/stores/other-user-timeline-store';

// Add new organized stores
import { useProfileStore } from '@/stores/profile/useProfileStore';
import { useProfileViewStore } from '@/stores/profile/useProfileViewStore';
```

#### Phase 2: Gradual Component Migration

```typescript
// Old component usage
const { nodes, loading, selectNode } = useCurrentUserTimelineStore();

// New component usage
const { data: profile, isLoading } = useProfileQuery(username);
const { selectedNodeId, selectNode } = useProfileViewStore();
```

#### Phase 3: Deprecate Old Stores

- Mark old stores as deprecated
- Remove after all components migrated
- Clean up unused dependencies

## Migration Notes

This feature reuses existing data models with view-specific transformations. No database schema changes required. All data fetching uses existing endpoints with new aggregation layer. The new store architecture provides better separation of concerns while maintaining compatibility with existing API endpoints.
