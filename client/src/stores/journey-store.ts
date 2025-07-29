import {
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Connection,
  ReactFlowInstance,
} from '@xyflow/react';
import { createWithEqualityFn } from 'zustand/traditional';
import { nanoid } from 'nanoid';
import { sortItemsByDate, calculateTimelinePosition, DateRange, parseFlexibleDate } from '@/utils/date-parser';

// Helper function to safely extract string from object
const extractString = (value: any): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) {
    return value.name || value.role || value.class || value.title || '';
  }
  return '';
};

// Helper function to calculate date-based X position for focus mode timeline
const calculateFocusTimelinePosition = (
  targetDate: string | null | undefined,
  workStartDate: string,
  workEndDate: string | null
): number => {
  const START_X = 200;
  const TIMELINE_WIDTH = 800; // Width for focus mode timeline
  
  if (!targetDate) {
    // If no date provided, align to work experience start
    return START_X;
  }

  const target = parseFlexibleDate(targetDate);
  const workStart = parseFlexibleDate(workStartDate);
  const workEnd = workEndDate ? parseFlexibleDate(workEndDate) : null;
  
  if (!target.isValid || !workStart.isValid) {
    return START_X;
  }

  // Use work end date or current date for timeline calculation
  const endDate = workEnd?.isValid ? workEnd.date : new Date();
  const totalTimespan = endDate.getTime() - workStart.date.getTime();
  
  if (totalTimespan <= 0) {
    return START_X;
  }

  // Calculate position based on date relative to work experience timespan
  const targetTimespan = target.date.getTime() - workStart.date.getTime();
  const progress = Math.max(0, Math.min(1, targetTimespan / totalTimespan));
  
  return START_X + (progress * TIMELINE_WIDTH);
};

// Helper function to calculate bounds for a set of nodes
const calculateNodeBounds = (nodes: Node<Record<string, unknown>>[]) => {
  const NODE_WIDTH = 80;  // Approximate node width
  const NODE_HEIGHT = 80; // Approximate node height
  
  const minX = Math.min(...nodes.map(node => node.position.x));
  const maxX = Math.max(...nodes.map(node => node.position.x + NODE_WIDTH));
  const minY = Math.min(...nodes.map(node => node.position.y));
  const maxY = Math.max(...nodes.map(node => node.position.y + NODE_HEIGHT));

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
};

// Types for our professional journey data
export interface WorkExperienceData {
  id: string;
  title: string;
  company: string;
  start: string;
  end: string;
  description: string;
  location?: string;
  projects?: ProjectData[];
}

export interface EducationData {
  id: string;
  school: string;
  degree: string;
  field: string;
  start: string;
  end: string;
  description?: string;
}

export interface ProjectData {
  id: string;
  title: string;
  description: string;
  start: string;
  end: string;
  technologies?: string[];
  experienceId: string;
}



// Node data types for React Flow - must extend Record<string, unknown>
export type WorkExperienceNodeData = WorkExperienceData & {
  type: 'workExperience';
  onNodeClick?: (data: any, nodeId?: string) => void;
  onNodeDelete?: (nodeId: string) => void;
  isHighlighted?: boolean;
  isFocused?: boolean;
  isBlurred?: boolean;
  [key: string]: unknown;
};

export type EducationNodeData = EducationData & {
  type: 'education';
  onNodeClick?: (data: any, nodeId?: string) => void;
  onNodeDelete?: (nodeId: string) => void;
  isHighlighted?: boolean;
  [key: string]: unknown;
};

export type ProjectNodeData = ProjectData & {
  type: 'project';
  onNodeClick?: (data: any, nodeId?: string) => void;
  onNodeDelete?: (nodeId: string) => void;
  isHighlighted?: boolean;
  parentExperienceId: string;
  [key: string]: unknown;
};



// Union type for all node data
export type ProfessionalJourneyNodeData = 
  | WorkExperienceNodeData 
  | EducationNodeData 
  | ProjectNodeData;

