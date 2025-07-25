import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { Node, Edge } from '@xyflow/react';

export interface Milestone {
  id: string;
  title: string;
  type: 'education' | 'job' | 'transition' | 'skill' | 'event' | 'project' | 'update';
  date: string;
  startDate?: string;
  endDate?: string;
  duration?: string;
  description: string;
  skills: string[];
  organization?: string;
  objectives?: string;
  technologies?: string[];
  impact?: string;
  challenges?: string;
  teamSize?: number;
  budget?: string;
  outcomes?: string[];
  lessonsLearned?: string;
  isSubMilestone?: boolean;
  parentId?: string;
}

export interface ProfileData {
  name: string;
  headline?: string;
  location?: string;
  about?: string;
  avatarUrl?: string;
  experiences: Array<{
    title: string;
    company: string;
    start?: string;
    end?: string;
    description?: string;
  }>;
  education: Array<{
    school: string;
    degree?: string;
    field?: string;
    start?: string;
    end?: string;
  }>;
  skills: string[];
}

interface TimelineState {
  // Data state
  nodes: Node[];
  edges: Edge[];
  profileData: ProfileData | null;
  milestones: Milestone[];
  
  // UI state
  isLoading: boolean;
  error: string | null;
  selectedNodeId: string | null;
  viewportPosition: { x: number; y: number; zoom: number };
  timeRange: { start: number; end: number };
  
  // Filters and display options
  visibleCategories: Set<string>;
  skillsVisible: boolean;
  timelineMode: 'compact' | 'detailed';
  
  // Actions - Data Management
  setProfileData: (data: ProfileData) => void;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  addNode: (node: Node) => void;
  updateNode: (nodeId: string, updates: Partial<Node>) => void;
  removeNode: (nodeId: string) => void;
  addMilestone: (parentNodeId: string, milestone: Milestone) => void;
  updateMilestone: (nodeId: string, milestoneId: string, updates: Partial<Milestone>) => void;
  removeMilestone: (nodeId: string, milestoneId: string) => void;
  
  // Actions - UI Management
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSelectedNode: (nodeId: string | null) => void;
  setViewportPosition: (position: { x: number; y: number; zoom: number }) => void;
  setTimeRange: (range: { start: number; end: number }) => void;
  
  // Actions - Display Options
  toggleCategory: (category: string) => void;
  setSkillsVisible: (visible: boolean) => void;
  setTimelineMode: (mode: 'compact' | 'detailed') => void;
  
  // Actions - Navigation
  navigateToNode: (nodeId: string) => void;
  centerOnTimeRange: (startYear: number, endYear: number) => void;
  
  // Actions - API calls
  loadProfileData: (username: string) => Promise<void>;
  saveTimelineChanges: () => Promise<void>;
  
  // Computed values
  getVisibleNodes: () => Node[];
  getNodesByYear: (year: number) => Node[];
  getNodeMilestones: (nodeId: string) => Milestone[];
}

