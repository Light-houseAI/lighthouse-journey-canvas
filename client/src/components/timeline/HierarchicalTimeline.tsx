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
  Edge,
  useNodesState,
  useEdgesState,
  addEdge,
  Controls,
  Background,
  BackgroundVariant,
  Connection,
  ReactFlowProvider,
  Panel,
  NodeProps,
  useReactFlow,
  Handle,
  Position,
} from 'reactflow';

import 'reactflow/dist/style.css';

import { useHierarchyStore } from '../../stores/hierarchy-store';
import { HierarchyNodePanel } from './HierarchyNodePanel';
import {
  getLayoutedElements,
  sortNodesByDate,
  filterNodesForLayout,
  generateTimelineEdges
} from '../../utils/layout';
import { UnifiedNode, UnifiedNodeData } from './UnifiedNode';
import { MultiStepAddNodeModal } from '../modals/MultiStepAddNodeModal';
import { hierarchyApi, CreateNodePayload } from '../../services/hierarchy-api';

// Timeline Plus Button Data Interface
export interface TimelinePlusButtonData extends Record<string, unknown> {
  type: 'start' | 'end';
  parentId?: string;
  level: number;
  onClick: () => void;
}

// Timeline Plus Button Component
const TimelinePlusButton: React.FC<NodeProps<TimelinePlusButtonData>> = ({ data }) => {
  const { type, onClick } = data;

  return (
    <div className="relative">
      {/* Connection handles for React Flow */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{ background: '#3b82f6', border: 'none', width: 8, height: 8 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{ background: '#3b82f6', border: 'none', width: 8, height: 8 }}
      />

      <button
        onClick={onClick}
        className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-xl transition-all duration-300 transform hover:scale-110 flex items-center justify-center border-3 border-white/20 backdrop-blur-sm"
        title={type === 'start' ? 'Start Timeline' : 'Continue Timeline'}
        style={{
          background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
          border: '3px dashed rgba(59, 130, 246, 0.6)',
          boxShadow: '0 8px 25px rgba(59, 130, 246, 0.3), 0 4px 10px rgba(0, 0, 0, 0.2)',
        }}
      >
        <span className="text-2xl font-bold drop-shadow-sm">⊕</span>
      </button>
    </div>
  );
};

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

  // Load data on mount
  useEffect(() => {
    loadNodes();
  }, [loadNodes]);

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
        type: 'unified',
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
      const sourceVisible = visibleNodes.some(node => (node.data as unknown as UnifiedNodeData).node.id === edge.source);
      const targetVisible = visibleNodes.some(node => (node.data as unknown as UnifiedNodeData).node.id === edge.target);
      return sourceVisible && targetVisible;
    });

    // Generate timeline edges (including chronological connections)
    const timelineEdges = generateTimelineEdges(visibleNodes, hierarchyEdges);

    // Add plus button nodes for timeline start/end
    const plusButtonNodes: Node<TimelinePlusButtonData>[] = [];

    // Add timeline start plus button (only for root level)
    if (visibleNodes.length > 0) {
      plusButtonNodes.push({
        id: 'timeline-start-plus',
        type: 'timelinePlus',
        position: { x: 0, y: 0 }, // Will be positioned by Dagre
        draggable: false, // Disable dragging for plus buttons
        data: {
          type: 'start',
          level: 0,
          onClick: () => handleTimelineAdd('start'),
        },
      });

      plusButtonNodes.push({
        id: 'timeline-end-plus',
        type: 'timelinePlus',
        position: { x: 0, y: 0 }, // Will be positioned by Dagre
        draggable: false, // Disable dragging for plus buttons
        data: {
          type: 'end',
          level: 0,
          onClick: () => handleTimelineAdd('end'),
        },
      });
    }

    // Combine all nodes
    const allNodes = [...visibleNodes, ...plusButtonNodes];

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

  // Enhanced node types including timeline plus buttons
  const nodeTypes = useMemo(() => ({
    unified: UnifiedNode,
    timelinePlus: TimelinePlusButton,
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
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
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
              className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-lg transition-all duration-200"
            >
              <span className="text-xl mr-2">⊕</span>
              Start Timeline
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
          <Panel position="top-left" className="bg-white rounded-lg shadow-lg border border-gray-200 m-4">
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
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
              title="Clear Focus - Return to full timeline view"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear Focus
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
                  case 'project':
                    // Based on projectCreateSchema from shared/schema.ts
                    return {
                      description: cleanValue(formData.description),
                      technologies: formData.technologies || [],
                      projectType: cleanValue(formData.projectType),
                      startDate: cleanValue(formData.startDate || formData.start),
                      endDate: cleanValue(formData.endDate || formData.end),
                    };
                  case 'job':
                    // Based on jobCreateSchema from shared/schema.ts
                    return {
                      company: cleanValue(formData.company),
                      position: cleanValue(formData.position),
                      location: cleanValue(formData.location),
                      startDate: cleanValue(formData.startDate || formData.start),
                      endDate: cleanValue(formData.endDate || formData.end),
                    };
                  case 'education':
                    // Based on educationCreateSchema from shared/schema.ts
                    return {
                      institution: cleanValue(formData.institution),
                      degree: cleanValue(formData.degree),
                      field: cleanValue(formData.field),
                      location: cleanValue(formData.location),
                      startDate: cleanValue(formData.startDate || formData.start),
                      endDate: cleanValue(formData.endDate || formData.end),
                    };
                  case 'event':
                    // Based on eventCreateSchema from shared/schema.ts
                    return {
                      eventType: cleanValue(formData.eventType),
                      location: cleanValue(formData.location),
                      organizer: cleanValue(formData.organizer),
                      startDate: cleanValue(formData.startDate || formData.start),
                      endDate: cleanValue(formData.endDate || formData.end),
                    };
                  case 'action':
                    // Based on actionCreateSchema from shared/schema.ts
                    return {
                      category: cleanValue(formData.category),
                      impact: cleanValue(formData.impact),
                      verification: cleanValue(formData.verification),
                      startDate: cleanValue(formData.startDate || formData.start),
                      endDate: cleanValue(formData.endDate || formData.end),
                    };
                  case 'careerTransition':
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
                label: data.title || data.label || `New ${data.type}`,
                ...(addNodeContext.parentId && { parentId: addNodeContext.parentId }),
                meta: getMetaFields(data.type, data)
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
                title: parentNode.label,
                type: parentNode.type
              } : undefined;
            })() : undefined,
            availableTypes: ['job', 'education', 'project', 'event', 'action', 'careerTransition'],
            suggestedData: {
              position: addNodeContext.position,
              parentId: addNodeContext.parentId
            }
          }}
        />
      )}

      {/* Loading overlay for operations */}
      {loading && hierarchyNodes.length > 0 && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-lg p-4 shadow-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Processing...</p>
          </div>
        </div>
      )}
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
