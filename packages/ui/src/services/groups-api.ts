/**
 * Groups API Service
 * Client for group CRUD operations and context resolution.
 */

import { httpClient } from './http-client';

const BASE_URL = '/api/v2/groups';

// ============================================================================
// TYPES
// ============================================================================

export interface Group {
  id: string;
  name: string;
  description?: string | null;
  nodeId?: string | null;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface GroupItem {
  id: string;
  itemType: 'session' | 'workflow' | 'step';
  sessionMappingId: string;
  workflowId?: string | null;
  stepId?: string | null;
  metadata?: Record<string, unknown> | null;
  addedAt: string;
}

export interface GroupWithItems {
  group: Group;
  items: GroupItem[];
}

export interface GroupSessionContext {
  id: string;
  generatedTitle: string | null;
  highLevelSummary: string | null;
  summary: Record<string, unknown> | null;
  screenshotDescriptions: Record<string, unknown> | null;
  durationSeconds: number | null;
  workflowName: string | null;
}

export interface CreateGroupRequest {
  name: string;
  description?: string;
  nodeId?: string;
}

export interface AddGroupItemsRequest {
  items: {
    itemType: 'session' | 'workflow' | 'step';
    sessionMappingId: string;
    workflowId?: string;
    stepId?: string;
    metadata?: Record<string, unknown>;
  }[];
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * List all groups for the authenticated user
 */
export async function getUserGroups(
  nodeId?: string
): Promise<Group[]> {
  const params = new URLSearchParams();
  if (nodeId) params.set('nodeId', nodeId);

  const query = params.toString();
  const url = query ? `${BASE_URL}?${query}` : BASE_URL;

  return httpClient.request<Group[]>(url);
}

/**
 * Get a group with its items
 */
export async function getGroup(groupId: string): Promise<GroupWithItems> {
  return httpClient.request<GroupWithItems>(`${BASE_URL}/${groupId}`);
}

/**
 * Create a new group
 */
export async function createGroup(data: CreateGroupRequest): Promise<Group> {
  return httpClient.post<Group>(BASE_URL, data);
}

/**
 * Update a group's name/description
 */
export async function updateGroup(
  groupId: string,
  data: { name?: string; description?: string }
): Promise<Group> {
  return httpClient.patch<Group>(`${BASE_URL}/${groupId}`, data);
}

/**
 * Delete a group
 */
export async function deleteGroup(groupId: string): Promise<void> {
  await httpClient.delete(`${BASE_URL}/${groupId}`);
}

/**
 * Add items to a group
 */
export async function addItemsToGroup(
  groupId: string,
  items: AddGroupItemsRequest['items']
): Promise<GroupItem[]> {
  return httpClient.post<GroupItem[]>(`${BASE_URL}/${groupId}/items`, { items });
}

/**
 * Remove an item from a group
 */
export async function removeItemFromGroup(
  groupId: string,
  itemId: string
): Promise<void> {
  await httpClient.delete(`${BASE_URL}/${groupId}/items/${itemId}`);
}

/**
 * Resolve a group's items to session_mappings data for Insight Assistant queries.
 * Returns deduplicated sessions with summary, screenshotDescriptions, and other columns.
 */
export async function getGroupContext(
  groupId: string
): Promise<GroupSessionContext[]> {
  return httpClient.request<GroupSessionContext[]>(`${BASE_URL}/${groupId}/context`);
}