export const useTimelineStore = create<TimelineState>()(
  devtools(
    immer((set, get) => ({
      // Initial state
      nodes: [],
      edges: [],
      profileData: null,
      milestones: [],
      
      isLoading: false,
      error: null,
      selectedNodeId: null,
      viewportPosition: { x: 0, y: 0, zoom: 1 },
      timeRange: { start: 2020, end: new Date().getFullYear() },
      
      visibleCategories: new Set(['job', 'education', 'project']),
      skillsVisible: true,
      timelineMode: 'detailed',

      // Data Management Actions
      setProfileData: (data) => set((state) => {
        state.profileData = data;
        state.error = null;
      }),

      setNodes: (nodes) => set((state) => {
        state.nodes = nodes;
      }),

      setEdges: (edges) => set((state) => {
        state.edges = edges;
      }),

      addNode: (node) => set((state) => {
        state.nodes.push(node);
      }),

      updateNode: (nodeId, updates) => set((state) => {
        const nodeIndex = state.nodes.findIndex(n => n.id === nodeId);
        if (nodeIndex !== -1) {
          state.nodes[nodeIndex] = { ...state.nodes[nodeIndex], ...updates };
        }
      }),

      removeNode: (nodeId) => set((state) => {
        state.nodes = state.nodes.filter(n => n.id !== nodeId);
        state.edges = state.edges.filter(e => e.source !== nodeId && e.target !== nodeId);
      }),

      addMilestone: (parentNodeId, milestone) => set((state) => {
        const nodeIndex = state.nodes.findIndex(n => n.id === parentNodeId);
        if (nodeIndex !== -1) {
          const node = state.nodes[nodeIndex];
          if (!node.data.subMilestones) {
            node.data.subMilestones = [];
          }
          node.data.subMilestones.push(milestone);
        }
        state.milestones.push(milestone);
      }),

      updateMilestone: (nodeId, milestoneId, updates) => set((state) => {
        const nodeIndex = state.nodes.findIndex(n => n.id === nodeId);
        if (nodeIndex !== -1) {
          const node = state.nodes[nodeIndex];
          if (node.data.subMilestones) {
            const milestoneIndex = node.data.subMilestones.findIndex((m: any) => m.id === milestoneId);
            if (milestoneIndex !== -1) {
              node.data.subMilestones[milestoneIndex] = { 
                ...node.data.subMilestones[milestoneIndex], 
                ...updates 
              };
            }
          }
        }
        
        const globalMilestoneIndex = state.milestones.findIndex(m => m.id === milestoneId);
        if (globalMilestoneIndex !== -1) {
          state.milestones[globalMilestoneIndex] = { 
            ...state.milestones[globalMilestoneIndex], 
            ...updates 
          };
        }
      }),

      removeMilestone: (nodeId, milestoneId) => set((state) => {
        const nodeIndex = state.nodes.findIndex(n => n.id === nodeId);
        if (nodeIndex !== -1) {
          const node = state.nodes[nodeIndex];
          if (node.data.subMilestones) {
            node.data.subMilestones = node.data.subMilestones.filter((m: any) => m.id !== milestoneId);
          }
        }
        state.milestones = state.milestones.filter(m => m.id !== milestoneId);
      }),

      // UI Management Actions
      setLoading: (loading) => set((state) => {
        state.isLoading = loading;
      }),

      setError: (error) => set((state) => {
        state.error = error;
        state.isLoading = false;
      }),

      setSelectedNode: (nodeId) => set((state) => {
        state.selectedNodeId = nodeId;
      }),

      setViewportPosition: (position) => set((state) => {
        state.viewportPosition = position;
      }),

      setTimeRange: (range) => set((state) => {
        state.timeRange = range;
      }),

      // Display Options Actions
      toggleCategory: (category) => set((state) => {
        if (state.visibleCategories.has(category)) {
          state.visibleCategories.delete(category);
        } else {
          state.visibleCategories.add(category);
        }
      }),

      setSkillsVisible: (visible) => set((state) => {
        state.skillsVisible = visible;
      }),

      setTimelineMode: (mode) => set((state) => {
        state.timelineMode = mode;
      }),

      // Navigation Actions
      navigateToNode: (nodeId) => set((state) => {
        state.selectedNodeId = nodeId;
        // Trigger navigation event
        window.dispatchEvent(new CustomEvent('navigateTimeline', {
          detail: { nodeId }
        }));
      }),

      centerOnTimeRange: (startYear, endYear) => set((state) => {
        state.timeRange = { start: startYear, end: endYear };
        // Calculate viewport position to center on this range
        // This would need to be implemented based on your timeline layout
      }),

      // API Actions
      loadProfileData: async (username) => {
        const { setLoading, setError, setProfileData } = get();
        
        try {
          setLoading(true);
          setError(null);

          const response = await fetch(`/api/profile/${username}`);
          
          if (!response.ok) {
            throw new Error('Failed to load profile data');
          }

          const data = await response.json();
          setProfileData(data);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to load profile';
          setError(message);
        } finally {
          setLoading(false);
        }
      },

      saveTimelineChanges: async () => {
        const { nodes, milestones, setError } = get();
        
        try {
          setError(null);

          const response = await fetch('/api/timeline/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ nodes, milestones }),
          });

          if (!response.ok) {
            throw new Error('Failed to save timeline changes');
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to save changes';
          setError(message);
          throw error;
        }
      },

      // Computed values
      getVisibleNodes: () => {
        const { nodes, visibleCategories } = get();
        return nodes.filter(node => visibleCategories.has(node.data.type));
      },

      getNodesByYear: (year) => {
        const { nodes } = get();
        return nodes.filter(node => {
          const nodeYear = new Date(node.data.date || node.data.startDate).getFullYear();
          return nodeYear === year;
        });
      },

      getNodeMilestones: (nodeId) => {
        const { nodes } = get();
        const node = nodes.find(n => n.id === nodeId);
        return node?.data.subMilestones || [];
      },
    })),
    { name: 'timeline-store' }
  )
);