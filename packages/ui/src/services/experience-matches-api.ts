/**
 * Experience Matches API Client (LIG-179)
 *
 * API client for fetching experience matches from the backend.
 * Handles HTTP requests and error transformation.
 * Uses schema validation for type safety.
 * Returns server response format (success/error)
 */

import type { GraphRAGSearchResponse } from '../components/search/types/search.types';
import { httpClient } from './http-client';

/**
 * Fetch experience matches for a node
 * Validates response using schema
 */
export async function fetchExperienceMatches(
  nodeId: string,
  forceRefresh = false
): Promise<GraphRAGSearchResponse> {
  const queryParams = forceRefresh ? '?forceRefresh=true' : '';
  const url = `/api/v2/experience/${nodeId}/matches${queryParams}`;

  return httpClient.request<GraphRAGSearchResponse>(url, {
    method: 'GET',
  });
}

/**
 * Fetch just the search query for a node
 * (Optional - useful for getting query without full match data)
 */
export async function fetchSearchQuery(nodeId: string): Promise<string> {
  const url = `/api/v2/experience/${nodeId}/search-query`;
  return httpClient.request<string>(url, {
    method: 'GET',
  });
}

/**
 * Prefetch matches for multiple nodes
 * Useful for preloading data when timeline loads
 */
export async function prefetchMatches(
  nodeIds: string[]
): Promise<Map<string, GraphRAGSearchResponse>> {
  const results = new Map<string, GraphRAGSearchResponse>();

  // Fetch in parallel with error handling for individual failures
  const promises = nodeIds.map(async (nodeId) => {
    try {
      const data = await fetchExperienceMatches(nodeId);
      results.set(nodeId, data);
    } catch (error) {
      // Log error but don't fail the entire batch
      console.warn(
        `Failed to prefetch matches for node ${nodeId}:`,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  });

  await Promise.all(promises);

  return results;
}

/**
 * Check if a node can have matches (client-side check)
 * This is a quick check before making an API call
 * LIG-206 Phase 6: Updated to support job application event nodes
 */
export function canNodeHaveMatches(
  nodeType: string,
  endDate?: string | null,
  meta?: any
): boolean {
  // LIG-206: Support job application event nodes
  const isJobApplication =
    nodeType === 'event' && meta?.eventType === 'job-application';

  // Only job, education, and job application nodes can have matches
  if (nodeType !== 'job' && nodeType !== 'education' && !isJobApplication) {
    return false;
  }

  // Job applications always have matches (they're always "current")
  if (isJobApplication) {
    return true;
  }

  // For job/education nodes: check if they're current
  // If no end date, it's current
  if (!endDate) {
    return true;
  }

  // Check if end date is in the future
  try {
    const endDateObj = new Date(endDate + '-01');
    const now = new Date();
    return endDateObj > now;
  } catch {
    return false;
  }
}
