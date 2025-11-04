/**
 * Type guard utilities for safe narrowing of TimelineNode types.
 *
 * These functions enable compile-time type safety when accessing
 * node-specific metadata without runtime overhead.
 *
 * @example
 * ```typescript
 * if (isJobNode(node)) {
 *   console.log(node.meta.role); // TypeScript knows meta is JobMeta
 * }
 * ```
 */

import { TimelineNodeType } from './enums';
import type {
  ActionMeta,
  CareerTransitionMeta,
  EducationMeta,
  EventMeta,
  JobMeta,
  ProjectMeta,
  TimelineNode,
} from './types';

/**
 * Type guard for Job nodes.
 * Narrows TimelineNode to have JobMeta type.
 */
export function isJobNode(
  node: TimelineNode
): node is TimelineNode & { meta: JobMeta } {
  return node.type === TimelineNodeType.Job;
}

/**
 * Type guard for Education nodes.
 * Narrows TimelineNode to have EducationMeta type.
 */
export function isEducationNode(
  node: TimelineNode
): node is TimelineNode & { meta: EducationMeta } {
  return node.type === TimelineNodeType.Education;
}

/**
 * Type guard for Project nodes.
 * Narrows TimelineNode to have ProjectMeta type.
 */
export function isProjectNode(
  node: TimelineNode
): node is TimelineNode & { meta: ProjectMeta } {
  return node.type === TimelineNodeType.Project;
}

/**
 * Type guard for Event nodes.
 * Narrows TimelineNode to have EventMeta type.
 */
export function isEventNode(
  node: TimelineNode
): node is TimelineNode & { meta: EventMeta } {
  return node.type === TimelineNodeType.Event;
}

/**
 * Type guard for Action nodes.
 * Narrows TimelineNode to have ActionMeta type.
 */
export function isActionNode(
  node: TimelineNode
): node is TimelineNode & { meta: ActionMeta } {
  return node.type === TimelineNodeType.Action;
}

/**
 * Type guard for Career Transition nodes.
 * Narrows TimelineNode to have CareerTransitionMeta type.
 */
export function isCareerTransitionNode(
  node: TimelineNode
): node is TimelineNode & { meta: CareerTransitionMeta } {
  return node.type === TimelineNodeType.CareerTransition;
}

// ============================================================================
// RUNTIME VALIDATION TYPE GUARDS
// ============================================================================
/**
 * These guards perform actual Zod schema validation for runtime safety.
 * Use these when you need to verify meta structure integrity (e.g., from database, API).
 *
 * For compile-time type narrowing only, use the guards above (isJobNode, etc.)
 *
 * @example
 * ```typescript
 * // Compile-time only (fast, no validation)
 * if (isJobNode(node)) {
 *   console.log(node.meta.role); // TypeScript knows type, but meta might be invalid
 * }
 *
 * // Runtime validation (safe, validates meta structure)
 * if (isValidJobNode(node)) {
 *   console.log(node.meta.role); // TypeScript + runtime both guarantee valid JobMeta
 * }
 *
 * // Assertion (throws if invalid)
 * assertJobNode(node);
 * console.log(node.meta.role); // Guaranteed valid or error thrown
 * ```
 */

import {
  educationMetaSchema,
  eventMetaSchema,
  jobMetaSchema,
  projectMetaSchema,
} from './types';

/**
 * Runtime validation for Job nodes.
 * Returns true if node type is Job AND meta passes jobMetaSchema validation.
 */
export function isValidJobNode(
  node: TimelineNode
): node is TimelineNode & { meta: JobMeta } {
  if (node.type !== TimelineNodeType.Job) return false;
  return jobMetaSchema.safeParse(node.meta).success;
}

/**
 * Runtime validation for Education nodes.
 * Returns true if node type is Education AND meta passes educationMetaSchema validation.
 */
export function isValidEducationNode(
  node: TimelineNode
): node is TimelineNode & { meta: EducationMeta } {
  if (node.type !== TimelineNodeType.Education) return false;
  return educationMetaSchema.safeParse(node.meta).success;
}

/**
 * Runtime validation for Project nodes.
 * Returns true if node type is Project AND meta passes projectMetaSchema validation.
 */
export function isValidProjectNode(
  node: TimelineNode
): node is TimelineNode & { meta: ProjectMeta } {
  if (node.type !== TimelineNodeType.Project) return false;
  return projectMetaSchema.safeParse(node.meta).success;
}

/**
 * Runtime validation for Event nodes.
 * Returns true if node type is Event AND meta passes eventMetaSchema validation.
 */
export function isValidEventNode(
  node: TimelineNode
): node is TimelineNode & { meta: EventMeta } {
  if (node.type !== TimelineNodeType.Event) return false;
  return eventMetaSchema.safeParse(node.meta).success;
}

/**
 * Assertion guard for Job nodes.
 * Throws error if node type is not Job or meta is invalid.
 * Use when you expect a valid Job node and want to fail fast.
 */
export function assertJobNode(
  node: TimelineNode
): asserts node is TimelineNode & { meta: JobMeta } {
  if (node.type !== TimelineNodeType.Job) {
    throw new Error(`Expected Job node, got ${node.type}`);
  }
  jobMetaSchema.parse(node.meta); // Throws if invalid
}

/**
 * Assertion guard for Education nodes.
 * Throws error if node type is not Education or meta is invalid.
 */
export function assertEducationNode(
  node: TimelineNode
): asserts node is TimelineNode & { meta: EducationMeta } {
  if (node.type !== TimelineNodeType.Education) {
    throw new Error(`Expected Education node, got ${node.type}`);
  }
  educationMetaSchema.parse(node.meta); // Throws if invalid
}

// ============================================================================
// NETWORKING ACTIVITY TYPE GUARDS
// ============================================================================

import type {
  ColdOutreachActivity,
  InformationalInterviewActivity,
  NetworkingActivity,
  NetworkingEventActivity,
  ReconnectedActivity,
} from './api/updates.schemas.js';
import { NetworkingType } from './enums.js';

/**
 * Compile-time type guard for ColdOutreach activities.
 * Use this after validating NetworkingData to narrow the activity type.
 *
 * @example
 * ```typescript
 * if (isColdOutreachActivity(activity)) {
 *   console.log(activity.whom); // TypeScript knows this exists
 * }
 * ```
 */
export function isColdOutreachActivity(
  activity: NetworkingActivity
): activity is ColdOutreachActivity {
  return activity.networkingType === NetworkingType.ColdOutreach;
}

/**
 * Compile-time type guard for Reconnected activities.
 */
export function isReconnectedActivity(
  activity: NetworkingActivity
): activity is ReconnectedActivity {
  return activity.networkingType === NetworkingType.ReconnectedWithSomeone;
}

/**
 * Compile-time type guard for NetworkingEvent activities.
 */
export function isNetworkingEventActivity(
  activity: NetworkingActivity
): activity is NetworkingEventActivity {
  return activity.networkingType === NetworkingType.AttendedNetworkingEvent;
}

/**
 * Compile-time type guard for InformationalInterview activities.
 */
export function isInformationalInterviewActivity(
  activity: NetworkingActivity
): activity is InformationalInterviewActivity {
  return activity.networkingType === NetworkingType.InformationalInterview;
}
