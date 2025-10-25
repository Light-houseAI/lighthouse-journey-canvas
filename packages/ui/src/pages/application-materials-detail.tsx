import { TabsGroup } from '@journey/components';
import { LINKEDIN_TYPE } from '@journey/schema';
import { Calendar } from 'lucide-react';
import { useState } from 'react';
import { useRoute } from 'wouter';

import { MaterialsSummaryCard } from '../components/application-materials/MaterialsSummaryCard';
import { JourneyHeader } from '../components/journey/JourneyHeader';
import { PermissionsDisplay } from '../components/permissions/PermissionsDisplay';
import { ShareButton } from '../components/share/ShareButton';
import { UserAvatar } from '../components/user/UserAvatar';
import { useTheme } from '../contexts/ThemeContext';
import {
  useApplicationMaterials,
  useCareerTransitionNode,
} from '../hooks/use-application-materials';
import { useAllNodes } from '../hooks/use-interview-chapter';
import { useCurrentUser } from '../hooks/useAuth';

/**
 * Application Materials Detail View
 * Shows detailed information about application materials (resumes and LinkedIn)
 */
export default function ApplicationMaterialsDetail() {
  const [match, params] = useRoute(
    '/application-materials/:careerTransitionId'
  );
  const careerTransitionId = params?.careerTransitionId;
  const { theme } = useTheme();
  const { data: currentUser } = useCurrentUser();

  // Fetch career transition node for permissions and owner info
  const { data: node, isLoading: isLoadingNode } =
    useCareerTransitionNode(careerTransitionId);

  // Fetch application materials
  const { data: materials, isLoading: isLoadingMaterials } =
    useApplicationMaterials(careerTransitionId);

  // Fetch all nodes for sharing functionality
  const { data: allNodes = [] } = useAllNodes();

  const isLoading = isLoadingNode || isLoadingMaterials;

  // Separate resumes and LinkedIn
  const resumeItems =
    materials?.items.filter((item) => item.type !== LINKEDIN_TYPE) || [];
  const linkedInItem = materials?.items.find(
    (item) => item.type === LINKEDIN_TYPE
  );

  // Create tab options for resumes only (no LinkedIn)
  const resumeTabOptions = resumeItems.map((item) => ({
    value: item.type,
    label: item.type,
  }));

  // Tab state for resumes - use first option if current tab is not in options
  const [activeResumeTab, setActiveResumeTab] = useState<string>('');
  const effectiveActiveTab =
    activeResumeTab &&
    resumeTabOptions.some((opt) => opt.value === activeResumeTab)
      ? activeResumeTab
      : resumeTabOptions[0]?.value || '';

  // Get permissions from node response
  const permissions = node?.permissions || [];

  // Format date
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  };

  if (!match || !careerTransitionId) {
    return (
      <div
        className={`flex h-screen items-center justify-center ${theme.backgroundGradient}`}
      >
        <p className="text-gray-500">Career transition not found</p>
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

  // Get career transition title for context
  const careerTransitionTitle = node?.meta?.title || 'Job search';
  const lastUpdated =
    materials?.items[0]?.resumeVersion.lastUpdated || node?.updatedAt;

  // Get active resume content
  const getActiveResumeContent = () => {
    const resumeItem = resumeItems.find(
      (item) => item.type === effectiveActiveTab
    );
    if (resumeItem) {
      return <MaterialsSummaryCard resumeEntry={resumeItem} />;
    }
    return null;
  };

  return (
    <div
      className={`relative flex h-screen w-full flex-col overflow-hidden ${theme.backgroundGradient}`}
    >
      {/* Header */}
      <JourneyHeader />

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-4xl px-8 py-6">
          {/* Chapter Header */}
          <div className="mb-8 rounded-lg bg-white p-6 shadow-sm">
            {/* Chapter Label */}
            <div className="mb-2">
              <span className="text-sm font-medium text-gray-500">Chapter</span>
            </div>

            <div className="mb-4 flex items-start justify-between">
              <div className="flex-1">
                <h1 className="mb-3 text-4xl font-bold text-gray-900">
                  Application Materials
                </h1>

                {/* Subtitle - Career Transition Context */}
                <p className="mb-3 text-base text-gray-600">
                  For {careerTransitionTitle}
                </p>

                {/* Owner and Date */}
                <div className="mb-2 flex items-center gap-4 text-sm text-gray-600">
                  {node?.owner && (
                    <UserAvatar user={node.owner} size="sm" showName={true} />
                  )}
                  {lastUpdated && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>Last Updated {formatDate(lastUpdated)}</span>
                    </div>
                  )}
                </div>

                {/* Visibility */}
                {permissions.length > 0 && (
                  <PermissionsDisplay permissions={permissions} />
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3">
                {/* Only show share button if current user is the owner */}
                {currentUser && node?.owner?.id === currentUser.id && (
                  <ShareButton
                    nodes={node ? [node] : []}
                    allNodes={allNodes}
                    showLabel={true}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Materials Content */}
          {resumeItems.length === 0 && !linkedInItem ? (
            <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
              <p className="text-gray-500">
                No application materials yet. Add materials through the career
                transition wizard.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Resumes Section - Only show if resumes exist */}
              {resumeItems.length > 0 && (
                <div className="rounded-lg bg-white p-6 shadow-sm">
                  <h2 className="mb-4 text-xl font-bold text-gray-900">
                    Resumes
                  </h2>

                  {/* Tabs for Resume Types */}
                  {resumeTabOptions.length > 1 && (
                    <div className="mb-6">
                      <TabsGroup
                        options={resumeTabOptions}
                        activeTab={effectiveActiveTab}
                        onTabChange={setActiveResumeTab}
                      />
                    </div>
                  )}

                  {/* Active Resume Content */}
                  {getActiveResumeContent()}
                </div>
              )}

              {/* LinkedIn Profile Section - Only show if LinkedIn exists */}
              {linkedInItem && (
                <div className="rounded-lg bg-white p-6 shadow-sm">
                  <h2 className="mb-4 text-xl font-bold text-gray-900">
                    LinkedIn Profile
                  </h2>
                  <MaterialsSummaryCard resumeEntry={linkedInItem} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
