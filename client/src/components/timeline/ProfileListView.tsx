import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, RefreshCw, ChevronRight, ChevronDown, MapPin, Calendar, Building, GraduationCap, Plus } from 'lucide-react';

import { hierarchyApi } from '../../services/hierarchy-api';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import { useProfileViewStore } from '../../stores/profile-view-store';
import { useAuthStore } from '../../stores/auth-store';
import { NodeIcon } from '../icons/NodeIcons';
import { ProjectNodePanel } from '../nodes/project/ProjectNodePanel';
import { JobNodePanel } from '../nodes/job/JobNodePanel';
import { EducationNodePanel } from '../nodes/education/EducationNodePanel';
import { EventNodePanel } from '../nodes/event/EventNodePanel';
import { CareerTransitionNodePanel } from '../nodes/career-transition/CareerTransitionNodePanel';
import { ActionNodePanel } from '../nodes/action/ActionNodePanel';
import { MultiStepAddNodeModal } from '../modals/MultiStepAddNodeModal';

// Simple types for props
export interface ProfileListViewProps {
  username?: string;
  className?: string;
}

// TanStack Query keys for caching
const queryKeys = {
  timeline: (username?: string) => ['timeline', username || 'current'] as const,
};

// Get appropriate icon color based on node type to match panel colors
const getNodeTypeIconColor = (type: string) => {
  switch (type) {
    case 'job':
      return 'text-cyan-600'; // Matches JobNodePanel cyan theme
    case 'project':
      return 'text-purple-600'; // Matches ProjectNodePanel purple theme  
    case 'education':
      return 'text-blue-600';
    case 'event':
      return 'text-yellow-600';
    case 'careerTransition':
      return 'text-violet-600'; // Matches CareerTransitionNodePanel violet theme
    case 'action':
      return 'text-green-600';
    default:
      return 'text-gray-600';
  }
};

// Format duration in a more readable way
const formatDuration = (startDate?: string, endDate?: string) => {
  if (!startDate && !endDate) return null;
  
  const start = startDate ? new Date(startDate).toLocaleDateString('en-US', { 
    month: 'short', 
    year: 'numeric' 
  }) : null;
  
  const end = endDate ? new Date(endDate).toLocaleDateString('en-US', { 
    month: 'short', 
    year: 'numeric' 
  }) : 'Present';
  
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
const generateNodeTitle = (node: any) => {
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
      // Use same logic as EducationNodePanel.tsx
      const organizationName = (node.meta as Record<string, unknown>)?.organizationName || (node.meta as Record<string, unknown>)?.institution || (node.meta as Record<string, unknown>)?.school || 'Institution';
      const degree = node.meta?.degree;
      const field = node.meta?.field;
      
      if (degree && organizationName !== 'Institution') {
        return field 
          ? `${degree} in ${field} at ${organizationName}`
          : `${degree} at ${organizationName}`;
      } else if (degree) {
        return field ? `${degree} in ${field}` : degree;
      } else if (organizationName !== 'Institution') {
        return organizationName;
      }
      return 'Education';
    }
      
    case 'event': {
      if (node.meta?.description) {
        return node.meta.description;
      }
      return 'Event';
    }
      
    case 'careerTransition': {
      const fromRole = (node.meta as Record<string, unknown>)?.fromRole;
      const toRole = (node.meta as Record<string, unknown>)?.toRole;
      if (fromRole && toRole) {
        return `${fromRole} to ${toRole}`;
      } else if (toRole) {
        return `Transition to ${toRole}`;
      } else if (fromRole) {
        return `Transition from ${fromRole}`;
      }
      return 'Career Transition';
    }
      
    case 'action': {
      if (node.meta?.description) {
        return node.meta.description;
      }
      return 'Action';
    }
      
    default:
      return node.meta?.description || 'Experience';
  }
};

