/**
 * Insights API Service
 * Handles communication with the insights API endpoints
 */

import type {
  InsightCreateDTO,
  InsightUpdateDTO,
  NodeInsight,
} from '@journey/schema';
import { insightCreateSchema, insightUpdateSchema } from '@journey/schema';

import { httpClient } from './http-client';

/**
 * Get all insights for a specific node
 */
export async function getNodeInsights(nodeId: string): Promise<NodeInsight[]> {
  return httpClient.request<NodeInsight[]>(
    `/api/v2/timeline/nodes/${nodeId}/insights`
  );
}

/**
 * Create a new insight for a node
 * Validates request using schema
 */
export async function createInsight(
  nodeId: string,
  data: InsightCreateDTO
): Promise<NodeInsight> {
  // Validate request (let Zod errors bubble to error boundary)
  const validatedData = insightCreateSchema.parse(data);

  return httpClient.request<NodeInsight>(
    `/api/v2/timeline/nodes/${nodeId}/insights`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validatedData),
    }
  );
}

/**
 * Update an existing insight
 * Validates request using schema
 */
export async function updateInsight(
  insightId: string,
  data: InsightUpdateDTO
): Promise<NodeInsight> {
  // Validate request (let Zod errors bubble to error boundary)
  const validatedData = insightUpdateSchema.parse(data);

  return httpClient.request<NodeInsight>(
    `/api/v2/timeline/insights/${insightId}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validatedData),
    }
  );
}

/**
 * Delete an insight
 */
export async function deleteInsight(insightId: string): Promise<void> {
  return httpClient.request<void>(`/api/v2/timeline/insights/${insightId}`, {
    method: 'DELETE',
  });
}
