/**
 * Hierarchy Rules for Timeline Nodes
 * Ensures proper parent-child relationships based on Lighthouse schema
 */

import { TimelineNodeType } from '@journey/schema';

/**
 * Nodes that can only exist at the root level (no parent)
 */
export const ROOT_ONLY_NODES = new Set<TimelineNodeType>([
  TimelineNodeType.Job,
  TimelineNodeType.Education,
  TimelineNodeType.CareerTransition,
]);

/**
 * Nodes that can exist at any level (root or nested)
 */
export const ANY_LEVEL_NODES = new Set<TimelineNodeType>([
  TimelineNodeType.Project,
  TimelineNodeType.Event,
  TimelineNodeType.Action,
]);

/**
 * Defines which node types can be children of each parent type
 */
export const HIERARCHY_RULES: Record<TimelineNodeType, Set<TimelineNodeType>> = {
  [TimelineNodeType.Job]: new Set([
    TimelineNodeType.Project,
    TimelineNodeType.Event,
    TimelineNodeType.Action,
  ]),
  [TimelineNodeType.Education]: new Set([
    TimelineNodeType.Project,
    TimelineNodeType.Event,
    TimelineNodeType.Action,
  ]),
  [TimelineNodeType.CareerTransition]: new Set([
    TimelineNodeType.Project,
    TimelineNodeType.Event,
    TimelineNodeType.Action,
  ]),
  [TimelineNodeType.Project]: new Set([
    TimelineNodeType.Event,
    TimelineNodeType.Action,
  ]),
  [TimelineNodeType.Event]: new Set([
    TimelineNodeType.Action,
  ]),
  [TimelineNodeType.Action]: new Set([]),
};

/**
 * Validate if a node type can be a child of a parent type
 */
export function canBeChildOf(
  childType: TimelineNodeType,
  parentType: TimelineNodeType | null
): boolean {
  // If no parent, check if this can be a root node
  if (!parentType) {
    return ROOT_ONLY_NODES.has(childType) || ANY_LEVEL_NODES.has(childType);
  }

  // Check if parent type allows this child type
  const allowedChildren = HIERARCHY_RULES[parentType];
  return allowedChildren ? allowedChildren.has(childType) : false;
}

/**
 * Get allowed child types for a parent
 */
export function getAllowedChildTypes(
  parentType: TimelineNodeType | null
): TimelineNodeType[] {
  if (!parentType) {
    return [
      ...Array.from(ROOT_ONLY_NODES),
      ...Array.from(ANY_LEVEL_NODES),
    ];
  }

  const allowedChildren = HIERARCHY_RULES[parentType];
  return allowedChildren ? Array.from(allowedChildren) : [];
}

/**
 * Check if a node type must be at root level
 */
export function mustBeRoot(nodeType: TimelineNodeType): boolean {
  return ROOT_ONLY_NODES.has(nodeType);
}

/**
 * Check if a node type can have children
 */
export function canHaveChildren(nodeType: TimelineNodeType): boolean {
  const rules = HIERARCHY_RULES[nodeType];
  return rules ? rules.size > 0 : false;
}