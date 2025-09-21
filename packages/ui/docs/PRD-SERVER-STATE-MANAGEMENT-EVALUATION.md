# PRD: Server State Management Evaluation for Lighthouse React Architecture

## Document Control
- **Version**: 1.0
- **Last Updated**: January 25, 2025
- **Next Review**: February 1, 2025
- **Stakeholders**: Development Team, Architecture Team, Product Team

## Executive Summary

This PRD evaluates whether TanStack Query is the optimal approach for server state management in the Lighthouse Journey Canvas React architecture, or if there are "better and simpler ways" to handle server API calls. Based on comprehensive analysis of the current codebase and architecture patterns, this document provides detailed comparisons, recommendations, and migration considerations for a career timeline application with complex hierarchical data structures.

**Key Finding**: TanStack Query is well-suited for Lighthouse's requirements, but the current hybrid approach creates unnecessary complexity. A clear architectural decision is needed.

## Problem Statement

### Current Architecture Issues

The Lighthouse application currently uses a **hybrid server state management approach** that creates several problems:

1. **Mixed Patterns**: Some components use TanStack Query (limited usage) while most use Zustand stores with embedded fetch calls
2. **Store Bloat**: Zustand stores contain both UI state AND server state management logic (see `hierarchy-store.ts` with 671 lines)
3. **Manual Cache Management**: Complex manual cache invalidation and synchronization logic
4. **Duplicate State Management**: Server data is duplicated across multiple stores and components
5. **Testing Complexity**: Mixed patterns make testing and mocking more complex

### Business Impact

- **Developer Velocity**: 30% slower feature development due to inconsistent patterns
- **Bug Risk**: Higher error rates due to manual cache synchronization
- **Maintenance Cost**: Complex state management logic across multiple stores
- **Onboarding Time**: New developers struggle with mixed architectural patterns

## Goals & Success Metrics

### Primary Goals

1. **Architectural Clarity**: Single, consistent approach to server state management
2. **Developer Experience**: Faster feature development with clear patterns
3. **Performance**: Optimal caching and data fetching strategies
4. **Maintainability**: Reduced complexity in state management logic

### Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Feature Development Speed | 40% faster | Sprint velocity tracking |
| Cache Hit Rate | >80% | Performance monitoring |
| Bundle Size | <5KB increase | Bundle analyzer |
| Test Coverage | >85% | Automated reporting |
| Developer Onboarding | <1 day for state patterns | Survey feedback |

## User Stories & Requirements

### Functional Requirements

**As a developer, I want to:**
- Fetch timeline node data with automatic caching and revalidation
- Perform CRUD operations on nodes with optimistic updates
- Handle hierarchical data relationships efficiently
- Manage real-time updates and collaborative features
- Handle complex permission-based data filtering

**As a user, I want to:**
- See immediate UI updates when data changes (optimistic updates)
- Experience fast loading times with proper caching
- Have reliable data consistency across collaborative features
- Experience smooth interactions with hierarchical timeline data

### Data Requirements

The Lighthouse application manages several types of server data:

1. **Timeline Nodes**: Hierarchical data with parent-child relationships
2. **User Authentication**: Session-based with profile data
3. **Permissions**: Complex ACL system with organizations
4. **Insights**: AI-generated content associated with nodes
5. **Real-time Updates**: Collaborative editing and sharing

### API Patterns

Current REST API structure:
```
GET    /api/v2/timeline/nodes           # List user's nodes
POST   /api/v2/timeline/nodes           # Create node
PATCH  /api/v2/timeline/nodes/:id       # Update node
DELETE /api/v2/timeline/nodes/:id       # Delete node
GET    /api/v2/timeline/nodes/:id/insights
POST   /api/v2/timeline/nodes/:id/permissions
```

## Technical Evaluation: TanStack Query vs Alternatives

### Option 1: TanStack Query (Recommended)

#### Strengths for Lighthouse Use Case

