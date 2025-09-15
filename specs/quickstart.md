# Quickstart: Timeline Journey Profile View

**Feature**: Profile View with Tree-based List Display  
**Branch**: 001-lets-revamp-journey  
**Date**: 2025-01-12

## Prerequisites

1. **Development Environment**

   ```bash
   # Ensure you're on the feature branch
   git checkout 001-lets-revamp-journey

   # Install dependencies
   pnpm install

   # Install MSW for mocking (if not already installed)
   pnpm add -D msw@^2.0.0
   ```

2. **Database Setup**
   - Ensure PostgreSQL is running
   - Database migrations are up to date
   - Test data is seeded

## New Store Implementation Examples

### Using the New Profile Store (TanStack Query)

```typescript
// components/ProfilePage.tsx
import { useProfileQuery } from '@/stores/profile/useProfileStore';
import { useProfileViewStore } from '@/stores/profile/useProfileViewStore';

export function ProfilePage({ username }: { username?: string }) {
  // Data fetching with TanStack Query
  const { data: profile, isLoading, error } = useProfileQuery(username);

  // UI state with Zustand
  const { selectedNodeId, selectNode, expandedNodeIds, toggleNodeExpansion } = useProfileViewStore();

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div>
      <ProfileHeader
        name={`${profile.firstName} ${profile.lastName}`}
        profileUrl={profile.profileUrl}
      />
      <ExperienceSection
        title="Current Experiences"
        nodes={profile.currentExperiences}
        expandedIds={expandedNodeIds}
        selectedId={selectedNodeId}
        onNodeClick={selectNode}
        onToggleExpand={toggleNodeExpansion}
      />
      <ExperienceSection
        title="Past Experiences"
        nodes={profile.pastExperiences}
        expandedIds={expandedNodeIds}
        selectedId={selectedNodeId}
        onNodeClick={selectNode}
        onToggleExpand={toggleNodeExpansion}
      />
    </div>
  );
}
```

### Profile Store Implementation (Data Layer)

```typescript
// stores/profile/useProfileStore.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hierarchyApi } from '@/services/hierarchy-api';

export function useProfileQuery(username?: string) {
  return useQuery({
    queryKey: ['profile', username || 'current'],
    queryFn: async () => {
      const nodes = username
        ? await hierarchyApi.listUserNodesWithPermissions(username)
        : await hierarchyApi.listNodesWithPermissions();

      // Transform nodes into profile structure
      const { current, past } = separateExperiences(nodes);

      return {
        userName: username || 'currentUser',
        currentExperiences: buildHierarchyTree(current),
        pastExperiences: buildHierarchyTree(past),
        totalNodes: nodes.length,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useUpdateNodeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }) => hierarchyApi.updateNode(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}
```

### Profile View Store Implementation (UI State)

````typescript
// stores/profile/useProfileViewStore.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface ProfileViewState {
  // State
  selectedNodeId: string | null;
  focusedNodeId: string | null;
  expandedNodeIds: Set<string>;
  isPanelOpen: boolean;
  panelMode: 'view' | 'edit';

  // Actions
  selectNode: (nodeId: string | null) => void;
  toggleNodeExpansion: (nodeId: string) => void;
  openPanel: (nodeId: string, mode?: 'view' | 'edit') => void;
  closePanel: () => void;
  resetUIState: () => void;
}

export const useProfileViewStore = create<ProfileViewState>()(
  devtools(
    (set) => ({
      // Initial state
      selectedNodeId: null,
      focusedNodeId: null,
      expandedNodeIds: new Set(),
      isPanelOpen: false,
      panelMode: 'view',

      // Actions
      selectNode: (nodeId) => set({
        selectedNodeId: nodeId,
        isPanelOpen: nodeId !== null,
      }),

      toggleNodeExpansion: (nodeId) => set((state) => {
        const newExpanded = new Set(state.expandedNodeIds);
        if (newExpanded.has(nodeId)) {
          newExpanded.delete(nodeId);
        } else {
          newExpanded.add(nodeId);
        }
        return { expandedNodeIds: newExpanded };
      }),

      openPanel: (nodeId, mode = 'view') => set({
        selectedNodeId: nodeId,
        isPanelOpen: true,
        panelMode: mode,
      }),

      closePanel: () => set({
        isPanelOpen: false,
        selectedNodeId: null,
      }),

      resetUIState: () => set({
        selectedNodeId: null,
        focusedNodeId: null,
        expandedNodeIds: new Set(),
        isPanelOpen: false,
        panelMode: 'view',
      }),
    }),
    { name: 'profile-view-store' }
  )
);

