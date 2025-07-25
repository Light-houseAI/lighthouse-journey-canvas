// Store exports
export { useAuthStore } from './auth-store';
export { useTimelineStore } from './timeline-store';
export { useChatStore } from './chat-store';
export { useUIStore } from './ui-store';

// Type exports
export type { User } from './auth-store';
export type { 
  Milestone, 
  ProfileData 
} from './timeline-store';
export type { 
  ChatMessage, 
  ConversationState, 
  TimeFrame 
} from './chat-store';

// Enhanced hook exports
export {
  useAuthWithQuery,
  useTimelineWithQuery,
  useChatWithOptimistic,
  useUIOperations,
  useAppStores,
} from '../hooks/use-zustand-query';

// Store selectors for performance optimization
export const authSelectors = {
  user: (state: any) => state.user,
  isAuthenticated: (state: any) => state.isAuthenticated,
  isLoading: (state: any) => state.isLoading,
  error: (state: any) => state.error,
};

export const timelineSelectors = {
  nodes: (state: any) => state.nodes,
  selectedNodeId: (state: any) => state.selectedNodeId,
  isLoading: (state: any) => state.isLoading,
  profileData: (state: any) => state.profileData,
};

export const chatSelectors = {
  messages: (state: any) => state.messages,
  isProcessing: (state: any) => state.isProcessing,
  conversationState: (state: any) => state.conversationState,
  isOpen: (state: any) => state.isOpen,
};

export const uiSelectors = {
  theme: (state: any) => state.theme,
  toasts: (state: any) => state.toasts,
  modals: (state: any) => state.modals,
  isGlobalLoading: (state: any) => state.isGlobalLoading,
  features: (state: any) => state.features,
};