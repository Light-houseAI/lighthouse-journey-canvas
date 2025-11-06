import { BrandPlatform } from '@journey/schema';
import { Calendar, ExternalLink } from 'lucide-react';
import { useRoute } from 'wouter';

import { JourneyHeader } from '../components/journey/JourneyHeader';
import { PermissionsDisplay } from '../components/permissions/PermissionsDisplay';
import { UserAvatar } from '../components/user/UserAvatar';
import { useTheme } from '../contexts/ThemeContext';
import { useCurrentUser } from '../hooks/useAuth';
import { useBrandBuildingActivities } from '../hooks/useBrandBuildingActivities';
import { useTimelineNode } from '../hooks/useTimeline';

/**
 * Brand Building Chapter Detail View
 * Shows all brand building activities grouped by platform
 */
export default function BrandBuildingChapter() {
  const [match, params] = useRoute('/brand-building-chapter/:nodeId');
  const nodeId = params?.nodeId;
  const { theme } = useTheme();
  const { data: currentUser } = useCurrentUser();

  // Fetch the career transition node
  const { data: node, isLoading: isLoadingNode } = useTimelineNode(
    nodeId ?? ''
  );

  // Fetch all brand building activities for this node
  const { activities, isLoading: isLoadingActivities } =
    useBrandBuildingActivities(nodeId ?? '');

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
  const permissions = Array.isArray(node?.permissions) ? node.permissions : [];

  // Get brand building data from node meta
  const brandBuildingData = node?.meta?.brandBuildingData as any;
  const overallSummary = brandBuildingData?.overallSummary;

  // Group activities by platform
  const activityGroups = activities.reduce(
    (acc, activity) => {
      if (!acc[activity.platform]) {
        acc[activity.platform] = [];
      }
      acc[activity.platform].push(activity);
      return acc;
    },
    {} as Record<BrandPlatform, typeof activities>
  );

  const renderPlatformGroup = (platform: BrandPlatform) => {
    const platformActivities = activityGroups[platform] || [];
    if (platformActivities.length === 0) return null;

    const summary = brandBuildingData?.summaries?.[platform];
    const keyPoints = brandBuildingData?.keyPoints?.[platform] || [];

    // Deduplicate screenshots across all activities for this platform
    const deduplicateScreenshots = (activities: typeof platformActivities) => {
      const seenFiles = new Set<string>();
      return activities.map((activity) => {
        const uniqueScreenshots = activity.screenshots.filter((screenshot) => {
          const fileKey = `${screenshot.filename}_${screenshot.sizeBytes}`;
          if (seenFiles.has(fileKey)) {
            return false;
          }
          seenFiles.add(fileKey);
          return true;
        });
        return { ...activity, screenshots: uniqueScreenshots };
      });
    };

    const deduplicatedActivities = deduplicateScreenshots(platformActivities);

    return (
      <div key={platform} className="rounded-lg bg-white p-6 shadow-sm">
        {/* Section Header */}
        <h2 className="mb-4 text-xl font-semibold leading-[30px] tracking-[-0.05px] text-[#333333]">
          {platform}
        </h2>

        {/* LLM Summary and Key Points */}
        <div className="mb-6 space-y-0 text-[15px] leading-[1.5] text-[#666666]">
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
              <p className="mb-0 font-bold">Key strengths on {platform}:</p>
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

        {/* Activities */}
        <div className="space-y-4">
          {deduplicatedActivities.map((activity, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-gray-200 bg-gray-50 p-4"
            >
              {/* Profile URL */}
              <div className="mb-3 flex items-center gap-2">
                <ExternalLink className="h-4 w-4 text-gray-500" />
                <a
                  href={activity.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-teal-600 hover:text-teal-700 hover:underline"
                >
                  View Profile
                </a>
              </div>

              {/* Profile Notes */}
              {activity.notes && (
                <div className="mb-3">
                  <p className="text-sm text-gray-700">{activity.notes}</p>
                </div>
              )}

              {/* Screenshots */}
              {activity.screenshots.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">
                    Screenshots ({activity.screenshots.length}):
                  </p>
                  {activity.screenshots.map((screenshot, screenshotIdx) => (
                    <div
                      key={screenshotIdx}
                      className="rounded border border-gray-200 bg-white p-3"
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <ExternalLink className="h-3 w-3 text-gray-400" />
                        <a
                          href={`/api/files/${screenshot.storageKey}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-teal-600 hover:text-teal-700 hover:underline"
                        >
                          {screenshot.filename}
                        </a>
                      </div>
                      {screenshot.notes && (
                        <p className="text-xs text-gray-600">
                          {screenshot.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Timestamp */}
              <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                <Calendar className="h-3 w-3" />
                <span>
                  {new Date(activity.timestamp).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
            </div>
          ))}
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
              Brand Building
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
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              )}
            </div>

            {/* Permissions */}
            <PermissionsDisplay permissions={permissions} />
          </div>

          {/* Overall Summary */}
          {overallSummary && (
            <div className="border-t border-gray-200 pt-4">
              <p className="text-[15px] leading-[1.5] text-[#666666]">
                {overallSummary}
              </p>
            </div>
          )}
        </div>

        {/* Empty State */}
        {activities.length === 0 && (
          <div className="rounded-lg bg-white p-8 text-center shadow-sm">
            <p className="text-gray-500">
              No brand building activities recorded yet.
            </p>
          </div>
        )}

        {/* Platform Groups */}
        <div className="space-y-6">
          {(['LinkedIn', 'X'] as BrandPlatform[]).map((platform) =>
            renderPlatformGroup(platform)
          )}
        </div>
      </main>
    </div>
  );
}
