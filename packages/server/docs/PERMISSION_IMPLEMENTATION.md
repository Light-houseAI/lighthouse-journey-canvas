# Search API Permission Implementation (LIG-179)

## Overview
This document describes the permission filtering implementation for search APIs to ensure users can only access nodes they have permission to view, consistent with the profile page behavior.

## Permission System Architecture

### Core Permission Model
The system uses a hierarchical permission model with the following components:

1. **Node Ownership**: Each node has a `userId` field indicating the owner
2. **Node Policies**: The `node_policies` table defines access rules with:
   - Subject (user, group, organization, or public)
   - Action (view, edit, delete)
   - Level (overview, full)
   - Effect (ALLOW, DENY)
3. **Timeline Node Closure**: Supports hierarchical permission inheritance

### Permission Check Flow

```
User Request → Controller (get userId) → Service (apply filter) → Repository (enforce permissions)
```

## Implementation Changes

### 1. GraphRAG Search API (`/api/v2/graphrag/search`)

**Files Modified**:
- `packages/server/src/repositories/pgvector-graphrag.repository.ts` - Added JOIN-based permission filtering
- `packages/server/src/services/pgvector-graphrag.service.ts` - Passes requestingUserId to repository
- `packages/server/src/controllers/pgvector-graphrag.controller.ts` - Extracts and passes user context

**Key Change - Database-Level Permission Filtering**:
Following the pattern from `getAllNodes`, permissions are now filtered at the database level using sophisticated JOINs with CTEs:

```sql
WITH subject_keys AS (
  -- Define subject identities (user and public)
  SELECT subject_type, subject_id, specificity FROM (VALUES
    ('user'::subject_type, ${requestingUserId}::integer, 3),
    ('public'::subject_type, NULL::integer, 0)
  ) AS v(subject_type, subject_id, specificity)
),
relevant_policies AS (
  -- Get policies with hierarchical inheritance via timeline_node_closure
  ...
),
ranked_policies AS (
  -- Apply precedence: DENY > ALLOW, closer > farther, newer > older
  ...
),
authorized_nodes AS (
  -- Get nodes where user has ALLOW permission + own nodes
  SELECT DISTINCT descendant_id as node_id
  FROM ranked_policies
  WHERE precedence_rank = 1 AND effect = 'ALLOW'
  UNION
  SELECT id as node_id FROM timeline_nodes WHERE user_id = ${requestingUserId}
)
-- Main query joins with authorized_nodes for permission filtering
SELECT ... FROM graphrag_chunks gc
LEFT JOIN authorized_nodes an ON an.node_id = gc.node_id
WHERE ... AND (
  gc.node_id IS NULL OR an.node_id IS NOT NULL OR gc.user_id = ${requestingUserId}
)
```

**Benefits of JOIN approach**:
- Single database query instead of separate permission check
- Better performance with large result sets
- Consistent with existing `getAllNodes` implementation
- Leverages PostgreSQL's query optimizer

### 2. Experience Matches API (`/api/v2/experience/:nodeId/matches`)

**File Modified**: `packages/server/src/services/experience-matches.service.ts`

**Changes**:
- Already uses `hierarchyRepository.getById(nodeId, userId)` which enforces permissions
- Updated to pass `requestingUserId` to GraphRAG search for consistent filtering

### 3. Controller Updates

**File Modified**: `packages/server/src/controllers/pgvector-graphrag.controller.ts`

**Changes**:
- Extracts `currentUserId` from authenticated request
- Passes both `excludeUserId` and `requestingUserId` to service

## Permission Filtering Logic

### Access Levels
1. **Owner Access**: Users can always access their own nodes (full permissions)
2. **Public Access**: Nodes marked as public are visible to all users
3. **Shared Access**: Nodes explicitly shared with specific users
4. **Group/Organization Access**: Through group or organization membership

### Batch Authorization
The system uses efficient batch authorization to prevent N+1 queries:
```typescript
checkBatchAuthorization(
  requestingUserId: number,
  nodeIds: string[],
  targetUserId?: number,
  action: 'view' = 'view',
  level: 'overview' | 'full' = 'overview'
)
```

## Testing

Created comprehensive integration tests in `packages/server/tests/integration/search-permissions.test.ts`:

1. **GraphRAG Search Tests**:
   - Verifies users only see permitted nodes in search results
   - Tests private, public, and shared node visibility

2. **Experience Matches Tests**:
   - Ensures 404 for unauthorized node access
   - Validates permission filtering in matched results

3. **User Search Tests**:
   - Confirms user search returns users but respects node privacy

## Security Considerations

1. **Defense in Depth**: Permissions checked at multiple layers:
   - Controller: Authentication required
   - Service: Permission filtering applied
   - Repository: Database queries scoped by user

2. **Fail Secure**: Default behavior denies access unless explicitly allowed

3. **Performance**: Batch authorization prevents performance degradation with large result sets

## Migration Notes

No database schema changes required. The existing permission system from the profile page is reused:
- `timeline_nodes` table with `userId` field
- `node_policies` table for access rules
- `timeline_node_closure` for hierarchical permissions

## API Compatibility

All changes are backward compatible:
- `requestingUserId` is optional in GraphRAGSearchRequest
- Existing API contracts maintained
- No breaking changes to response formats

## Future Enhancements

1. **Caching**: Add Redis caching for permission checks
2. **Audit Logging**: Track permission checks for compliance
3. **Fine-grained Permissions**: Support field-level access control
4. **Performance Optimization**: Implement permission materialized views