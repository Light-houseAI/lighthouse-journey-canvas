import { TodoStatus } from '@journey/schema';
import { Calendar } from 'lucide-react';
import { useRoute } from 'wouter';

import { JourneyHeader } from '../components/journey/JourneyHeader';
import {
  ApplicationStatus,
  type StatusData,
} from '../components/nodes/career-transition/wizard/steps/types';
import { PermissionsDisplay } from '../components/permissions/PermissionsDisplay';
import { ShareButton } from '../components/share/ShareButton';
import { UserAvatar } from '../components/user/UserAvatar';
import { useTheme } from '../contexts/ThemeContext';
import {
  useAllNodes,
  useApplicationNode,
} from '../hooks/use-interview-chapter';

/**
 * Interview Chapter Detail View
 * Shows detailed information about a specific interview chapter
 */
export default function InterviewChapterDetail() {
  const [match, params] = useRoute('/interview-chapter/:applicationId');
  const applicationId = params?.applicationId;
  const { theme } = useTheme();
  // Fetch all nodes for sharing functionality
  const { data: allNodes = [] } = useAllNodes();

  // Fetch the application node
  const { data: application, isLoading } = useApplicationNode(applicationId);

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
      [ApplicationStatus.Accepted]: 'Accepted',
      [ApplicationStatus.Rejected]: 'Rejected',
      [ApplicationStatus.Withdrawn]: 'Withdrawn',
      [ApplicationStatus.Interviewing]: 'Interviewing',
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
      <div className="flex flex-1 overflow-hidden">
        {/* Main Content Area */}
        <div className="flex flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-4xl px-8 py-6">
            {/* Chapter Header */}
            <div className="mb-8 rounded-lg bg-white p-6 shadow-sm">
              {/* Chapter Label */}
              <div className="mb-2">
                <span className="text-sm font-medium text-gray-500">
                  Chapter
                </span>
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

                <ShareButton
                  nodes={application ? [application] : []}
                  allNodes={allNodes}
                  showLabel={true}
                />
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
                            {todos.map((todo) => (
                              <li key={todo.id} className="mb-0">
                                <span className="leading-[1.5]">
                                  {todo.status === TodoStatus.Completed
                                    ? '✅'
                                    : '⏱️'}{' '}
                                  {todo.description}
                                </span>
                              </li>
                            ))}
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
      </div>
    </div>
  );
}
