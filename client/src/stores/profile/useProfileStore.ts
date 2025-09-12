import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { 
  NodeDetailsResponse, 
  ProfileData, 
  ProfileResponse, 
  TimelineNodeView 
} from '../../types/profile';
import { transformTimelineForProfile } from './useTimelineTransform';

// ============================================================================
// QUERY KEYS
// ============================================================================
// Centralized query keys for cache management

export const profileQueryKeys = {
  all: ['profile'] as const,
  profiles: () => [...profileQueryKeys.all, 'list'] as const,
  profile: (username?: string) => [...profileQueryKeys.profiles(), username || 'current'] as const,
  nodeDetails: (nodeId: string) => ['node-details', nodeId] as const,
  nodes: () => ['timeline-nodes'] as const,
  userNodes: (userId: number) => [...profileQueryKeys.nodes(), userId] as const,
};

// ============================================================================
// API FUNCTIONS
// ============================================================================
// HTTP client functions for profile data

async function fetchProfile(username?: string): Promise<ProfileResponse> {
  const url = username 
    ? `/api/v2/timeline/nodes?username=${encodeURIComponent(username)}`
    : '/api/v2/timeline/nodes';
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Include cookies for authentication
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ 
      error: 'Network Error', 
      message: 'Failed to fetch profile data' 
    }));
    throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

async function fetchNodeDetails(nodeId: string): Promise<NodeDetailsResponse> {
  const response = await fetch(`/api/v2/timeline/nodes/${encodeURIComponent(nodeId)}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ 
      error: 'Network Error', 
      message: 'Failed to fetch node details' 
    }));
    throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

async function updateNode(
  nodeId: string, 
  updates: Partial<TimelineNodeView>
): Promise<NodeDetailsResponse> {
  const response = await fetch(`/api/v2/timeline/nodes/${encodeURIComponent(nodeId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ 
      error: 'Update Failed', 
      message: 'Failed to update node' 
    }));
    throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

async function deleteNode(nodeId: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`/api/v2/timeline/nodes/${encodeURIComponent(nodeId)}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ 
      error: 'Delete Failed', 
      message: 'Failed to delete node' 
    }));
    throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

// ============================================================================
// QUERY HOOKS
// ============================================================================

/**
 * Fetch profile data with timeline nodes
 * Transforms server response into client-optimized format
 */
export function useProfileQuery(username?: string) {
  return useQuery({
    queryKey: profileQueryKeys.profile(username),
    queryFn: async () => {
      const response = await fetchProfile(username);
      
      // Transform server response to client format
      const allNodes = [...response.timeline.current, ...response.timeline.past];
      const { currentTree, pastTree, isValid } = transformTimelineForProfile(allNodes);
      
      if (!isValid) {
        console.warn('Profile data contains invalid tree structure');
      }
      
      const profileData: ProfileData = {
        id: response.profile.userName, // Use username as ID for now
        userName: response.profile.userName,
        firstName: response.profile.firstName,
        lastName: response.profile.lastName,
        profileUrl: response.profile.profileUrl,
        currentExperiences: response.timeline.current,
        pastExperiences: response.timeline.past,
        totalNodes: response.timeline.totalCount,
        lastUpdated: new Date(), // Could come from server
      };

      return {
        profile: profileData,
        currentTree,
        pastTree,
        permissions: response.permissions,
        allNodes,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    retry: (failureCount, error) => {
      // Don't retry on 404 (user not found) or 403 (no permission)
      const message = error.message.toLowerCase();
      if (message.includes('404') || message.includes('403')) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Fetch detailed information for a specific node
 */
export function useNodeDetailsQuery(nodeId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: profileQueryKeys.nodeDetails(nodeId),
    queryFn: () => fetchNodeDetails(nodeId),
    enabled: enabled && !!nodeId,
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error) => {
      const message = error.message.toLowerCase();
      if (message.includes('404') || message.includes('403')) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

/**
 * Prefetch node details for hover states
 */
export function usePrefetchNodeDetails() {
  const queryClient = useQueryClient();
  
  return (nodeId: string) => {
    queryClient.prefetchQuery({
      queryKey: profileQueryKeys.nodeDetails(nodeId),
      queryFn: () => fetchNodeDetails(nodeId),
      staleTime: 1 * 60 * 1000,
    });
  };
}

// ============================================================================
// MUTATION HOOKS
// ============================================================================

/**
 * Update a timeline node with optimistic updates
 */
export function useUpdateNodeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<TimelineNodeView> }) =>
      updateNode(id, updates),
    onMutate: async ({ id, updates }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: profileQueryKeys.nodeDetails(id) });

      // Snapshot previous value
      const previousNodeDetails = queryClient.getQueryData(profileQueryKeys.nodeDetails(id));

      // Optimistically update node details
      queryClient.setQueryData(profileQueryKeys.nodeDetails(id), (old: NodeDetailsResponse | undefined) => {
        if (!old) return old;
        return {
          ...old,
          node: { ...old.node, ...updates },
        };
      });

      return { previousNodeDetails };
    },
    onError: (err, { id }, context) => {
      // Revert optimistic update
      if (context?.previousNodeDetails) {
        queryClient.setQueryData(profileQueryKeys.nodeDetails(id), context.previousNodeDetails);
      }
    },
    onSettled: (data, error, { id }) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: profileQueryKeys.nodeDetails(id) });
      queryClient.invalidateQueries({ queryKey: profileQueryKeys.profiles() });
    },
  });
}

/**
 * Delete a timeline node
 */
export function useDeleteNodeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteNode,
    onSuccess: (data, nodeId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: profileQueryKeys.nodeDetails(nodeId) });
      
      // Invalidate profile queries to refetch without deleted node
      queryClient.invalidateQueries({ queryKey: profileQueryKeys.profiles() });
    },
  });
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Get cached profile data without triggering a fetch
 */
export function useCachedProfile(username?: string) {
  const queryClient = useQueryClient();
  return queryClient.getQueryData(profileQueryKeys.profile(username));
}

/**
 * Invalidate and refetch profile data
 */
export function useRefreshProfile() {
  const queryClient = useQueryClient();
  
  return (username?: string) => {
    queryClient.invalidateQueries({ 
      queryKey: profileQueryKeys.profile(username) 
    });
  };
}

/**
 * Check if profile data is loading
 */
export function useIsProfileLoading(username?: string) {
  const queryClient = useQueryClient();
  const queryState = queryClient.getQueryState(profileQueryKeys.profile(username));
  return queryState?.fetchStatus === 'fetching';
}

// ============================================================================
// ERROR BOUNDARY HELPERS
// ============================================================================

export class ProfileQueryError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public cause?: unknown
  ) {
    super(message);
    this.name = 'ProfileQueryError';
  }
}

/**
 * Transform API errors into user-friendly messages
 */
export function getProfileErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('404') || message.includes('not found')) {
      return 'Profile not found. This user may not exist or may have a private profile.';
    }
    
    if (message.includes('403') || message.includes('forbidden')) {
      return 'You do not have permission to view this profile.';
    }
    
    if (message.includes('401') || message.includes('unauthorized')) {
      return 'Please sign in to view this profile.';
    }
    
    if (message.includes('network') || message.includes('fetch')) {
      return 'Network error. Please check your connection and try again.';
    }
  }
  
  return 'An unexpected error occurred. Please try again later.';
}