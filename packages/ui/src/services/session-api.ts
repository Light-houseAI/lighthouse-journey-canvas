/**
 * Session API Service
 * Fetches desktop session data for timeline nodes
 * (LIG-247: Desktop Session to Work Track Mapping)
 */

import type {
  NodeSessionsResponse,
  SessionMappingItem,
  ListSessionsResponse,
} from '@journey/schema';

import { httpClient } from './http-client';

const BASE_URL = '/api/v2/sessions';

/**
 * Query options for fetching node sessions
 */
export interface NodeSessionsOptions {
  page?: number;
  limit?: number;
}

/**
 * Get sessions mapped to a specific timeline node
 * Returns sessions with pagination and aggregate stats
 */
export async function getNodeSessions(
  nodeId: string,
  options: NodeSessionsOptions = {}
): Promise<NodeSessionsResponse['data']> {
  const { page = 1, limit = 10 } = options;
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  return httpClient.request<NodeSessionsResponse['data']>(
    `/api/v2/timeline/nodes/${nodeId}/sessions?${params.toString()}`
  );
}

/**
 * Format duration in seconds to human-readable string
 */
export function formatSessionDuration(seconds: number | null): string {
  if (!seconds) return '0m';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Format session date to readable string
 */
export function formatSessionDate(dateString: string | null): string {
  if (!dateString) return 'Unknown';

  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format session time range
 */
export function formatSessionTimeRange(
  startedAt: string | null,
  endedAt: string | null
): string {
  if (!startedAt) return '';

  const start = new Date(startedAt);
  const startTime = start.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (!endedAt) return startTime;

  const end = new Date(endedAt);
  const endTime = end.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return `${startTime} - ${endTime}`;
}

/**
 * Query options for fetching all user sessions
 */
export interface UserSessionsOptions {
  page?: number;
  limit?: number;
  nodeId?: string;
}

/**
 * Get all sessions for the authenticated user
 * Returns sessions with pagination and optional filtering
 */
export async function getUserSessions(
  options: UserSessionsOptions = {}
): Promise<ListSessionsResponse['data']> {
  const { page = 1, limit = 20, nodeId } = options;
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  if (nodeId) {
    params.set('nodeId', nodeId);
  }

  return httpClient.request<ListSessionsResponse['data']>(
    `${BASE_URL}?${params.toString()}`
  );
}

// Re-export types for convenience
export type { NodeSessionsResponse, SessionMappingItem, ListSessionsResponse };

