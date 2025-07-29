import { createWithEqualityFn } from 'zustand/traditional';
import { ReactFlowInstance } from '@xyflow/react';

// Data types for nodes
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

// Node data types for React Flow
export type WorkExperienceNodeData = WorkExperienceData & {
  type: 'workExperience';
  onNodeClick?: (data: any, nodeId?: string) => void;
  onNodeDelete?: (nodeId: string) => void;
  isHighlighted?: boolean;
  isFocused?: boolean;
  isBlurred?: boolean;
  isSelected?: boolean;
  [key: string]: unknown;
};

export type EducationNodeData = EducationData & {
  type: 'education';
  onNodeClick?: (data: any, nodeId?: string) => void;
  onNodeDelete?: (nodeId: string) => void;
  isHighlighted?: boolean;
  isFocused?: boolean;
  isBlurred?: boolean;
  isSelected?: boolean;
  [key: string]: unknown;
};

export type ProjectNodeData = ProjectData & {
  type: 'project';
  onNodeClick?: (data: any, nodeId?: string) => void;
  onNodeDelete?: (nodeId: string) => void;
  isHighlighted?: boolean;
  isSelected?: boolean;
  parentExperienceId: string;
  [key: string]: unknown;
};

export type ProfessionalJourneyNodeData = 
  | WorkExperienceNodeData 
  | EducationNodeData 
  | ProjectNodeData;

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
    
    if (reactFlowInstance) {
      // Use a shorter delay first, then retry with longer delay if needed
      const attemptZoom = (delay: number, attempt: number = 1) => {
        setTimeout(() => {
          const nodes = reactFlowInstance.getNodes();
          const focusedNode = nodes.find(node => node.id === nodeId);
          
          if (!focusedNode) {
            console.log('Focused node not found, attempt:', attempt);
            return;
          }
          
          // Find all connected project nodes
          const connectedNodes = nodes.filter(node => {
            if (node.id === nodeId) return true;
            return node.data?.parentExperienceId === nodeId || node.data?.experienceId === nodeId;
          });
          
          console.log(`Zoom attempt ${attempt}: Found ${connectedNodes.length} connected nodes for ${nodeId}`);
          
          if (connectedNodes.length > 1) {
            // We have project nodes - calculate bounds for all connected nodes
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
            
            // Add reasonable buffers
            const buffer = 80;
            const horizontalBuffer = extraModalSpace ? 150 : buffer; // Moderate horizontal space
            const verticalBuffer = extraModalSpace ? 600 : buffer; // Extra vertical space below for modal
            
            const bounds = {
              x: minX - horizontalBuffer,
              y: minY - buffer,
              width: (maxX + horizontalBuffer) - (minX - horizontalBuffer),
              height: (maxY + verticalBuffer) - (minY - buffer)
            };
            
            console.log('Zooming to multi-node bounds:', bounds);
            
            reactFlowInstance.fitBounds(bounds, {
              duration: 800,
              padding: 0.02, // Very small padding for more zoom in
            });
          } else if (attempt <= 2) {
            // Maybe project nodes haven't loaded yet, try again
            console.log(`No project nodes found yet, retrying in ${delay * 2}ms...`);
            attemptZoom(delay * 2, attempt + 1);
          } else {
            // Single node focus after max attempts
            console.log('Final fallback: single node focus');
            
            const modalWidth = extraModalSpace ? 200 : 100;
            const modalHeight = extraModalSpace ? 600 : 200;
            
            const bounds = {
              x: focusedNode.position.x - modalWidth,
              y: focusedNode.position.y - 100,
              width: 400 + (modalWidth * 2),
              height: 300 + modalHeight
            };
            
            reactFlowInstance.fitBounds(bounds, {
              duration: 800,
              padding: 0.02,
            });
          }
        }, delay);
      };
      
      attemptZoom(100); // Start with 100ms delay
    }
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
      });
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  },
}));