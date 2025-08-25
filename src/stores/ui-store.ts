import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  description?: string;
  duration?: number;
}

interface Modal {
  id: string;
  type: string;
  isOpen: boolean;
  data?: any;
}

interface UIState {
  // Global loading states
  isGlobalLoading: boolean;
  loadingMessage: string | null;
  
  // Toast notifications
  toasts: Toast[];
  
  // Modal management
  modals: Modal[];
  
  // Navigation state
  currentPage: string;
  navigationHistory: string[];
  
  // Theme and preferences
  theme: 'light' | 'dark' | 'system';
  sidebarCollapsed: boolean;
  preferredLanguage: string;
  
  // Feature flags
  features: Record<string, boolean>;
  
  // Viewport and responsive
  isMobile: boolean;
  viewport: { width: number; height: number };
  
  // Loading states for specific operations
  loadingStates: Record<string, boolean>;
  
  // Actions - Global Loading
  setGlobalLoading: (loading: boolean, message?: string) => void;
  
  // Actions - Toast Management
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
  
  // Actions - Modal Management
  openModal: (type: string, data?: any) => void;
  closeModal: (id: string) => void;
  closeAllModals: () => void;
  isModalOpen: (type: string) => boolean;
  
  // Actions - Navigation
  setCurrentPage: (page: string) => void;
  navigateBack: () => void;
  
  // Actions - Theme and Preferences
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setPreferredLanguage: (language: string) => void;
  
  // Actions - Feature Flags
  setFeature: (key: string, enabled: boolean) => void;
  isFeatureEnabled: (key: string) => boolean;
  
  // Actions - Viewport
  setViewport: (viewport: { width: number; height: number }) => void;
  setIsMobile: (isMobile: boolean) => void;
  
  // Actions - Specific Loading States
  setLoadingState: (key: string, loading: boolean) => void;
  isLoading: (key: string) => boolean;
  
  // Utility actions
  reset: () => void;
}

export const useUIStore = create<UIState>()(
  devtools(
    persist(
      immer((set, get) => ({
        // Initial state
        isGlobalLoading: false,
        loadingMessage: null,
        toasts: [],
        modals: [],
        currentPage: '/',
        navigationHistory: [],
        theme: 'system',
        sidebarCollapsed: false,
        preferredLanguage: 'en',
        features: {
          skillExtraction: true,
          voiceChat: true,
          timelineScrubber: true,
          advancedFiltering: true,
        },
        isMobile: false,
        viewport: { width: 1920, height: 1080 },
        loadingStates: {},

        // Global Loading Actions
        setGlobalLoading: (loading, message) => set((state) => {
          state.isGlobalLoading = loading;
          state.loadingMessage = message || null;
        }),

        // Toast Management Actions
        addToast: (toast) => set((state) => {
          const newToast: Toast = {
            ...toast,
            id: `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            duration: toast.duration || 5000,
          };
          state.toasts.push(newToast);
          
          // Auto-remove toast after duration
          if (newToast.duration > 0) {
            setTimeout(() => {
              set((state) => {
                state.toasts = state.toasts.filter(t => t.id !== newToast.id);
              });
            }, newToast.duration);
          }
        }),

        removeToast: (id) => set((state) => {
          state.toasts = state.toasts.filter(t => t.id !== id);
        }),

        clearToasts: () => set((state) => {
          state.toasts = [];
        }),

        // Modal Management Actions
        openModal: (type, data) => set((state) => {
          const modal: Modal = {
            id: `modal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type,
            isOpen: true,
            data,
          };
          
          // Close existing modals of the same type
          state.modals = state.modals.filter(m => m.type !== type);
          state.modals.push(modal);
        }),

        closeModal: (id) => set((state) => {
          const modalIndex = state.modals.findIndex(m => m.id === id);
          if (modalIndex !== -1) {
            state.modals[modalIndex].isOpen = false;
            // Remove modal after animation
            setTimeout(() => {
              set((state) => {
                state.modals = state.modals.filter(m => m.id !== id);
              });
            }, 300);
          }
        }),

        closeAllModals: () => set((state) => {
          state.modals.forEach(modal => {
            modal.isOpen = false;
          });
          // Clear all modals after animations
          setTimeout(() => {
            set((state) => {
              state.modals = [];
            });
          }, 300);
        }),

        isModalOpen: (type) => {
          const { modals } = get();
          return modals.some(m => m.type === type && m.isOpen);
        },

        // Navigation Actions
        setCurrentPage: (page) => set((state) => {
          if (state.currentPage !== page) {
            state.navigationHistory.push(state.currentPage);
            state.currentPage = page;
            
            // Limit history size
            if (state.navigationHistory.length > 10) {
              state.navigationHistory.shift();
            }
          }
        }),

        navigateBack: () => set((state) => {
          if (state.navigationHistory.length > 0) {
            const previousPage = state.navigationHistory.pop();
            if (previousPage) {
              state.currentPage = previousPage;
            }
          }
        }),

        // Theme and Preferences Actions
        setTheme: (theme) => set((state) => {
          state.theme = theme;
        }),

        setSidebarCollapsed: (collapsed) => set((state) => {
          state.sidebarCollapsed = collapsed;
        }),

        setPreferredLanguage: (language) => set((state) => {
          state.preferredLanguage = language;
        }),

        // Feature Flags Actions
        setFeature: (key, enabled) => set((state) => {
          state.features[key] = enabled;
        }),

        isFeatureEnabled: (key) => {
          const { features } = get();
          return features[key] || false;
        },

        // Viewport Actions
        setViewport: (viewport) => set((state) => {
          state.viewport = viewport;
        }),

        setIsMobile: (isMobile) => set((state) => {
          state.isMobile = isMobile;
        }),

        // Specific Loading States Actions
        setLoadingState: (key, loading) => set((state) => {
          if (loading) {
            state.loadingStates[key] = true;
          } else {
            delete state.loadingStates[key];
          }
        }),

        isLoading: (key) => {
          const { loadingStates } = get();
          return loadingStates[key] || false;
        },

        // Utility Actions
        reset: () => set((state) => {
          state.toasts = [];
          state.modals = [];
          state.loadingStates = {};
          state.isGlobalLoading = false;
          state.loadingMessage = null;
        }),
      })),
      {
        name: 'ui-store',
        partialize: (state) => ({
          theme: state.theme,
          sidebarCollapsed: state.sidebarCollapsed,
          preferredLanguage: state.preferredLanguage,
          features: state.features,
        }),
      }
    ),
    { name: 'ui-store' }
  )
);