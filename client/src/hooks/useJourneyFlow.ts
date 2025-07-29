import { useMemo } from 'react';
import { Node, Edge } from '@xyflow/react';
import { useJourneyStore } from '@/stores/journey-store';
import { sortItemsByDate, calculateTimelinePosition, DateRange } from '@/utils/date-parser';

// Helper function to safely extract string from object
const extractString = (value: any): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) {
    return value.name || value.role || value.class || value.title || '';
  }
  return '';
};

/**
 * Clean hook that transforms Zustand store data to React Flow format
 * Following React Flow + Zustand best practices
 */
export const useJourneyFlow = () => {
  // Get all store state and actions
  const store = useJourneyStore();
  
  // Transform profile data to React Flow nodes and edges
  const { nodes, edges } = useMemo(() => {
    if (!store.profileData?.filteredData) {
      return { nodes: [], edges: [] };
    }

    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const allItems: (DateRange & { nodeId: string; type: string; data: any })[] = [];

    // Collect all work experiences
    if (store.profileData.filteredData.experiences) {
      store.profileData.filteredData.experiences.forEach((exp: any, index: number) => {
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
    if (store.profileData.filteredData.education) {
      store.profileData.filteredData.education.forEach((edu: any, index: number) => {
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

    // Create main timeline nodes with focus states
    const mainNodes = sortedItems.map((item, index) => {
      const position = calculateTimelinePosition(sortedItems, index);
      
      return {
        id: item.nodeId,
        type: item.type,
        position: { x: position.x, y: position.y },
        data: { 
          ...item.data, 
          branch: position.branch,
          // Add focus/selection states from store
          isFocused: store.focusedExperienceId === item.nodeId,
          isBlurred: store.focusedExperienceId && store.focusedExperienceId !== item.nodeId,
          isSelected: store.selectedNodeId === item.nodeId,
          isHighlighted: store.highlightedNodeId === item.nodeId,
        },
      };
    });

    nodes.push(...mainNodes);

    // Add project nodes if in focus mode
    if (store.focusedExperienceId) {
      const focusedNode = mainNodes.find(node => node.id === store.focusedExperienceId);
      
      if (focusedNode && focusedNode.data.type === 'workExperience' && focusedNode.data.projects) {
        focusedNode.data.projects.forEach((project: any, projectIndex: number) => {
          const projectNodeId = `${store.focusedExperienceId}-project-${projectIndex}`;
          
          // Calculate project position relative to parent
          const projectX = focusedNode.position.x + (projectIndex * 200) - 100;
          const projectY = focusedNode.position.y + 150 + (projectIndex * 80);
          
          const projectNode: Node = {
            id: projectNodeId,
            type: 'project',
            position: { x: projectX, y: projectY },
            data: {
              id: projectNodeId,
              title: extractString(project.title || project.name) || '',
              description: extractString(project.description) || '',
              start: project.start || '',
              end: project.end || '',
              technologies: project.technologies || [],
              experienceId: store.focusedExperienceId,
              parentExperienceId: store.focusedExperienceId,
              type: 'project',
              originalProject: project,
              isSelected: store.selectedNodeId === projectNodeId,
              isHighlighted: store.highlightedNodeId === projectNodeId,
            },
          };

          nodes.push(projectNode);

          // Add edge from experience to project
          const projectEdge: Edge = {
            id: `${store.focusedExperienceId!}-${projectNodeId}`,
            source: store.focusedExperienceId!,
            target: projectNodeId,
            type: 'lBranch',
            sourceHandle: projectX < focusedNode.position.x ? 'left' : 'right',
            targetHandle: 'top',
          };

          edges.push(projectEdge);
        });
      }
    }

    // Connect main timeline nodes chronologically on primary timeline (branch 0)
    const primaryNodes = mainNodes.filter(node => node.data.branch === 0);
    for (let i = 0; i < primaryNodes.length - 1; i++) {
      const currentNode = primaryNodes[i];
      const nextNode = primaryNodes[i + 1];

      const edge: Edge = {
        id: `${currentNode.id}-${nextNode.id}`,
        source: currentNode.id,
        target: nextNode.id,
        type: 'straightTimeline',
      };

      edges.push(edge);
    }

    // Create branch connections for secondary timelines
    const secondaryNodes = mainNodes.filter(node => node.data.branch > 0);
    secondaryNodes.forEach((secondaryNode) => {
      // Find the closest primary timeline node by start date for branch start
      const startConnectionNode = primaryNodes.find(primaryNode => {
        return new Date(primaryNode.data.start).getTime() <= new Date(secondaryNode.data.start).getTime();
      }) || primaryNodes[0];

      if (startConnectionNode) {
        // L-shaped dotted line from primary to secondary (branch start)
        edges.push({
          id: `branch-start-${startConnectionNode.id}-${secondaryNode.id}`,
          source: startConnectionNode.id,
          target: secondaryNode.id,
          type: 'lBranch',
        });

        // L-shaped dotted line from secondary back to primary (branch end)
        const endConnectionNode = primaryNodes.find(primaryNode => {
          return new Date(primaryNode.data.start).getTime() >= new Date(secondaryNode.data.end || new Date()).getTime();
        }) || primaryNodes[primaryNodes.length - 1];

        if (endConnectionNode && endConnectionNode.id !== startConnectionNode.id) {
          edges.push({
            id: `branch-end-${secondaryNode.id}-${endConnectionNode.id}`,
            source: secondaryNode.id,
            target: endConnectionNode.id,
            type: 'lBranch',
          });
        }
      }
    });

    return { nodes, edges };
  }, [
    store.profileData, 
    store.focusedExperienceId, 
    store.selectedNodeId, 
    store.highlightedNodeId
  ]); // Recalculate when any of these change

  // Return transformed data + store actions
  return {
    // Transformed data for React Flow
    nodes,
    edges,
    
    // Store state
    profileData: store.profileData,
    isLoading: store.isLoading,
    error: store.error,
    focusedExperienceId: store.focusedExperienceId,
    selectedNodeId: store.selectedNodeId,
    highlightedNodeId: store.highlightedNodeId,
    reactFlowInstance: store.reactFlowInstance,
    
    // Store actions
    setProfileData: store.setProfileData,
    loadProfileData: store.loadProfileData,
    refreshProfileData: store.refreshProfileData,
    clearProfileData: store.clearProfileData,
    setFocusedExperience: store.setFocusedExperience,
    setSelectedNode: store.setSelectedNode,
    setHighlightedNode: store.setHighlightedNode,
    setReactFlowInstance: store.setReactFlowInstance,
    autoFitTimeline: store.autoFitTimeline,
    zoomToFocusedNode: store.zoomToFocusedNode,
    logout: store.logout,
  };
};