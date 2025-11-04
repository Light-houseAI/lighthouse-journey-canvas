import { TodoList } from '@journey/components';
import { LINKEDIN_TYPE, TodoStatus } from '@journey/schema';
import { useQuery } from '@tanstack/react-query';
import { Calendar, ChevronDown, ChevronRight, Eye } from 'lucide-react';
import { useEffect } from 'react';
import { useLocation, useRoute } from 'wouter';

import { JourneyHeader } from '../components/journey/JourneyHeader';
import type {
  JobApplication,
  Todo,
} from '../components/nodes/career-transition/wizard/steps/types';
import {
  ApplicationStatus,
  EventType,
} from '../components/nodes/career-transition/wizard/steps/types';
import { ShareButton } from '../components/share/ShareButton';
import { useTheme } from '../contexts/ThemeContext';
import { useNetworkingActivities } from '../hooks/useNetworkingActivities';
import { hierarchyApi } from '../services/hierarchy-api';
import { useCareerTransitionStore } from '../stores/career-transition-store';

// Helper to check if status is after Applied (includes all interview stages and beyond)
const isAfterApplied = (status: ApplicationStatus): boolean => {
  // All statuses after Applied
  return [
    ApplicationStatus.RecruiterScreen,
    ApplicationStatus.PhoneInterview,
    ApplicationStatus.TechnicalInterview,
    ApplicationStatus.OnsiteInterview,
    ApplicationStatus.FinalInterview,
    ApplicationStatus.Offer,
    ApplicationStatus.Applied,
    ApplicationStatus.Rejected,
    ApplicationStatus.Withdrawn,
  ].includes(status);
};

/**
 * Career Transition Detail View
 * Shows interview chapters and tasks grouped by application
 */
