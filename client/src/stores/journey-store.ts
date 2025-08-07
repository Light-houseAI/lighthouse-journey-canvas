import { createWithEqualityFn } from 'zustand/traditional';
import { ReactFlowInstance } from '@xyflow/react';
import type { Education } from '@shared/schema';
import type { EducationNodeData } from '../components/nodes/shared/nodeUtils';

// Data types for nodes
export interface JobData {
  id: string;
  title: string;
  company: string;
  position: string;
  startDate: string;
  endDate: string;
  description: string;
  location?: string;
  projects?: ProjectData[];
}

// Use Education type from shared schema for data consistency

export interface ProjectData {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  status?: string;
  technologies?: string[];
  experienceId: string;
}

export interface EventData {
  id: string;
  title: string;
  eventType: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  organizer?: string;
}

export interface ActionData {
  id: string;
  title: string;
  actionType: string;
  category: string;
  status: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  impact?: string;
  verification?: string;
}

export interface CareerTransitionData {
  id: string;
  title: string;
  transitionType: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  fromRole?: string;
  toRole?: string;
  reason?: string;
}

// Base expandable node interface
export interface BaseExpandableNodeData {
  isExpanded?: boolean;
  children?: any[];
  hasExpandableContent?: boolean;
}

// Node data types for React Flow
export type JobNodeData = JobData & BaseExpandableNodeData & {
  type: 'job';
  onNodeClick?: (data: any, nodeId?: string) => void;
  onNodeDelete?: (nodeId: string) => void;
  onToggleExpansion?: (nodeId: string) => void;
  isHighlighted?: boolean;
  isFocused?: boolean;
  isBlurred?: boolean;
  isSelected?: boolean;
  isCompleted?: boolean;
  isOngoing?: boolean;
  isSuggested?: boolean;
  suggestedReason?: string;
  [key: string]: unknown;
};

// Use EducationNodeData from nodeUtils for consistency

export type ProjectNodeData = ProjectData & {
  type: 'project';
  onNodeClick?: (data: any, nodeId?: string) => void;
  onNodeDelete?: (nodeId: string) => void;
  isHighlighted?: boolean;
  isSelected?: boolean;
  parentExperienceId: string;
  [key: string]: unknown;
};

export type EventNodeData = EventData & {
  type: 'event';
  onNodeClick?: (data: any, nodeId?: string) => void;
  onNodeDelete?: (nodeId: string) => void;
  isHighlighted?: boolean;
  isFocused?: boolean;
  isBlurred?: boolean;
  isSelected?: boolean;
  [key: string]: unknown;
};

export type ActionNodeData = ActionData & {
  type: 'action';
  onNodeClick?: (data: any, nodeId?: string) => void;
  onNodeDelete?: (nodeId: string) => void;
  isHighlighted?: boolean;
  isFocused?: boolean;
  isBlurred?: boolean;
  isSelected?: boolean;
  [key: string]: unknown;
};

export type CareerTransitionNodeData = CareerTransitionData & BaseExpandableNodeData & {
  type: 'careerTransition';
  onNodeClick?: (data: any, nodeId?: string) => void;
  onNodeDelete?: (nodeId: string) => void;
  onToggleExpansion?: (nodeId: string) => void;
  isHighlighted?: boolean;
  isFocused?: boolean;
  isBlurred?: boolean;
  isSelected?: boolean;
  isOngoing?: boolean;
  [key: string]: unknown;
};

export type ProfessionalJourneyNodeData = 
  | JobNodeData 
  | EducationNodeData 
  | ProjectNodeData
  | EventNodeData
  | ActionNodeData
  | CareerTransitionNodeData;

/**
 * Unified Journey Store - Single source of truth
 * Manages both profile data and UI state following Zustand best practices
 */
export interface JourneyStore {
  // Profile Data
  profileData: any | null;
  isLoading: boolean;
  error: string | null;
  
  // UI State
  focusedExperienceId: string | null;
  selectedNodeId: string | null;
  highlightedNodeId: string | null;
  reactFlowInstance: ReactFlowInstance | null;
  
