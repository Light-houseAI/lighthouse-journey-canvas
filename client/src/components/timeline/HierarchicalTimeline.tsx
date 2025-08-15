/**
 * HierarchicalTimeline - Main React Flow Component
 *
 * Provides the complete hierarchical timeline visualization using React Flow + Dagre.
 * Integrates with the UnifiedNode component and hierarchy store for a simplified,
 * meta-driven timeline experience.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Node,
  useNodesState,
  useEdgesState,
  addEdge,
  Controls,
  Connection,
  ReactFlowProvider,
  Panel,
  useReactFlow,
} from 'reactflow';

import 'reactflow/dist/style.css';

import { useHierarchyStore } from '../../stores/hierarchy-store';
import { HierarchyNodePanel } from './HierarchyNodePanel';
import {
  getLayoutedElements,
  filterNodesForLayout,
  generateTimelineEdges
} from '../../utils/layout';
import { JobNode, JobNodeData } from '../nodes/job/JobNode';
import { EducationNode, EducationNodeData } from '../nodes/education/EducationNode';
import { ProjectNode, ProjectNodeData } from '../nodes/project/ProjectNode';
import { EventNode, EventNodeData } from '../nodes/event/EventNode';
import { ActionNode, ActionNodeData } from '../nodes/action/ActionNode';
import { CareerTransitionNode, CareerTransitionNodeData } from '../nodes/career-transition/CareerTransitionNode';
import { MultiStepAddNodeModal } from '../modals/MultiStepAddNodeModal';
import { hierarchyApi, CreateNodePayload } from '../../services/hierarchy-api';
import { TimelineNodeType } from '@shared/schema';
import { FloatingActionButton } from '../ui/floating-action-button';


// Props for the hierarchical timeline
export interface HierarchicalTimelineProps {
  className?: string;
  style?: React.CSSProperties;
}

// Main Timeline Component (Inner)
const HierarchicalTimelineInner: React.FC<HierarchicalTimelineProps> = ({
  className = '',
  style = {},
}) => {
  const {
    nodes: hierarchyNodes,
    tree,
    loading,
    error,
    selectedNodeId,
    focusedNodeId,
    layoutDirection,
    expandedNodeIds,
    showPanel,

    // Actions
    loadNodes,
    selectNode,
    focusNode,
    clearFocus,
    toggleNodeExpansion,
    // Layout direction methods removed - forced to LR only


    // Getters
    hasChildren,
    isNodeExpanded,
  } = useHierarchyStore();

  const [reactFlowNodes, setReactFlowNodes, onNodesChange] = useNodesState([]);
  const [reactFlowEdges, setReactFlowEdges, onEdgesChange] = useEdgesState([]);
  const [showAddNodeModal, setShowAddNodeModal] = useState(false);
  const [addNodeContext, setAddNodeContext] = useState<{ parentId?: string; position: 'start' | 'end' | 'child' }>({ position: 'start' });

  // React Flow instance for programmatic control
  const { fitView: reactFlowFitView, getNodes } = useReactFlow();

  // Data loading handled by parent component
  // Zustand store automatically refreshes this component when data changes

  // Handle timeline plus button clicks
  const handleTimelineAdd = useCallback((position: 'start' | 'end', parentId?: string) => {
    setAddNodeContext({ position, parentId });
    setShowAddNodeModal(true);
  }, []);

  // Handle adding child node from UnifiedNode
  const handleAddChild = useCallback((parentNodeId: string) => {
    setAddNodeContext({ position: 'child', parentId: parentNodeId });
    setShowAddNodeModal(true);
  }, []);

  // Handle node focus with zoom to fit
  const handleNodeFocusWithZoom = useCallback((nodeId: string) => {
    focusNode(nodeId);

    // Wait for React Flow to update, then fit view to focused node and its children
    setTimeout(() => {
      const allNodes = getNodes();
      const focusedNodeData = hierarchyNodes.find(n => n.id === nodeId);

      if (!focusedNodeData) return;

      // Find all child nodes (including already expanded ones)
      const childNodeIds = hierarchyNodes
        .filter(node => node.parentId === nodeId)
        .map(node => node.id);

      // Include the focused node and its children
      const nodesToInclude = [nodeId, ...childNodeIds];
      const nodesToFit = allNodes.filter(node =>
        nodesToInclude.includes(node.data?.node?.id)
      );

      if (nodesToFit.length > 0) {
        // Use React Flow's fitView with specific nodes, accounting for side panel
        reactFlowFitView({
          nodes: nodesToFit,
          minZoom: 0.5,
          maxZoom: 1.5,
          padding: 0.3, // Extra padding to account for side panel
          duration: 600, // Smooth animation
        });
      } else {
        // If no children, just fit the single node
        const singleNodeToFit = allNodes.find(node =>
          node.data?.node?.id === nodeId
        );
        if (singleNodeToFit) {
          reactFlowFitView({
            nodes: [singleNodeToFit],
            minZoom: 0.8,
            maxZoom: 1.2,
            padding: 0.3,
            duration: 600,
          });
        }
      }
    }, 150);
  }, [focusNode, getNodes, hierarchyNodes, reactFlowFitView, expandedNodeIds]);
  // Handle node expansion with auto fit view to include parent and all children
  const handleNodeExpandWithFitView = useCallback((nodeId: string) => {
    // First expand the node
    toggleNodeExpansion(nodeId);

    // Wait for React Flow to update with new child nodes, then fit view
    setTimeout(() => {
      const allNodes = getNodes();
      const expandedNodeData = hierarchyNodes.find(n => n.id === nodeId);

      if (!expandedNodeData) return;

      // Find the parent node (if this is a child being expanded)
      const parentNodeId = expandedNodeData.parentId;

      // If this is a child node being expanded, include parent + all siblings + this node's children
      if (parentNodeId) {
        // Find parent
        const parentId = parentNodeId;
        // Find all siblings (other children of the same parent)
        const siblingNodeIds = hierarchyNodes
          .filter(node => node.parentId === parentId)
          .map(node => node.id);
        // Find this node's children
        const thisNodeChildrenIds = hierarchyNodes
          .filter(node => node.parentId === nodeId)
          .map(node => node.id);

        // Include parent + all siblings + this node's children
        const nodesToInclude = [parentId, ...siblingNodeIds, ...thisNodeChildrenIds];
        const nodesToFit = allNodes.filter(node =>
          nodesToInclude.includes(node.data?.node?.id)
        );

        if (nodesToFit.length > 1) {
          reactFlowFitView({
            nodes: nodesToFit,
            minZoom: 0.5,
            maxZoom: 1.0,
            padding: 0.3,
            duration: 600,
          });
        }
      } else {
        // This is a root node being expanded - include it and all its children
        const childNodeIds = hierarchyNodes
          .filter(node => node.parentId === nodeId)
          .map(node => node.id);

        const nodesToInclude = [nodeId, ...childNodeIds];
        const nodesToFit = allNodes.filter(node =>
          nodesToInclude.includes(node.data?.node?.id)
        );

        if (nodesToFit.length > 1) {
          reactFlowFitView({
            nodes: nodesToFit,
            minZoom: 0.6,
            maxZoom: 1.2,
            padding: 0.3,
            duration: 600,
          });
        }
      }
    }, 200);
  }, [toggleNodeExpansion, getNodes, hierarchyNodes, reactFlowFitView]);
  // Handle node collapse with safe fit view (only show remaining visible nodes)
  const handleNodeCollapseWithFitView = useCallback((nodeId: string) => {
    // First collapse the node
    toggleNodeExpansion(nodeId);

    // Wait for React Flow to update, then fit view to remaining visible nodes
    setTimeout(() => {
      const allNodes = getNodes();
      const collapsedNodeData = hierarchyNodes.find(n => n.id === nodeId);

      if (!collapsedNodeData) {
        console.warn('Collapsed node data not found:', nodeId);
        return;
      }

      const parentNodeId = collapsedNodeData.parentId;

      if (parentNodeId) {
        // This is a child node being collapsed - show parent + all siblings
        const parentNode = allNodes.find(node => node.data?.node?.id === parentNodeId);

        if (!parentNode) {
          console.warn('Parent node not found for collapsed child:', parentNodeId);
          // Fallback: just fit view to the collapsed node itself
          const nodeToFit = allNodes.find(node => node.data?.node?.id === nodeId);
          if (nodeToFit) {
            reactFlowFitView({
              nodes: [nodeToFit],
              minZoom: 0.8,
              maxZoom: 1.2,
              padding: 0.3,
              duration: 400,
            });
          }
          return;
        }

        const siblingNodeIds = hierarchyNodes
          .filter(node => node.parentId === parentNodeId)
          .map(node => node.id);

        const nodesToInclude = [parentNodeId, ...siblingNodeIds];
        const nodesToFit = allNodes.filter(node =>
          nodesToInclude.includes(node.data?.node?.id)
        );

        if (nodesToFit.length > 1) {
          reactFlowFitView({
            nodes: nodesToFit,
            minZoom: 0.6,
            maxZoom: 1.2,
            padding: 0.3,
            duration: 400,
          });
        }
      } else {
        // This is a root node being collapsed - fit view to show all root nodes
        console.log('Collapsing root node:', nodeId);

        // Get all root nodes (nodes without parents) that are currently visible
        const rootNodeIds = hierarchyNodes
          .filter(node => !node.parentId)
          .map(node => node.id);

        const rootNodesToFit = allNodes.filter(node =>
          rootNodeIds.includes(node.data?.node?.id)
        );

        if (rootNodesToFit.length > 0) {
          reactFlowFitView({
            nodes: rootNodesToFit,
            minZoom: 0.5,
            maxZoom: 1.0,
            padding: 0.3,
            duration: 400,
          });
        } else {
          // Fallback: fit to just the collapsed node
          const nodeToFit = allNodes.find(node => node.data?.node?.id === nodeId);
          if (nodeToFit) {
            reactFlowFitView({
              nodes: [nodeToFit],
              minZoom: 0.8,
              maxZoom: 1.2,
              padding: 0.3,
              duration: 400,
            });
          }
        }
      }
    }, 150); // Shorter delay for collapse
  }, [toggleNodeExpansion, getNodes, hierarchyNodes, reactFlowFitView]);;

  // Convert hierarchy data to React Flow format with Dagre layout
  const flowData = useMemo(() => {
    if (hierarchyNodes.length === 0) {
      return { nodes: [], edges: [] };
    }

    // Filter nodes based on expansion state
    // Transform hierarchy nodes to React Flow nodes with proper parent-child relationships
    const reactFlowNodes = hierarchyNodes.map(node => {
      const nodeHasChildren = hasChildren(node.id);
      const isChildNode = !!node.parentId;

      return {
        id: node.id,
        type: node.type,
        position: { x: 0, y: 0 }, // Initial position - will be set by layout
        draggable: false, // Disable dragging for all nodes
        data: {
          node,
          isSelected: selectedNodeId === node.id,
          isFocused: focusedNodeId === node.id,
          isExpanded: isNodeExpanded(node.id),
          hasChildren: nodeHasChildren,
          onSelect: () => selectNode(node.id),
          onFocus: () => handleNodeFocusWithZoom(node.id),
          onExpand: () => handleNodeExpandWithFitView(node.id),
          onCollapse: () => handleNodeCollapseWithFitView(node.id),
          onAddChild: () => handleAddChild(node.id),
          // Add handle configuration for parent-child connections (like main branch)
          handles: {
            left: true,    // Standard horizontal connections
            right: true,   // Standard horizontal connections
            bottom: nodeHasChildren,  // Bottom handle if this node has children
            top: isChildNode,         // Top handle if this node has a parent
          },
        },
        // Use React Flow's parent-child system for proper positioning
        parentId: isChildNode ? node.parentId : undefined,
        // Don't use extent: 'parent' - let React Flow position children freely
      };
    });

    const visibleNodes = filterNodesForLayout(reactFlowNodes, expandedNodeIds);

    // Generate hierarchy edges for parent-child relationships
    const hierarchyEdges = tree.edges.filter(edge => {
      // Include edge if both nodes are visible
      const sourceVisible = visibleNodes.some(node => (node.data as any).node.id === edge.source);
      const targetVisible = visibleNodes.some(node => (node.data as any).node.id === edge.target);
      return sourceVisible && targetVisible;
    });

    // Generate timeline edges (including chronological connections)
    const timelineEdges = generateTimelineEdges(visibleNodes, hierarchyEdges);

    // Use only the visible timeline nodes (no plus buttons)
    const allNodes = visibleNodes;

    // Apply Dagre layout with timeline-specific configuration
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      allNodes as Node[],
      timelineEdges,
      layoutDirection // Use store's layout direction
    );

    return { nodes: layoutedNodes, edges: layoutedEdges };
  }, [
    hierarchyNodes,
    tree,
    selectedNodeId,
    focusedNodeId,
    expandedNodeIds, // This needs to trigger re-calculation
    layoutDirection,
    isNodeExpanded,
    hasChildren,
    selectNode,
    handleNodeFocusWithZoom,
    toggleNodeExpansion,
    handleNodeExpandWithFitView,
    handleNodeCollapseWithFitView,
    handleTimelineAdd,
  ]);

  // Update React Flow state when data changes
  useEffect(() => {
    setReactFlowNodes(flowData.nodes);
    setReactFlowEdges(flowData.edges);
  }, [flowData, setReactFlowNodes, setReactFlowEdges]);

  // Handle background click to clear focus
  const handleBackgroundClick = useCallback(() => {
    if (hierarchyNodes.length === 0) {
      // If empty canvas, show add node modal
      handleTimelineAdd('start');
    } else if (focusedNodeId) {
      // If focused node exists, clear focus
      clearFocus();
    }
  }, [hierarchyNodes.length, focusedNodeId, clearFocus]);

  // Handle connection (not used but required by React Flow)
  const onConnect = useCallback(
    (params: Connection) => setReactFlowEdges((eds) => addEdge(params, eds)),
    [setReactFlowEdges],
  );

  // Enhanced node types for timeline
  const nodeTypes = useMemo(() => ({
    [TimelineNodeType.Job]: JobNode,
    [TimelineNodeType.Education]: EducationNode,
    [TimelineNodeType.Project]: ProjectNode,
    [TimelineNodeType.Event]: EventNode,
    [TimelineNodeType.Action]: ActionNode,
    [TimelineNodeType.CareerTransition]: CareerTransitionNode,
  }), []);

  // Loading state
  if (loading && hierarchyNodes.length === 0) {
    return (
      <div className={`h-full flex items-center justify-center ${className}`} style={style}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading hierarchy...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`h-full flex items-center justify-center ${className}`} style={style}>
        <div className="text-center">
          <div className="text-red-500 mb-4 text-6xl">⚠️</div>
          <p className="text-red-600 font-medium">Failed to load timeline</p>
          <p className="text-gray-600 text-sm">{error}</p>
          <button
            onClick={() => loadNodes()}
            className="group relative mt-4 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium rounded-xl shadow-lg transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/25 overflow-hidden"
          >
            {/* Magic UI shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <span className="relative z-10">Retry</span>
          </button>
        </div>
      </div>
    );
  }

  // Empty state - clean, simple
  if (hierarchyNodes.length === 0) {
    return (
      <div className={`h-full relative ${className}`} style={style}>
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <div className="text-gray-400 mb-4 text-6xl">📊</div>
            <p className="text-gray-600 font-medium mb-4">Create your first timeline node</p>
            <button
              onClick={() => handleTimelineAdd('start')}
              className="group relative inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium rounded-xl shadow-xl transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/25 overflow-hidden"
            >
              {/* Magic UI shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <span className="relative z-10 text-xl mr-3">✨</span>
              <span className="relative z-10">Start Timeline</span>
            </button>
          </div>
        </div>

        {/* Background for empty canvas click */}
        <div
          className="absolute inset-0 cursor-pointer"
          onClick={handleBackgroundClick}
        />
      </div>
    );
  }

  return (
    <div className={`h-full relative ${className}`} style={style}>

      {/* React Flow with hierarchical layout */}
      <ReactFlow
        nodes={reactFlowNodes}
        edges={reactFlowEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneClick={handleBackgroundClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{
          padding: 0.2,
          includeHiddenNodes: false,
        }}
        minZoom={0.1}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
      >
        <Controls />
        {/* Custom clear focus button - positioned to avoid side panel */}
        {focusedNodeId && (
          <Panel position="top-left" className="bg-gradient-to-r from-white via-slate-50 to-white rounded-xl shadow-xl border border-slate-200/50 backdrop-blur-sm m-4">
            <button
              onClick={() => {
                clearFocus();
                // Fit view to show all nodes after clearing focus, accounting for side panel
                reactFlowFitView({
                  padding: 0.3, // Extra padding to account for side panel
                  includeHiddenNodes: false,
                  duration: 500,
                });
              }}
              className="group relative flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-700 hover:text-slate-900 rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-slate-500/25 overflow-hidden"
              title="Clear Focus - Return to full timeline view"
            >
              {/* Magic UI shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-200/50 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-slate-100/50 via-slate-200/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <svg className="relative z-10 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className="relative z-10">Clear Focus</span>
            </button>
          </Panel>
        )}
      </ReactFlow>

      {/* Side panel */}
      {showPanel && selectedNodeId && (
        <HierarchyNodePanel />
      )}

      {/* Timeline Add Node Modal */}
      {showAddNodeModal && (
        <MultiStepAddNodeModal
          isOpen={showAddNodeModal}
          onClose={() => setShowAddNodeModal(false)}
          onSubmit={async (data) => {
            try {
              // Create the node payload from modal data
              // Filter out only the fields that belong in meta based on node type (from shared schema)
              const getMetaFields = (nodeType: string, formData: any) => {
                // Remove undefined values to keep the meta clean
                const cleanValue = (value: any) => value === undefined ? undefined : value;

                switch (nodeType) {
                  case TimelineNodeType.Project:
                    // Based on projectCreateSchema from shared/schema.ts
                    return {
                      description: cleanValue(formData.description),
                      technologies: formData.technologies || [],
                      projectType: cleanValue(formData.projectType),
                      startDate: cleanValue(formData.startDate || formData.start),
                      endDate: cleanValue(formData.endDate || formData.end),
                    };
                  case TimelineNodeType.Job:
                    // Based on jobMetaSchema from shared/schema.ts
                    return {
                      company: cleanValue(formData.company),
                      role: cleanValue(formData.role),
                      location: cleanValue(formData.location),
                      description: cleanValue(formData.description),
                      startDate: cleanValue(formData.startDate || formData.start),
                      endDate: cleanValue(formData.endDate || formData.end),
                    };
                  case TimelineNodeType.Education:
                    // Based on educationCreateSchema from shared/schema.ts
                    return {
                      institution: cleanValue(formData.institution),
                      degree: cleanValue(formData.degree),
                      field: cleanValue(formData.field),
                      location: cleanValue(formData.location),
                      startDate: cleanValue(formData.startDate || formData.start),
                      endDate: cleanValue(formData.endDate || formData.end),
                    };
                  case TimelineNodeType.Event:
                    // Based on eventCreateSchema from shared/schema.ts
                    return {
                      eventType: cleanValue(formData.eventType),
                      location: cleanValue(formData.location),
                      organizer: cleanValue(formData.organizer),
                      startDate: cleanValue(formData.startDate || formData.start),
                      endDate: cleanValue(formData.endDate || formData.end),
                    };
                  case TimelineNodeType.Action:
                    // Based on actionCreateSchema from shared/schema.ts
                    return {
                      category: cleanValue(formData.category),
                      impact: cleanValue(formData.impact),
                      verification: cleanValue(formData.verification),
                      startDate: cleanValue(formData.startDate || formData.start),
                      endDate: cleanValue(formData.endDate || formData.end),
                    };
                  case TimelineNodeType.CareerTransition:
                    // Based on careerTransitionCreateSchema from shared/schema.ts
                    return {
                      startDate: cleanValue(formData.startDate || formData.start),
                      endDate: cleanValue(formData.endDate || formData.end),
                    };
                  default:
                    // For unknown types, return only basic fields
                    return {
                      description: cleanValue(formData.description),
                      startDate: cleanValue(formData.startDate || formData.start),
                      endDate: cleanValue(formData.endDate || formData.end),
                    };
                }
              };

              const nodePayload: CreateNodePayload = {
                type: data.type,
                ...(addNodeContext.parentId && { parentId: addNodeContext.parentId }),
                meta: {
                  ...getMetaFields(data.type, data),
                  title: data.title || `New ${data.type}`
                }
              };

              // Create the node via API
              const newNode = await hierarchyApi.createNode(nodePayload);
              console.log('Node created successfully:', newNode);

              // Reload the hierarchy to show the new node
              await loadNodes();

              // Close the modal
              setShowAddNodeModal(false);

              // Select the new node if it was created
              if (newNode.id) {
                selectNode(newNode.id);
              }
            } catch (error) {
              console.error('Failed to create node:', error);
              throw error; // Re-throw so modal can handle the error
            }
          }}
          context={{
            insertionPoint: addNodeContext.position === 'child' ? 'branch' : 'after',
            parentNode: addNodeContext.parentId ? (() => {
              const parentNode = hierarchyNodes.find(n => n.id === addNodeContext.parentId);
              return parentNode ? {
                id: parentNode.id,
                title: parentNode.meta.title,
                type: parentNode.type
              } : undefined;
            })() : undefined,
            availableTypes: [TimelineNodeType.Job, TimelineNodeType.Education, TimelineNodeType.Project, TimelineNodeType.Event, TimelineNodeType.Action, TimelineNodeType.CareerTransition],
            suggestedData: {
              position: addNodeContext.position,
              parentId: addNodeContext.parentId
            }
          }}
        />
      )}

      {/* Loading overlay for operations */}
      {loading && hierarchyNodes.length > 0 && (
        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="relative bg-gradient-to-r from-white via-slate-50 to-white rounded-xl p-6 shadow-2xl border border-slate-200/50 backdrop-blur-sm">
            {/* Subtle background effects */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-purple-500/5 rounded-xl"></div>
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-400/50 to-transparent"></div>
            
            <div className="relative z-10 flex flex-col items-center">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200 border-t-blue-500 mb-3"></div>
              <p className="text-sm text-slate-600 font-medium">Processing...</p>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Button - Add Node */}
      <FloatingActionButton
        onClick={() => handleTimelineAdd('end')}
        className="fixed bottom-6 right-20 z-50"
        title="Add Timeline Node"
        shimmerColor="#ffffff"
        shimmerDuration="4s"
      />
    </div>
  );
};

// Main Hierarchical Timeline Component
const HierarchicalTimeline: React.FC<HierarchicalTimelineProps> = (props) => {
  return (
    <ReactFlowProvider>
      <HierarchicalTimelineInner {...props} />
    </ReactFlowProvider>
  );
};

export { HierarchicalTimeline };