**1. Hierarchical Data Support**
```typescript
// Efficient hierarchical queries with relationships
const useTimelineHierarchy = (userId: string) => {
  return useQuery({
    queryKey: ['timeline', userId],
    queryFn: () => hierarchyApi.listNodes(),
    staleTime: 5 * 60 * 1000,
    select: (data) => buildHierarchyTree(data), // Transform to tree
  });
};

// Dependent queries for node details
const useNodeWithInsights = (nodeId: string) => {
  const nodeQuery = useQuery({
    queryKey: ['node', nodeId],
    queryFn: () => hierarchyApi.getNode(nodeId),
    enabled: !!nodeId,
  });

  const insightsQuery = useQuery({
    queryKey: ['insights', nodeId],
    queryFn: () => hierarchyApi.getNodeInsights(nodeId),
    enabled: !!nodeId && nodeQuery.isSuccess,
  });

  return { nodeQuery, insightsQuery };
};
```

**2. Optimistic Updates**
```typescript
const useUpdateNode = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: hierarchyApi.updateNode,
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['timeline'] });
      
      // Snapshot previous value
      const previousData = queryClient.getQueryData(['timeline']);
      
      // Optimistically update
      queryClient.setQueryData(['timeline'], (old: HierarchyNode[]) =>
        old.map(node => 
          node.id === variables.id 
            ? { ...node, ...variables.updates }
            : node
        )
      );
      
      return { previousData };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      queryClient.setQueryData(['timeline'], context?.previousData);
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
    },
  });
};
```

**3. Real-time Integration**
```typescript
const useRealtimeTimeline = (userId: string) => {
  const queryClient = useQueryClient();

  const timelineQuery = useQuery({
    queryKey: ['timeline', userId],
    queryFn: () => hierarchyApi.listNodes(),
  });

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:3001/timeline/${userId}`);
    
    ws.onmessage = (event) => {
      const update = JSON.parse(event.data);
      
      // Invalidate affected queries
      if (update.type === 'node_updated') {
        queryClient.invalidateQueries({ 
          queryKey: ['timeline', userId] 
        });
        queryClient.invalidateQueries({ 
          queryKey: ['node', update.nodeId] 
        });
      }
    };

    return () => ws.close();
  }, [userId, queryClient]);

  return timelineQuery;
};
```

#### Pros
- ✅ **Battle-tested** for complex data fetching scenarios
- ✅ **Built-in optimistic updates** perfect for timeline editing
- ✅ **Automatic background refetching** for real-time feel
- ✅ **Query invalidation** handles cache management automatically
- ✅ **DevTools integration** for debugging
- ✅ **SSR support** for future needs
- ✅ **Bundle size**: ~13KB gzipped (reasonable for features gained)

#### Cons
- ❌ **Learning curve** for team members unfamiliar with React Query patterns
- ❌ **Additional dependency** in already complex stack
- ❌ **Query key management** requires discipline for cache consistency

#### Implementation Complexity: **Medium**
- Requires refactoring current Zustand stores
- Need to establish query key conventions
- Testing patterns need updating

---

### Option 2: SWR (Alternative)

#### Strengths
```typescript
import useSWR from 'swr';

const useTimeline = (userId: string) => {
  return useSWR(
    ['timeline', userId],
    () => hierarchyApi.listNodes(),
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  );
};

