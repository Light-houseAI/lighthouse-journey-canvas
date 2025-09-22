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

  // Fallback to title if available
  if (node.meta?.title) {
    return node.meta.title;
  }

  return '';
}

/**
 * Format experience duration for display
 */
export function formatExperienceDuration(startDate?: string, endDate?: string | null): string {
  if (!startDate) {
    return '';
  }

  try {
    const start = new Date(startDate + '-01');
    const end = endDate ? new Date(endDate + '-01') : new Date();

    const months =
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth());

    if (months < 1) {
      return 'Less than a month';
    }

    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;

    if (years === 0) {
      return remainingMonths === 1 ? '1 month' : `${remainingMonths} months`;
    }

    if (remainingMonths === 0) {
      return years === 1 ? '1 year' : `${years} years`;
    }

    const yearText = years === 1 ? '1 year' : `${years} years`;
    const monthText = remainingMonths === 1 ? '1 month' : `${remainingMonths} months`;

    return `${yearText} ${monthText}`;
  } catch {
    return '';
  }
}

/**
 * Get a display label for the experience status
 */
export function getExperienceStatusLabel(node: TimelineNode): string {
  if (!isCurrentExperience(node)) {
    return 'Past';
  }

  const endDate = node.meta?.endDate;
  if (!endDate) {
    return 'Current';
  }

  // Has future end date
  try {
    const endDateObj = new Date(endDate + '-01');
    const now = new Date();
    const daysUntilEnd = Math.ceil((endDateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilEnd <= 30) {
      return `Ending in ${daysUntilEnd} days`;
    }

    return 'Current';
  } catch {
    return 'Current';
  }
}

/**
 * Check if node metadata has enough information for match detection
 */
export function hasEnoughInfoForMatches(node: TimelineNode): boolean {
  // Need at least a description, role, or degree
  if (node.type === 'job') {
    return !!(node.meta?.description || node.meta?.role);
  }

  if (node.type === 'education') {
    return !!(node.meta?.description || node.meta?.degree);
  }

  return false;
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

/**
 * Sort experience nodes by start date (most recent first)
 */
export function sortExperiencesByDate(nodes: TimelineNode[]): TimelineNode[] {
  return [...nodes].sort((a, b) => {
    const aDate = a.meta?.startDate || '';
    const bDate = b.meta?.startDate || '';

    // Sort in descending order (most recent first)
    return bDate.localeCompare(aDate);
  });
}

/**
 * Group experience nodes by current/past status
 */
export function groupExperiencesByStatus(nodes: TimelineNode[]): {
  current: TimelineNode[];
  past: TimelineNode[];
} {
  const current: TimelineNode[] = [];
  const past: TimelineNode[] = [];

  nodes.forEach(node => {
    if (isCurrentExperience(node)) {
      current.push(node);
    } else {
      past.push(node);
    }
  });

  return { current, past };
}