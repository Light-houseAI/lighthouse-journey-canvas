import type { NetworkingActivity } from '@journey/schema';
import { useQuery } from '@tanstack/react-query';

import { hierarchyApi } from '../services/hierarchy-api';

/**
 * Hook to fetch networking activities from node meta
 * Aligns with application materials pattern - data stored directly on node
 */
export function useNetworkingActivities(nodeId: string | undefined) {
  return useQuery({
    queryKey: ['networking-activities', nodeId],
    queryFn: async () => {
      if (!nodeId) return [];

      try {
        // Fetch the career transition node
        const node = await hierarchyApi.getNode(nodeId);

        // Extract networking data from node meta (now nested structure)
        const networkingData = node?.meta?.networkingData as any;
        const activitiesByType =
          (networkingData?.activities as Record<
            string,
            NetworkingActivity[]
          >) || {};

        // Flatten all activities from all types
        const activities: NetworkingActivity[] = [];
        for (const typeActivities of Object.values(activitiesByType)) {
          activities.push(...typeActivities);
        }

        // Sort by timestamp (newest first) with error handling
        activities.sort((a, b) => {
          try {
            const timeA = new Date(a.timestamp).getTime();
            const timeB = new Date(b.timestamp).getTime();

            // Handle invalid dates
            if (isNaN(timeA) && isNaN(timeB)) return 0;
            if (isNaN(timeA)) {
              console.warn(
                '[useNetworkingActivities] Invalid timestamp in activity:',
                {
                  activity: a,
                  timestamp: a.timestamp,
                }
              );
              return 1; // Put invalid items at end
            }
            if (isNaN(timeB)) {
              console.warn(
                '[useNetworkingActivities] Invalid timestamp in activity:',
                {
                  activity: b,
                  timestamp: b.timestamp,
                }
              );
              return -1; // Put invalid items at end
            }

            return timeB - timeA;
          } catch (error) {
            console.error(
              '[useNetworkingActivities] Sort operation failed:',
              error
            );
            return 0; // Maintain original order on error
          }
        });

        return activities;
      } catch (error) {
        console.error('[useNetworkingActivities] Failed to fetch activities:', {
          nodeId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });

        // Re-throw to let TanStack Query handle error state
        throw error;
      }
    },
    enabled: !!nodeId,
    retry: false, // Don't retry - let UI handle errors
  });
}