// Hierarchical node component with expand/collapse
const HierarchicalNode = ({ 
  node, 
  allNodes, 
  level = 0 
}: { 
  node: Record<string, unknown>; 
  allNodes: Record<string, unknown>[]; 
  level?: number;
}) => {
  const expandedNodeIds = useProfileViewStore((state) => state.expandedNodeIds);
  const toggleNodeExpansion = useProfileViewStore((state) => state.toggleNodeExpansion);
  const openPanel = useProfileViewStore((state) => state.openPanel);
  const selectedNodeId = useProfileViewStore((state) => state.selectedNodeId);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // Find children of this node
  const children = allNodes.filter(n => n.parentId === node.id);
  const hasChildren = children.length > 0;
  const isExpanded = expandedNodeIds.has(node.id);
  const isSelected = selectedNodeId === node.id;
  
  const handleToggleExpansion = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      toggleNodeExpansion(node.id);
    }
  };
  
  const handleNodeClick = () => {
    openPanel(node.id, 'view');
  };
  
  return (
    <div className="flex flex-col space-y-2">
      <div 
        className={`group flex flex-col border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-all duration-200 min-w-0 ${
          isSelected ? 'bg-blue-50 border-blue-300 shadow-sm' : 'border-gray-200'
        }`}
        style={{ marginLeft: `${level * 1.25}rem` }}
        onClick={handleNodeClick}
      >
        <div className="flex items-start gap-3 min-w-0">
          {/* Expansion button and Add button */}
          <div className="flex-shrink-0 mt-0.5 flex items-center gap-1">
            {hasChildren ? (
              <button 
                onClick={handleToggleExpansion}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-gray-600" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-600" />
                )}
              </button>
            ) : (
              <div className="w-6 h-6 flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-gray-300 rounded-full"></div>
              </div>
            )}
            
            {/* Add sub-experience button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsAddModalOpen(true);
              }}
              className="p-1 hover:bg-gray-100 rounded transition-colors opacity-0 group-hover:opacity-100"
              title="Add sub-experience"
            >
              <Plus className="h-3 w-3 text-gray-500" />
            </button>
          </div>

          {/* Node type icon */}
          <div className="flex-shrink-0 mt-0.5">
            <NodeIcon 
              type={node.type as string} 
              size={18} 
              className={`flex-shrink-0 ${getNodeTypeIconColor(node.type as string)}`} 
            />
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                {/* Title */}
                <h4 className="font-semibold text-gray-900 leading-snug">
                  {generateNodeTitle(node)}
                </h4>

                {/* Subtitle fields based on node type */}
                <div className="flex flex-col mt-1 space-y-1">
                  {/* Company/Organization */}
                  {(node.meta?.company || node.meta?.organizationName) && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-600 min-w-0">
                      <Building size={14} className="flex-shrink-0" />
                      <span className="truncate">{node.meta?.company || node.meta?.organizationName}</span>
                    </div>
                  )}

                  {/* School for education */}
                  {node.meta?.school && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-600 min-w-0">
                      <GraduationCap size={14} className="flex-shrink-0" />
                      <span className="truncate">{node.meta.school}</span>
                    </div>
                  )}

                  {/* Location */}
                  {node.meta?.location && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-500 min-w-0">
                      <MapPin size={14} className="flex-shrink-0" />
                      <span className="truncate">{node.meta.location}</span>
                    </div>
                  )}

                  {/* Duration */}
                  {formatDuration(node.meta?.startDate, node.meta?.endDate) && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-500 min-w-0">
                      <Calendar size={14} className="flex-shrink-0" />
                      <span className="truncate">{formatDuration(node.meta?.startDate, node.meta?.endDate)}</span>
                    </div>
                  )}

                  {/* Role for jobs */}
                  {node.meta?.role && node.type === 'job' && (
                    <div className="text-sm text-gray-600 font-medium">
                      {node.meta.role}
                    </div>
                  )}

                  {/* Degree and field for education */}
                  {(node.meta?.degree || node.meta?.field) && node.type === 'education' && (
                    <div className="text-sm text-gray-600">
                      {node.meta?.degree && <span className="font-medium">{node.meta.degree}</span>}
                      {node.meta?.degree && node.meta?.field && <span> • </span>}
                      {node.meta?.field && <span>{node.meta.field}</span>}
                    </div>
                  )}

                  {/* Project type */}
                  {node.meta?.projectType && node.type === 'project' && (
                    <div className="flex">
                      <span className="inline-block px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full font-medium">
                        {node.meta.projectType}
                      </span>
                    </div>
                  )}
                </div>

                {/* Description */}
                {node.meta?.description && (
                  <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                    {node.meta.description}
                  </p>
                )}
              </div>

              {/* Node type badge */}
              <div className="flex-shrink-0">
                <span className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full font-medium capitalize">
                  {node.type === 'careerTransition' ? 'transition' : node.type}
                </span>
              </div>
            </div>
          </div>
        </div>
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
      
      {/* Add Node Modal */}
      {isAddModalOpen && (
        <MultiStepAddNodeModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={() => {
            setIsAddModalOpen(false);
            // Optionally refresh data here
          }}
          context={{
            insertionPoint: 'branch',
            parentNode: {
              id: node.id,
              title: generateNodeTitle(node),
              type: node.type
            },
            availableTypes: ['job', 'project', 'education', 'event', 'careerTransition', 'action']
          }}
        />
      )}
    </div>
  );
};

