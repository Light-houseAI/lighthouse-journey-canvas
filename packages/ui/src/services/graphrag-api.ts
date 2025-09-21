/**
 * GraphRAG API Service
 * 
 * Handles communication with GraphRAG profile search endpoints
 */

import type { 
  GraphRAGSearchRequest, 
  GraphRAGSearchResponse, 
  ProfileResult 
} from '@/components/search/types/search.types';

import { httpClient } from './http-client';

// Helper function to make API requests to GraphRAG endpoints
async function graphragRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `/api/v2/graphrag${path}`;
  return httpClient.request<T>(url, init);
}

/**
 * Search for user profiles using GraphRAG
 */
export async function searchProfiles(
  query: string, 
  options: Partial<GraphRAGSearchRequest> = {}
): Promise<ProfileResult[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  // Validate query length (1-500 chars as per PRD)
  const trimmedQuery = query.trim();
  if (trimmedQuery.length > 500) {
    throw new Error('Search query is too long. Please use fewer than 500 characters.');
  }

  const requestBody: GraphRAGSearchRequest = {
    query: trimmedQuery,
    limit: options.limit || 3, // Fixed at 3 for header search as per PRD
    similarityThreshold: options.similarityThreshold || 0.5
  };

  try {
    const response = await graphragRequest<GraphRAGSearchResponse>('/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    // Return only the profiles array, filtering to ensure exactly 3 results max
    return response.profiles.slice(0, 3);
  } catch (error) {
    console.error('GraphRAG search failed:', error);
    
    // Transform API errors to user-friendly messages
    if (error instanceof Error) {
      if (error.message.includes('Network')) {
        throw new Error('Search temporarily unavailable. Please check your connection and try again.');
      }
      if (error.message.includes('timeout')) {
        throw new Error('Search is taking longer than expected. Please try again.');
      }
      if (error.message.includes('404')) {
        throw new Error('Search service is currently unavailable.');
      }
      if (error.message.includes('401') || error.message.includes('403')) {
        throw new Error('You don\'t have permission to search profiles.');
      }
    }
    
    // Generic error fallback
    throw new Error('Unable to complete search. Please try again.');
  }
}

/**
 * Get search suggestions (future enhancement)
 */
export async function getSearchSuggestions(query: string): Promise<string[]> {
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