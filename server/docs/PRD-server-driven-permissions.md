# PRD: Server-Driven Permissions Architecture

## Executive Summary

Transform the current client-side permission checking system to a server-driven model where each timeline node includes its permission metadata from the backend. This eliminates duplicate permission logic, improves security, and creates a single source of truth for access control.

## Problem Statement

### Current Issues

1. **Duplicate Permission Logic**: Permission checks happen both on backend (filtering) and frontend (`user.id === node.userId`)
2. **Scattered Implementation**: Permission logic duplicated across 15+ components
3. **Limited Scalability**: Current client-side checks can't handle complex permission scenarios (org-based, time-limited, role-based)
4. **Security Concerns**: Client-side permission checks can be bypassed via browser dev tools
5. **Maintenance Burden**: Any permission logic change requires updates in multiple components

### Why Now?

- Backend already has sophisticated permission system (`NodePermissionService`) that's underutilized
- Recent implementation of separate stores (current user vs other user) provides foundation
- Growing need for complex permission scenarios (organization sharing, public profiles)

## Goals & Success Metrics

### Primary Goals

1. **Single Source of Truth**: Backend determines all permissions
2. **Clean Component Architecture**: Components receive permissions as props
3. **Performance Optimization**: Owner views bypass permission checks
4. **Type Safety**: Permissions are part of the data model

### Success Metrics

- **Code Reduction**: 50% reduction in permission-related code in components
- **Performance**: No degradation in load times for owner views
- **Security**: Zero client-side permission bypasses possible
- **Developer Velocity**: 75% faster to add new permission features
- **Type Coverage**: 100% type safety for permission-related code

## User Stories & Requirements

### User Stories

#### As a Timeline Owner

- I want instant access to all my nodes without permission checks
- I want to see edit/delete buttons on all my nodes
- I want to control who can see my timeline nodes

#### As a Timeline Viewer

- I want to see only nodes I have permission to view
- I want appropriate UI based on my access level (read-only, edit, etc.)
- I want clear indication of what I can and cannot do

#### As a Developer

- I want permissions included in node data from API
- I want type-safe permission interfaces
- I want to avoid duplicate permission logic

### Functional Requirements

#### Backend Requirements

1. **API Enhancement**
   - Include permission metadata with each node in API responses
   - Return `NodeWithPermissions` type with `canView`, `canEdit`, `canShare` fields
   - Optimize owner queries to skip permission checks

2. **Permission Calculation**
   - Calculate permissions server-side based on policies
   - Support batch permission checking for performance
   - Cache permission results where appropriate

3. **Response Structure**
   ```typescript
   interface TimelineNodeWithPermissions extends TimelineNode {
     permissions: {
       canView: boolean;
       canEdit: boolean;
       canShare: boolean;
       canDelete: boolean;
       accessLevel: VisibilityLevel;
     };
   }
   ```

#### Frontend Requirements

1. **Component Architecture**
   - Components accept permissions via props
   - Remove all `user.id === node.userId` checks
   - Create reusable permission hooks

2. **Store Updates**
   - Update node types to include permissions
   - Handle permissions in both timeline stores
   - Maintain permission state during updates

3. **UI Rendering**
   - Conditionally render UI elements based on permissions
   - Show/hide edit buttons based on `canEdit`
   - Show/hide share button based on `canShare`

### Non-Functional Requirements

1. **Performance**: No degradation in page load times
2. **Security**: All permission checks server-side
3. **Backward Compatibility**: Phased migration without breaking changes
4. **Type Safety**: Full TypeScript coverage
5. **Testing**: 90% test coverage for permission logic

## Technical Specifications

### Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Database      │────▶│   Backend API   │────▶│   Frontend      │
│                 │     │                 │     │                 │
│ - timeline_nodes│     │ - Permission    │     │ - Components    │
│ - node_policies │     │   Service       │     │   use props     │
│ - organizations │     │ - Include perms │     │ - No ownership  │
│                 │     │   in response   │     │   checks        │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### API Design

#### GET /api/v2/timeline/nodes

**Current Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "job",
      "userId": 123,
      "meta": { ... }
    }
  ]
}
```

**New Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "job",
      "userId": 123,
      "meta": { ... },
      "permissions": {
        "canView": true,
        "canEdit": false,
        "canShare": false,
        "canDelete": false,
        "accessLevel": "overview"
      }
    }
  ]
}
```

### Database Schema

No changes required - existing schema supports this:

- `timeline_nodes` - Node data
- `node_policies` - Permission policies
- Permission calculation happens at query time

### Component Interface

```typescript
interface NodeComponentProps {
  node: TimelineNodeWithPermissions;
  onEdit?: () => void;
  onDelete?: () => void;
}

// Usage in component
const JobNode: FC<NodeComponentProps> = ({ node }) => {
  const { permissions } = node;

  return (
    <div>
      {permissions.canEdit && <EditButton />}
      {permissions.canShare && <ShareButton />}
    </div>
  );
};
```

## Implementation Plan

### Phase 1: Backend Enhancement (Week 1)

