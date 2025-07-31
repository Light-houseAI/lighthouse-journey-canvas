import React, { useMemo, useEffect } from 'react';
import { ReactFlow, Background, BackgroundVariant, Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useDataStore } from '@/stores/data-store';
import { useNodeFocusStore } from '@/stores/node-focus-store';
import { useNodeSelectionStore } from '@/stores/node-selection-store';
import { useNodeHighlightStore } from '@/stores/node-highlight-store';
import { useUICoordinatorStore } from '@/stores/ui-coordinator-store';
import { nodeTypes } from '@/components/nodes';
import { edgeTypes } from '@/components/edges';
import { sortItemsByDate, calculateTimelinePosition, DateRange } from '@/utils/date-parser';
import { JourneyHeader } from '@/components/journey/JourneyHeader';

// Helper function to safely extract string from object
const extractString = (value: any): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) {
    return value.name || value.role || value.class || value.title || '';
  }
  return '';
};

interface JourneyTimelineProps {
  className?: string;
  style?: React.CSSProperties;
  onPaneClick?: () => void;
}

/**
 * JourneyTimeline Component
 * 
 * A data-driven component that automatically:
 * 1. Consumes profile data from context (via stores)
 * 2. Transforms data into React Flow nodes and edges
 * 3. Handles all behavior states (focus, selection, highlight)
 * 4. Pre-generates all nodes for optimal performance
 * 
 * No complex hooks needed - just a component that does one thing well.
 */