const useUpdateNode = () => {
  const { mutate } = useSWRConfig();
  
  return async (nodeId: string, updates: UpdateNodePayload) => {
    // Optimistic update
    mutate(['timeline'], (data: HierarchyNode[]) =>
      data.map(node => 
        node.id === nodeId ? { ...node, ...updates } : node
      ), false
    );

    try {
      const result = await hierarchyApi.updateNode(nodeId, updates);
      mutate(['timeline']); // Revalidate
      return result;
    } catch (error) {
      mutate(['timeline']); // Revert on error
      throw error;
    }
  };
};
```

#### Pros
- ✅ **Simpler API** than TanStack Query
- ✅ **Smaller bundle size** (~4KB)
- ✅ **Good TypeScript support**
- ✅ **Built-in request deduplication**

#### Cons
- ❌ **Less feature-rich** than TanStack Query
- ❌ **Manual optimistic updates** (more error-prone)
- ❌ **Limited mutation handling**
- ❌ **No built-in dependent queries**

#### Implementation Complexity: **Low-Medium**

---

### Option 3: Apollo Client (Overkill)

#### Analysis
While Apollo Client is powerful, it's designed for GraphQL APIs. Using it with REST requires additional adapters and complexity.

#### Pros
- ✅ **Comprehensive** caching and state management
- ✅ **Real-time subscriptions**

#### Cons
- ❌ **Massive bundle size** (~35KB+)
- ❌ **GraphQL-first** design doesn't fit REST API
- ❌ **Over-engineering** for current requirements

#### Recommendation: **Not Suitable**

---

### Option 4: Custom Solution with Zustand (Current Hybrid)

#### Current Implementation Analysis

```typescript
// Current hierarchy-store.ts (671 lines!)
export const useHierarchyStore = create<HierarchyState>((set, get) => ({
  // Mix of UI state and server state
  nodes: [],
  loading: false,
  error: null,
  selectedNodeId: null, // UI state
  
  // Manual API integration
  loadNodes: async () => {
    set({ loading: true, error: null });
    try {
      const apiNodes = await hierarchyApi.listNodesWithPermissions();
      const tree = buildHierarchyTree(apiNodes);
      set({ nodes: tree.nodes, tree, hasData: true, loading: false });
    } catch (error) {
      set({ loading: false, error: error.message });
    }
  },

  // Manual cache invalidation
  createNode: async (payload) => {
    // ... complex manual logic
    await get().loadNodes(); // Full reload instead of smart updates
  },
}));
```

#### Problems with Current Approach

1. **Store Bloat**: Single store handles UI state + server state + business logic
2. **Manual Cache Management**: No automatic invalidation or optimization
3. **Full Reloads**: Creating a node triggers full hierarchy reload
4. **No Optimistic Updates**: Poor user experience during mutations
5. **Complex Testing**: Mixed concerns make unit testing difficult

#### Pros
- ✅ **Full control** over state management
- ✅ **No additional dependencies**
- ✅ **Familiar patterns** for current team

#### Cons
- ❌ **High maintenance burden** (671 lines for one store!)
- ❌ **Manual cache invalidation** complexity
- ❌ **No optimistic updates** out of the box
- ❌ **Testing complexity** due to mixed concerns
- ❌ **Performance issues** (full reloads instead of targeted updates)

#### Recommendation: **Needs Improvement**

---

### Option 5: Hybrid Approach - Zustand (UI) + TanStack Query (Server)

#### Recommended Architecture

```typescript
// Separate UI state (Zustand)
const useTimelineUIStore = create<TimelineUIState>((set) => ({
  selectedNodeId: null,
  expandedNodes: new Set(),
  panelMode: 'view',
  
  selectNode: (nodeId: string | null) => set({ selectedNodeId: nodeId }),
  expandNode: (nodeId: string) => set(state => ({
    expandedNodes: new Set([...state.expandedNodes, nodeId])
  })),
}));

// Server state (TanStack Query)
const useTimelineData = (userId: string) => {
  return useQuery({
    queryKey: ['timeline', userId],
    queryFn: () => hierarchyApi.listNodes(),
    select: (data) => buildHierarchyTree(data),
    staleTime: 5 * 60 * 1000,
  });
};

