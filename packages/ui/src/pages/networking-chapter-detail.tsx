import { NetworkingType } from '@journey/schema';
import { Calendar } from 'lucide-react';
import { useRoute } from 'wouter';

import { JourneyHeader } from '../components/journey/JourneyHeader';
import type { NetworkingActivity } from '../components/nodes/career-transition/wizard/steps/types';
import { PermissionsDisplay } from '../components/permissions/PermissionsDisplay';
import { UserAvatar } from '../components/user/UserAvatar';
import { useTheme } from '../contexts/ThemeContext';
import { useCurrentUser } from '../hooks/useAuth';
import { useNetworkingActivities } from '../hooks/useNetworkingActivities';
import { useTimelineNode } from '../hooks/useTimeline';

/**
 * Networking Chapter Detail View
 * Shows all networking activities from updates
 */
export default function NetworkingChapterDetail() {
  const [match, params] = useRoute('/networking-chapter/:nodeId');
  const nodeId = params?.nodeId;
  const { theme } = useTheme();
  const { data: currentUser } = useCurrentUser();

  // Fetch the career transition node
  const { data: node, isLoading: isLoadingNode } = useTimelineNode(
    nodeId ?? ''
  );

  // Fetch all networking activities for this node
  const { data: activities = [], isLoading: isLoadingActivities } =
    useNetworkingActivities(nodeId ?? '');

  const isLoading = isLoadingNode || isLoadingActivities;

  if (!match || !nodeId) {
    return (
      <div
        className={`flex h-screen items-center justify-center ${theme.backgroundGradient}`}
      >
        <p className="text-gray-500">Chapter not found</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className={`flex h-screen items-center justify-center ${theme.backgroundGradient}`}
      >
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
      </div>
    );
  }

  // Get permissions from node response
  const permissions = node?.permissions || [];

  // Group activities by type
  const activityGroups = activities.reduce(
    (acc, activity) => {
      if (!acc[activity.networkingType]) {
        acc[activity.networkingType] = [];
      }
      acc[activity.networkingType].push(activity);
      return acc;
    },
    {} as Record<NetworkingType, NetworkingActivity[]>
  );

  const renderActivityGroup = (type: NetworkingType) => {
    // Get data from node meta (if available)
    const networkingData = node?.meta?.networkingData as any;
    const summary = networkingData?.summaries?.[type];
    const keyPoints = networkingData?.keyPoints?.[type] || [];

    return (
      <div key={type} className="rounded-lg bg-white p-6 shadow-sm">
        {/* Section Header */}
        <h2 className="mb-4 text-xl font-semibold leading-[30px] tracking-[-0.05px] text-[#333333]">
          {type}
        </h2>

        {/* LLM Summary and Key Points */}
        <div className="space-y-0 text-[15px] leading-[1.5] text-[#666666]">
          {/* Summary */}
          <p className="mb-0">
            {summary || (
              <span className="italic text-gray-400">
                Summary will be generated after activities are added.
              </span>
            )}
          </p>

          {/* Key Points */}
          {keyPoints.length > 0 && (
            <>
              <p className="mb-0">&nbsp;</p>
              <p className="mb-0 font-bold">
                Key elements of {type.toLowerCase()} strategy:
              </p>
              <ul className="ml-[22.5px] list-disc space-y-0">
                {keyPoints.map((point, idx) => (
                  <li key={idx} className="mb-0">
                    <span className="leading-[1.5]">{point}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`flex min-h-screen flex-col ${theme.backgroundGradient}`}>
      <JourneyHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-8 py-6">
        {/* Chapter Header */}
        <div className="mb-8 rounded-lg bg-white p-6 shadow-sm">
          {/* Chapter Label */}
          <div className="mb-2">
            <span className="text-sm font-medium text-gray-500">Chapter</span>
          </div>

          <div className="mb-4">
            <h1 className="mb-3 text-4xl font-bold text-gray-900">
              Networking
            </h1>

            {/* Owner and Date */}
            <div className="mb-2 flex items-center gap-4 text-sm text-gray-600">
              {currentUser && (
                <UserAvatar
                  user={{
                    firstName: currentUser.firstName ?? undefined,
                    lastName: currentUser.lastName ?? undefined,
                    userName:
                      node?.userName || currentUser.userName || undefined,
                    email: currentUser.email ?? undefined,
                  }}
                  size="sm"
                  showName={true}
                />
              )}
              {node?.updatedAt && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Last Updated{' '}
                    {new Date(node.updatedAt).toLocaleDateString('en-US', {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              )}
            </div>

            {/* Visibility */}
            {permissions.length > 0 && (
              <PermissionsDisplay permissions={permissions} />
            )}
          </div>

          {/* Overall networking summary */}
          {(node?.meta?.networkingData as any)?.overallSummary ? (
            <p className="text-base text-gray-700">
              {(node.meta.networkingData as any).overallSummary}
            </p>
          ) : (
            <p className="text-base italic text-gray-400">
              Overall networking summary will be generated after adding
              activities.
            </p>
          )}
        </div>

        {/* Content */}
        {activities.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
            <p className="text-gray-500">
              No networking activities recorded yet.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Networking activity groups */}
            {Object.entries(activityGroups).map(([type]) =>
              renderActivityGroup(type as NetworkingType)
            )}
          </div>
        )}
      </main>
    </div>
  );
}
