/**
 * Experience Utility Functions (LIG-179)
 *
 * Utilities for working with experience nodes (jobs and education).
 * Includes current experience detection and search query building.
 */

import type { TimelineNode } from '@journey/schema';

/**
 * Check if an experience node is current (no end date or future end date)
 */
export function isCurrentExperience(node: TimelineNode): boolean {
  // Only job and education nodes can be experiences
  if (node.type !== 'job' && node.type !== 'education') {
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

  // Second priority: role (for jobs) or degree (for education)
  if (node.type === 'job' && node.meta?.role) {
    return node.meta.role;
  }

  if (node.type === 'education' && node.meta?.degree) {
    return node.meta.degree;
  }

  // Fallback to title if available (shouldn't happen for job/education)
  if (node.meta?.title) {
    return node.meta.title;
  }

  return '';
}
