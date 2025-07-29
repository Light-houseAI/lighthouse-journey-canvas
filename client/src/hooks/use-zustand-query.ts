import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/auth-store';
import { useChatStore } from '../stores/chat-store';
import { useUIStore } from '../stores/ui-store';

/**
 * Custom hook that integrates auth store with React Query for authentication operations
 */
export const useAuthWithQuery = () => {
  const authStore = useAuthStore();
  const { addToast } = useUIStore();
  const queryClient = useQueryClient();

  // Query for checking authentication status
  const authQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authStore.checkAuth,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: authStore.login,
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      addToast({
        type: 'success',
        title: 'Welcome back!',
        description: `Logged in as ${user.email}`,
      });
    },
    onError: (error: Error) => {
      addToast({
        type: 'error',
        title: 'Login failed',
        description: error.message,
      });
    },
  });

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: authStore.register,
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      addToast({
        type: 'success',
        title: 'Account created!',
        description: `Welcome, ${user.email}`,
      });
    },
    onError: (error: Error) => {
      addToast({
        type: 'error',
        title: 'Registration failed',
        description: error.message,
      });
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: authStore.logout,
    onSuccess: () => {
      queryClient.clear();
      addToast({
        type: 'success',
        title: 'Logged out',
        description: 'You have been successfully logged out',
      });
    },
  });

  // Update interest mutation
  const updateInterestMutation = useMutation({
    mutationFn: authStore.updateUserInterest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      addToast({
        type: 'success',
        title: 'Interest updated',
        description: 'Your interest has been updated successfully',
      });
    },
    onError: (error: Error) => {
      addToast({
        type: 'error',
        title: 'Update failed',
        description: error.message,
      });
    },
  });

  // Complete onboarding mutation
  const completeOnboardingMutation = useMutation({
    mutationFn: authStore.completeOnboarding,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      addToast({
        type: 'success',
        title: 'Onboarding complete!',
        description: 'Welcome to your journey canvas',
      });
    },
    onError: (error: Error) => {
      addToast({
        type: 'error',
        title: 'Onboarding failed',
        description: error.message,
      });
    },
  });

  return {
    ...authStore,
    authQuery,
    loginMutation,
    registerMutation,
    logoutMutation,
    updateInterestMutation,
    completeOnboardingMutation,
    isLoading: authStore.isLoading || authQuery.isLoading,
  };
};

// Timeline integration removed (legacy store deleted)

/**
 * Custom hook that integrates chat store with optimistic updates
 */
export const useChatWithOptimistic = () => {
  const chatStore = useChatStore();
  const { addToast } = useUIStore();

  // Enhanced message sending with optimistic updates
  const sendMessageOptimistic = async (message: string) => {
    const tempMessageId = `temp-${Date.now()}`;
    
    // Optimistically add user message
    chatStore.addMessage('user', message);
    
    // Add temporary assistant message
    chatStore.addMessage('assistant', '', true);
    
    try {
      await chatStore.sendMessageToAI(message);
    } catch (error) {
      // Remove temporary message and show error
      chatStore.addMessage('assistant', 'I apologize, but I encountered an error. Please try again.');
      addToast({
        type: 'error',
        title: 'Message failed',
        description: 'Your message could not be processed',
      });
    }
  };

  // Enhanced onboarding with error handling
  const handleOnboardingOptimistic = async (message: string) => {
    try {
      await chatStore.handleOnboardingWithAI(message);
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Onboarding error',
        description: 'There was an issue with the onboarding process',
      });
    }
  };

  return {
    ...chatStore,
    sendMessageOptimistic,
    handleOnboardingOptimistic,
  };
};

/**
 * Custom hook for UI operations with enhanced feedback
 */
export const useUIOperations = () => {
  const uiStore = useUIStore();

  // Enhanced toast function with auto-dismiss and stacking
  const showToast = (
    type: 'success' | 'error' | 'warning' | 'info',
    title: string,
    description?: string,
    duration?: number
  ) => {
    uiStore.addToast({
      type,
      title,
      description,
      duration,
    });
  };

  // Modal operations with promise support
  const showModal = (type: string, data?: any): Promise<any> => {
    return new Promise((resolve) => {
      uiStore.openModal(type, { ...data, resolve });
    });
  };

  // Loading operations with automatic cleanup
  const withLoading = async <T>(
    operation: () => Promise<T>,
    loadingKey: string,
    loadingMessage?: string
  ): Promise<T> => {
    try {
      uiStore.setLoadingState(loadingKey, true);
      if (loadingMessage) {
        uiStore.setGlobalLoading(true, loadingMessage);
      }
      
      const result = await operation();
      return result;
    } finally {
      uiStore.setLoadingState(loadingKey, false);
      if (loadingMessage) {
        uiStore.setGlobalLoading(false);
      }
    }
  };

  return {
    ...uiStore,
    showToast,
    showModal,
    withLoading,
  };
};

/**
 * Unified hook that provides access to all stores with integrated patterns
 */
export const useAppStores = () => {
  const auth = useAuthWithQuery();
  const chat = useChatWithOptimistic();
  const ui = useUIOperations();

  return {
    auth,
    chat,
    ui,
  };
};