export default function CareerTransitionDetail() {
  const [match, params] = useRoute('/career-transition/:nodeId');
  const nodeId = params?.nodeId;
  const { theme } = useTheme();
  const [, setLocation] = useLocation();

  // Use Zustand store for UI state
  const {
    expandedCompanies,
    expandedStatuses,
    activeApplicationTodos,
    toggleCompany,
    toggleStatus,
    expandAll,
    setActiveTodos,
  } = useCareerTransitionStore();

  // Fetch career transition node details
  const { data: node, isLoading: isLoadingNode } = useQuery({
    queryKey: ['career-transition-node', nodeId],
    queryFn: async () => {
      if (!nodeId) return null;
      return hierarchyApi.getNode(nodeId);
    },
    enabled: !!nodeId,
  });

  // Fetch all nodes for sharing functionality
  const { data: allNodes = [] } = useQuery({
    queryKey: ['all-nodes'],
    queryFn: async () => {
      return hierarchyApi.listNodes();
    },
  });

  // Fetch all job applications for this career transition
  const { data: applications = [], isLoading: isLoadingApps } = useQuery({
    queryKey: ['job-applications', nodeId],
    queryFn: async () => {
      if (!nodeId) return [];
      const nodes = await hierarchyApi.listNodes();
      const appNodes = nodes.filter(
        (n) =>
          n.parentId === nodeId &&
          n.meta?.eventType === EventType.JobApplication
      );

      return appNodes.map((n) => ({
        id: n.id,
        ...n.meta,
      })) as JobApplication[];
    },
    enabled: !!nodeId,
  });

  // Fetch networking activities for this career transition
  const { data: networkingActivities = [] } = useNetworkingActivities(nodeId);

  const isLoading = isLoadingNode || isLoadingApps;

  // Filter applications that are after Applied status (chapters)
  const interviewChapters = applications.filter((app) =>
    isAfterApplied(app.applicationStatus)
  );

  // Group todos by application - filter to show only ACTIVE todos (exclude completed)
  const todosByApplication = applications
    .map((app) => {
      const statusData = app.statusData || {};

      // Filter each status to only include active todos (not completed)
      const activeTodosByStatus: Record<ApplicationStatus, Todo[]> =
        {} as Record<ApplicationStatus, Todo[]>;

      Object.entries(statusData).forEach(
        ([status, data]: [string, unknown]) => {
          const statusDataObj = data as { todos?: Todo[] };
          const todos = statusDataObj.todos || [];
          const activeTodos = todos.filter(
            (todo: Todo) => todo.status !== TodoStatus.Completed
          );
          if (activeTodos.length > 0) {
            activeTodosByStatus[status as ApplicationStatus] = activeTodos;
          }
        }
      );

      return {
        applicationId: app.id,
        company: app.company,
        jobTitle: app.jobTitle,
        applicationName: `${app.company} - ${app.jobTitle}`,
        todosByStatus: activeTodosByStatus,
      };
    })
    .filter((app) => {
      // Only include applications that have active todos
      return Object.values(app.todosByStatus).some((todos) => todos.length > 0);
    });

  // Expand all companies and statuses when applications data loads
  useEffect(() => {
    if (applications.length > 0) {
      const applicationIds = todosByApplication.map((app) => app.applicationId);
      const statusKeys: string[] = [];

      todosByApplication.forEach((app) => {
        Object.keys(app.todosByStatus).forEach((status) => {
          statusKeys.push(`${app.applicationId}-${status}`);
        });
      });

      expandAll(applicationIds, statusKeys);
    }
  }, [applications.length, expandAll]);

  if (!match || !nodeId) {
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

  const title = node?.meta?.title || 'Job search';
  const description = node?.meta?.description || '';

  // Format date range
  const getDateRange = () => {
    if (!node?.meta) return '';
    const startDate = node.meta.startDate;
    const endDate = node.meta.endDate;

    if (!startDate) return '';

    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      });
    };

    const start = formatDate(startDate);
    const end = endDate ? formatDate(endDate) : 'present';

    return `${start} to ${end}`;
  };

  // Get visibility from node permissions
  const getVisibilityText = () => {
    if (!node) return 'Private';

    const permissions = node.permissions || {};
    const sharedWithNetworks = permissions.sharedWithNetworks || [];
    const sharedWithIndividuals = permissions.sharedWithIndividuals || [];

    if (sharedWithNetworks.length === 0 && sharedWithIndividuals.length === 0) {
      return 'Private';
    }

    const parts = [];
    if (sharedWithNetworks.length > 0) {
      parts.push(
        `${sharedWithNetworks.length} network${sharedWithNetworks.length > 1 ? 's' : ''}`
      );
    }
    if (sharedWithIndividuals.length > 0) {
      parts.push(
        `${sharedWithIndividuals.length} individual${sharedWithIndividuals.length > 1 ? 's' : ''}`
      );
    }

    return `Visible to ${parts.join(' and ')}`;
  };

  const handleTodosChange = (
    applicationId: string,
    status: ApplicationStatus,
    newTodos: Todo[]
  ) => {
    setActiveTodos(applicationId, status, newTodos);
    // TODO: Save to backend
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
          <div className="mx-auto w-full max-w-7xl px-8 py-6">
            {/* Journey Header */}
            <div className="mb-8">
              <div className="mb-4 flex items-start gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gray-100">
                  <Calendar className="h-8 w-8 text-gray-600" />
                </div>
                <div className="flex-1">
                  <h1 className="mb-2 text-3xl font-bold text-gray-900">
                    {title}
                  </h1>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                    {getDateRange() && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {getDateRange()}
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Eye className="h-4 w-4" />
                      {getVisibilityText()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <ShareButton
                    nodes={node ? [node] : []}
                    allNodes={allNodes}
                    showLabel={true}
                  />
                </div>
              </div>

              {description && <p className="text-gray-700">{description}</p>}
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              {/* Left Column - Application Materials, Networking, Job Search Chapters (2/3 width) */}
              <div className="space-y-8 lg:col-span-2">
                {/* Application Materials Section - Only show if materials exist */}
                {node?.meta?.applicationMaterials?.items &&
                  node.meta.applicationMaterials.items.length > 0 &&
                  (() => {
                    // Extract filtering logic once
                    const resumeCount =
                      node.meta.applicationMaterials.items.filter(
                        (item) => item.type !== LINKEDIN_TYPE
                      ).length;
                    const hasLinkedIn =
                      node.meta.applicationMaterials.items.some(
                        (item) => item.type === LINKEDIN_TYPE
                      );

                    return (
                      <div>
                        <h2 className="mb-4 text-xl font-bold text-gray-900">
                          Application Materials
                        </h2>
                        <div
                          onClick={() =>
                            setLocation(`/application-materials/${nodeId}`)
                          }
                          className="cursor-pointer rounded-lg border border-gray-200 bg-white p-6 transition-shadow hover:shadow-md"
                        >
                          <p className="text-base text-gray-700">
                            {resumeCount} resume{resumeCount !== 1 ? 's' : ''}
                            {hasLinkedIn && ' and LinkedIn profile'}
                          </p>
                          <p className="mt-2 text-sm text-gray-500">
                            Click to view and manage application materials
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                {/* Networking Chapter */}
                {networkingActivities.length > 0 && (
                  <div>
                    <h2 className="mb-4 text-xl font-bold text-gray-900">
                      Networking
                    </h2>
                    <div
                      onClick={() =>
                        setLocation(`/networking-chapter/${nodeId}`)
                      }
                      className="cursor-pointer rounded-lg border border-gray-200 bg-white p-6 transition-shadow hover:shadow-md"
                    >
                      <p className="text-base text-gray-700">
                        {networkingActivities.length} networking{' '}
                        {networkingActivities.length === 1
                          ? 'activity'
                          : 'activities'}
                      </p>
                      <p className="mt-2 text-sm text-gray-500">
                        Click to view networking activities
                      </p>
                    </div>
                  </div>
                )}

                {/* Job Search Chapters */}
                <div>
                  <h2 className="mb-4 text-xl font-bold text-gray-900">
                    Job Search Chapters ({interviewChapters.length})
                  </h2>

                  {interviewChapters.length === 0 ? (
                    <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
                      <p className="text-gray-500">
                        No interview chapters yet. Applications with interview
                        status will appear here.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {interviewChapters.map((app) => (
                        <div
                          key={app.id}
                          onClick={() => {
                            setLocation(`/interview-chapter/${app.id}`);
                          }}
                          className="cursor-pointer rounded-lg border border-gray-200 bg-white p-6 transition-shadow hover:shadow-md"
                        >
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">
                              {app.company}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {app.jobTitle}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column - My Tasks (1/3 width) */}
              <div className="lg:col-span-1">
                <h2 className="mb-4 text-xl font-bold text-gray-900">
                  My tasks
                </h2>

                {todosByApplication.length === 0 ? (
                  <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
                    <p className="text-sm text-gray-500">
                      No tasks yet. Add tasks to your applications to track
                      progress.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {todosByApplication.map((group) => {
                      const isCompanyExpanded = expandedCompanies.has(
                        group.applicationId
                      );
                      const todosByStatus = group.todosByStatus || {};
                      const statusesWithTodos = Object.entries(
                        todosByStatus
                      ).filter(([, todos]) => todos.length > 0);

                      // Count total todos for this company
                      const totalTodos = statusesWithTodos.reduce(
                        (sum, [, todos]) => sum + todos.length,
                        0
                      );

                      return (
                        <div
                          key={group.applicationId}
                          className="rounded-lg border border-gray-200 bg-white"
                        >
                          {/* Company Header - Clickable to expand/collapse */}
                          <button
                            onClick={() => toggleCompany(group.applicationId)}
                            className="flex w-full items-center justify-between p-4 text-left hover:bg-gray-50"
                          >
                            <div className="flex-1">
                              <h3 className="text-sm font-semibold text-gray-900">
                                {group.company}
                              </h3>
                              <p className="text-xs text-gray-600">
                                {group.jobTitle}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">
                                {totalTodos} task{totalTodos !== 1 ? 's' : ''}
                              </span>
                              {isCompanyExpanded ? (
                                <ChevronDown className="h-4 w-4 text-gray-400" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-gray-400" />
                              )}
                            </div>
                          </button>

                          {/* Expanded Content - Grouped by Status */}
                          {isCompanyExpanded && (
                            <div className="border-t border-gray-200 p-4 pt-0">
                              {statusesWithTodos.map(([status, todos]) => {
                                const statusKey = `${group.applicationId}-${status}`;
                                const isStatusExpanded =
                                  expandedStatuses.has(statusKey);
                                const activeTodos =
                                  activeApplicationTodos[group.applicationId]?.[
                                    status as ApplicationStatus
                                  ] || todos;

                                return (
                                  <div key={statusKey} className="mt-4">
                                    {/* Status Header - Clickable to expand/collapse */}
                                    <button
                                      onClick={() => toggleStatus(statusKey)}
                                      className="flex w-full items-center justify-between py-2 text-left hover:bg-gray-50"
                                    >
                                      <span className="text-xs font-medium text-gray-700">
                                        {status}
                                      </span>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500">
                                          {activeTodos.length}
                                        </span>
                                        {isStatusExpanded ? (
                                          <ChevronDown className="h-3 w-3 text-gray-400" />
                                        ) : (
                                          <ChevronRight className="h-3 w-3 text-gray-400" />
                                        )}
                                      </div>
                                    </button>

                                    {/* Status Todos */}
                                    {isStatusExpanded && (
                                      <div className="mt-2">
                                        <TodoList
                                          todos={activeTodos}
                                          onChange={(newTodos) =>
                                            handleTodosChange(
                                              group.applicationId,
                                              status as ApplicationStatus,
                                              newTodos
                                            )
                                          }
                                          allowStatusChange={true}
                                          placeholder="Add a task..."
                                        />
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
