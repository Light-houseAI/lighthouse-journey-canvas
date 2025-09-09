/**
 * Hierarchy Rules for Timeline Nodes
 * Based on @shared/schema.ts from Lighthouse
 */

export enum TimelineNodeType {
  Job = 'job',
  Education = 'education',
  Project = 'project',
  Event = 'event',
  Action = 'action',
  CareerTransition = 'careerTransition',
}

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
    TimelineNodeType.Project, // Projects can have sub-projects
    TimelineNodeType.Event,
    TimelineNodeType.Action,
  ]),
  [TimelineNodeType.Event]: new Set([
    TimelineNodeType.Project,
    TimelineNodeType.Action,
  ]),
  [TimelineNodeType.Action]: new Set([
    TimelineNodeType.Project,
  ]),
};

/**
 * Validate if a node type can be a root node
 */
export function canBeRoot(nodeType: TimelineNodeType): boolean {
  return ROOT_ONLY_NODES.has(nodeType) || ANY_LEVEL_NODES.has(nodeType);
}

/**
 * Validate if a node type can have the specified parent type
 */
export function canHaveParent(
  nodeType: TimelineNodeType,
  parentType: TimelineNodeType
): boolean {
  // Root-only nodes cannot have any parent
  if (ROOT_ONLY_NODES.has(nodeType)) {
    return false;
  }
  
  // Check if parent type allows this child type
  const allowedChildren = HIERARCHY_RULES[parentType];
  return allowedChildren ? allowedChildren.has(nodeType) : false;
}

/**
 * Get valid child types for a parent node type
 */
export function getValidChildTypes(
  parentType: TimelineNodeType
): TimelineNodeType[] {
  const allowedChildren = HIERARCHY_RULES[parentType];
  return allowedChildren ? Array.from(allowedChildren) : [];
}

/**
 * Validate an entire node hierarchy
 */
export interface NodeHierarchy {
  id: string;
  type: TimelineNodeType;
  parentId?: string;
  children?: NodeHierarchy[];
}

export function validateHierarchy(
  nodes: NodeHierarchy[],
  parentType?: TimelineNodeType
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  for (const node of nodes) {
    // Check root-level validation
    if (!parentType) {
      if (!canBeRoot(node.type)) {
        errors.push(
          `Node ${node.id} of type '${node.type}' cannot be at root level`
        );
      }
    } else {
      // Check parent-child validation
      if (!canHaveParent(node.type, parentType)) {
        errors.push(
          `Node ${node.id} of type '${node.type}' cannot be child of '${parentType}'`
        );
      }
    }
    
    // Recursively validate children
    if (node.children && node.children.length > 0) {
      const childValidation = validateHierarchy(node.children, node.type);
      errors.push(...childValidation.errors);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}