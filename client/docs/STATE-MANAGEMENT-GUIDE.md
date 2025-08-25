# TanStack Query + Zustand State Management Guide

## Overview: Separation of Concerns

The key insight is that **server state and client state are fundamentally different** and should be managed by specialized tools:

- **TanStack Query**: Manages server state (async data from APIs)
- **Zustand**: Manages client state (UI state, user interactions)

```typescript
// 🌐 Server State (TanStack Query)
// - Timeline nodes from database
// - User profiles
// - Permissions
// - Any data that lives on the server

// 🖥️ Client State (Zustand)
// - Selected node ID
// - Expanded/collapsed nodes
// - Filter settings
// - Form draft state
// - UI preferences
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     React Components                         │
│                                                              │
│  const { data } = useQuery(...)  // Server state            │
│  const { selectedId } = useUIStore() // Client state        │
└──────────────┬────────────────────────┬────────────────────┘
               │                        │
               ▼                        ▼
┌──────────────────────────┐  ┌──────────────────────────────┐
│    TanStack Query        │  │         Zustand              │
│                          │  │                              │
│  • Server data caching   │  │  • UI state                  │
│  • Background refetch    │  │  • User preferences          │
│  • Optimistic updates    │  │  • Local form state          │
│  • Request deduplication │  │  • Selection/filters         │
│  • Infinite queries      │  │  • Temporary UI state        │
└──────────────────────────┘  └──────────────────────────────┘
               │                        │
               ▼                        ▼
         Backend APIs              Local Storage
```

## How They Work Together

### 1. Server State with TanStack Query

TanStack Query handles all data that originates from the server:

```typescript
// features/timeline/api/queries.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Fetching timeline nodes
export const useTimelineNodes = (userId: number) => {
  return useQuery({
    queryKey: ['timeline', 'nodes', userId],
    queryFn: async () => {
      const response = await fetch(`/api/v2/timeline/nodes?userId=${userId}`);
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000,   // Keep in cache for 10 minutes
  });
};

// Creating a new node with optimistic update
export const useCreateNode = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (newNode: CreateNodeData) => {
      const response = await fetch('/api/v2/timeline/nodes', {
        method: 'POST',
        body: JSON.stringify(newNode),
      });
      return response.json();
    },
    onMutate: async (newNode) => {
      // Optimistic update - immediately show in UI
      await queryClient.cancelQueries({ queryKey: ['timeline', 'nodes'] });
      const previousNodes = queryClient.getQueryData(['timeline', 'nodes']);
      
      queryClient.setQueryData(['timeline', 'nodes'], (old: any) => {
        return [...old, { ...newNode, id: 'temp-id', isOptimistic: true }];
      });
      
      return { previousNodes };
    },
    onError: (err, newNode, context) => {
      // Rollback on error
      queryClient.setQueryData(['timeline', 'nodes'], context.previousNodes);
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['timeline', 'nodes'] });
    },
  });
};
```

### 2. Client State with Zustand

Zustand manages all local UI state that doesn't need to persist on the server:

```typescript
// features/timeline/stores/timeline-ui.store.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface TimelineUIState {
  // Selection state
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  
  // View state
  expandedNodes: Set<string>;
  zoomLevel: number;
  viewMode: 'timeline' | 'hierarchy' | 'grid';
  
  // Filter state
  filters: {
    types: Set<TimelineNodeType>;
    dateRange: { start: Date | null; end: Date | null };
    searchQuery: string;
  };
  
  // Actions
  selectNode: (id: string | null) => void;
  toggleNodeExpanded: (id: string) => void;
  setFilters: (filters: Partial<TimelineUIState['filters']>) => void;
  resetFilters: () => void;
}

export const useTimelineUIStore = create<TimelineUIState>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        selectedNodeId: null,
        hoveredNodeId: null,
        expandedNodes: new Set(),
        zoomLevel: 1,
        viewMode: 'timeline',
        filters: {
          types: new Set(),
          dateRange: { start: null, end: null },
          searchQuery: '',
        },
        
        // Actions
        selectNode: (id) => set({ selectedNodeId: id }),
        
        toggleNodeExpanded: (id) => set((state) => {
          const expanded = new Set(state.expandedNodes);
          if (expanded.has(id)) {
            expanded.delete(id);
          } else {
            expanded.add(id);
          }
          return { expandedNodes: expanded };
        }),
        
        setFilters: (filters) => set((state) => ({
          filters: { ...state.filters, ...filters }
        })),
        
        resetFilters: () => set({
          filters: {
            types: new Set(),
            dateRange: { start: null, end: null },
            searchQuery: '',
          }
        }),
      }),
      {
        name: 'timeline-ui-storage', // Persist some UI state
        partialize: (state) => ({
          viewMode: state.viewMode,
          zoomLevel: state.zoomLevel,
        }),
      }
    )
  )
);
```

