/**
 * GraphRAG API Service
 *
 * Handles communication with GraphRAG profile search endpoints
 * Uses schema validation for type safety on both request and response
 * Returns server response format (success/error)
 */

import type {
  GraphRAGSearchRequest,
  ProfileResult,
} from '../components/search/types/search.types';
import { graphRAGSearchRequestSchema } from '../components/search/types/search.types';
import { httpClient } from './http-client';

// Helper function to make API requests to GraphRAG endpoints
async function graphragRequest<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const url = `/api/v2/graphrag${path}`;
  return httpClient.request<T>(url, init);
}

/**
 * Search for user profiles using GraphRAG
 * Validates both request and response using Zod schemas
 */
export async function searchProfiles(
  query: string,
  options: Partial<GraphRAGSearchRequest> = {}
): Promise<ProfileResult[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const trimmedQuery = query.trim();

  // Construct request body
  const requestBody: GraphRAGSearchRequest = {
    query: trimmedQuery,
    limit: options.limit || 3,
    tenantId: options.tenantId,
    excludeUserId: options.excludeUserId,
    similarityThreshold: options.similarityThreshold,
  };

  // Validate request (let Zod errors bubble to error boundary)
  const validatedRequest = graphRAGSearchRequestSchema.parse(requestBody);

  return graphragRequest<ProfileResult[]>('/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(validatedRequest),
  });
}

/**
 * Get search suggestions (future enhancement)
 */
export async function getSearchSuggestions(): Promise<string[]> {
  // Placeholder for future implementation
  // Could return popular search terms, recent searches, etc.
  return [];
}

/**
 * Clear search cache (utility function)
 */
export function clearSearchCache(): void {
  // This will be implemented when we add TanStack Query cache management
  // For now, it's a placeholder for future cache clearing functionality
}
