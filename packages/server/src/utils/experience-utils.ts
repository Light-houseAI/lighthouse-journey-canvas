/**
 * Experience Utility Functions (LIG-182)
 *
 * Utilities for working with experience nodes (jobs, education, and career transitions).
 * Includes current experience detection and search query building.
 */

import type { TimelineNode } from '@journey/schema';
import { TimelineNodeType } from '@journey/schema';

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
 *
 * Prioritizes description over title/role/degree for the base query.
 *
 * LIG-193 Enhancement: Optionally appends recent update notes to provide
 * additional context for GraphRAG matching. Update notes are filtered to
 * remove empty values and formatted with a clear delimiter.
 *
 * @param node - The timeline node to build a query from
 * @param updateNotes - Optional array of update note strings (typically from last 30 days)
 * @returns Formatted search query string. Format:
 *          - Without updates: "{base query from node metadata}"
 *          - With updates: "{base query}\n\nRecent updates:\n{note1}\n{note2}..."
 *
 * @example
 * // Basic usage
 * const query = buildSearchQuery(careerTransitionNode);
 * // Returns: "Looking for backend engineering roles"
 *
 * @example
 * // With update notes
 * const query = buildSearchQuery(careerTransitionNode, [
 *   "Applied to 5 companies",
 *   "Completed AWS certification"
 * ]);
 * // Returns: "Looking for backend engineering roles\n\nRecent updates:\nApplied to 5 companies\nCompleted AWS certification"
 */
export function buildSearchQuery(node: TimelineNode, updateNotes?: string[]): string {
  // Build base query from node metadata
  let baseQuery = '';

  // First priority: description
  if (node.meta?.description) {
    baseQuery = node.meta.description;
  }
  // Second priority: type-specific fields
  else {
    switch (node.type) {
      case TimelineNodeType.Job:
        if (node.meta?.role) {
          baseQuery = node.meta.role;
        }
        break;
      case TimelineNodeType.Education:
        if (node.meta?.degree) {
          baseQuery = node.meta.degree;
        }
        break;
      case TimelineNodeType.CareerTransition:
        // Career transitions should prioritize title as fallback
        if (node.meta?.title) {
          baseQuery = node.meta.title;
        }
        break;
      default:
        break;
    }

    // Final fallback to title if available
    if (!baseQuery && node.meta?.title) {
      baseQuery = node.meta.title;
    }
  }

  // If no update notes provided, return base query
  if (!updateNotes || updateNotes.length === 0) {
    return baseQuery;
  }

  // Filter out empty/null notes
  const validNotes = updateNotes.filter(note => note && note.trim().length > 0);

  if (validNotes.length === 0) {
    return baseQuery;
  }

  // Append update notes with delimiter
  const updatesSection = validNotes.join('\n');
  return `${baseQuery}\n\nRecent updates:\n${updatesSection}`;
}