  // Expansion State - Map of nodeId to expansion state
  nodeExpansionState: Record<string, boolean>;
  
  // Actions
  setProfileData: (data: any) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  loadProfileData: () => Promise<void>;
  refreshProfileData: () => Promise<void>;
  clearProfileData: () => void;
  
  // UI Actions
  setFocusedExperience: (id: string | null) => void;
  setSelectedNode: (id: string | null) => void;
  setHighlightedNode: (id: string | null) => void;
  setReactFlowInstance: (instance: ReactFlowInstance) => void;
  
  // Expansion Actions
  toggleNodeExpansion: (nodeId: string) => void;
  setNodeExpansion: (nodeId: string, isExpanded: boolean) => void;
  isNodeExpanded: (nodeId: string) => boolean;
  expandAllNodes: () => void;
  collapseAllNodes: () => void;
  
  // Utility Actions
  autoFitTimeline: () => void;
  zoomToFocusedNode: (nodeId: string, extraModalSpace?: boolean) => void;
  logout: () => Promise<void>;
}

/**
 * Clean Zustand store following best practices
 */
export const useJourneyStore = createWithEqualityFn<JourneyStore>((set, get) => ({
  // Profile Data State
  profileData: null,
  isLoading: false,
  error: null,
  
  // UI State
  focusedExperienceId: null,
  selectedNodeId: null,
  highlightedNodeId: null,
  reactFlowInstance: null,
  
  // Expansion State
  nodeExpansionState: {},
  
  // Profile Data Actions
  setProfileData: (data: any) => {
    set({ profileData: data, error: null });
  },

  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },

  setError: (error: string | null) => {
    set({ error, isLoading: false });
  },

  loadProfileData: async () => {
    const { profileData } = get();
    
    // Don't reload if we already have data
    if (profileData) return;
    
    set({ isLoading: true, error: null });
    
    try {
      const response = await fetch('/api/profile');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      set({ 
        profileData: data, 
        isLoading: false,
        error: null 
      });
    } catch (error) {
      console.error('Failed to load profile data:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load profile data',
        isLoading: false 
      });
    }
  },

  refreshProfileData: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await fetch('/api/profile');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      set({ 
        profileData: data, 
        isLoading: false,
        error: null 
      });
    } catch (error) {
      console.error('Failed to refresh profile data:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to refresh profile data',
        isLoading: false 
      });
    }
  },

  clearProfileData: () => {
    set({ 
      profileData: null, 
      isLoading: false, 
      error: null,
      // Reset UI state when clearing data
      focusedExperienceId: null,
      selectedNodeId: null,
      highlightedNodeId: null,
      // Reset expansion state
      nodeExpansionState: {},
    });
  },
  
  // UI Actions
  setFocusedExperience: (id: string | null) => {
    set({ 
      focusedExperienceId: id,
      selectedNodeId: null, // Clear selection when changing focus
    });
  },

  setSelectedNode: (id: string | null) => {
    set({ selectedNodeId: id });
  },

  setHighlightedNode: (id: string | null) => {
    set({ highlightedNodeId: id });
    
    // Auto-clear highlight after 3 seconds
    if (id) {
      setTimeout(() => {
        if (get().highlightedNodeId === id) {
          set({ highlightedNodeId: null });
        }
      }, 3000);
    }
  },

  setReactFlowInstance: (instance: ReactFlowInstance) => {
    set({ reactFlowInstance: instance });
  },
  
  // Expansion Actions
  toggleNodeExpansion: (nodeId: string) => {
    const { nodeExpansionState } = get();
    const currentState = nodeExpansionState[nodeId] || false;
    set({
      nodeExpansionState: {
        ...nodeExpansionState,
        [nodeId]: !currentState
      }
    });
  },

  setNodeExpansion: (nodeId: string, isExpanded: boolean) => {
    const { nodeExpansionState } = get();
    set({
      nodeExpansionState: {
        ...nodeExpansionState,
        [nodeId]: isExpanded
      }
    });
  },

  isNodeExpanded: (nodeId: string) => {
    const { nodeExpansionState } = get();
    return nodeExpansionState[nodeId] || false;
  },

  expandAllNodes: () => {
    const { profileData } = get();
    if (!profileData) return;
    
    const nodeExpansionState: Record<string, boolean> = {};
    
    // Get experiences and education from the correct data structure
    const experiences = profileData.experiences || profileData.filteredData?.experiences || [];
    const education = profileData.education || profileData.filteredData?.education || [];
    
    // Expand all experience nodes
    if (experiences && experiences.length > 0) {
      experiences.forEach((exp: any, index: number) => {
        nodeExpansionState[`experience-${index}`] = true;
      });
    }
    
    // Expand all education nodes  
    if (education && education.length > 0) {
      education.forEach((edu: any, index: number) => {
        nodeExpansionState[`education-${index}`] = true;
      });
    }
    
    set({ nodeExpansionState });
  },

  collapseAllNodes: () => {
    set({ nodeExpansionState: {} });
  },
  
  // Utility Actions
  autoFitTimeline: () => {
    const { reactFlowInstance } = get();
    
    if (reactFlowInstance) {
      setTimeout(() => {
        reactFlowInstance.fitView({
          duration: 1000,
          padding: 0.2,
        });
      }, 100);
    }
  },

  zoomToFocusedNode: (nodeId: string, extraModalSpace: boolean = false) => {
    const { reactFlowInstance } = get();
    
    if (!reactFlowInstance) return;
    
    // Simple zoom with minimal delay and straightforward fallback
    setTimeout(() => {
      const nodes = reactFlowInstance.getNodes();
      const focusedNode = nodes.find(node => node.id === nodeId);
      
      if (!focusedNode) {
        console.log('Zoom failed: Node not found:', nodeId);
        return;
      }
      
      console.log('🔍 Zooming to node:', nodeId);
      
      // Find all connected nodes (parent and children)
      const connectedNodes = nodes.filter(node => {
        if (node.id === nodeId) return true;
        
        // Check if this is a child of the focused node
        if (node.data?.parentId === nodeId) return true;
        
        // Check if this is the parent of the focused node  
        if (focusedNode.data?.parentId === node.id) return true;
        
        // Legacy checks for different parent relationship patterns
        if (node.data?.parentExperienceId === nodeId || node.data?.experienceId === nodeId) return true;
        if (focusedNode.data?.parentExperienceId === node.id || focusedNode.data?.experienceId === node.id) return true;
        
        return false;
      });
      
      console.log('🔗 Connected nodes found:', connectedNodes.length, connectedNodes.map(n => ({ id: n.id, type: n.type })));
      
      if (connectedNodes.length > 1) {
        // Zoom to include all connected nodes (parent + children)
        const positions = connectedNodes.map(n => ({
          x: n.position.x,
          y: n.position.y,
          width: n.width || 240,
          height: n.height || 180
        }));
        
        const minX = Math.min(...positions.map(p => p.x));
        const maxX = Math.max(...positions.map(p => p.x + p.width));
        const minY = Math.min(...positions.map(p => p.y));
        const maxY = Math.max(...positions.map(p => p.y + p.height));
        
        const buffer = extraModalSpace ? 120 : 80;
        
        reactFlowInstance.fitBounds({
          x: minX - buffer,
          y: minY - buffer,
          width: (maxX + buffer) - (minX - buffer),
          height: (maxY + buffer) - (minY - buffer)
        }, {
          duration: 600,
          padding: 0.05
        });
      } else {
        // Fallback: Zoom to single node
        const buffer = extraModalSpace ? 200 : 120;
        
        reactFlowInstance.fitBounds({
          x: focusedNode.position.x - buffer,
          y: focusedNode.position.y - buffer,
          width: 240 + (buffer * 2),
          height: 180 + (buffer * 2)
        }, {
          duration: 600,
          padding: 0.05
        });
      }
    }, 100); // Single 100ms delay - enough for React to update
  },

  logout: async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
      
      // Clear all state on logout
      set({
        profileData: null,
        isLoading: false,
        error: null,
        focusedExperienceId: null,
        selectedNodeId: null,
        highlightedNodeId: null,
        reactFlowInstance: null,
        nodeExpansionState: {},
      });
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  },
}));