## Quick Test Scenarios

### Scenario 1: View Profile with Current and Past Experiences

1. **Start the development server**
   ```bash
   pnpm dev
````

2. **Navigate to profile page**
   - Open browser to `http://localhost:3000/profile/testuser`
   - Verify profile header shows user name
   - Verify share and copy buttons are visible

3. **Verify experience sections**
   - Current Experiences section shows nodes without end dates
   - Past Experiences section shows completed nodes
   - Each section displays nodes in tree structure

### Scenario 2: Navigate Hierarchical Nodes

1. **Expand parent nodes**
   - Click expansion arrow on job/education nodes
   - Verify child nodes (projects, events) appear indented
   - Verify tree lines connect parent to children

2. **Collapse nodes**
   - Click expansion arrow again
   - Verify children are hidden
   - Verify state persists during navigation

### Scenario 3: View Node Details

1. **Select a node**
   - Click on any timeline node
   - Verify side panel opens with details
   - Verify all metadata fields are displayed

2. **Navigate between nodes**
   - Click different node
   - Verify panel updates with new content
   - Previous selection state is cleared

3. **Close panel**
   - Click close button or outside panel
   - Verify panel closes
   - Node selection is cleared

### Scenario 4: Share Profile Functionality

1. **Test share button**
   - Click share button in header
   - Verify Web Share API dialog opens (if supported)
   - Fallback to copy URL if not supported

2. **Test copy URL**
   - Click copy button
   - Verify URL is copied to clipboard
   - Verify success toast notification
   - Test URL format: `https://app.lighthouse.ai/username`

## Testing Commands

### Unit Tests

```bash
# Run component tests
pnpm test:client -- ProfilePage
pnpm test:client -- TreeList
pnpm test:client -- ProfileHeader

# Run store tests
pnpm test:client -- profile-view-store

# Run hook tests
pnpm test:client -- useProfileQuery
```

### Integration Tests

```bash
# Run API integration tests
pnpm test:server -- profile.routes

# Run full integration suite
pnpm test:integration
```

### E2E Tests

```bash
# Run profile view E2E tests
pnpm test:e2e -- profile-view.spec.ts

# Run in headed mode for debugging
pnpm test:e2e:debug -- profile-view.spec.ts

# Open Playwright UI
pnpm test:e2e:ui
```

## Performance Validation

### Metrics to Verify

1. **Initial Load**: < 200ms
2. **Node Expansion**: < 100ms
3. **Panel Open/Close**: < 50ms
4. **Large Dataset** (100+ nodes): < 500ms with virtual scrolling

### Performance Test

```bash
# Run performance benchmarks
pnpm test:perf -- profile-view

# Check bundle size
pnpm build && pnpm analyze
```

## Accessibility Checklist

- [ ] Keyboard navigation works (Tab, Enter, Arrow keys)
- [ ] Screen reader announces tree structure
- [ ] ARIA labels present on all interactive elements
- [ ] Focus indicators visible
- [ ] Color contrast meets WCAG AA standards

## Common Issues & Solutions

### Issue: Profile not loading

**Solution**: Check API endpoint is returning data

```bash
curl http://localhost:3000/api/profile/testuser
```

### Issue: Nodes not expanding

**Solution**: Verify parent-child relationships in data

```bash
# Check node hierarchy
pnpm run db:inspect-timeline
```

### Issue: Share button not working

**Solution**: Test in HTTPS context or localhost

```bash
# Use HTTPS for testing
pnpm dev --https
```

## Deployment Checklist

- [ ] All tests passing
- [ ] Performance metrics met
- [ ] Accessibility audit passed
- [ ] Cross-browser testing complete
- [ ] Mobile responsive design verified
- [ ] Error tracking configured
- [ ] Feature flags configured (if applicable)

## Rollback Plan

If issues arise after deployment:

1. **Immediate rollback**

   ```bash
   git revert HEAD
   git push origin main
   ```

2. **Feature flag disable**

   ```javascript
   // Disable in feature flags
   FEATURE_PROFILE_VIEW = false;
   ```

3. **Monitor and fix**
   - Check error logs
   - Identify root cause
   - Deploy hotfix

## Support Resources

- **Documentation**: `/docs/features/profile-view.md`
- **API Docs**: `/specs/001-lets-revamp-journey/contracts/`
- **Design Specs**: Figma link (if available)
- **Team Contact**: #lighthouse-dev channel

## Success Criteria

✅ All test scenarios pass  
✅ Performance targets met  
✅ No console errors  
✅ Accessibility audit clean  
✅ Cross-browser compatibility verified