// React Flow state interface
export interface RFState {
  nodes: Node<Record<string, unknown>>[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  
  // React Flow instance
  reactFlowInstance: ReactFlowInstance | null;
  
  // UI State
  selectedNodeId: string | null;
  highlightedNodeId: string | null;
  focusedExperienceId: string | null;
  
  // Data loading
  isLoading: boolean;
  
  // Actions
  loadProfileData: () => Promise<void>;
  setReactFlowInstance: (instance: ReactFlowInstance) => void;
  setSelectedNode: (nodeId: string | null) => void;
  setHighlightedNode: (nodeId: string | null) => void;
  setFocusedExperience: (nodeId: string | null) => void;
  updateNode: (nodeId: string, data: Partial<ProfessionalJourneyNodeData>) => void;
  addProjectNode: (experienceId: string, projectData: Omit<ProjectData, 'id' | 'experienceId'>) => void;
  deleteNode: (nodeId: string) => void;
  navigateToNode: (nodeId: string) => void;
  zoomToFitNode: (nodeId: string) => void;
  autoFitTimeline: () => void;
}


// Main Zustand store following React Flow patterns
export const useProfessionalJourneyStore = createWithEqualityFn<RFState>((set, get) => ({
  nodes: [],
  edges: [],
  reactFlowInstance: null,
  selectedNodeId: null,
  highlightedNodeId: null,
  focusedExperienceId: null,
  isLoading: false,

  // React Flow event handlers
  onNodesChange: (changes: NodeChange[]) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    });
  },

