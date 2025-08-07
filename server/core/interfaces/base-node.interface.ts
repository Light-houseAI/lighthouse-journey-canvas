/**
 * Base Node Interface and NodeType Enum
 *
 * Defines the fundamental structure for all node types in the system.
 * All specific node types (WorkExperience, Education, etc.) extend this base interface.
 */

/**
 * Enum defining all supported node types in the system
 * As specified in PRD section 3.1 and 3.2
 */
export enum NodeType {
  // Core Node Types (MVP - Section 3.1)
  Job = 'workExperience',
  Education = 'education',
  Project = 'project',

  // Extended Node Types (Future - Section 3.2)
  Event = 'event',
  Action = 'action',
  CareerTransition = 'careerTransition'
}

/**
 * Base interface that all node types must implement
 *
 * This provides the common structure for all nodes stored in the
 * profiles.filteredData JSON field as specified in PRD section 7.2
 */
export interface BaseNode {
  /** Unique identifier for the node */
  id: string;

  /** Type of node - must be one of the supported NodeType values */
  type: NodeType;

  /** Human-readable title/name for the node */
  title: string;

  /** Optional detailed description of the node */
  description?: string;

  /** Optional start date in ISO string format */
  startDate?: string;

  /** Optional end date in ISO string format (or "Present" for ongoing) */
  endDate?: string;

  /** Timestamp when the node was created */
  createdAt: string;

  /** Timestamp when the node was last updated */
  updatedAt: string;
}

/**
 * Type guard to check if an object is a valid BaseNode
 */
export function isBaseNode(obj: any): obj is BaseNode {
  return (
    obj &&
    typeof obj.id === 'string' &&
    Object.values(NodeType).includes(obj.type) &&
    typeof obj.title === 'string' &&
    typeof obj.createdAt === 'string' &&
    typeof obj.updatedAt === 'string' &&
    (obj.description === undefined || typeof obj.description === 'string') &&
    (obj.startDate === undefined || typeof obj.startDate === 'string') &&
    (obj.endDate === undefined || typeof obj.endDate === 'string')
  );
}

/**
 * Utility function to create a new BaseNode with generated timestamps
 */
export function createBaseNode(
  id: string,
  type: NodeType,
  title: string,
  options: {
    description?: string;
    startDate?: string;
    endDate?: string;
  } = {}
): BaseNode {
  const now = new Date().toISOString();

  return {
    id,
    type,
    title,
    description: options.description,
    startDate: options.startDate,
    endDate: options.endDate,
    createdAt: now,
    updatedAt: now
  };
}