export const JourneyTimeline: React.FC<JourneyTimelineProps> = ({
  className = "career-journey-flow",
  style = { background: 'transparent' },
  onPaneClick
}) => {
  // Get data from stores (consumed from context via providers)
  const profileData = useDataStore(state => state.profileData);
  const { focusedExperienceId, setFocusedExperience } = useNodeFocusStore();
  const selectedNodeId = useNodeSelectionStore(state => state.selectedNodeId);
  const highlightedNodeId = useNodeHighlightStore(state => state.highlightedNodeId);
  const { setReactFlowInstance, autoFitTimeline } = useUICoordinatorStore();

  // Handle focus mode exit
  const handleExitFocus = () => {
    setFocusedExperience(null);
    // Reset zoom to show full timeline
    setTimeout(() => {
      autoFitTimeline();
    }, 100);
  };

  // Auto-fit timeline when data loads (component handles its own behavior)
  useEffect(() => {
    if (profileData?.filteredData) {
      // Small delay to ensure nodes are rendered
      setTimeout(() => {
        autoFitTimeline();
      }, 100);
    }
  }, [profileData?.filteredData, autoFitTimeline]);

  // Transform profile data to React Flow nodes and edges
  const { nodes, edges } = useMemo(() => {
    if (!profileData?.filteredData) {
      return { nodes: [], edges: [] };
    }

    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const allItems: (DateRange & { nodeId: string; type: string; data: any })[] = [];

    // Collect all work experiences
    if (profileData.filteredData.experiences) {
      profileData.filteredData.experiences.forEach((exp: any, index: number) => {
        const nodeId = `experience-${index}`;
        allItems.push({
          nodeId,
          type: 'workExperience',
          start: exp.start || '',
          end: exp.end || '',
          data: {
            id: nodeId,
            title: extractString(exp.title || exp.position) || '',
            company: extractString(exp.company) || '',
            start: exp.start || '',
            end: exp.end || '',
            description: extractString(exp.description) || '',
            location: extractString(exp.location) || '',
            projects: exp.projects || [],
            type: 'workExperience',
          },
        });
      });
    }

    // Collect all education
    if (profileData.filteredData.education) {
      profileData.filteredData.education.forEach((edu: any, index: number) => {
        const nodeId = `education-${index}`;
        allItems.push({
          nodeId,
          type: 'education',
          start: edu.start || '',
          end: edu.end || '',
          data: {
            id: nodeId,
            school: extractString(edu.school || edu.institution) || '',
            degree: extractString(edu.degree) || '',
            field: extractString(edu.field) || '',
            start: edu.start || '',
            end: edu.end || '',
            description: extractString(edu.description) || '',
            type: 'education',
          },
        });
      });
    }

    // Sort all items by start date
    const sortedItems = sortItemsByDate(
      allItems,
      (item) => item.start,
      (item) => item.end
    );

    // Create main timeline nodes with behavior states
    const mainNodes = sortedItems.map((item, index) => {
      const position = calculateTimelinePosition(sortedItems, index);
      
      return {
        id: item.nodeId,
        type: item.type,
        position: { x: position.x, y: position.y },
        data: { 
          ...item.data, 
          branch: position.branch,
          // Add behavior states from stores
          isFocused: focusedExperienceId === item.nodeId,
          isBlurred: focusedExperienceId && focusedExperienceId !== item.nodeId,
          isSelected: selectedNodeId === item.nodeId,
          isHighlighted: highlightedNodeId === item.nodeId,
        },
      };
    });

    nodes.push(...mainNodes);

    // Pre-generate ALL project nodes and edges for optimal performance
    mainNodes.forEach(experienceNode => {
      if (experienceNode.data.type === 'workExperience' && experienceNode.data.projects) {
        experienceNode.data.projects.forEach((project: any, projectIndex: number) => {
          const projectNodeId = `${experienceNode.id}-project-${projectIndex}`;
          
          // Calculate project position relative to parent
          const projectX = experienceNode.position.x + (projectIndex * 200) - 100;
          const projectY = experienceNode.position.y + 150 + (projectIndex * 80);
          
          // Determine if this project should be visible
          const shouldShowProject = focusedExperienceId === experienceNode.id;
          
          const projectNode: Node = {
            id: projectNodeId,
            type: 'project',
            position: { x: projectX, y: projectY },
            hidden: !shouldShowProject, // Hide/show based on focus state
            data: {
              id: projectNodeId,
              title: extractString(project.title || project.name) || '',
              description: extractString(project.description) || '',
              start: project.start || '',
              end: project.end || '',
              technologies: project.technologies || [],
              experienceId: experienceNode.id,
              parentExperienceId: experienceNode.id,
              type: 'project',
              originalProject: project,
              isSelected: selectedNodeId === projectNodeId,
              isHighlighted: highlightedNodeId === projectNodeId,
            },
          };

          nodes.push(projectNode);

          // Add edge from experience to project
          const projectEdge: Edge = {
            id: `${experienceNode.id}-${projectNodeId}`,
            source: experienceNode.id,
            target: projectNodeId,
            type: 'lBranch',
            sourceHandle: projectX < experienceNode.position.x ? 'left' : 'right',
            targetHandle: 'top',
            hidden: !shouldShowProject, // Hide/show edge based on focus state
          };

          edges.push(projectEdge);
        });
      }
    });

    // Connect ALL main timeline nodes chronologically (single timeline)
    for (let i = 0; i < mainNodes.length - 1; i++) {
      const currentNode = mainNodes[i];
      const nextNode = mainNodes[i + 1];

      const edge: Edge = {
        id: `${currentNode.id}-${nextNode.id}`,
        source: currentNode.id,
        target: nextNode.id,
        type: 'straightTimeline',
      };

      edges.push(edge);
    }

    return { nodes, edges };
  }, [profileData, focusedExperienceId, selectedNodeId, highlightedNodeId]);

  return (
    <div className="relative w-full h-full">
      {/* Journey Header - Always visible */}
      <JourneyHeader />
      
      {/* Focus Mode Exit Button */}
      <AnimatePresence>
        {focusedExperienceId && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute top-24 right-6 z-20"
          >
            <Button
              onClick={handleExitFocus}
              variant="outline"
              size="sm"
              className="bg-amber-500/20 border-amber-400/50 text-amber-200 hover:bg-amber-500/40 hover:text-white backdrop-blur-sm"
            >
              <X className="w-4 h-4 mr-2" />
              Exit Focus Mode
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* React Flow Timeline - with space for header */}
      <div className="pt-24 h-full">
        <ReactFlow
        onInit={setReactFlowInstance}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{
          padding: 0.3,
          includeHiddenNodes: false,
          minZoom: 0.4,
          maxZoom: 1.2,
        }}
        minZoom={0.2}
        maxZoom={1.8}
        className={className}
        style={style}
        panOnScroll={true}
        zoomOnScroll={false}
        attributionPosition="bottom-center"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="rgba(168, 85, 247, 0.2)"
        />
      </ReactFlow>
      </div>
    </div>
  );
};