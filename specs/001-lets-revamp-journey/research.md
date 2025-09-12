# Research Report: Timeline Journey Profile View

**Date**: 2025-01-12  
**Feature**: Timeline Journey Profile View  
**Branch**: 001-lets-revamp-journey

## Executive Summary

Research completed for implementing a new profile view page that displays timeline nodes in a simplified list format. Key decisions: Use TanStack Query for server state, Zustand for client state, MSW for API mocking, and comprehensive testing at all levels.

## Research Areas

### 1. State Management Strategy

**Decision**: Hybrid approach with TanStack Query + Zustand  
**Rationale**:

- TanStack Query excels at server state management with built-in caching, optimistic updates, and background refetching
- Zustand provides lightweight client state management for UI state (selected node, panel visibility, etc.)
- Clear separation between server state (timeline nodes) and client state (UI interactions)

**Alternatives Considered**:

- Redux Toolkit: Too heavy for this feature, adds unnecessary complexity
- Context API only: Lacks sophisticated caching and sync capabilities
- Zustand only: Would require implementing server state patterns manually

### 2. Data Fetching Pattern

**Decision**: TanStack Query with custom hooks  
**Rationale**:

- Existing QueryClient setup in tanstack-migration worktree can be reused
- Built-in support for optimistic updates when editing nodes
- Automatic background refetching ensures data freshness
- Query invalidation patterns for updating related data

**Implementation Pattern**:

```typescript
// Custom hook for profile data
useProfileQuery(username) -> Returns current + past experiences
useNodeMutation() -> For updating node data with optimistic updates
```

### 3. Component Architecture

**Decision**: Tree-based list components with shared node renderers  
**Rationale**:

- Reuse existing node components (JobNode, EducationNode, etc.) without React Flow
- Create new list-specific wrappers for tree structure
- Maintain consistency with existing UI patterns

**Component Structure**:

- ProfilePage (main container)
  - ProfileHeader (name, share/copy buttons)
  - ExperienceSection (current/past)
    - TreeList (hierarchical display)
      - NodeListItem (wrapper for existing nodes)
  - NodeDetailsPanel (side panel)

### 4. Testing Strategy

**Decision**: Multi-level testing approach  
**Rationale**: Comprehensive coverage ensures reliability

**Testing Levels**:

1. **Component Tests** (Vitest + Testing Library)
   - Individual component behavior
   - User interactions
   - State changes

2. **Integration Tests** (Vitest + MSW)
   - API interactions
   - Store updates
   - Data flow

3. **E2E Tests** (Playwright)
   - Full user journeys
   - Profile viewing scenarios
   - Share/copy functionality

**Mocking Strategy**:

- MSW for API mocking in tests
- Factory functions for test data generation
- Zustand test stores for isolated component testing

### 5. Routing Strategy

**Decision**: Reuse existing routing pattern  
**Rationale**:

- `/` - Shows logged-in user's own profile (no username needed)
- `/:username` - Shows specified user's profile (with permissions)
- Consistent with current app navigation
- No new routes needed, just update existing pages

### 6. Performance Optimizations

**Decision**: Virtual scrolling for large datasets  
**Rationale**:

- React Window/Virtuoso for rendering large node lists
- Lazy loading of node details
- Memoization of expensive tree calculations

**Thresholds**:

- Virtual scrolling activates at 50+ nodes
- Initial render < 200ms
- Interaction response < 100ms

### 7. Accessibility Considerations

**Decision**: ARIA-compliant tree structure  
**Rationale**:

- Proper ARIA labels for tree navigation
- Keyboard navigation support
- Screen reader announcements for state changes

### 8. Share/Copy Feature Implementation

**Decision**: Reuse existing share logic from settings page  
**Rationale**:

- Consistent behavior across application
- Proven implementation pattern
- Web Share API with clipboard fallback

## Technology Stack Summary

### Dependencies to Add

- `msw`: ^2.0.0 - API mocking for tests
- `@tanstack/react-virtual`: ^3.0.0 - Virtual scrolling (if needed)

### Existing Infrastructure to Leverage

- **API Endpoints**: `/api/v2/timeline/nodes` (GET all nodes)
- **Stores**: `current-user-timeline-store.ts`, `other-user-timeline-store.ts`
- **Hooks**: `useTimelineStore()` for data fetching
- **Services**: `hierarchy-api.ts` for API calls
- **Components**: Existing node components from timeline
- `@tanstack/react-query`: Already in tanstack-migration
- `zustand`: Already in use for stores
- `@testing-library/react`: Component testing
- `vitest`: Unit/integration testing
- `playwright`: E2E testing

## Implementation Risks & Mitigations

### Risk 1: Performance with Deep Hierarchies

**Mitigation**: Implement virtual scrolling, lazy expand/collapse

### Risk 2: Complex State Synchronization

**Mitigation**: Clear separation of concerns, TanStack Query for server state

### Risk 3: Testing Complexity

**Mitigation**: Incremental test development, reusable test utilities

## Next Steps

1. Design data models and API contracts
2. Create component architecture diagrams
3. Define test scenarios
4. Generate implementation tasks

## References

- TanStack Query Docs: Mutations, optimistic updates, query invalidation patterns
- Zustand Patterns: Store slices, TypeScript integration
- MSW Best Practices: Handler organization, test fixtures
- Existing codebase: tanstack-migration worktree, settings page implementation
