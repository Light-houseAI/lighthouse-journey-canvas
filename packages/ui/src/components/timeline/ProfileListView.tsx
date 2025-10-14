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
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';

import { hierarchyApi } from '../../services/hierarchy-api';
import { useAuthStore } from '../../stores/auth-store';
import { useProfileViewStore } from '../../stores/profile-view-store';
import { NodeIcon } from '../icons/NodeIcons';
import { MultiStepAddNodeModal } from '../modals/MultiStepAddNodeModal';
import { CareerUpdateWizard } from '../nodes/career-transition/wizard/CareerUpdateWizard';
import { ProfileHeader } from '../profile/ProfileHeader';

// Simple types for props
export interface ProfileListViewProps {
  username?: string;
  className?: string;
}

// TanStack Query keys for caching
const queryKeys = {
  timeline: (username?: string) => ['timeline', username || 'current'] as const,
};

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

// Generate meaningful titles for different node types
export const generateNodeTitle = (node: any) => {
  // If there's an explicit title, use it
  if (node.meta?.title) {
    return node.meta.title;
  }

  // Generate titles based on node type
  switch (node.type) {
    case 'job': {
      const company = node.meta?.organizationName || node.meta?.company;
      const role = node.meta?.role || node.meta?.position;
      if (role && company) {
        return `${role} at ${company}`;
      } else if (role) {
        return role;
      } else if (company) {
        return `Job at ${company}`;
      }
      return 'Job Experience';
    }

    case 'project': {
      if (node.meta?.description) {
        return node.meta.description;
      }
      return 'Project';
    }

    case 'education': {
      const meta = node.meta as Record<string, unknown> | undefined;
      const organizationName = String(
        meta?.organizationName ||
          meta?.institution ||
          meta?.school ||
          'Institution'
      );
      const degreeStr = meta?.degree ? String(meta.degree) : '';
      const fieldStr = meta?.field ? String(meta.field) : '';

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
        return String(node.meta.description);
      }
      return 'Event';
    }

    case 'careerTransition': {
      const meta = node.meta as Record<string, unknown> | undefined;
      const fromRoleStr = meta?.fromRole ? String(meta.fromRole) : '';
      const toRoleStr = meta?.toRole ? String(meta.toRole) : '';

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
        return String(node.meta.description);
      }
      return 'Action';
    }

    default:
      return node.meta?.description
        ? String(node.meta.description)
        : 'Experience';
  }
};

