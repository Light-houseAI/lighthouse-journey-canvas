import type { BrandActivity } from '@journey/schema';
import { useQuery } from '@tanstack/react-query';

import { hierarchyApi } from '../services/hierarchy-api';

interface UseBrandBuildingActivitiesResult {
  activities: BrandActivity[];
  isLoading: boolean;
  error: Error | null;
}

export const useBrandBuildingActivities = (
  nodeId: string
): UseBrandBuildingActivitiesResult => {
  const {
    data: node,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['brand-building-activities', nodeId],
    queryFn: async () => {
      const node = await hierarchyApi.getNode(nodeId);
      return node;
    },
  });

  // Extract and flatten brand building activities
  const activities: BrandActivity[] = [];

  if (node?.meta?.brandBuildingData) {
    const brandBuildingData = node.meta.brandBuildingData as {
      activities?: Record<string, BrandActivity[]>;
    };

    if (brandBuildingData.activities) {
      // Flatten activities from all platforms
      for (const platformActivities of Object.values(
        brandBuildingData.activities
      )) {
        if (Array.isArray(platformActivities)) {
          activities.push(...platformActivities);
        }
      }
    }
  }

  // Sort by timestamp (newest first)
  activities.sort((a, b) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  return {
    activities,
    isLoading,
    error: error as Error | null,
  };
};
