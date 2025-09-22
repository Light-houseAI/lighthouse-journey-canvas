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

/**
 * Validate if a node can have matches
 * (Current experience nodes only)
 */
export function canHaveMatches(node: TimelineNode): boolean {
  return (node.type === 'job' || node.type === 'education') && isCurrentExperience(node);
}

/**
 * Get display text for an experience node
 * Used for UI display purposes
 */
export function getExperienceDisplayText(node: TimelineNode): string {
  if (node.type === 'job') {
    return node.meta?.role || 'Job Experience';
  }

  if (node.type === 'education') {
    return node.meta?.degree || 'Education';
  }

  return 'Experience';
}

/**
 * Parse YYYY-MM date format to Date object
 */
export function parseYearMonthDate(dateStr: string): Date | null {
  if (!dateStr) {
    return null;
  }

  try {
    // Add -01 to make it a valid date (first day of month)
    const dateObj = new Date(dateStr + '-01');

    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
      return null;
    }

    return dateObj;
  } catch {
    return null;
  }
}

/**
 * Check if an experience is ending soon (within 30 days)
 * Useful for showing warnings or prompts
 */
export function isEndingSoon(node: TimelineNode, daysThreshold = 30): boolean {
  if (!isCurrentExperience(node)) {
    return false;
  }

  const endDate = node.meta?.endDate;
  if (!endDate) {
    return false; // No end date means not ending
  }

  const endDateObj = parseYearMonthDate(endDate);
  if (!endDateObj) {
    return false;
  }

  const now = new Date();
  const daysUntilEnd = Math.ceil((endDateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return daysUntilEnd > 0 && daysUntilEnd <= daysThreshold;
}

/**
 * Get duration of an experience in months
 */
export function getExperienceDuration(node: TimelineNode): number | null {
  const startDate = node.meta?.startDate;
  if (!startDate) {
    return null;
  }

  const startDateObj = parseYearMonthDate(startDate);
  if (!startDateObj) {
    return null;
  }

  const endDate = node.meta?.endDate;
  const endDateObj = endDate ? parseYearMonthDate(endDate) : new Date();

  if (!endDateObj) {
    return null;
  }

  // Calculate months difference
  const monthsDiff =
    (endDateObj.getFullYear() - startDateObj.getFullYear()) * 12 +
    (endDateObj.getMonth() - startDateObj.getMonth());

  return Math.max(0, monthsDiff);
}