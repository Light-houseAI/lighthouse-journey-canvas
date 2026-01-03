import {
  Alert,
  AlertDescription,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  VStack,
} from '@journey/components';
import type { TimelineNodeWithPermissions } from '@journey/schema';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Building,
  Calendar,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  MapPin,
  MoreVertical,
  Plus,
  RefreshCw,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import React, { useState } from 'react';
import { useLocation } from 'wouter';

import { useCurrentUser } from '../../hooks/useAuth';
import { hierarchyApi } from '../../services/hierarchy-api';
import { useProfileViewStore } from '../../stores/profile-view-store';
import { NodeIcon } from '../icons/NodeIcons';
import { MultiStepAddNodeModal } from '../modals/MultiStepAddNodeModal';
import { CareerUpdateWizard } from '../nodes/career-transition/wizard/CareerUpdateWizard';
import { ProfileHeader } from '../profile/ProfileHeader';
import { NodeSessions } from './NodeSessions';
import { useNodeSessions } from '../../hooks/useNodeSessions';
import type { SessionMappingItem } from '@journey/schema';
import { WorkflowAnalysisPanel } from '../workflow/WorkflowAnalysisPanel';
import { HierarchicalWorkflowPanel } from '../workflow/HierarchicalWorkflowPanel';
import { AIUsageOverviewPanel } from '../workflow/AIUsageOverviewPanel';
import { Sparkles, Bot } from 'lucide-react';

// Simple types for props
export interface ProfileListViewProps {
  username?: string;
  className?: string;
}

// TanStack Query keys for caching
const queryKeys = {
  timeline: (username?: string) => ['timeline', username || 'current'] as const,
};

// Valid node type union for icon typing
type ValidNodeType =
  | 'action'
  | 'job'
  | 'education'
  | 'project'
  | 'event'
  | 'careerTransition';

// Get appropriate icon color based on node type
const getNodeTypeIconColor = (type: string) => {
  switch (type) {
    case 'job':
      return 'text-cyan-600';
    case 'project':
      return 'text-purple-600';
    case 'education':
      return 'text-blue-600';
    case 'event':
      return 'text-yellow-600';
    case 'careerTransition':
      return 'text-violet-600';
    case 'action':
      return 'text-green-600';
    default:
      return 'text-gray-600';
  }
};

// Format duration in a more readable way
const formatDuration = (startDate?: string, endDate?: string) => {
  if (!startDate && !endDate) return null;

  const start = startDate
    ? new Date(startDate).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      })
    : null;

  const end = endDate
    ? new Date(endDate).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      })
    : 'Present';

  if (start && end) {
    return `${start} - ${end}`;
  } else if (start) {
    return `${start} - Present`;
  } else if (end && end !== 'Present') {
    return `Until ${end}`;
  }
  return null;
};

// Helper to title case a string
const toTitleCase = (str: string): string => {
  return str.replace(/\b([a-z])/g, (_m, c: string) => c.toUpperCase());
};

// Generate meaningful titles for different node types
export const generateNodeTitle = (node: TimelineNodeWithPermissions) => {
  // If there's an explicit title, use it
  if (node.meta?.title) {
    return toTitleCase(String(node.meta.title));
  }

  // Generate titles based on node type
  switch (node.type) {
    case 'job': {
      const company = node.meta?.organizationName || node.meta?.company;
      const role = node.meta?.role || node.meta?.position;
      const companyStr = company ? toTitleCase(String(company)) : '';
      const roleStr = role ? toTitleCase(String(role)) : '';
      if (roleStr && companyStr) {
        return `${roleStr} at ${companyStr}`;
      } else if (roleStr) {
        return roleStr;
      } else if (companyStr) {
        return `Job at ${companyStr}`;
      }
      return 'Job Experience';
    }

    case 'project': {
      if (node.meta?.description) {
        return toTitleCase(String(node.meta.description));
      }
      return 'Project';
    }

    case 'education': {
      const meta = node.meta as Record<string, unknown> | undefined;
      const organizationName = toTitleCase(String(
        meta?.organizationName ||
          meta?.institution ||
          meta?.school ||
          'Institution'
      ));
      const degreeStr = meta?.degree ? toTitleCase(String(meta.degree)) : '';
      const fieldStr = meta?.field ? toTitleCase(String(meta.field)) : '';

      if (degreeStr && organizationName !== 'Institution') {
        if (fieldStr) {
          return `${degreeStr} in ${fieldStr} at ${organizationName}`;
        }
        return `${degreeStr} at ${organizationName}`;
      }
      if (degreeStr) {
        return fieldStr ? `${degreeStr} in ${fieldStr}` : degreeStr;
      }
      if (organizationName !== 'Institution') {
        return organizationName;
      }
      return 'Education';
    }

    case 'event': {
      if (node.meta?.description) {
        return toTitleCase(String(node.meta.description));
      }
      return 'Event';
    }

    case 'careerTransition': {
      const meta = node.meta as Record<string, unknown> | undefined;
      const fromRoleStr = meta?.fromRole ? toTitleCase(String(meta.fromRole)) : '';
      const toRoleStr = meta?.toRole ? toTitleCase(String(meta.toRole)) : '';

      if (fromRoleStr && toRoleStr) {
        return `${fromRoleStr} to ${toRoleStr}`;
      }
      if (toRoleStr) {
        return `Transition to ${toRoleStr}`;
      }
      if (fromRoleStr) {
        return `Transition from ${fromRoleStr}`;
      }
      return 'Career Transition';
    }

    case 'action': {
      if (node.meta?.description) {
        return toTitleCase(String(node.meta.description));
      }
      return 'Action';
    }

    default:
      return node.meta?.description
        ? toTitleCase(String(node.meta.description))
        : 'Experience';
  }
};