### 3. Integration Pattern: Combining Both States

Here's how components use both stores together:

```typescript
// features/timeline/components/TimelineView.tsx
export function TimelineView() {
  const { userId } = useAuth(); // Context for auth
  
  // Server state from TanStack Query
  const { 
    data: nodes, 
    isLoading, 
    error,
    refetch 
  } = useTimelineNodes(userId);
  
  // Client state from Zustand
  const {
    selectedNodeId,
    expandedNodes,
    filters,
    viewMode,
    selectNode,
    toggleNodeExpanded,
  } = useTimelineUIStore();
  
  // Derived state (computed from both)
  const filteredNodes = useMemo(() => {
    if (!nodes) return [];
    
    return nodes.filter(node => {
      // Apply client-side filters to server data
      if (filters.types.size > 0 && !filters.types.has(node.type)) {
        return false;
      }
      if (filters.searchQuery && !node.title.includes(filters.searchQuery)) {
        return false;
      }
      // Date range filtering...
      return true;
    });
  }, [nodes, filters]);
  
  // Find selected node from server data using client state
  const selectedNode = useMemo(
    () => nodes?.find(n => n.id === selectedNodeId),
    [nodes, selectedNodeId]
  );
  
  return (
    <div className="timeline-container">
      {isLoading && <LoadingSpinner />}
      {error && <ErrorMessage error={error} />}
      
      <TimelineCanvas
        nodes={filteredNodes}
        selectedNodeId={selectedNodeId}
        expandedNodes={expandedNodes}
        viewMode={viewMode}
        onNodeClick={selectNode}
        onNodeToggle={toggleNodeExpanded}
      />
      
      {selectedNode && (
        <NodeDetailsPanel node={selectedNode} />
      )}
    </div>
  );
}
```

### 4. Advanced Pattern: Optimistic Updates with Coordination

When creating or updating data, both stores work together:

```typescript
// features/timeline/hooks/useNodeOperations.ts
export function useNodeOperations() {
  const queryClient = useQueryClient();
  const { selectNode, expandedNodes } = useTimelineUIStore();
  const createNodeMutation = useCreateNode();
  
  const createNode = async (data: CreateNodeData) => {
    try {
      // Optimistic UI update
      const optimisticId = `temp-${Date.now()}`;
      
      // Update UI state immediately
      selectNode(optimisticId);
      
      // Server mutation with optimistic update
      const newNode = await createNodeMutation.mutateAsync({
        ...data,
        tempId: optimisticId,
      });
      
      // Update UI state with real ID
      selectNode(newNode.id);
      
      // If it's a parent node, expand it
      if (data.parentId && !expandedNodes.has(data.parentId)) {
        useTimelineUIStore.getState().toggleNodeExpanded(data.parentId);
      }
      
      return newNode;
    } catch (error) {
      // Reset UI state on error
      selectNode(null);
      throw error;
    }
  };
  
  return { createNode };
}
```

### 5. Synchronization Pattern: Server Changes Update UI

Sometimes server changes need to update UI state:

```typescript
// features/timeline/hooks/useTimelineSync.ts
export function useTimelineSync() {
  const { data: nodes } = useTimelineNodes();
  const { selectedNodeId, selectNode } = useTimelineUIStore();
  
  // If selected node is deleted on server, clear selection
  useEffect(() => {
    if (selectedNodeId && nodes) {
      const nodeExists = nodes.some(n => n.id === selectedNodeId);
      if (!nodeExists) {
        selectNode(null);
      }
    }
  }, [nodes, selectedNodeId, selectNode]);
  
  // Listen for real-time updates (WebSocket, SSE, etc.)
  useEffect(() => {
    const unsubscribe = subscribeToNodeUpdates((event) => {
      if (event.type === 'node.deleted' && event.nodeId === selectedNodeId) {
        selectNode(null);
      }
    });
    
    return unsubscribe;
  }, [selectedNodeId, selectNode]);
}
```

## Common Patterns & Best Practices

### 1. Form State Management

