/**
 * Node Type Definitions
 *
 * Defines the specific node types that extend the BaseNode interface.
 * Each node type corresponds to a different category of career/professional data
 * as specified in PRD sections 3.1 and 3.2.
 */

import { BaseNode, NodeType } from '../core/interfaces/base-node.interface';

/**
 * Work Experience Node
 *
 * Represents employment history and professional roles.
 * Core node type for MVP (PRD Section 3.1)
 */
export interface Job extends BaseNode {
  /** Company/organization name */
  company: string;

  /** Job title/position held */
  position: string;

  /** Work location (city, state, country) */
  location?: string;
}

/**
 * Education Node
 *
 * Represents academic qualifications and educational background.
 * Core node type for MVP (PRD Section 3.1)
 */
export interface Education extends BaseNode {
  /** Educational institution name */
  institution?: string;

  /** Degree or certification type */
  degree?: string;

  /** Field of study or major */
  field?: string;

  /** Institution location */
  location?: string;

  /** Academic or personal projects */
  projects?: Project[];

  events?: Event[];

  actions?: Action[];
}

/**
 * Project Node
 *
 * Represents personal or professional projects.
 * Core node type for MVP (PRD Section 3.1)
 */
export interface Project extends BaseNode {

  /** Technologies and tools used */
  technologies?: string[];

  /** Project type */
  projectType?: 'personal' | 'professional' | 'academic' | 'freelance' | 'open-source';
}

/**
 * Event Node
 *
 * Represents conferences, meetups, presentations, and other professional events.
 * Extended node type for future implementation (PRD Section 3.2)
 */
export interface Event extends BaseNode {
  /** Event location */
  location?: string;
}

/**
 * Action Node
 *
 * Represents achievements, milestones, certifications, and other professional actions.
 * Extended node type for future implementation (PRD Section 3.2)
 */
export interface Action extends BaseNode {

}

/**
 * Career Transition Node
 *
 * Represents job changes, career pivots, and major professional transitions.
 * Extended node type for future implementation (PRD Section 3.2)
 */
export interface CareerTransition extends BaseNode {

}

/**
 * Union type for all node types
 */
export type AnyNode = Job | Education | Project | Event | Action | CareerTransition;

/**
 * Type guards for node types
 */

/** Type guard for WorkExperience nodes */
export function isWorkExperience(node: any): node is Job {
  return !!(node && node.type === NodeType.Job && typeof node.company === 'string' && typeof node.position === 'string');
}

/** Type guard for Education nodes */
export function isEducation(node: any): node is Education {
  return !!(node && node.type === NodeType.Education && typeof node.institution === 'string');
}

/** Type guard for Project nodes */
export function isProject(node: any): node is Project {
  return !!(node && node.type === NodeType.Project && typeof node.status === 'string');
}

/** Type guard for Event nodes */
export function isEvent(node: any): node is Event {
  return !!(node && node.type === NodeType.Event && typeof node.eventType === 'string');
}

/** Type guard for Action nodes */
export function isAction(node: any): node is Action {
  return !!(node && node.type === NodeType.Action && typeof node.actionType === 'string');
}

/** Type guard for CareerTransition nodes */
export function isCareerTransition(node: any): node is CareerTransition {
  return !!(node && node.type === NodeType.CareerTransition && typeof node.transitionType === 'string');
}

/**
 * Utility function to get node type from node object
 */
export function getNodeType(node: AnyNode): NodeType {
  return node.type;
}

/**
 * Utility function to create a node of specific type with default values
 */
export function createNode<T extends AnyNode>(
  type: NodeType,
  baseData: Omit<T, 'id' | 'createdAt' | 'updatedAt'>,
  id?: string
): T {
  const now = new Date().toISOString();
  const nodeId = id || `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  return {
    ...baseData,
    id: nodeId,
    createdAt: now,
    updatedAt: now,
  } as T;
}