// Hierarchical node component with expand/collapse
const HierarchicalNode = ({
  node,
  allNodes,
  level = 0,
}: {
  node: Record<string, unknown>;
  allNodes: Record<string, unknown>[];
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
      setLocation(`/career-transition/${String(node.id)}`);
    }
  };

  return (
    <VStack spacing={2} className="flex flex-col">
      <div
        className={`group flex min-w-0 flex-col rounded-lg border border-gray-200 p-4 ${
          node.type === 'careerTransition'
            ? 'cursor-pointer transition-shadow hover:shadow-md'
            : ''
        }`}
        style={{ marginLeft: `${level * 1.25}rem` }}
        onClick={handleNodeClick}
      >
        <div className="flex min-w-0 items-start gap-3">
          {/* Node type icon */}
          <div className="mt-0.5 flex-shrink-0">
            <NodeIcon
              type={node.type as string}
              size={18}
              className={`flex-shrink-0 ${getNodeTypeIconColor(node.type as string)}`}
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
                        {node.meta?.company || node.meta?.organizationName}
                      </span>
                    </div>
                  )}

                  {/* School for education */}
                  {node.meta?.school && (
                    <div className="flex min-w-0 items-center gap-1.5 text-sm text-gray-600">
                      <GraduationCap size={14} className="flex-shrink-0" />
                      <span className="truncate">{node.meta.school}</span>
                    </div>
                  )}

                  {/* Location */}
                  {node.meta?.location && (
                    <div className="flex min-w-0 items-center gap-1.5 text-sm text-gray-500">
                      <MapPin size={14} className="flex-shrink-0" />
                      <span className="truncate">{node.meta.location}</span>
                    </div>
                  )}

                  {/* Duration */}
                  {formatDuration(node.meta?.startDate, node.meta?.endDate) && (
                    <div className="flex min-w-0 items-center gap-1.5 text-sm text-gray-500">
                      <Calendar size={14} className="flex-shrink-0" />
                      <span className="truncate">
                        {formatDuration(
                          node.meta?.startDate,
                          node.meta?.endDate
                        )}
                      </span>
                    </div>
                  )}

                  {/* Role for jobs */}
                  {node.meta?.role && node.type === 'job' && (
                    <div className="text-sm font-medium text-gray-600">
                      {node.meta.role}
                    </div>
                  )}

                  {/* Degree and field for education */}
                  {(node.meta?.degree || node.meta?.field) &&
                    node.type === 'education' && (
                      <div className="text-sm text-gray-600">
                        {node.meta?.degree && (
                          <span className="font-medium">
                            {node.meta.degree}
                          </span>
                        )}
                        {node.meta?.degree && node.meta?.field && (
                          <span> • </span>
                        )}
                        {node.meta?.field && <span>{node.meta.field}</span>}
                      </div>
                    )}

                  {/* Project type */}
                  {node.meta?.projectType && node.type === 'project' && (
                    <div className="flex">
                      <span className="inline-block rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700">
                        {node.meta.projectType}
                      </span>
                    </div>
                  )}
                </VStack>

                {/* Description */}
                {node.meta?.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-gray-600">
                    {node.meta.description}
                  </p>
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
              {(node as any).permissions?.canEdit && (
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
            insertionPoint: 'child',
            parentId: node.id as string,
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

// Experience section with hierarchical tree structure
const ExperienceSection = ({
  title,
  rootNodes,
  allNodes,
  onAddExperience,
}: {
  title: string;
  rootNodes: Record<string, unknown>[];
  allNodes: Record<string, unknown>[];
  onAddExperience?: () => void;
}) => {
  const shouldShowAddButton = title === 'Current Journeys';

  if (rootNodes.length === 0) {
    return (
      <div className="flex flex-col rounded-lg bg-neutral-100 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-[#2e2e2e]">{title}</h3>
          {shouldShowAddButton && onAddExperience && (
            <Button
              onClick={onAddExperience}
              variant="outline"
              className="gap-2"
            >
              <Plus className="size-[16px]" />
              <span className="text-sm font-medium text-[#2e2e2e]">
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
    <div className="flex flex-col rounded-lg bg-neutral-100 p-6">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-xl font-semibold text-[#2e2e2e]">{title}</h3>
        {shouldShowAddButton && onAddExperience && (
          <Button onClick={onAddExperience} variant="outline" className="gap-2">
            <Plus className="size-[16px]" />
            <span className="text-sm font-medium text-[#2e2e2e]">
              Add journey
            </span>
          </Button>
        )}
      </div>
      <div className="flex flex-col gap-4">
        {rootNodes.map((node) => (
          <HierarchicalNode
            key={node.id}
            node={node}
            allNodes={allNodes}
            level={0}
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
  const { user } = useAuthStore();
  const [isProfileAddModalOpen, setIsProfileAddModalOpen] = useState(false);

  // Get store functions
  const setAllNodes = useProfileViewStore((state) => state.setAllNodes);

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
        // Get other user's visible nodes
        return await hierarchyApi.listUserNodes(username as string);
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

  // Update the profile view store with the loaded nodes for ShareButton context
  useEffect(() => {
    setAllNodes(nodes);
  }, [nodes, setAllNodes]);

  // Separate root nodes (no parentId) into current and past experiences
  const rootNodes = nodes.filter((node) => !node.parentId);
  const currentRootNodes = rootNodes.filter((node) => !node.meta?.endDate);
  const pastRootNodes = rootNodes.filter((node) => node.meta?.endDate);

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
                name: username
                  ? `${username}'s Journey`
                  : user?.firstName && user?.lastName
                    ? `${user.firstName} ${user.lastName}'s Journey`
                    : user?.firstName
                      ? `${user.firstName}'s Journey`
                      : user?.userName
                        ? `${user.userName}'s Journey`
                        : "User's Journey",
                avatar: user?.avatar || '',
                description: '',
                title: '',
              }}
              profileUrl={window.location.href}
              showShareButton={true}
              showMoreOptions={true}
              isCurrentUser={isCurrentUser}
              onShare={() => {
                // Share functionality handled by ProfileHeader
              }}
            />

            {/* Current Journeys */}
            <ExperienceSection
              title="Current Journeys"
              rootNodes={currentRootNodes}
              allNodes={nodes}
              onAddExperience={() => setIsProfileAddModalOpen(true)}
            />

            {/* Past Experiences */}
            <ExperienceSection
              title="Past Experiences"
              rootNodes={pastRootNodes}
              allNodes={nodes}
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
            // Optionally refresh data here
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