```typescript
// Temporary form state in Zustand, submit to server via TanStack Query
interface FormStore {
  draft: Partial<TimelineNode>;
  setDraft: (draft: Partial<TimelineNode>) => void;
  clearDraft: () => void;
}

const useFormStore = create<FormStore>((set) => ({
  draft: {},
  setDraft: (draft) => set({ draft }),
  clearDraft: () => set({ draft: {} }),
}));

function NodeEditForm({ nodeId }: { nodeId: string }) {
  const { draft, setDraft, clearDraft } = useFormStore();
  const updateMutation = useUpdateNode();
  
  const handleSubmit = async () => {
    await updateMutation.mutateAsync({ id: nodeId, ...draft });
    clearDraft(); // Clear local state after successful save
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <input
        value={draft.title || ''}
        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
      />
      {/* More fields... */}
    </form>
  );
}
```

### 2. Pagination with Both Stores

```typescript
// Server state handles data, client state handles page number
const usePaginatedNodes = () => {
  const { currentPage, setPage } = useTimelineUIStore();
  
  return useQuery({
    queryKey: ['nodes', 'paginated', currentPage],
    queryFn: () => fetchNodes({ page: currentPage, limit: 20 }),
    keepPreviousData: true, // Smooth pagination
  });
};
```

### 3. Search with Debouncing

```typescript
// Client state for immediate UI feedback, server query for results
function SearchableTimeline() {
  const { searchQuery, setSearchQuery } = useTimelineUIStore();
  const debouncedQuery = useDebounce(searchQuery, 300);
  
  const { data: searchResults } = useQuery({
    queryKey: ['timeline', 'search', debouncedQuery],
    queryFn: () => searchNodes(debouncedQuery),
    enabled: debouncedQuery.length > 2, // Only search 3+ characters
  });
  
  return (
    <div>
      <input
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search nodes..."
      />
      {/* Show results... */}
    </div>
  );
}
```

## Performance Benefits

### TanStack Query Optimizations
- **Request Deduplication**: Multiple components requesting same data = 1 API call
- **Background Refetching**: Keeps data fresh without blocking UI
- **Optimistic Updates**: Instant feedback for better UX
- **Infinite Queries**: Efficient pagination and scrolling
- **Selective Refetching**: Only refetch what changed

### Zustand Benefits
- **No Re-render Cascades**: Direct subscriptions to specific state slices
- **Computed Values**: Derive state without causing re-renders
- **Middleware Support**: Persist, devtools, immer for immutability
- **TypeScript**: Full type safety out of the box
- **Small Bundle**: ~8KB minified

## Migration Example

Here's how to migrate from a traditional all-in-one store:

```typescript
// ❌ OLD: Everything in one Zustand store
const useStore = create((set) => ({
  // Mixed concerns
  nodes: [],        // Server data
  loading: false,   // Server state
  selectedId: null, // UI state
  filters: {},      // UI state
  
  // API calls in store 😱
  fetchNodes: async () => {
    set({ loading: true });
    const nodes = await api.getNodes();
    set({ nodes, loading: false });
  },
}));

// ✅ NEW: Separated concerns
// Server state with TanStack Query
const useNodes = () => useQuery({
  queryKey: ['nodes'],
  queryFn: api.getNodes,
});

// UI state with Zustand
const useUIStore = create((set) => ({
  selectedId: null,
  filters: {},
  setSelectedId: (id) => set({ selectedId: id }),
  setFilters: (filters) => set({ filters }),
}));

// Usage in component
function Timeline() {
  const { data: nodes, isLoading } = useNodes(); // Server state
  const { selectedId, filters } = useUIStore();  // UI state
  
  // Clean separation of concerns ✨
}
```

## Testing Strategy

### Testing TanStack Query

```typescript
// tests/timeline.test.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

test('fetches timeline nodes', async () => {
  const { result } = renderHook(() => useTimelineNodes(1), {
    wrapper: createWrapper(),
  });
  
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toHaveLength(3);
});
```

### Testing Zustand

```typescript
// tests/timeline-ui-store.test.ts
import { renderHook, act } from '@testing-library/react';
import { useTimelineUIStore } from '../stores/timeline-ui.store';

beforeEach(() => {
  useTimelineUIStore.setState({
    selectedNodeId: null,
    expandedNodes: new Set(),
  });
});

test('selects and deselects nodes', () => {
  const { result } = renderHook(() => useTimelineUIStore());
  
  act(() => {
    result.current.selectNode('node-1');
  });
  
  expect(result.current.selectedNodeId).toBe('node-1');
});
```

## Summary

The combination of TanStack Query and Zustand provides:

1. **Clear Separation**: Server state vs client state
2. **Optimal Performance**: Each tool optimized for its domain
3. **Better DX**: Less boilerplate, better TypeScript support
4. **Scalability**: Grows with your application
5. **Testing**: Easier to test in isolation

The key is understanding that **server state is a cache of remote data**, while **client state is ephemeral UI state**. By using the right tool for each job, you get a simpler, more maintainable architecture.