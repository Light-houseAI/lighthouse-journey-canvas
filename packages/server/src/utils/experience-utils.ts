/**
 * Experience Utility Functions (LIG-182)
 *
 * Utilities for working with experience nodes (jobs, education, and career transitions).
 * Includes current experience detection and search query building.
 */

import { TimelineNodeType } from '@journey/schema';
import type { TimelineNode } from '@journey/schema';

/**
 * Check if an experience node is current (no end date or future end date)
 */
export function isCurrentExperience(node: TimelineNode): boolean {
  // Only job, education, and career transition nodes can be experiences
  switch (node.type) {
    case TimelineNodeType.Job:
    case TimelineNodeType.Education:
    case TimelineNodeType.CareerTransition:
      break;
    default:
      return false;
  }

  const endDate = node.meta?.endDate;

  // No end date means current
  if (!endDate) {
    return true;
  }

  try {
    // Parse the YYYY-MM format date
    // Add -01 to make it a valid date (first day of month)
    const endDateObj = new Date(endDate + '-01');

    // Check if date is valid
    if (isNaN(endDateObj.getTime())) {
      return false;
    }

    // Compare with current date
    const now = new Date();

    // If end date is in the future, it's current
    return endDateObj > now;
  } catch (error) {
    // Invalid date format, treat as not current
    return false;
  }
}

/**
 * Build a search query from experience node metadata
 * Prioritizes description over title/role/degree
 */
export function buildSearchQuery(node: TimelineNode): string {
  // First priority: description
  if (node.meta?.description) {
    return node.meta.description;
  }

  // Second priority: type-specific fields
  switch (node.type) {
    case TimelineNodeType.Job:
      if (node.meta?.role) {
        return node.meta.role;
      }
      break;
    case TimelineNodeType.Education:
      if (node.meta?.degree) {
        return node.meta.degree;
      }
      break;
    case TimelineNodeType.CareerTransition:
      // Career transitions should prioritize title as fallback
      if (node.meta?.title) {
        return node.meta.title;
      }
      break;
    default:
      break;
  }

  // Final fallback to title if available
  if (node.meta?.title) {
    return node.meta.title;
  }

  return '';
}
