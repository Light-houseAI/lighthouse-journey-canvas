import { Button } from '@journey/components';
import { TodoStatus } from '@journey/schema';
import { Calendar } from 'lucide-react';
import { useState } from 'react';
import { useRoute } from 'wouter';

import { JourneyHeader } from '../components/journey/JourneyHeader';
import {
  ApplicationStatus,
  type StatusData,
} from '../components/nodes/career-transition/wizard/steps/types';
import { PermissionsDisplay } from '../components/permissions/PermissionsDisplay';
import { ShareButton } from '../components/share/ShareButton';
import { ExperienceMatchesModal } from '../components/timeline/ExperienceMatchesModal';
import { NetworkInsightsSidePanel } from '../components/timeline/NetworkInsightsSidePanel';
import { UserAvatar } from '../components/user/UserAvatar';
import { useTheme } from '../contexts/ThemeContext';
import { useExperienceMatches } from '../hooks/search/useExperienceMatches';
import {
  useAllNodes,
  useApplicationNode,
} from '../hooks/use-interview-chapter';
import { useCurrentUser } from '../hooks/useAuth';

/**
 * Interview Chapter Detail View
 * Shows detailed information about a specific interview chapter
 */
export default function InterviewChapterDetail() {
  const [match, params] = useRoute('/interview-chapter/:applicationId');
  const applicationId = params?.applicationId;
  const { theme } = useTheme();
  const { data: currentUser } = useCurrentUser();

  // LIG-206 Phase 6: State for side panel and modal visibility
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [shouldFetchMatches, setShouldFetchMatches] = useState(false);

  // Fetch all nodes for sharing functionality
  const { data: allNodes = [] } = useAllNodes();

  // Fetch the application node
  const { data: application, isLoading } = useApplicationNode(applicationId);

  // LIG-206 Phase 6: Fetch experience matches for this application (manual trigger)
  const {
    data: matchesData,
    isLoading: isLoadingMatches,
    matchCount,
  } = useExperienceMatches(application || ({} as any), shouldFetchMatches);

  // Handle find insights button click
  const handleFindInsights = () => {
    setShouldFetchMatches(true);
    setIsSidePanelOpen(true);
  };

  if (!match || !applicationId) {
    return (
      <div
        className={`flex h-screen items-center justify-center ${theme.backgroundGradient}`}
      >
        <p className="text-gray-500">Interview chapter not found</p>
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

  const company = application?.meta?.company || 'Company';
  const applicationDate = application?.meta?.applicationDate;
  const interviewContext =
    application?.meta?.llmInterviewContext ||
    application?.meta?.interviewContext;

  // Get statusData with todos and summaries
  const statusData = (application?.meta?.statusData || {}) as Record<
    ApplicationStatus,
    StatusData
  >;
  const statusesWithData = Object.entries(statusData).filter(([, data]) => {
    const hasTodos = data.todos && data.todos.length > 0;
    const hasSummary = !!data.llmSummary;
    return hasTodos || hasSummary;
  });

  // Get permissions from node response
  const permissions = application?.permissions || [];

  // Group todos by application status
  const getStatusLabel = (status: ApplicationStatus): string => {
    const labels: Record<ApplicationStatus, string> = {
      [ApplicationStatus.Applied]: 'Applied',
      [ApplicationStatus.RecruiterScreen]: 'Recruiter Screen',
      [ApplicationStatus.PhoneInterview]: 'Phone Interview',
      [ApplicationStatus.TechnicalInterview]: 'Technical Interview',
      [ApplicationStatus.OnsiteInterview]: 'Onsite Interview',
      [ApplicationStatus.FinalInterview]: 'Final Interview',
      [ApplicationStatus.Offer]: 'Offer',
      [ApplicationStatus.OfferAccepted]: 'Offer Accepted',
      [ApplicationStatus.OfferDeclined]: 'Offer Declined',
      [ApplicationStatus.Rejected]: 'Rejected',
      [ApplicationStatus.Withdrawn]: 'Withdrawn',
      [ApplicationStatus.Ghosted]: 'Ghosted',
    };
    return labels[status] || status;
  };

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
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
                  {company} Interviews
                </h1>

                {/* Owner and Date */}
                <div className="mb-2 flex items-center gap-4 text-sm text-gray-600">
                  {application?.owner && (
                    <UserAvatar
                      user={application.owner}
                      size="sm"
                      showName={true}
                    />
                  )}
                  {applicationDate && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>Last Updated {formatDate(applicationDate)}</span>
                    </div>
                  )}
                </div>

                {/* Visibility */}
                {permissions.length > 0 && (
                  <PermissionsDisplay permissions={permissions} />
                )}
              </div>

              {/* LIG-206 Phase 6: Action buttons */}
              <div className="flex items-center gap-3">
                {/* Find network insights button */}
                <Button
                  onClick={handleFindInsights}
                  disabled={isLoadingMatches}
                  size="sm"
                >
                  Find network insights
                </Button>

                {/* Only show share button if current user is the owner */}
                {currentUser && application?.owner?.id === currentUser.id && (
                  <ShareButton
                    nodes={application ? [application] : []}
                    allNodes={allNodes}
                    showLabel={true}
                  />
                )}
              </div>
            </div>

            {/* Overall Interview Summary */}
            {interviewContext && (
              <p className="text-base text-gray-700">{interviewContext}</p>
            )}
          </div>

          {/* Interview Preparation - All Statuses with Data */}
          {statusesWithData.length > 0 && (
            <div className="space-y-4">
              {statusesWithData.map(([status, data]) => {
                const todos = data.todos || [];
                const summary = data.llmSummary;

                return (
                  <div
                    key={status}
                    className="rounded-lg bg-white p-6 shadow-sm"
                  >
                    {/* Status Header */}
                    <h2 className="mb-4 text-xl font-semibold leading-[30px] tracking-[-0.05px] text-[#333333]">
                      {getStatusLabel(status as ApplicationStatus)}
                    </h2>

                    {/* Summary and Todos Section */}
                    <div className="space-y-0 text-[15px] leading-[1.5] text-[#666666]">
                      <p className="mb-0">
                        <span className="font-bold">What is the round: </span>
                        <span>
                          {summary ||
                            `Preparing for ${getStatusLabel(status as ApplicationStatus).toLowerCase()} at ${company}.`}
                        </span>
                      </p>

                      <p className="mb-0">&nbsp;</p>

                      <p className="mb-0 font-bold">
                        {application?.owner?.firstName
                          ? `${application.owner.firstName.charAt(0).toUpperCase()}${application.owner.firstName.slice(1)}'s preparation:`
                          : 'Your preparation:'}
                      </p>

                      {/* Todos List */}
                      {todos.length > 0 && (
                        <ul className="ml-[22.5px] list-disc space-y-0">
                          {todos.map((todo) => {
                            // Map TodoStatus to icons
                            const statusIcon =
                              {
                                [TodoStatus.Completed]: '✅',
                                [TodoStatus.InProgress]: '🔄',
                                [TodoStatus.Pending]: '⏱️',
                                [TodoStatus.Blocked]: '🚫',
                              }[todo.status] || '⏱️';

                            return (
                              <li key={todo.id} className="mb-0">
                                <span className="leading-[1.5]">
                                  {statusIcon} {todo.description}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* LIG-206 Phase 6: Network Insights Side Panel - Fixed overlay */}
      <NetworkInsightsSidePanel
        data={matchesData}
        isLoading={isLoadingMatches}
        matchCount={matchCount}
        isOpen={isSidePanelOpen}
        onClose={() => setIsSidePanelOpen(false)}
        onOpenModal={() => setIsModalOpen(true)}
      />

      {/* LIG-206 Phase 6: Network Insights Modal */}
      {isModalOpen && (
        <ExperienceMatchesModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          data={matchesData}
          isLoading={isLoadingMatches}
        />
      )}
    </div>
  );
}
