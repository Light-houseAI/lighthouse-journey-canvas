import { TimelineNodeType } from '@journey/schema';
import { z } from 'zod';

// ============================================================================
// CLIENT-SIDE PROFILE TYPES
// ============================================================================

// Profile data aggregated from user and timeline information (client view-specific)
export const profileDataSchema = z.object({
  id: z.string(),
  userName: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().optional(), // Only for own profile
  profileUrl: z.string(),
  currentExperiences: z.array(z.any()), // TimelineNodeView array - defined below
  pastExperiences: z.array(z.any()), // TimelineNodeView array - defined below
  totalNodes: z.number(),
  lastUpdated: z.date(),
});

export type ProfileData = z.infer<typeof profileDataSchema>;

// Extended timeline node with view-specific computed fields
export const timelineNodeViewSchema: z.ZodType<TimelineNodeView> = z.object({
  // Existing fields (matching server timeline node)
  id: z.string(),
  type: z.nativeEnum(TimelineNodeType),
  parentId: z.string().nullable(),
  userId: z.number(),
  meta: z.record(z.any()), // Type-specific metadata
  createdAt: z.date(),
  updatedAt: z.date(),

  // View-specific computed fields (client only)
  isCurrent: z.boolean(), // Computed from endDate
  depth: z.number(), // Hierarchy depth for indentation
  children: z
    .array(z.lazy((): z.ZodType<TimelineNodeView> => timelineNodeViewSchema))
    .optional(), // Recursive children
  path: z.array(z.string()), // Breadcrumb path from root
  permissions: z.object({
    canView: z.boolean(),
    canEdit: z.boolean(),
    canDelete: z.boolean(),
    canShare: z.boolean(),
  }),
});

export type TimelineNodeView = z.infer<typeof timelineNodeViewSchema>;

// Wrapper for hierarchical display in list view (client UI state)
export const treeNodeSchema = z.object({
  node: timelineNodeViewSchema,
  isExpanded: z.boolean(),
  isSelected: z.boolean(),
  level: z.number(), // Indentation level
  hasChildren: z.boolean(),
  isLastChild: z.boolean(), // For tree line rendering
  parentPath: z.array(z.string()), // IDs of all parents
});

export type TreeNode = z.infer<typeof treeNodeSchema>;

// ============================================================================
// API RESPONSE SCHEMAS (client expectations)
// ============================================================================

// GET /api/v2/timeline/nodes response
export const profileResponseSchema = z.object({
  profile: z.object({
    userName: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    profileUrl: z.string(),
  }),
  timeline: z.object({
    current: z.array(timelineNodeViewSchema),
    past: z.array(timelineNodeViewSchema),
    totalCount: z.number(),
  }),
  permissions: z.object({
    canEdit: z.boolean(),
    canShare: z.boolean(),
  }),
});

export type ProfileResponse = z.infer<typeof profileResponseSchema>;

// GET /api/v2/timeline/nodes/:nodeId response
export const nodeDetailsResponseSchema = z.object({
  node: timelineNodeViewSchema,
  insights: z
    .array(
      z.object({
        id: z.string(),
        type: z.string(),
        content: z.string(),
        createdAt: z.date(),
      })
    )
    .optional(),
  skills: z
    .array(
      z.object({
        name: z.string(),
        category: z.string(),
      })
    )
    .optional(),
  attachments: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        url: z.string(),
      })
    )
    .optional(),
  permissions: z.object({
    canView: z.boolean(),
    canEdit: z.boolean(),
    canDelete: z.boolean(),
    canShare: z.boolean(),
  }),
});

export type NodeDetailsResponse = z.infer<typeof nodeDetailsResponseSchema>;

// ============================================================================
// STORE INTERFACES (client-side state management)
// ============================================================================

// Profile View Store (UI State Layer) - Zustand
export interface ProfileViewStore {
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
