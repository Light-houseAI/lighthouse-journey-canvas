import { createWithEqualityFn } from 'zustand/traditional';
import { ReactFlowInstance } from '@xyflow/react';

/**
 * UI Coordinator Store
 * Single responsibility: React Flow instance management and timeline utilities
 * Coordinates between behavior stores but doesn't contain behavior state itself
 */
export interface UICoordinatorStore {
  // State
  reactFlowInstance: ReactFlowInstance | null;
  
  // Actions
  setReactFlowInstance: (instance: ReactFlowInstance) => void;
  autoFitTimeline: () => void;
  zoomToFocusedNode: (nodeId: string, extraModalSpace?: boolean) => void;
  logout: () => Promise<void>;
}

/**
 * UI coordination store following component-centric architecture
 * Manages React Flow instance and provides timeline utilities
 */
export const useUICoordinatorStore = createWithEqualityFn<UICoordinatorStore>((set, get) => ({
  // State
  reactFlowInstance: null,
  
  // Actions
  setReactFlowInstance: (instance: ReactFlowInstance) => {
    set({ reactFlowInstance: instance });
  },
  
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
      
      // Clear React Flow instance on logout
      set({
        reactFlowInstance: null,
      });
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  },
}));