- [ ] Update `HierarchyService.getAllNodes()` to include permissions
- [ ] Implement owner view optimization (bypass permission checks)
- [ ] Add batch permission checking for viewer scenarios
- [ ] Update controller to return enhanced responses
- [ ] Add integration tests for permission responses

### Phase 2: API Client & Types (Week 1)

- [ ] Update shared schema types
- [ ] Modify `hierarchy-api.ts` to handle new response
- [ ] Update store interfaces with permission fields
- [ ] Ensure type safety throughout

### Phase 3: Core Component Migration (Week 2)

- [ ] Update `HierarchicalTimeline` to use server permissions
- [ ] Create `useNodePermissions` hook
- [ ] Migrate node components (Job, Education, Project, etc.)
- [ ] Update data flow to pass permissions via props

### Phase 4: Panel Component Migration (Week 2)

- [ ] Update all panel components to use permissions from props
- [ ] Remove ownership calculations
- [ ] Update edit/delete button visibility logic
- [ ] Test all permission scenarios

### Phase 5: Cleanup & Optimization (Week 3)

- [ ] Remove all client-side ownership checks
- [ ] Implement permission caching strategy
- [ ] Performance testing and optimization
- [ ] Documentation updates
- [ ] Final testing and bug fixes

## Testing Strategy

### Unit Tests

- Permission calculation logic (backend)
- Permission enrichment in API responses
- Component rendering based on permissions
- Store handling of permission data

### Integration Tests

- API returns correct permissions for different users
- Owner views bypass permission checks
- Viewer sees filtered nodes with correct permissions
- Permission updates reflect immediately

### E2E Tests

- Owner can perform all actions on their nodes
- Viewer sees appropriate UI based on permissions
- Share functionality respects permissions
- Permission changes update UI correctly

### Performance Tests

- Owner view load time (should be same or better)
- Viewer load time with permission checks
- Large dataset handling (1000+ nodes)
- Memory usage with permission metadata

## Risk Assessment

### Technical Risks

1. **Performance Impact**
   - Risk: Permission checks slow down API
   - Mitigation: Batch checking, caching, owner bypass

2. **Migration Complexity**
   - Risk: Breaking changes during migration
   - Mitigation: Phased approach, feature flags

3. **Type Safety**
   - Risk: Type mismatches during migration
   - Mitigation: Strict TypeScript, gradual migration

### Business Risks

1. **User Experience**
   - Risk: UI elements appear/disappear unexpectedly
   - Mitigation: Thorough testing, gradual rollout

2. **Security**
   - Risk: Permission bypass during migration
   - Mitigation: Backend enforcement remains active throughout

## Rollout Strategy

### Phase 1: Dark Launch

- Deploy backend changes without frontend using them
- Monitor performance impact
- Validate permission calculations

### Phase 2: Internal Testing

- Enable for development environment
- Test with team members
- Gather feedback

### Phase 3: Gradual Rollout

- Enable for 10% of users
- Monitor metrics and errors
- Increase to 50%, then 100%

### Phase 4: Cleanup

- Remove old permission code
- Update documentation
- Knowledge transfer

## Success Criteria

### Acceptance Criteria

- [ ] All nodes include permission metadata in API responses
- [ ] Owner views load without permission checks
- [ ] Components use server-provided permissions exclusively
- [ ] No client-side ownership checks remain
- [ ] All tests pass with 90% coverage
- [ ] No performance degradation
- [ ] Type safety maintained throughout

### Definition of Done

- Code reviewed and approved
- All tests passing
- Documentation updated
- Performance benchmarks met
- Security review completed
- Deployed to production
- Monitoring in place

## Post-Implementation Benefits

### Immediate Benefits

1. **Cleaner Code**: Reduced duplication and complexity
2. **Better Security**: Server-side enforcement only
3. **Type Safety**: Permissions in data model
4. **Developer Experience**: Easier to understand and modify

### Future Opportunities

1. **Advanced Permissions**: Time-based, role-based, org-based
2. **Public Profiles**: Easy to implement with permission system
3. **Collaboration Features**: Fine-grained sharing controls
4. **Audit Logging**: Track permission usage
5. **Permission Templates**: Reusable permission sets

## Appendix

### Current Files Requiring Changes

1. **Backend**
   - `server/services/hierarchy-service.ts`
   - `server/controllers/hierarchy-controller.ts`
   - `server/repositories/hierarchy-repository.ts`

2. **Frontend**
   - `client/src/services/hierarchy-api.ts`
   - `client/src/components/timeline/HierarchicalTimeline.tsx`
   - All node components (6 files)
   - All panel components (6 files)
   - Store files (2 files)

### Performance Benchmarks

- Current owner view load: ~200ms
- Current viewer load: ~300ms
- Target owner view: ≤200ms
- Target viewer load: ≤350ms

### Security Considerations

- Permission checks remain server-side
- No sensitive data in client
- Audit logging for permission changes
- Rate limiting on permission APIs

---

**Document Version**: 1.0
**Created**: December 2024
**Owner**: Engineering Team
**Status**: In Review
