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
} from 'lucide-react';
import React, { useState } from 'react';
import { useLocation } from 'wouter';

import { hierarchyApi } from '../../services/hierarchy-api';
import { useAnalytics, AnalyticsEvents } from '../../hooks/useAnalytics';
import { toast } from '../../hooks/use-toast';
import { useProfileViewStore } from '../../stores/profile-view-store';
import { NodeIcon } from '../icons/NodeIcons';
import { MultiStepAddNodeModal } from '../modals/MultiStepAddNodeModal';
import { CareerUpdateWizard } from '../nodes/career-transition/wizard/CareerUpdateWizard';
import { BrowseWorkOutputsModal } from '../modals/BrowseWorkOutputsModal';
import { NodeSessions } from './NodeSessions';
import { useNodeSessions } from '../../hooks/useNodeSessions';
import { NaturalLanguageQueryDialog } from '../workflow/NaturalLanguageQueryDialog';
import { ProgressSnapshotPanel } from './ProgressSnapshotPanel';
import { TrackAnalysisChatModal } from '../modals/TrackAnalysisChatModal';

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
      // Prefer company name as the primary identifier
      if (companyStr) {
        return companyStr;
      } else if (roleStr) {
        return roleStr;
      }
      return 'Job Experience';
    }

    case 'work': {
      // Work tracks from desktop app - prefer company/name as primary identifier
      const meta = node.meta as Record<string, unknown> | undefined;
      const name = meta?.name || meta?.label || meta?.company;
      const nameStr = name ? toTitleCase(String(name)) : '';
      if (nameStr) {
        return nameStr;
      }
      return 'Work Track';
    }

    case 'project': {
      // Prefer projectName or name as primary identifier for personal project tracks
      const meta = node.meta as Record<string, unknown> | undefined;
      const projectName = meta?.projectName || meta?.name || meta?.description;
      if (projectName) {
        return toTitleCase(String(projectName));
      }
      return 'Project';
    }

    case 'education': {
      // Prefer school/institution name as primary identifier
      const meta = node.meta as Record<string, unknown> | undefined;
      const organizationName = toTitleCase(String(
        meta?.organizationName ||
          meta?.institution ||
          meta?.school ||
          ''
      ));
      if (organizationName) {
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
      // For job search tracks, prefer targetRole as the primary identifier
      const meta = node.meta as Record<string, unknown> | undefined;
      const targetRoleStr = meta?.targetRole ? toTitleCase(String(meta.targetRole)) : '';
      const toRoleStr = meta?.toRole ? toTitleCase(String(meta.toRole)) : '';

      // Show target role or toRole as the primary identifier
      if (targetRoleStr) {
        return targetRoleStr;
      }
      if (toRoleStr) {
        return toRoleStr;
      }
      return 'Job Search';
    }

    case 'action': {
      if (node.meta?.description) {
        return toTitleCase(String(node.meta.description));
      }
      return 'Action';
    }

    default: {
      // For unknown node types, try various metadata fields (primary identifiers first)
      const meta = node.meta as Record<string, unknown> | undefined;
      const primaryId = meta?.company || meta?.school || meta?.targetRole ||
                        meta?.projectName || meta?.name || meta?.label || meta?.description;
      if (primaryId) {
        return toTitleCase(String(primaryId));
      }
      // Fallback with node type if available
      if (node.type) {
        return toTitleCase(String(node.type));
      }
      return 'Untitled Journey';
    }
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

// Work output item type
interface WorkOutputItem {
  id: string;
  title: string;
  description: string;
  templateKey: string;
}

// Default work outputs for the card
const defaultWorkOutputs: WorkOutputItem[] = [
  {
    id: 'progress-update',
    title: 'Progress update',
    description: 'A weekly snapshot of what you worked on.',
    templateKey: 'progress-update',
  },
  {
    id: 'work-habits',
    title: 'Work habits analysis',
    description: 'A breakdown of your work patterns, rhythms, strengths.',
    templateKey: 'workflow-analysis',
  },
  {
    id: 'work-story',
    title: 'Work story',
    description: 'A structured story of your work highlighting your process.',
    templateKey: 'story-summary',
  },
];

// Format relative time (e.g., "10m ago", "2h ago", "3d ago")
const formatRelativeTime = (dateString?: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
  const [showAskAboutWork, setShowAskAboutWork] = useState(false);
  const [showBrowseOutputsModal, setShowBrowseOutputsModal] = useState(false);
  const [showProgressSnapshot, setShowProgressSnapshot] = useState(false);
  const [showWorkflowChatModal, setShowWorkflowChatModal] = useState(false);
  const queryClient = useQueryClient();
  const { track } = useAnalytics();

  // Fetch session data for this node
  const { data: sessionsData } = useNodeSessions(node.id, { limit: 1 }, true);
  const sessionCount = sessionsData?.pagination?.total ?? 0;
  const lastSession = sessionsData?.sessions?.[0];
  const lastSessionTime = lastSession?.startedAt ? formatRelativeTime(lastSession.startedAt) : '';

  const title = generateNodeTitle(node);

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

  const handleWorkOutputClick = (templateKey: string) => {
    // Show "Coming Soon" for work-habits and work-story
    if (templateKey === 'workflow-analysis' || templateKey === 'story-summary') {
      track(AnalyticsEvents.BUTTON_CLICKED, {
        button_name: templateKey === 'workflow-analysis' ? 'work_habits_analysis' : 'work_story',
        template_key: templateKey,
        node_id: node.id,
        status: 'coming_soon',
      });
      toast({
        title: 'Coming Soon',
        description: 'This feature is currently under development. Stay tuned!',
      });
      return;
    }
    // Show Progress Snapshot panel for progress-update
    if (templateKey === 'progress-update') {
      track(AnalyticsEvents.BUTTON_CLICKED, {
        button_name: 'progress_update',
        template_key: templateKey,
        node_id: node.id,
      });
      setShowProgressSnapshot(true);
      return;
    }
    setLocation(`/work-track/${node.id}?template=${templateKey}`);
  };

  return (
    <div className="w-full max-w-[492px] min-w-[320px] flex-shrink-0">
      {/* Main Card with purple gradient effect */}
      <div
        className="relative overflow-hidden rounded-xl bg-white"
        style={{
          boxShadow: '0px 4px 6px -2px rgba(120, 132, 149, 0.08), 0px 12px 16px -4px rgba(120, 132, 149, 0.15)',
        }}
      >
        {/* Purple gradient blur effect at top */}
        <div
          className="absolute top-[-51px] left-1/2 -translate-x-1/2 w-[457px] h-[133px] pointer-events-none"
          style={{
            background: '#8051FF',
            filter: 'blur(150px)',
          }}
        />

        {/* Card content */}
        <div className="relative pt-[50px] px-4 pb-4 flex flex-col items-center gap-4">
          {/* Icon with glass effect */}
          <div
            className="w-[85px] h-[85px] rounded-full flex items-center justify-center"
            style={{
              background: 'linear-gradient(180deg, #F6F6F6 0%, rgba(255, 255, 255, 0) 100%)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div
              className="w-12 h-12 rounded-full bg-white flex items-center justify-center"
              style={{ border: '1px solid #EDEDED' }}
            >
              <Building className="w-6 h-6 text-[#4A4F4E]" strokeWidth={2} />
            </div>
          </div>

          {/* Title and details */}
          <div className="flex flex-col items-center gap-1 w-full">
            <h3
              className="text-xl font-semibold text-center"
              style={{
                color: '#161619',
                fontFamily: 'Inter, sans-serif',
                letterSpacing: '-0.05px',
                lineHeight: '30px',
              }}
            >
              {title}
            </h3>
            <div className="flex items-center justify-center gap-1.5 text-sm" style={{ color: '#656D76' }}>
              <span>{sessionCount} sessions total</span>
              {lastSessionTime && (
                <>
                  <span>•</span>
                  <span>Last session pushed {lastSessionTime}</span>
                </>
              )}
            </div>
          </div>

          {/* Help input field */}
          <div className="w-full flex flex-col gap-1">
            <label
              className="text-sm font-medium"
              style={{ color: '#161619', letterSpacing: '-0.05px' }}
            >
              Need help with your {title} work?
            </label>
            <div
              className="w-full cursor-pointer rounded-xl bg-white p-3 transition-colors hover:bg-gray-50"
              style={{
                border: '1px solid #EAECF0',
                boxShadow: '3px 3px 10px rgba(120, 132, 149, 0.08)',
              }}
              onClick={() => setShowWorkflowChatModal(true)}
            >
              <div
                className="w-full text-sm"
                style={{
                  color: '#9AA4A0',
                  fontFamily: 'Inter, sans-serif',
                  letterSpacing: '-0.05px',
                  lineHeight: '22px',
                  minHeight: '44px',
                }}
              >
                Ask for insights, reports, etc ...
              </div>
            </div>
          </div>

          {/* My favorite work outputs section */}
          <div
            className="w-full rounded-xl bg-white"
            style={{
              border: '1px solid #EAECF0',
              boxShadow: '6px 6px 15px rgba(120, 132, 149, 0.15)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-2.5 py-2.5">
              <span className="text-sm font-medium" style={{ color: '#9AA4A0' }}>
                My favorite work outputs
              </span>
              <button
                className="text-sm font-medium hover:underline"
                style={{ color: '#2F6CC8' }}
                onClick={() => setShowBrowseOutputsModal(true)}
              >
                See all work outputs
              </button>
            </div>

            {/* Work output items */}
            <div className="flex flex-col px-2 pb-1.5 gap-1">
              {defaultWorkOutputs.map((output) => (
                <div
                  key={output.id}
                  className="flex items-center justify-between px-4 py-3 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                  style={{ background: output.id === 'progress-update' ? '#F9FAFB' : 'transparent' }}
                  onClick={() => handleWorkOutputClick(output.templateKey)}
                >
                  <div className="flex flex-col gap-0.5">
                    <span
                      className="text-sm font-bold"
                      style={{ color: '#2E2E2E', letterSpacing: '-0.05px' }}
                    >
                      {output.title}
                    </span>
                    <span
                      className="text-xs"
                      style={{ color: '#4A4F4E', letterSpacing: '-0.05px' }}
                    >
                      {output.description}
                    </span>
                  </div>
                  <button
                    className="flex items-center gap-2 text-sm font-semibold"
                    style={{ color: '#2E2E2E' }}
                  >
                    View
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M3.75 9H14.25M14.25 9L9.75 4.5M14.25 9L9.75 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Hidden dropdown for actions - accessible via right-click or long-press in future */}
      {node.permissions.canEdit && (
        <DropdownMenu
          open={isDropdownOpen}
          onOpenChange={setIsDropdownOpen}
        >
          <DropdownMenuTrigger asChild>
            <button className="sr-only">More actions</button>
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

      {/* Ask About Your Work Dialog */}
      <NaturalLanguageQueryDialog
        nodeId={node.id}
        isOpen={showAskAboutWork}
        onClose={() => setShowAskAboutWork(false)}
      />

      {/* Browse Work Outputs Modal */}
      <BrowseWorkOutputsModal
        isOpen={showBrowseOutputsModal}
        onClose={() => setShowBrowseOutputsModal(false)}
        nodeId={node.id}
        onSelectTemplate={(templateKey) => {
          setLocation(`/work-track/${node.id}?template=${templateKey}`);
        }}
      />

      {/* Progress Snapshot Modal */}
      {showProgressSnapshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowProgressSnapshot(false)}
          />
          {/* Modal */}
          <div
            className="relative flex max-h-[90vh] w-full max-w-[900px] flex-col overflow-hidden rounded-xl bg-white"
            style={{
              boxShadow: '0px 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div className="flex-1 overflow-y-auto p-6">
              <ProgressSnapshotPanel
                nodeId={node.id}
                nodeTitle={title}
                onClose={() => setShowProgressSnapshot(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Track Analysis Chat Modal */}
      <TrackAnalysisChatModal
        isOpen={showWorkflowChatModal}
        onClose={() => setShowWorkflowChatModal(false)}
        nodeId={node.id}
      />
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
  const shouldShowAddButton = title === 'My tracks';

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
      <div className="flex flex-row gap-4 overflow-x-auto pb-2">
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
  const [isProfileAddModalOpen, setIsProfileAddModalOpen] = useState(false);
  const queryClient = useQueryClient();

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

  // Helper to check if a node has meaningful data (not an orphan/placeholder)
  const hasNodeMeaningfulData = (node: TimelineNodeWithPermissions): boolean => {
    const meta = node.meta || {};
    // Check for any meaningful metadata
    return !!(
      meta.title ||
      meta.name ||
      meta.role ||
      meta.company ||
      meta.organizationName ||
      meta.degree ||
      meta.description ||
      meta.label ||
      // Work tracks from desktop app have specific fields
      meta.jobTitle ||
      // Projects and work tracks have isWorkTrack flag
      meta.isWorkTrack
    );
  };

  // Separate root nodes (no parentId) into current and past experiences
  // Filter out nodes without meaningful data (orphan/placeholder nodes)
  const rootNodes = nodes.filter((node) => !node.parentId && hasNodeMeaningfulData(node));
  const currentRootNodes = rootNodes.filter((node) => !node.meta.endDate);

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
      <div className="flex-1 overflow-y-auto overflow-x-auto">
        <div className="flex min-h-full flex-col gap-6 bg-gray-50 p-4 sm:p-6 lg:p-8">
          <div className="flex max-w-none flex-col gap-4 sm:gap-6">
            {/* My tracks - Current */}
            <ExperienceSection
              title="My tracks"
              rootNodes={currentRootNodes}
              onAddExperience={() => setIsProfileAddModalOpen(true)}
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