// Hierarchical node component with expand/collapse
const HierarchicalNode = ({
  node,
  allNodes,
  level = 0,
}: {
  node: TimelineNodeWithPermissions;
  allNodes: TimelineNodeWithPermissions[];
  level?: number;
}) => {
  const expandedNodeIds = useProfileViewStore((state) => state.expandedNodeIds);
  const toggleNodeExpansion = useProfileViewStore(
    (state) => state.toggleNodeExpansion
  );
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showSubjourneyModal, setShowSubjourneyModal] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const handleDeleteJourney = async () => {
    const title = generateNodeTitle(node);
    const confirmed = window.confirm(
      `Delete this journey?\n\n${title}\n\nThis cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await hierarchyApi.deleteNode(node.id);
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
    } catch (error) {
      console.error('Failed to delete journey:', error);
      const message = (error as Error)?.message || String(error);
      window.alert(`Failed to delete journey: ${message}`);
    }
  };

  // Find children of this node
  const children = allNodes.filter((n) => n.parentId === node.id);
  const hasChildren = children.length > 0;
  const isExpanded = expandedNodeIds.has(node.id);

  const handleToggleExpansion = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      toggleNodeExpansion(node.id);
    }
  };

  const handleNodeClick = () => {
    if (node.type === 'careerTransition') {
      setLocation(`/career-transition/${node.id}`);
    } else if (node.type === 'project') {
      // Navigate to work track detail view
      setLocation(`/work-track/${node.id}`);
    }
  };

  // Check if this node is clickable (has a detail view)
  const isClickable = node.type === 'careerTransition' || node.type === 'project';

  // Cast node.type to ValidNodeType for icon component
  const nodeTypeForIcon = node.type as ValidNodeType;

  return (
    <VStack spacing={2} className="flex flex-col">
      <div
        className={`group flex min-w-0 flex-col rounded-lg border border-gray-200 p-4 ${
          isClickable
            ? 'cursor-pointer transition-shadow hover:shadow-md hover:border-blue-200'
            : ''
        }`}
        style={{ marginLeft: `${level * 1.25}rem` }}
        onClick={handleNodeClick}
      >
        <div className="flex min-w-0 items-start gap-3">
          {/* Node type icon */}
          <div className="mt-0.5 flex-shrink-0">
            <NodeIcon
              type={nodeTypeForIcon}
              size={18}
              className={`flex-shrink-0 ${getNodeTypeIconColor(node.type)}`}
            />
          </div>

          {/* Main content */}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {/* Title */}
                <h4 className="font-semibold leading-snug text-gray-900">
                  {generateNodeTitle(node)}
                </h4>

                {/* Subtitle fields based on node type */}
                <VStack spacing={1} className="mt-1 flex flex-col">
                  {/* Company/Organization */}
                  {(node.meta?.company || node.meta?.organizationName) && (
                    <div className="flex min-w-0 items-center gap-1.5 text-sm text-gray-600">
                      <Building size={14} className="flex-shrink-0" />
                      <span className="truncate">
                        {String(
                          node.meta.company || node.meta.organizationName
                        )}
                      </span>
                    </div>
                  )}

                  {/* School for education */}
                  {node.meta?.school && (
                    <div className="flex min-w-0 items-center gap-1.5 text-sm text-gray-600">
                      <GraduationCap size={14} className="flex-shrink-0" />
                      <span className="truncate">
                        {String(node.meta.school)}
                      </span>
                    </div>
                  )}

                  {/* Location */}
                  {node.meta?.location && (
                    <div className="flex min-w-0 items-center gap-1.5 text-sm text-gray-500">
                      <MapPin size={14} className="flex-shrink-0" />
                      <span className="truncate">
                        {String(node.meta.location)}
                      </span>
                    </div>
                  )}

                  {/* Duration */}
                  {formatDuration(
                    node.meta.startDate
                      ? String(node.meta.startDate)
                      : undefined,
                    node.meta.endDate ? String(node.meta.endDate) : undefined
                  ) && (
                    <div className="flex min-w-0 items-center gap-1.5 text-sm text-gray-500">
                      <Calendar size={14} className="flex-shrink-0" />
                      <span className="truncate">
                        {formatDuration(
                          node.meta.startDate
                            ? String(node.meta.startDate)
                            : undefined,
                          node.meta.endDate
                            ? String(node.meta.endDate)
                            : undefined
                        )}
                      </span>
                    </div>
                  )}

                  {/* Role for jobs */}
                  {node.meta.role && node.type === 'job' && (
                    <div className="text-sm font-medium text-gray-600">
                      {String(node.meta.role)}
                    </div>
                  )}

                  {/* Degree and field for education */}
                  {(node.meta.degree || node.meta.field) &&
                    node.type === 'education' && (
                      <div className="text-sm text-gray-600">
                        {node.meta.degree && (
                          <span className="font-medium">
                            {String(node.meta.degree)}
                          </span>
                        )}
                        {node.meta.degree && node.meta.field && (
                          <span> • </span>
                        )}
                        {node.meta.field && (
                          <span>{String(node.meta.field)}</span>
                        )}
                      </div>
                    )}

                  {/* Project type */}
                  {node.meta.projectType && node.type === 'project' && (
                    <div className="flex">
                      <span className="inline-block rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700">
                        {String(node.meta.projectType)}
                      </span>
                    </div>
                  )}
                </VStack>

                {/* Description */}
                {node.meta.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-gray-600">
                    {String(node.meta.description)}
                  </p>
                )}

                {/* View my work as a... - show for project nodes at top level */}
                {level === 0 && node.type === 'project' && (
                  <div className="mt-4 space-y-2 border-t border-gray-100 pt-3">
                    <p className="text-xs text-gray-500">View my work as a...</p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs font-normal"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/work-track/${node.id}?template=workflow-analysis`);
                        }}
                      >
                        Workflow analysis
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs font-normal"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/work-track/${node.id}?template=progress-update`);
                        }}
                      >
                        Progress update
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs font-normal"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/work-track/${node.id}?template=story-summary`);
                        }}
                      >
                        Story summary
                      </Button>
                    </div>
                  </div>
                )}

                {/* Work Sessions - show for top-level nodes only */}
                {level === 0 && (
                  <NodeSessions nodeId={node.id} enabled={true} />
                )}
              </div>
            </div>
          </div>

          {level < 1 && (
            <div
              className="mt-0.5 flex flex-shrink-0 items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Actions dropdown menu - show for nodes with edit permission */}
              {node.permissions.canEdit && (
                <DropdownMenu
                  open={isDropdownOpen}
                  onOpenChange={setIsDropdownOpen}
                >
                  <DropdownMenuTrigger asChild>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      variant="ghost"
                      className="rounded p-1"
                      title="More actions"
                    >
                      <MoreVertical className="h-5 w-5 text-gray-500" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {/* Add Subjourney for level < 1 */}
                    {level < 1 && (
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault();
                          setIsDropdownOpen(false);
                          setShowSubjourneyModal(true);
                        }}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Subjourney
                      </DropdownMenuItem>
                    )}
                    {/* Add Update for career transitions */}
                    {node.type === 'careerTransition' && (
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault();
                          setIsDropdownOpen(false);
                          setShowUpdateModal(true);
                        }}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Add Update
                      </DropdownMenuItem>
                    )}

                    {/* Delete journey */}
                    {node.permissions.canDelete && (
                      <DropdownMenuItem
                        className="text-red-600 focus:text-red-600"
                        onSelect={(e) => {
                          e.preventDefault();
                          setIsDropdownOpen(false);
                          handleDeleteJourney();
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Journey
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}
        </div>

        {/* Chevron button at bottom right */}
        {hasChildren && (
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleToggleExpansion}
              variant="ghost"
              className="rounded p-1"
            >
              {isExpanded ? (
                <ChevronUp className="h-5 w-5 text-gray-500" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-500" />
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Render children when expanded */}
      {hasChildren && isExpanded && (
        <div className="ml-4">
          {children.map((childNode) => (
            <HierarchicalNode
              key={childNode.id}
              node={childNode}
              allNodes={allNodes}
              level={level + 1}
            />
          ))}
        </div>
      )}

      {/* Career Update Modal */}
      {showUpdateModal && (
        <CareerUpdateWizard
          nodeId={node.id}
          onSuccess={() => {
            setShowUpdateModal(false);
            queryClient.invalidateQueries({ queryKey: ['updates', node.id] });
            queryClient.invalidateQueries({ queryKey: ['timeline'] });
          }}
          onCancel={() => {
            setShowUpdateModal(false);
          }}
        />
      )}

      {/* Add Subjourney Modal */}
      {showSubjourneyModal && (
        <MultiStepAddNodeModal
          isOpen={showSubjourneyModal}
          onClose={() => setShowSubjourneyModal(false)}
          onSuccess={() => {
            setShowSubjourneyModal(false);
            queryClient.invalidateQueries({ queryKey: ['timeline'] });
            queryClient.invalidateQueries({ queryKey: ['nodes'] });
          }}
          context={{
            insertionPoint: 'branch',
            parentNode: {
              id: node.id,
              title: generateNodeTitle(node),
              type: node.type,
            },
            availableTypes: [
              'job',
              'project',
              'education',
              'event',
              'careerTransition',
              'action',
            ],
          }}
        />
      )}
    </VStack>
  );
};

// New JourneyCard component matching the Figma design
const JourneyCard = ({
  node,
}: {
  node: TimelineNodeWithPermissions;
}) => {
  const [, setLocation] = useLocation();
  const [showSubjourneyModal, setShowSubjourneyModal] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showWorkflowAnalysis, setShowWorkflowAnalysis] = useState(false);
  const [showTopWorkflows, setShowTopWorkflows] = useState(false);
  const [showAIUsageOverview, setShowAIUsageOverview] = useState(false);
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionMappingItem | null>(null);
  const queryClient = useQueryClient();

  // Get icon based on node type
  const getIconConfig = () => {
    switch (node.type) {
      case 'job':
        return { Icon: Building, bgColor: 'bg-blue-500' };
      case 'education':
        return { Icon: GraduationCap, bgColor: 'bg-teal-500' };
      case 'project':
        return { Icon: Building, bgColor: 'bg-purple-500' };
      default:
        return { Icon: Building, bgColor: 'bg-gray-500' };
    }
  };

  const { Icon, bgColor } = getIconConfig();
  const title = generateNodeTitle(node);
  const dateRange = formatDuration(
    node.meta.startDate ? String(node.meta.startDate) : undefined,
    node.meta.endDate ? String(node.meta.endDate) : undefined
  );

  // Get description/subtitle
  const getSubtitle = () => {
    if (node.meta?.role) return String(node.meta.role);
    if (node.meta?.description) return String(node.meta.description);
    return null;
  };

  const subtitle = getSubtitle();

  const handleDeleteJourney = async () => {
    const confirmed = window.confirm(
      `Delete this journey?\n\n${title}\n\nThis cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await hierarchyApi.deleteNode(node.id);
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
    } catch (error) {
      console.error('Failed to delete journey:', error);
      const message = (error as Error)?.message || String(error);
      window.alert(`Failed to delete journey: ${message}`);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
      <div className="flex flex-col lg:flex-row">
        {/* Left column - Main content */}
        <div className="flex-1 p-5 md:p-6">
          {/* Icon */}
          <div
            className={`w-10 h-10 md:w-12 md:h-12 ${bgColor} rounded-lg flex items-center justify-center mb-4`}
          >
            <Icon className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </div>

          {/* Title and date */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-xl md:text-2xl font-semibold text-gray-900 mb-1">
                {title}
              </h2>
              {dateRange && (
                <p className="text-sm text-gray-500 mb-1">
                  {dateRange}
                </p>
              )}
              {subtitle && (
                <p className="text-sm text-gray-600">{subtitle}</p>
              )}
            </div>

            {/* Actions dropdown */}
            {node.permissions.canEdit && (
              <DropdownMenu
                open={isDropdownOpen}
                onOpenChange={setIsDropdownOpen}
              >
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="rounded p-1"
                    title="More actions"
                  >
                    <MoreVertical className="h-5 w-5 text-gray-500" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      setIsDropdownOpen(false);
                      setShowSubjourneyModal(true);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Subjourney
                  </DropdownMenuItem>
                  {node.permissions.canDelete && (
                    <DropdownMenuItem
                      className="text-red-600 focus:text-red-600"
                      onSelect={(e) => {
                        e.preventDefault();
                        setIsDropdownOpen(false);
                        handleDeleteJourney();
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Journey
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* View my work as... section */}
          <div className="mt-5 space-y-3">
            <p className="text-sm text-gray-500">View my work as a...</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-sm font-normal"
                onClick={() => {
                  setShowWorkflowAnalysis(!showWorkflowAnalysis);
                  if (!showWorkflowAnalysis) {
                    setShowTopWorkflows(false);
                    setShowAIUsageOverview(false);
                  }
                  setSelectedSession(null);
                }}
              >
                <Sparkles size={14} className="mr-1.5" />
                Workflow analysis
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-sm font-normal"
                onClick={() => {
                  setShowTopWorkflows(!showTopWorkflows);
                  if (!showTopWorkflows) {
                    setShowWorkflowAnalysis(false);
                    setShowAIUsageOverview(false);
                  }
                  setSelectedSession(null);
                }}
              >
                <TrendingUp size={14} className="mr-1.5" />
                Top Workflow
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-sm font-normal"
                onClick={() => {
                  setShowAIUsageOverview(!showAIUsageOverview);
                  if (!showAIUsageOverview) {
                    setShowWorkflowAnalysis(false);
                    setShowTopWorkflows(false);
                  }
                  setSelectedSession(null);
                }}
              >
                <Bot size={14} className="mr-1.5" />
                AI Usage Overview
              </Button>
            </div>
            <a
              href="#"
              className="inline-block text-sm text-blue-600 hover:underline transition-all"
              onClick={(e) => {
                e.preventDefault();
                setLocation(`/work-track/${node.id}`);
              }}
            >
              Browse more templates
            </a>
          </div>
        </div>

        {/* Right column - Most recent work panel */}
        <div className="lg:w-72 xl:w-80 border-t lg:border-t-0 lg:border-l border-gray-200">
          <RecentWorkPanel
            nodeId={node.id}
            showAllSessions={showAllSessions}
            onToggleShowAll={() => setShowAllSessions(!showAllSessions)}
            onSessionClick={(session) => {
              setSelectedSession(session);
              setShowWorkflowAnalysis(false);
              setShowTopWorkflows(false);
            }}
            selectedSessionId={selectedSession?.id}
          />
        </div>
      </div>

      {/* Workflow/Session panels - displayed below the card in a larger area */}
      {(showWorkflowAnalysis || showTopWorkflows || showAIUsageOverview || selectedSession) && (
        <div className="border-t border-gray-200 p-5 md:p-6 bg-gray-50">
          {/* Workflow Analysis Panel */}
          {showWorkflowAnalysis && (
            <WorkflowAnalysisPanel
              nodeId={node.id}
              onClose={() => setShowWorkflowAnalysis(false)}
            />
          )}

          {/* Top Workflow Panel */}
          {showTopWorkflows && (
            <HierarchicalWorkflowPanel
              nodeId={node.id}
              onClose={() => setShowTopWorkflows(false)}
            />
          )}

          {/* AI Usage Overview Panel */}
          {showAIUsageOverview && (
            <AIUsageOverviewPanel
              nodeId={node.id}
              onClose={() => setShowAIUsageOverview(false)}
            />
          )}

          {/* Selected Session Detail */}
          {selectedSession && !showWorkflowAnalysis && !showTopWorkflows && !showAIUsageOverview && (
            <SessionDetailPanel
              session={selectedSession}
              onClose={() => setSelectedSession(null)}
            />
          )}
        </div>
      )}

      {/* Add Subjourney Modal */}
      {showSubjourneyModal && (
        <MultiStepAddNodeModal
          isOpen={showSubjourneyModal}
          onClose={() => setShowSubjourneyModal(false)}
          onSuccess={() => {
            setShowSubjourneyModal(false);
            queryClient.invalidateQueries({ queryKey: ['timeline'] });
            queryClient.invalidateQueries({ queryKey: ['nodes'] });
          }}
          context={{
            insertionPoint: 'branch',
            parentNode: {
              id: node.id,
              title: generateNodeTitle(node),
              type: node.type,
            },
            availableTypes: [
              'job',
              'project',
              'education',
              'event',
              'careerTransition',
              'action',
            ],
          }}
        />
      )}
    </div>
  );
};

// Session Detail Panel - shows details when a session is clicked
const SessionDetailPanel = ({
  session,
  onClose,
}: {
  session: SessionMappingItem;
  onClose: () => void;
}) => {
  const sessionDate = session.startedAt ? new Date(session.startedAt) : null;
  const formattedDate = sessionDate
    ? sessionDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Unknown date';
  const formattedTime = sessionDate
    ? sessionDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {session.workflowName || 'Work Session'}
          </h3>
          <p className="text-sm text-gray-500">
            {formattedDate} {formattedTime && `at ${formattedTime}`}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          <span className="sr-only">Close</span>
          ×
        </Button>
      </div>

      {/* Session Summary */}
      {session.highLevelSummary && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Summary</h4>
          <p className="text-sm text-gray-600">{session.highLevelSummary}</p>
        </div>
      )}

      {/* Session Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
        {session.durationSeconds && (
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Duration</p>
            <p className="text-sm font-medium text-gray-900">
              {Math.round(session.durationSeconds / 60)} min
            </p>
          </div>
        )}
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1">Category</p>
          <p className="text-sm font-medium text-gray-900 capitalize">
            {session.category?.replace(/_/g, ' ') || 'General'}
          </p>
        </div>
        {session.categoryConfidence && (
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Confidence</p>
            <p className="text-sm font-medium text-gray-900">
              {Math.round(session.categoryConfidence * 100)}%
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// Recent Work Panel component for the right side of journey cards
const RecentWorkPanel = ({
  nodeId,
  showAllSessions = false,
  onToggleShowAll,
  onSessionClick,
  selectedSessionId,
}: {
  nodeId: string;
  showAllSessions?: boolean;
  onToggleShowAll?: () => void;
  onSessionClick?: (session: SessionMappingItem) => void;
  selectedSessionId?: string;
}) => {
  const limit = showAllSessions ? 50 : 5;
  const { data, isLoading } = useNodeSessions(nodeId, { limit }, true);

  const sessions: SessionMappingItem[] = data?.sessions || [];

  // Group sessions by date
  const groupSessionsByDate = () => {
    const groups: { dayLabel: string; dateLabel: string; items: SessionMappingItem[] }[] = [];
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dateGroups = new Map<string, SessionMappingItem[]>();

    sessions.forEach((session: SessionMappingItem) => {
      if (!session.startedAt) return;
      const sessionDate = new Date(session.startedAt);
      const dateKey = sessionDate.toDateString();

      if (!dateGroups.has(dateKey)) {
        dateGroups.set(dateKey, []);
      }
      dateGroups.get(dateKey)?.push(session);
    });

    dateGroups.forEach((items, dateKey) => {
      const date = new Date(dateKey);
      let dayLabel = '';

      if (date.toDateString() === today.toDateString()) {
        dayLabel = 'Today';
      } else if (date.toDateString() === yesterday.toDateString()) {
        dayLabel = 'Yesterday';
      } else {
        dayLabel = date.toLocaleDateString('en-US', { weekday: 'long' });
      }

      const dateLabel = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });

      groups.push({ dayLabel, dateLabel, items });
    });

    return groups;
  };

  const workGroups = groupSessionsByDate();

  if (isLoading) {
    return (
      <div className="bg-gray-50 p-4 md:p-5 h-full">
        <h3 className="text-xs font-medium text-pink-600 mb-4">Most recent work</h3>
        <div className="space-y-3">
          <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-1/2 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  // When showing all sessions, use actual fetched count; otherwise use pagination total
  // Note: sessionCount from API may include all historical sessions, so we use sessions.length when expanded
  const totalSessions = showAllSessions
    ? sessions.length
    : (data?.pagination?.total ?? sessions.length);
  const hasMoreSessions = !showAllSessions && sessions.length >= 5 && (data?.pagination?.hasNext ?? false);

  if (sessions.length === 0) {
    return (
      <div className="bg-gray-50 p-4 md:p-5 h-full">
        <h3 className="text-xs font-medium text-pink-600 mb-4">Most recent work</h3>
        <p className="text-sm text-gray-500">No work sessions yet</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 p-4 md:p-5 h-full flex flex-col">
      <h3 className="text-xs font-medium text-pink-600 mb-4">Most recent work</h3>
      <div className="space-y-4 flex-1 overflow-y-auto max-h-64">
        {workGroups.map((group, groupIndex) => (
          <div key={groupIndex} className="flex gap-4">
            {/* Date column */}
            <div className="flex-shrink-0 w-16 md:w-20 text-right">
              <div className="text-sm font-medium text-gray-900">
                {group.dayLabel}
              </div>
              <div className="text-sm text-gray-500">
                {group.dateLabel}
              </div>
            </div>

            {/* Divider */}
            <div className="w-px bg-gray-300 flex-shrink-0" />

            {/* Items column */}
            <div className="flex-1 space-y-1.5">
              {group.items.map((item: SessionMappingItem, itemIndex: number) => (
                <div
                  key={item.id || itemIndex}
                  onClick={() => onSessionClick?.(item)}
                  className={`text-sm cursor-pointer transition-colors line-clamp-1 ${
                    selectedSessionId === item.id
                      ? 'text-blue-600 font-medium'
                      : 'text-gray-900 hover:text-blue-600'
                  }`}
                >
                  {item.workflowName || item.highLevelSummary || 'Work Session'}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* View all sessions link */}
      {(hasMoreSessions || onToggleShowAll) && (
        <div className="mt-4 pt-3 border-t border-gray-200">
          <button
            onClick={onToggleShowAll}
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors"
          >
            {showAllSessions ? 'Show less' : `View all sessions (${totalSessions})`}
          </button>
        </div>
      )}
    </div>
  );
};

// Experience section with hierarchical tree structure - redesigned to match Figma
const ExperienceSection = ({
  title,
  rootNodes,
  onAddExperience,
}: {
  title: string;
  rootNodes: TimelineNodeWithPermissions[];
  onAddExperience?: () => void;
}) => {
  const shouldShowAddButton = title === 'My Journeys';

  if (rootNodes.length === 0) {
    return (
      <div className="flex flex-col">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-2xl font-semibold text-[#2e2e2e]">{title}</h3>
          {shouldShowAddButton && onAddExperience && (
            <Button
              onClick={onAddExperience}
              variant="ghost"
              className="gap-2 text-gray-600 hover:text-gray-900"
            >
              <Plus className="size-[16px]" />
              <span className="text-sm font-medium">
                Add journey
              </span>
            </Button>
          )}
        </div>
        <p className="text-sm text-gray-500">No {title.toLowerCase()} found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-2xl font-semibold text-[#2e2e2e]">{title}</h3>
        {shouldShowAddButton && onAddExperience && (
          <Button onClick={onAddExperience} variant="ghost" className="gap-2 text-gray-600 hover:text-gray-900">
            <Plus className="size-[16px]" />
            <span className="text-sm font-medium">
              Add journey
            </span>
          </Button>
        )}
      </div>
      <div className="flex flex-col gap-4">
        {rootNodes.map((node) => (
          <JourneyCard
            key={node.id}
            node={node}
          />
        ))}
      </div>
    </div>
  );
};

// Main profile list view component using NEW ARCHITECTURE: TanStack Query + Zustand
export function ProfileListViewContainer({
  username,
  className,
}: ProfileListViewProps) {
  const isCurrentUser = !username;
  const { data: user } = useCurrentUser();
  const [isProfileAddModalOpen, setIsProfileAddModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const titleCaseWords = (value: string) =>
    value.replace(/\b([a-z])/g, (_m, c: string) => c.toUpperCase());

  const profileHeaderName = username
    ? `${titleCaseWords(username)}'s Journey`
    : user?.firstName && user?.lastName
      ? `${titleCaseWords(user.firstName)} ${titleCaseWords(user.lastName)}'s Journey`
      : user?.firstName
        ? `${titleCaseWords(user.firstName)}'s Journey`
        : user?.userName
          ? `${titleCaseWords(user.userName)}'s Journey`
          : "User's Journey";

  // TanStack Query for SERVER STATE (API data fetching, caching, background refetch)
  const {
    data: nodes = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.timeline(username),
    queryFn: async () => {
      if (isCurrentUser) {
        // Get current user's nodes with permissions
        return await hierarchyApi.listNodesWithPermissions();
      } else {
        // Get other user's visible nodes with permissions
        return await hierarchyApi.listUserNodesWithPermissions(
          username as string
        );
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: (failureCount, error) => {
      // Don't retry on auth errors
      const message = error.message.toLowerCase();
      if (
        message.includes('401') ||
        message.includes('403') ||
        message.includes('unauthorized')
      ) {
        return false;
      }
      return failureCount < 3;
    },
    enabled: !!(!username || username), // Always enabled, but conditional logic in queryFn
  });

  // Separate root nodes (no parentId) into current and past experiences
  const rootNodes = nodes.filter((node) => !node.parentId);
  const currentRootNodes = rootNodes.filter((node) => !node.meta.endDate);
  const pastRootNodes = rootNodes.filter((node) => node.meta.endDate);

  // Loading state
  if (isLoading) {
    return (
      <div className={className}>
        <VStack spacing={6} className="p-6">
          <div className="animate-pulse">
            <div className="mb-6 rounded-lg bg-gray-200 p-4">
              <div className="mb-4 h-6 rounded bg-gray-300"></div>
              <VStack spacing={2}>
                <div className="h-4 w-3/4 rounded bg-gray-300"></div>
                <div className="h-4 w-1/2 rounded bg-gray-300"></div>
              </VStack>
            </div>
            <div className="rounded-lg bg-gray-200 p-4">
              <div className="mb-4 h-6 rounded bg-gray-300"></div>
              <VStack spacing={2}>
                <div className="h-4 w-3/4 rounded bg-gray-300"></div>
                <div className="h-4 w-1/2 rounded bg-gray-300"></div>
              </VStack>
            </div>
          </div>
        </VStack>
      </div>
    );
  }

  // Error state
  if (error) {
    const isAuthError =
      error.message.toLowerCase().includes('401') ||
      error.message.toLowerCase().includes('unauthorized');

    return (
      <div className={className}>
        <div className="p-6">
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <VStack spacing={2}>
                <p>Failed to load profile data: {error.message}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (isAuthError) {
                      // Clear auth state and redirect to sign in
                      localStorage.removeItem('auth-store');
                      window.location.href = '/';
                    } else {
                      refetch();
                    }
                  }}
                  className="border-red-300 text-red-600 hover:bg-red-100"
                >
                  <RefreshCw className="mr-1 h-3 w-3" />
                  {isAuthError ? 'Sign In' : 'Try Again'}
                </Button>
              </VStack>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  // Success state - show profile data
  return (
    <div className={`${className} flex h-full min-h-0 flex-col`}>
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="flex min-h-full flex-col gap-6 bg-gray-50 p-4 sm:p-6 lg:p-8">
          <div className="flex max-w-none flex-col gap-4 sm:gap-6">
            {/* Profile Header - Using LIG-169 redesign */}
            <ProfileHeader
              user={{
                name: profileHeaderName,
                avatar: '', // UserProfile doesn't have avatar field
                description: '',
                title: '',
              }}
              profileUrl={window.location.href}
              showShareButton={isCurrentUser}
              showMoreOptions={true}
              isCurrentUser={isCurrentUser}
              onShare={() => {
                // Share functionality handled by ProfileHeader
              }}
            />

            {/* My Journeys - Current */}
            <ExperienceSection
              title="My Journeys"
              rootNodes={currentRootNodes}
              onAddExperience={() => setIsProfileAddModalOpen(true)}
            />

            {/* Past Experiences */}
            <ExperienceSection
              title="Past Experiences"
              rootNodes={pastRootNodes}
            />

            {/* Empty state */}
            {nodes.length === 0 && (
              <div className="rounded-lg bg-white p-8 text-center shadow">
                <p className="text-gray-500">No timeline data found</p>
                {!username && (
                  <p className="mt-2 text-sm text-gray-400">
                    Start building your professional journey timeline
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Spacer to ensure last item can scroll to bottom - responsive */}
          <div className="h-8 flex-shrink-0 sm:h-12 lg:h-16"></div>
        </div>
      </div>

      {/* Profile Add Node Modal */}
      {isProfileAddModalOpen && (
        <MultiStepAddNodeModal
          isOpen={isProfileAddModalOpen}
          onClose={() => setIsProfileAddModalOpen(false)}
          onSuccess={() => {
            setIsProfileAddModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['timeline'] });
            queryClient.invalidateQueries({ queryKey: ['nodes'] });
          }}
          context={{
            insertionPoint: 'after',
            availableTypes: [
              'job',
              'project',
              'education',
              'event',
              'careerTransition',
              'action',
            ],
          }}
        />
      )}
    </div>
  );
}

export { ProfileListViewContainer as ProfileListView };