  onEdgesChange: (changes: EdgeChange[]) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },

  onConnect: (connection: Connection) => {
    set({
      edges: addEdge(connection, get().edges),
    });
  },

  // React Flow instance management
  setReactFlowInstance: (instance: ReactFlowInstance) => {
    set({ reactFlowInstance: instance });
  },

  // UI State actions
  setSelectedNode: (nodeId: string | null) => {
    set({ selectedNodeId: nodeId });
  },

  setHighlightedNode: (nodeId: string | null) => {
    set({ highlightedNodeId: nodeId });
  },

  setFocusedExperience: (nodeId: string | null) => {
    const { nodes, edges } = get();
    
    // Remove existing project nodes and their edges
    const filteredNodes = nodes.filter(node => node.data.type !== 'project');
    const filteredEdges = edges.filter(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);
      return !(sourceNode?.data.type === 'project' || targetNode?.data.type === 'project');
    });

    let updatedNodes = filteredNodes;
    let updatedEdges = filteredEdges;

    if (nodeId) {
      // Find the focused work experience node
      const focusedNode = filteredNodes.find(node => node.id === nodeId);
      
      if (focusedNode && focusedNode.data.type === 'workExperience') {
        const workData = focusedNode.data as WorkExperienceNodeData;
        
        // Create project nodes if they exist
        if (workData.projects && workData.projects.length > 0) {
          workData.projects.forEach((project: any, projectIndex: number) => {
            const projectNodeId = `${nodeId}-project-${projectIndex}`;
            const hasOwnDates = project.start && project.end;
            
            // Debug: Log project structure to see available fields
            console.log(`Creating project node ${projectIndex}:`, project);
            console.log('Available project fields:', Object.keys(project));
            
            // Calculate X position based on project start date or work experience start date
            const projectStartDate = project.start || workData.start;
            const projectX = calculateFocusTimelinePosition(
              projectStartDate,
              workData.start,
              workData.end
            );
            
            // Position project nodes aligned to their dates
            const projectNode: Node<Record<string, unknown>> = {
              id: projectNodeId,
              type: 'project',
              position: { 
                x: projectX, 
                y: focusedNode.position.y + 150 + (projectIndex * 80) // Stack projects vertically if multiple
              },
              data: {
                id: projectNodeId,
                title: extractString(project.title || project.name) || '',
                description: extractString(project.description) || '',
                start: project.start || '', // Keep original dates for display
                end: project.end || '', // Keep original dates for display
                technologies: project.technologies || [],
                experienceId: nodeId,
                parentExperienceId: nodeId,
                type: 'project',
                hasOwnDates: hasOwnDates, // Flag to indicate if project has its own dates
                // Try multiple possible field names for updates
                projectUpdates: project.updates || 
                                project.projectUpdates || 
                                project.milestones ||
                                project.tasks ||
                                project.workItems ||
                                project.entries ||
                                [], 
                originalProject: project, // Keep reference to original project data
              } as ProjectNodeData & { hasOwnDates: boolean; projectUpdates: any[]; originalProject: any },
            };

            updatedNodes.push(projectNode);

            // Determine edge direction based on project position relative to work experience
            const workExperienceX = focusedNode.position.x;
            const projectNodeX = projectX;
            
            // If project is to the left of work experience, edge comes from left side
            // If project is to the right, edge comes from right side
            const isProjectOnLeft = projectNodeX < workExperienceX;
            
            const projectEdge: Edge = {
              id: `${nodeId}-${projectNodeId}`,
              source: nodeId,
              target: projectNodeId,
              type: 'lBranch', // L-shaped dotted line for project connections
              sourceHandle: isProjectOnLeft ? 'left' : 'right', // Dynamic source handle
              targetHandle: 'top', // Projects connect from top
            };

            updatedEdges.push(projectEdge);
          });
        }
      }
    }
    
    // Update node focus states
    const finalNodes = updatedNodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        isFocused: nodeId === node.id,
        isBlurred: nodeId && nodeId !== node.id && node.data.type !== 'project',
      }
    }));
    
    set({ 
      focusedExperienceId: nodeId,
      nodes: finalNodes,
      edges: updatedEdges
    });
    
    // Auto-fit timeline after focus change
    setTimeout(() => {
      get().autoFitTimeline();
    }, 100);
  },

  // Node manipulation actions
  updateNode: (nodeId: string, data: Partial<ProfessionalJourneyNodeData>) => {
    set({
      nodes: get().nodes.map(node => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: { ...node.data, ...data }
          };
        }
        return node;
      }),
    });
  },

  addProjectNode: (experienceId: string, projectData: Omit<ProjectData, 'id' | 'experienceId'>) => {
    const parentNode = get().nodes.find(node => node.id === experienceId);
    if (!parentNode) return;

    const projectId = nanoid();
    const existingProjects = get().nodes.filter(
      node => node.data.type === 'project' && 
      (node.data as ProjectNodeData).parentExperienceId === experienceId
    );

    // Calculate X position based on project start date or parent experience start date
    const parentData = parentNode.data as WorkExperienceNodeData;
    const projectStartDate = projectData.start || parentData.start;
    const projectX = calculateFocusTimelinePosition(
      projectStartDate,
      parentData.start,
      parentData.end
    );

    const projectNode: Node<Record<string, unknown>> = {
      id: projectId,
      type: 'project',
      position: { x: projectX, y: parentNode.position.y + 150 + (existingProjects.length * 80) },
      data: {
        ...projectData,
        id: projectId,
        experienceId,
        type: 'project',
        parentExperienceId: experienceId,
      } as ProjectNodeData,
    };

    // Determine edge direction based on project position relative to work experience
    const isProjectOnLeft = projectX < parentNode.position.x;
    
    const projectEdge: Edge = {
      id: `${experienceId}-${projectId}`,
      source: experienceId,
      target: projectId,
      type: 'lBranch', // Use L-shaped edges for consistency
      sourceHandle: isProjectOnLeft ? 'left' : 'right', // Dynamic source handle
      targetHandle: 'top', // Projects connect from top
    };

    set({
      nodes: [...get().nodes, projectNode],
      edges: [...get().edges, projectEdge],
    });
  },

  deleteNode: (nodeId: string) => {
    // Remove node and all connected edges
    const nodesToKeep = get().nodes.filter(node => node.id !== nodeId);
    const edgesToKeep = get().edges.filter(
      edge => edge.source !== nodeId && edge.target !== nodeId
    );

    set({
      nodes: nodesToKeep,
      edges: edgesToKeep,
    });

    // Clear selection if deleted node was selected
    if (get().selectedNodeId === nodeId) {
      set({ selectedNodeId: null });
    }
  },

  navigateToNode: (nodeId: string) => {
    set({ highlightedNodeId: nodeId });
    
    // Clear highlight after 3 seconds
    setTimeout(() => {
      if (get().highlightedNodeId === nodeId) {
        set({ highlightedNodeId: null });
      }
    }, 3000);
  },

  zoomToFitNode: (nodeId: string) => {
    const { reactFlowInstance, nodes, edges, focusedExperienceId } = get();
    
    if (!reactFlowInstance) return;

    // In focus mode, only show the focused work experience and its projects
    if (focusedExperienceId) {
      const focusedNode = nodes.find(node => node.id === focusedExperienceId);
      const projectNodes = nodes.filter(node => 
        node.data.type === 'project' && 
        (node.data as any).parentExperienceId === focusedExperienceId
      );
      
      const focusNodes = focusedNode ? [focusedNode, ...projectNodes] : [];
      
      if (focusNodes.length === 0) return;

      const minX = Math.min(...focusNodes.map(node => node.position.x));
      const maxX = Math.max(...focusNodes.map(node => node.position.x + 80));
      const minY = Math.min(...focusNodes.map(node => node.position.y));
      const maxY = Math.max(...focusNodes.map(node => node.position.y + 80));

      // Add generous padding for focus mode
      const padding = 150;
      const bounds = {
        x: minX - padding,
        y: minY - padding,
        width: (maxX - minX) + (padding * 2),
        height: (maxY - minY) + (padding * 2),
      };

      // Fit view to focus area
      reactFlowInstance.fitBounds(bounds, {
        duration: 800,
        padding: 0.2,
      });
      return;
    }

    // Normal mode: show connected nodes
    const targetNode = nodes.find(node => node.id === nodeId);
    if (!targetNode) return;

    const connectedEdges = edges.filter(
      edge => edge.source === nodeId || edge.target === nodeId
    );

    const connectedNodeIds = new Set([nodeId]);
    connectedEdges.forEach(edge => {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    });

    const connectedNodes = nodes.filter(node => connectedNodeIds.has(node.id));

    if (connectedNodes.length === 0) return;

    const minX = Math.min(...connectedNodes.map(node => node.position.x));
    const maxX = Math.max(...connectedNodes.map(node => node.position.x + 80));
    const minY = Math.min(...connectedNodes.map(node => node.position.y));
    const maxY = Math.max(...connectedNodes.map(node => node.position.y + 80));

    const padding = 100;
    const bounds = {
      x: minX - padding,
      y: minY - padding,
      width: (maxX - minX) + (padding * 2),
      height: (maxY - minY) + (padding * 2),
    };

    reactFlowInstance.fitBounds(bounds, {
      duration: 800,
      padding: 0.1,
    });
  },

  autoFitTimeline: () => {
    const { reactFlowInstance, nodes, focusedExperienceId } = get();
    
    if (!reactFlowInstance || nodes.length === 0) return;

    // In focus mode, only consider focused nodes
    if (focusedExperienceId) {
      const focusedNode = nodes.find(node => node.id === focusedExperienceId);
      const projectNodes = nodes.filter(node => 
        node.data.type === 'project' && 
        (node.data as any).parentExperienceId === focusedExperienceId
      );
      
      const relevantNodes = focusedNode ? [focusedNode, ...projectNodes] : [];
      
      if (relevantNodes.length > 0) {
        const bounds = calculateNodeBounds(relevantNodes);
        const padding = relevantNodes.length <= 3 ? 0.3 : 0.2; // More padding for fewer nodes
        
        reactFlowInstance.fitBounds(bounds, {
          duration: 800,
          padding: padding,
        });
      }
      return;
    }

    // Normal mode: fit all timeline nodes
    const timelineNodes = nodes.filter(node => 
      node.data.type === 'workExperience' || node.data.type === 'education'
    );
    
    if (timelineNodes.length > 0) {
      const bounds = calculateNodeBounds(timelineNodes);
      
      // Adjust padding and zoom based on number of nodes
      let padding = 0.15; // Default padding
      if (timelineNodes.length <= 3) {
        padding = 0.4; // More padding for fewer nodes (zooms in more)
      } else if (timelineNodes.length <= 6) {
        padding = 0.25; // Medium padding
      }
      
      reactFlowInstance.fitBounds(bounds, {
        duration: 1000,
        padding: padding,
      });
    }
  },

  // API integration
  loadProfileData: async () => {
    set({ isLoading: true });
    
    try {
      const response = await fetch('/api/profile');
      const profileData = await response.json();
      
      if (!profileData.filteredData) {
        set({ isLoading: false });
        return;
      }

      const nodes: Node<Record<string, unknown>>[] = [];
      const edges: Edge[] = [];
      const allItems: (DateRange & { nodeId: string; type: string; data: any })[] = [];

      // Collect all work experiences and their projects
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
            } as WorkExperienceNodeData,
          });

          // Projects will be created dynamically when focusing on work experience
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
            } as EducationNodeData,
          });
        });
      }

      // Sort all items by start date using the utility function
      const sortedItems = sortItemsByDate(
        allItems, 
        (item) => item.start,
        (item) => item.end
      );

      // Create nodes with proper timeline positioning
      const sortedNodes = sortedItems.map((item, index) => {
        const position = calculateTimelinePosition(sortedItems, index);
        
        return {
          id: item.nodeId,
          type: item.type,
          position: { x: position.x, y: position.y },
          data: { ...item.data, branch: position.branch },
        } as Node<Record<string, unknown>>;
      });

      nodes.push(...sortedNodes);

      // Connect nodes chronologically on primary timeline (branch 0)
      const primaryNodes = sortedNodes.filter(node => node.data.branch === 0);
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
      const secondaryNodes = sortedNodes.filter(node => node.data.branch > 0);
      secondaryNodes.forEach((secondaryNode) => {
        const secondaryData = secondaryNode.data as WorkExperienceNodeData | EducationNodeData;
        
        // Find the closest primary timeline node by start date for branch start
        const startConnectionNode = primaryNodes.find(primaryNode => {
          const primaryData = primaryNode.data as WorkExperienceNodeData | EducationNodeData;
          return new Date(primaryData.start).getTime() <= new Date(secondaryData.start).getTime();
        }) || primaryNodes[0];

        if (startConnectionNode) {
          // L-shaped dotted line from primary to secondary (branch start)
          edges.push({
            id: `branch-start-${startConnectionNode.id}-${secondaryNode.id}`,
            source: startConnectionNode.id,
            target: secondaryNode.id,
            type: 'lBranch', // Uses L-shaped dotted line
          });

          // L-shaped dotted line from secondary back to primary (branch end)
          const endConnectionNode = primaryNodes.find(primaryNode => {
            const primaryData = primaryNode.data as WorkExperienceNodeData | EducationNodeData;
            return new Date(primaryData.start).getTime() >= new Date(secondaryData.end || new Date()).getTime();
          }) || primaryNodes[primaryNodes.length - 1];

          if (endConnectionNode && endConnectionNode.id !== startConnectionNode.id) {
            edges.push({
              id: `branch-end-${secondaryNode.id}-${endConnectionNode.id}`,
              source: secondaryNode.id,
              target: endConnectionNode.id,
              type: 'lBranch', // Uses L-shaped dotted line
            });
          }
        }
      });

      // Project nodes are now created dynamically in setFocusedExperience

      set({ 
        nodes: sortedNodes,
        edges,
        isLoading: false 
      });

      // Auto-fit timeline after loading data
      setTimeout(() => {
        get().autoFitTimeline();
      }, 500);

    } catch (error) {
      console.error('Failed to load profile data:', error);
      set({ isLoading: false });
    }
  },

  // Additional API actions for persistence
  saveNodeData: async (nodeId: string, data: Partial<ProfessionalJourneyNodeData>) => {
    try {
      const response = await fetch('/api/save-milestone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          milestone: { id: nodeId, ...data }
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Node data saved:', result);
      
      return result;
    } catch (error) {
      console.error('Failed to save node data:', error);
      throw error;
    }
  },

  saveProjectData: async (projectData: ProjectData) => {
    try {
      const response = await fetch('/api/save-milestone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          milestone: {
            ...projectData,
            isSubMilestone: true,
            parentId: projectData.experienceId,
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Project data saved:', result);
      
      return result;
    } catch (error) {
      console.error('Failed to save project data:', error);
      throw error;
    }
  },
}));

export default useProfessionalJourneyStore;