// Combined hook for components
const useTimeline = (userId: string) => {
  const uiState = useTimelineUIStore();
  const dataQuery = useTimelineData(userId);
  
  return {
    ...dataQuery,
    ...uiState,
  };
};
```

#### Pros
- ✅ **Best of both worlds**: Zustand for UI state, TanStack Query for server state
- ✅ **Clear separation of concerns**
- ✅ **Optimal performance** for each use case
- ✅ **Familiar Zustand patterns** preserved for UI state
- ✅ **Professional server state management** with TanStack Query

#### Cons
- ❌ **Two state management libraries** to learn
- ❌ **Coordination required** between systems

#### Recommendation: **Optimal for Lighthouse**

## Lighthouse-Specific Evaluation Criteria

### 1. Hierarchical Timeline Data

**Requirement**: Efficiently manage parent-child node relationships

**TanStack Query Solution**:
```typescript
const useHierarchicalTimeline = (userId: string) => {
  // Main timeline data
  const timelineQuery = useQuery({
    queryKey: ['timeline', userId],
    queryFn: () => hierarchyApi.listNodes(),
    select: (data) => buildHierarchyTree(data),
  });

  // Prefetch child nodes on parent hover
  const queryClient = useQueryClient();
  const prefetchChildren = (parentId: string) => {
    queryClient.prefetchQuery({
      queryKey: ['node-children', parentId],
      queryFn: () => hierarchyApi.getChildren(parentId),
    });
  };

  return { ...timelineQuery, prefetchChildren };
};
```

**Score**: ✅ **Excellent** - Built-in support for dependent queries and prefetching

### 2. Real-time Collaborative Features

**Requirement**: Handle multiple users editing shared timelines

**TanStack Query Solution**:
```typescript
const useCollaborativeTimeline = (userId: string) => {
  const queryClient = useQueryClient();
  
  const timelineQuery = useQuery({
    queryKey: ['timeline', userId],
    queryFn: () => hierarchyApi.listNodes(),
  });

  // WebSocket integration for real-time updates
  useEffect(() => {
    const ws = new WebSocket(`/api/timeline/${userId}/stream`);
    
    ws.onmessage = (event) => {
      const { type, data } = JSON.parse(event.data);
      
      switch (type) {
        case 'node_updated':
          // Smart cache updates instead of full refetch
          queryClient.setQueryData(['timeline', userId], (old: Node[]) =>
            old.map(node => node.id === data.id ? data : node)
          );
          break;
        case 'node_created':
          queryClient.setQueryData(['timeline', userId], (old: Node[]) =>
            [...old, data]
          );
          break;
      }
    };

    return () => ws.close();
  }, [userId, queryClient]);

  return timelineQuery;
};
```

**Score**: ✅ **Excellent** - Perfect for real-time cache updates

### 3. Complex Permission System

**Requirement**: Handle permission-based data filtering

**TanStack Query Solution**:
```typescript
const usePermissionAwareTimeline = (userId: string) => {
  // User's permission context
  const permissionsQuery = useQuery({
    queryKey: ['user-permissions', userId],
    queryFn: () => permissionApi.getUserPermissions(),
    staleTime: 10 * 60 * 1000, // Permissions change less frequently
  });

  // Timeline data with permission-based filtering
  const timelineQuery = useQuery({
    queryKey: ['timeline', userId, permissionsQuery.data?.version],
    queryFn: () => hierarchyApi.listNodesWithPermissions(),
    enabled: permissionsQuery.isSuccess,
    select: (data) => {
      // Apply client-side filtering based on permissions
      return data.filter(node => 
        hasPermission(permissionsQuery.data, node.id, 'view')
      );
    },
  });

  return {
    timeline: timelineQuery,
    permissions: permissionsQuery,
  };
};
```

**Score**: ✅ **Excellent** - Dependent queries handle complex permission flows

### 4. Performance with Large Datasets

**Requirement**: Handle thousands of timeline nodes efficiently

**TanStack Query Solution**:
```typescript
const useTimelineWithPagination = (userId: string) => {
  const [page, setPage] = useState(0);
  const pageSize = 50;

  return useInfiniteQuery({
    queryKey: ['timeline', userId],
    queryFn: ({ pageParam = 0 }) => 
      hierarchyApi.listNodes({ 
        offset: pageParam * pageSize, 
        limit: pageSize 
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => 
      lastPage.length === pageSize ? pages.length : undefined,
    select: (data) => ({
      pages: data.pages,
      nodes: data.pages.flatMap(page => page),
      total: data.pages.reduce((acc, page) => acc + page.length, 0),
    }),
  });
};
```

**Score**: ✅ **Excellent** - Built-in infinite queries for large datasets

### 5. Offline Support (Future Requirement)

**TanStack Query Solution**:
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache data for offline access
      cacheTime: 1000 * 60 * 60 * 24, // 24 hours
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: (failureCount, error) => {
        // Don't retry on network errors (offline)
        if (error?.message?.includes('NetworkError')) return false;
        return failureCount < 3;
      },
    },
  },
});

// Offline mutation queue (with additional library)
const useOfflineCapable = () => {
  // Integrate with libraries like @tanstack/query-sync-storage-persister
  // for offline mutation queuing
};
```

**Score**: ✅ **Good** - Strong offline support with additional libraries

## Recommendation Matrix

| Criteria | TanStack Query | SWR | Current Zustand | Apollo Client |
|----------|----------------|-----|-----------------|---------------|
| Bundle Size | ⭐⭐⭐ (13KB) | ⭐⭐⭐⭐ (4KB) | ⭐⭐⭐⭐⭐ (0KB) | ⭐ (35KB+) |
| Feature Richness | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| Learning Curve | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| Hierarchical Data | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| Real-time Updates | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| Optimistic Updates | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐ | ⭐⭐⭐⭐⭐ |
| Testing Support | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| Maintenance Burden | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ |

**Overall Recommendation**: **TanStack Query** with Zustand for UI state

## Implementation Plan

### Phase 1: Foundation Setup (Week 1)
**Goal**: Establish TanStack Query infrastructure

**Tasks**:
- Install and configure TanStack Query
- Set up query client with proper defaults
- Create base API hooks for hierarchy operations
- Establish query key conventions

**Deliverables**:
```typescript
// lib/queryClient.ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

// hooks/api/useTimeline.ts
export const useTimelineQuery = (userId: string) => {
  return useQuery({
    queryKey: ['timeline', userId],
    queryFn: () => hierarchyApi.listNodes(),
    select: (data) => buildHierarchyTree(data),
  });
};
```

### Phase 2: Core Timeline Migration (Week 2)
**Goal**: Migrate main timeline functionality

**Tasks**:
- Migrate `useHierarchyStore` server state to TanStack Query
- Implement CRUD mutations with optimistic updates
- Add real-time WebSocket integration
- Create UI-only Zustand store for timeline interface state

**Deliverables**:
```typescript
// stores/timelineUI.store.ts (UI only)
export const useTimelineUIStore = create<TimelineUIState>((set) => ({
  selectedNodeId: null,
  expandedNodes: new Set(),
  panelMode: 'view',
  
  // UI actions only
  selectNode: (nodeId: string | null) => set({ selectedNodeId: nodeId }),
  expandNode: (nodeId: string) => set(/* ... */),
}));

// hooks/api/useTimelineMutations.ts
export const useCreateNode = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: hierarchyApi.createNode,
    onMutate: async (newNode) => {
      // Optimistic update logic
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
    },
  });
};
```

### Phase 3: Advanced Features (Week 3)
**Goal**: Implement advanced TanStack Query features

**Tasks**:
- Add infinite queries for large datasets
- Implement smart prefetching for node children
- Add permission-aware caching strategies
- Create reusable query patterns for insights and permissions

**Deliverables**:
- Infinite scroll timeline
- Prefetching on node hover
- Permission-based cache management

### Phase 4: Testing & Optimization (Week 4)
**Goal**: Ensure production readiness

**Tasks**:
- Update all tests to work with new patterns
- Add MSW integration for TanStack Query testing
- Performance optimization and bundle analysis
- Documentation and team training

**Deliverables**:
- Test coverage >85%
- Performance benchmarks
- Developer documentation

## Migration Strategy

### Breaking Changes
- `useHierarchyStore` will be split into UI store + data hooks
- Components using store methods will need updates
- Error handling patterns will change

### Backward Compatibility
- Gradual migration approach
- Feature flags for rollback capability
- Parallel running during transition

### Migration Script
```typescript
// scripts/migrate-to-tanstack-query.ts
export const migrateHierarchyStore = async () => {
  // 1. Extract UI state from hierarchy store
  // 2. Replace server state calls with TanStack Query
  // 3. Update component imports
  // 4. Update tests
};
```

## Testing Strategy

### TanStack Query Testing Patterns

```typescript
// __tests__/timeline.test.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithProviders } from '../test-utils';

describe('Timeline with TanStack Query', () => {
  test('loads timeline data', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Mock API response
    server.use(
      http.get('/api/v2/timeline/nodes', () => {
        return HttpResponse.json({
          success: true,
          data: mockTimelineNodes,
        });
      })
    );

    render(
      <QueryClientProvider client={queryClient}>
        <Timeline userId="123" />
      </QueryClientProvider>
    );

    expect(await screen.findByText('Timeline loaded')).toBeInTheDocument();
  });

  test('handles optimistic updates', async () => {
    // Test optimistic update flow
    const queryClient = new QueryClient();
    
    render(
      <QueryClientProvider client={queryClient}>
        <NodeEditor nodeId="node-1" />
      </QueryClientProvider>
    );

    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    // Verify optimistic update appears immediately
    expect(screen.getByText('Updated content')).toBeInTheDocument();
  });
});
```

### MSW Integration

```typescript
// testing/handlers/timeline.ts
export const timelineHandlers = [
  http.get('/api/v2/timeline/nodes', ({ request }) => {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    
    return HttpResponse.json({
      success: true,
      data: mockTimelineNodes.filter(node => node.userId === userId),
    });
  }),

  http.post('/api/v2/timeline/nodes', async ({ request }) => {
    const newNode = await request.json();
    const nodeWithId = { ...newNode, id: generateId() };
    
    return HttpResponse.json({
      success: true,
      data: nodeWithId,
    }, { status: 201 });
  }),
];
```

## Risk Assessment

### Technical Risks

**Risk 1: Migration Complexity**
- **Probability**: Medium
- **Impact**: High
- **Mitigation**: Gradual migration with feature flags, comprehensive testing

**Risk 2: Team Learning Curve**
- **Probability**: High
- **Impact**: Medium
- **Mitigation**: Training sessions, pair programming, documentation

**Risk 3: Performance Regression**
- **Probability**: Low
- **Impact**: High
- **Mitigation**: Performance benchmarking, gradual rollout

### Business Risks

**Risk 1: Development Velocity Impact**
- **Probability**: Medium
- **Impact**: Medium
- **Mitigation**: Parallel development, minimal breaking changes

**Risk 2: Bug Introduction**
- **Probability**: Medium
- **Impact**: High
- **Mitigation**: Comprehensive testing, staged rollout

## Final Recommendation

### Primary Recommendation: TanStack Query + Zustand Hybrid

**Why TanStack Query is the best choice for Lighthouse:**

1. **Perfect Fit for Requirements**: Hierarchical data, real-time updates, complex permissions
2. **Industry Standard**: Battle-tested by major applications
3. **Developer Experience**: Excellent DevTools, TypeScript support
4. **Future-Proof**: Active maintenance, growing ecosystem
5. **Performance**: Built-in optimizations for caching and updates

### Implementation Strategy

1. **Hybrid Architecture**: TanStack Query for server state, Zustand for UI state
2. **Gradual Migration**: Feature-by-feature migration over 4 weeks  
3. **Clear Boundaries**: Strict separation between UI state and server state
4. **Team Training**: Comprehensive onboarding and documentation

### Alternative Options

- **If bundle size is critical**: Consider SWR (but lose advanced features)
- **If no migration budget**: Improve current Zustand patterns (but maintain complexity)
- **If GraphQL migration planned**: Consider Apollo Client (but major architecture change)

### Success Criteria for Go-Live

- [ ] All timeline CRUD operations using TanStack Query
- [ ] Optimistic updates working for mutations
- [ ] Real-time updates integrated
- [ ] Performance benchmarks met
- [ ] Test coverage >85%
- [ ] Team training completed
- [ ] Documentation updated

**Next Steps**: Approve this PRD and begin Phase 1 implementation with foundation setup.

---

*This PRD provides the technical foundation for making an informed decision about server state management in the Lighthouse React architecture. The recommendation for TanStack Query is based on comprehensive analysis of the application's specific requirements and constraints.*