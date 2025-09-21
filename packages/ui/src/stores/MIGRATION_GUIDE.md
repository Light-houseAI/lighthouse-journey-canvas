# Zustand Store Migration Guide

This guide explains how to migrate from the existing React Query + local state patterns to the new Zustand-based state management system.

## Overview

The new state management system uses Zustand stores integrated with React Query for optimal performance and developer experience. Each store handles a specific domain of the application:

- **Auth Store**: User authentication, login/logout, onboarding
- **Timeline Store**: Professional journey data, nodes, milestones
- **Chat Store**: Chat messages, conversation state, AI interactions
- **UI Store**: Global UI state, themes, modals, toasts, loading states

## Migration Examples

### Before (Old Pattern)
```tsx
// Old useAuth hook pattern
import { useAuth } from '../hooks/useAuth';

function LoginForm() {
  const { login, isLoading, error } = useAuth();
  const [email, setEmail] = useState('');
  // ... component logic
}
```

### After (New Zustand Pattern)
```tsx
// New Zustand + React Query integration
import { useAuthWithQuery } from '../stores';

function LoginForm() {
  const { loginMutation, user, isLoading } = useAuthWithQuery();
  const [email, setEmail] = useState('');
  
  const handleLogin = () => {
    loginMutation.mutate({ email, password });
  };
  // ... component logic
}
```

## Store Usage Patterns

### 1. Authentication
```tsx
import { useAuthWithQuery } from '../stores';

function App() {
  const { 
    user, 
    isAuthenticated, 
    loginMutation, 
    logoutMutation,
    completeOnboardingMutation 
  } = useAuthWithQuery();
  
  // The store automatically handles:
  // - Persistence of auth state
  // - Toast notifications on success/error
  // - Query invalidation
  // - Loading states
}
```

### 2. Timeline/Journey Management
```tsx
import { useTimelineWithQuery } from '../stores';

function ProfessionalJourney() {
  const { 
    nodes, 
    edges, 
    addMilestone, 
    saveTimelineMutation,
    isLoading 
  } = useTimelineWithQuery();
  
  const handleAddMilestone = (parentNodeId: string, milestone: Milestone) => {
    addMilestone(parentNodeId, milestone);
    saveTimelineMutation.mutate(); // Auto-saves with error handling
  };
}
```

### 3. Chat Integration
```tsx
import { useChatWithOptimistic } from '../stores';

function ChatInterface() {
  const { 
    messages, 
    sendMessageOptimistic, 
    isProcessing,
    conversationState 
  } = useChatWithOptimistic();
  
  // Optimistic updates for better UX
  const handleSend = (message: string) => {
    sendMessageOptimistic(message); // Handles optimistic UI updates
  };
}
```

### 4. UI State Management
```tsx
import { useUIOperations } from '../stores';

function SomeComponent() {
  const { 
    showToast, 
    showModal, 
    withLoading,
    theme,
    setTheme 
  } = useUIOperations();
  
  const handleOperation = async () => {
    await withLoading(
      () => performAsyncOperation(),
      'operation-key',
      'Processing...'
    );
    
    showToast('success', 'Operation completed!');
  };
}
```

## Advanced Patterns

### 1. Unified Store Access
```tsx
import { useAppStores } from '../stores';

function ComplexComponent() {
  const { auth, timeline, chat, ui } = useAppStores();
  
  // Access all stores in one hook for complex interactions
  const handleComplexOperation = async () => {
    if (!auth.isAuthenticated) {
      ui.showToast('error', 'Please log in first');
      return;
    }
    
    chat.setIsProcessing(true);
    await timeline.saveTimelineMutation.mutateAsync();
    chat.setIsProcessing(false);
  };
}
```

### 2. Selectors for Performance
```tsx
import { useAuthStore, authSelectors } from '../stores';

function UserDisplay() {
  // Only re-render when user changes, not other auth state
  const user = useAuthStore(authSelectors.user);
  
  return <div>{user?.email}</div>;
}
```

### 3. Store Composition
```tsx
import { useAuthStore, useUIStore } from '../stores';

function useAuthWithUI() {
  const auth = useAuthStore();
  const ui = useUIStore();
  
  const loginWithToast = async (credentials: any) => {
    try {
      await auth.login(credentials);
      ui.addToast({
        type: 'success',
        title: 'Welcome back!',
        description: `Logged in as ${credentials.email}`,
      });
    } catch (error) {
      ui.addToast({
        type: 'error',
        title: 'Login failed',
        description: error.message,
      });
    }
  };
  
  return { ...auth, loginWithToast };
}
```

## Best Practices

### 1. Use Enhanced Hooks
Always prefer the enhanced hooks (`useAuthWithQuery`, `useTimelineWithQuery`, etc.) over direct store access for components that need API integration.

### 2. Leverage Optimistic Updates
Use the optimistic update patterns for better UX, especially in chat and real-time interactions.

### 3. Error Handling
The enhanced hooks automatically handle errors and show toast notifications. Rely on this instead of manual error handling.

### 4. Loading States
Use the built-in loading states and the `withLoading` helper for consistent loading UX.

### 5. Persistence
Auth and UI preferences are automatically persisted. Don't manually handle localStorage for these concerns.

## Migration Checklist

- [ ] Replace `useAuth` hook usage with `useAuthWithQuery`
- [ ] Update chat components to use `useChatWithOptimistic`
- [ ] Migrate timeline components to `useTimelineWithQuery`
- [ ] Replace manual toast/modal management with `useUIOperations`
- [ ] Update imports to use the centralized `/stores` export
- [ ] Remove old state management code and hooks
- [ ] Test persistence behavior across browser sessions
- [ ] Verify error handling and loading states work correctly

## Performance Notes

- Zustand stores are optimized for minimal re-renders
- Use selectors for performance-critical components
- The stores integrate seamlessly with React Query's caching
- Persistence is handled efficiently with automatic serialization
- Store actions are batched and optimized automatically