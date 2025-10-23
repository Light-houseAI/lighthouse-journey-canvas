/**
 * Type Utility Layer
 *
 * Extends schema types with UI-specific presentation fields.
 * All UI code should import schema types and use these utilities
 * to add presentation layer data.
 */

import type {
  ActionMeta,
  CareerTransitionMeta,
  EducationMeta,
  EventMeta,
  JobMeta,
  ProjectMeta,
  TimelineNode,
  TimelineNodeWithPermissions,
} from '@journey/schema';

// ============================================================================
// TYPE NARROWING HELPERS
// ============================================================================

/**
 * Type guards for discriminated union narrowing
 */
export function isJobNode(
  node: TimelineNode
): node is TimelineNode & { type: 'job'; meta: JobMeta } {
  return node.type === 'job';
}

export function isEducationNode(
  node: TimelineNode
): node is TimelineNode & { type: 'education'; meta: EducationMeta } {
  return node.type === 'education';
}

export function isProjectNode(
  node: TimelineNode
): node is TimelineNode & { type: 'project'; meta: ProjectMeta } {
  return node.type === 'project';
}

export function isEventNode(
  node: TimelineNode
): node is TimelineNode & { type: 'event'; meta: EventMeta } {
  return node.type === 'event';
}

export function isActionNode(
  node: TimelineNode
): node is TimelineNode & { type: 'action'; meta: ActionMeta } {
  return node.type === 'action';
}

export function isCareerTransitionNode(
  node: TimelineNode
): node is TimelineNode & {
  type: 'careerTransition';
  meta: CareerTransitionMeta;
} {
  return node.type === 'careerTransition';
}

// ============================================================================
// HIERARCHY EXTENSIONS (for timeline visualization)
// ============================================================================

/**
 * UI extensions for hierarchy/tree visualization
 */
export interface HierarchyExtension {
  readonly level: number; // Depth in tree (0 = root)
  readonly isRoot: boolean; // Has no parent
  readonly childCount: number; // Direct children count
}

/**
 * Timeline node with hierarchy visualization metadata
 */
export type HierarchyNode = TimelineNodeWithPermissions & HierarchyExtension;

/**
 * Calculates the depth level of a node in the hierarchy
 */
export function calculateNodeLevel(
  node: TimelineNodeWithPermissions,
  allNodes: TimelineNodeWithPermissions[]
): number {
  if (!node.parentId) return 0;

  const parent = allNodes.find((n) => n.id === node.parentId);
  if (!parent) return 0;

  return 1 + calculateNodeLevel(parent, allNodes);
}

/**
 * Counts direct children of a node
 */
export function countChildren(
  nodeId: string,
  allNodes: TimelineNodeWithPermissions[]
): number {
  return allNodes.filter((n) => n.parentId === nodeId).length;
}

/**
 * Adds hierarchy metadata to a single node
 */
export function addHierarchyMetadata(
  node: TimelineNodeWithPermissions,
  allNodes: TimelineNodeWithPermissions[]
): HierarchyNode {
  return {
    ...node,
    level: calculateNodeLevel(node, allNodes),
    isRoot: !node.parentId,
    childCount: countChildren(node.id, allNodes),
  };
}

/**
 * Converts array of nodes to hierarchy nodes
 */
export function toHierarchyNodes(
  nodes: TimelineNodeWithPermissions[]
): HierarchyNode[] {
  return nodes.map((node) => addHierarchyMetadata(node, nodes));
}

// ============================================================================
// DISPLAY FIELD COMPUTATION
// ============================================================================

/**
 * Extracts display title from node metadata based on type
 */
export function getNodeDisplayTitle(node: TimelineNode): string {
  const meta = node.meta as Record<string, any>;

  switch (node.type) {
    case 'job':
      return meta.role || meta.title || 'Untitled Position';
    case 'education':
      return meta.degree || meta.title || 'Education';
    case 'project':
      return meta.title || 'Untitled Project';
    case 'event':
      return meta.title || 'Event';
    case 'action':
      return meta.title || 'Action';
    case 'careerTransition':
      return meta.title || 'Career Transition';
    default:
      return 'Untitled';
  }
}

/**
 * Extracts display subtitle from node metadata based on type
 */
export function getNodeDisplaySubtitle(node: TimelineNode): string {
  const meta = node.meta as Record<string, any>;

  switch (node.type) {
    case 'job':
      return meta.company || '';
    case 'education':
      return meta.field || '';
    case 'project':
      return meta.technologies?.join(', ') || '';
    case 'event':
      return meta.eventType || '';
    default:
      return '';
  }
}

/**
 * Determines if a node represents a current/ongoing experience
 */
export function isCurrentNode(node: TimelineNode): boolean {
  const meta = node.meta as Record<string, any>;
  const endDate = meta.endDate;
  return !endDate || endDate === null;
}

// ============================================================================
// META FIELD EXTRACTION
// ============================================================================

/**
 * Type-safe meta field extractor
 * Returns typed value based on node type
 */
export function getNodeMeta<T extends { meta: any }>(node: T): T['meta'] {
  return node.meta;
}

/**
 * Safely extracts a field from meta object
 */
export function extractMetaField<T = unknown>(
  node: TimelineNode,
  fieldName: string
): T | undefined {
  const meta = node.meta as Record<string, any>;
  return meta[fieldName] as T | undefined;
}

/**
 * Extracts date field from meta
 */
export function extractDateField(
  node: TimelineNode,
  fieldName: 'startDate' | 'endDate'
): string | null | undefined {
  return extractMetaField<string | null>(node, fieldName);
}
