/**
 * Frontend Experience Utility Functions (LIG-179)
 *
 * Client-side utilities for working with experience nodes.
 * Mirrors server-side logic for consistency.
 */

import type { TimelineNode } from '@journey/schema';

/**
 * Check if an experience node is current (no end date or future end date)
 * This duplicates server logic for client-side checks
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
    const endDateObj = new Date(endDate + '-01');

    // Check if date is valid
    if (isNaN(endDateObj.getTime())) {
      return false;
    }

    // Compare with current date
    const now = new Date();

    // If end date is in the future, it's current
    return endDateObj > now;
  } catch {
    // Invalid date format, treat as not current
    return false;
  }
}

/**
 * Get organization name from node metadata
 */
export function getOrganizationName(node: TimelineNode): string | undefined {
  // This would typically look up the org by ID
  // For now, return a placeholder or the orgId
  if (node.meta?.orgId) {
    return `Organization ${node.meta.orgId}`;
  }

  return undefined;
}