// Experience section with hierarchical tree structure
const ExperienceSection = ({ 
  title, 
  rootNodes,
  allNodes 
}: { 
  title: string; 
  rootNodes: Record<string, unknown>[];
  allNodes: Record<string, unknown>[];
}) => {
  if (rootNodes.length === 0) {
    return (
      <div className="flex flex-col bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-500 text-sm">No {title.toLowerCase()} found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-white rounded-lg shadow p-4">
      <h3 className="text-lg font-medium text-gray-900 mb-4">{title}</h3>
      <div className="flex flex-col space-y-3">
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
export function ProfileListViewContainer({ username, className }: ProfileListViewProps) {
  const isCurrentUser = !username;
  const { user } = useAuthStore();
  const [isProfileAddModalOpen, setIsProfileAddModalOpen] = useState(false);
  
  // Get panel state from Zustand store
  const isPanelOpen = useProfileViewStore((state) => state.isPanelOpen);
  const panelNodeId = useProfileViewStore((state) => state.panelNodeId);
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
      if (message.includes('401') || message.includes('403') || message.includes('unauthorized')) {
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
  const rootNodes = nodes.filter(node => !node.parentId);
  const currentRootNodes = rootNodes.filter(node => !node.meta?.endDate);
  const pastRootNodes = rootNodes.filter(node => node.meta?.endDate);

  // Loading state
  if (isLoading) {
    return (
      <div className={className}>
        <div className="p-6 space-y-6">
          <div className="animate-pulse">
            <div className="bg-gray-200 rounded-lg p-4 mb-6">
              <div className="h-6 bg-gray-300 rounded mb-4"></div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                <div className="h-4 bg-gray-300 rounded w-1/2"></div>
              </div>
            </div>
            <div className="bg-gray-200 rounded-lg p-4">
              <div className="h-6 bg-gray-300 rounded mb-4"></div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                <div className="h-4 bg-gray-300 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    const isAuthError = error.message.toLowerCase().includes('401') || 
                       error.message.toLowerCase().includes('unauthorized');

    return (
      <div className={className}>
        <div className="p-6">
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <div className="space-y-2">
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
                  className="text-red-600 border-red-300 hover:bg-red-100"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  {isAuthError ? 'Sign In' : 'Try Again'}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  // Success state - show profile data
  return (
    <div className={`${className} flex flex-col h-full`}>
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col p-6 space-y-6 bg-gray-50 min-h-full">
          <div className="flex-1">
          {/* Profile summary */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                {username ? `${username}'s Profile` : 
                 user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}'s Profile` :
                 user?.firstName ? `${user.firstName}'s Profile` :
                 user?.userName ? `${user.userName}'s Profile` :
                 'Profile'}
              </h2>
              {isCurrentUser && (
                <Button
                  onClick={() => setIsProfileAddModalOpen(true)}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Add Experience
                </Button>
              )}
            </div>
          </div>

          {/* Current Experiences */}
          <ExperienceSection 
            title="Current Experiences" 
            rootNodes={currentRootNodes}
            allNodes={nodes}
          />

          {/* Past Experiences */}
          <ExperienceSection 
            title="Past Experiences" 
            rootNodes={pastRootNodes}
            allNodes={nodes}
          />

          {/* Empty state */}
          {nodes.length === 0 && (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-500">No timeline data found</p>
              {!username && (
                <p className="text-sm text-gray-400 mt-2">
                  Start building your professional journey timeline
                </p>
              )}
            </div>
          )}
          
          {/* Spacer to ensure last item can scroll to bottom */}
          <div className="h-32"></div>
          </div>
        </div>
      </div>
      
      {/* Node Panel - Render appropriate panel based on selected node */}
      {isPanelOpen && panelNodeId && (() => {
        const selectedNode = nodes.find(node => node.id === panelNodeId);
        if (!selectedNode) return null;
        
        // Render appropriate panel based on node type
        switch (selectedNode.type) {
          case 'project':
            return <ProjectNodePanel node={selectedNode} />;
          case 'job':
            return <JobNodePanel node={selectedNode} />;
          case 'education':
            return <EducationNodePanel node={selectedNode} />;
          case 'event':
            return <EventNodePanel node={selectedNode} />;
          case 'careerTransition':
            return <CareerTransitionNodePanel node={selectedNode} />;
          case 'action':
            return <ActionNodePanel node={selectedNode} />;
        }
        
        // Fallback debug panel for other types
        return (
          <div className="fixed right-0 top-0 h-full w-96 z-50 bg-white shadow-lg border-l border-gray-200">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">
                {generateNodeTitle(selectedNode)}
              </h3>
              <p className="text-sm text-gray-600 mb-2">Type: {selectedNode.type}</p>
              <p className="text-sm text-gray-600">ID: {selectedNode.id}</p>
              {selectedNode.meta?.description && (
                <p className="mt-4 text-gray-700">{selectedNode.meta.description}</p>
              )}
            </div>
          </div>
        );
      })()}
      
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
            availableTypes: ['job', 'project', 'education', 'event', 'careerTransition', 'action']
          }}
        />
      )}
    </div>
  );
}

export { ProfileListViewContainer as ProfileListView };