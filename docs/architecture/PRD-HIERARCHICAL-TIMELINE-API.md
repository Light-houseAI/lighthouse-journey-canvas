# PRD: Hierarchical Timeline API - Server Implementation

## 1. Overview

### Purpose
Provide a simplified hierarchical timeline API (`/api/v2/timeline`) that enables creation and management of timeline nodes with parent-child relationships, focused on essential CRUD operations without complex hierarchy-specific endpoints.

### Goals
- Enable creation of 6 node types with unlimited nesting capability
- Support parent-child relationships through simple `parentId` field
- Provide user isolation and authentication integration
- Maintain type-specific metadata validation
- Offer clean API endpoints for client-side hierarchy management

### Success Metrics
- All 6 node types (job, education, project, event, action, careerTransition) supported
- Parent-child relationships work correctly through parentId references
- User isolation enforced - users can only access their own nodes
- API responses follow consistent Lighthouse patterns
- Performance suitable for typical hierarchies (50-100 nodes)

## 2. System Architecture

### Technology Stack
- **Database**: PostgreSQL with JSONB for flexible metadata
- **ORM**: Drizzle ORM for type-safe queries
- **DI Container**: TSyringe for dependency injection
- **Validation**: Zod schemas for request/response validation
- **Authentication**: Integration with existing Lighthouse auth system

### Database Schema
```sql
-- Node type enum
CREATE TYPE timeline_node_type AS ENUM (
  'job', 'education', 'project', 'event', 'action', 'careerTransition'
);

-- Main timeline nodes table
CREATE TABLE timeline_nodes (
  id TEXT PRIMARY KEY,                                    -- nanoid generated
  type timeline_node_type NOT NULL,                      -- Node type
  label TEXT NOT NULL,                                    -- Human readable name
  parent_id TEXT REFERENCES timeline_nodes(id) ON DELETE SET NULL,  -- Hierarchy relationship
  meta JSONB NOT NULL DEFAULT '{}',                      -- Type-specific metadata
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- User isolation
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,         -- Creation timestamp
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL          -- Last update timestamp
);

-- Performance indexes
CREATE INDEX timeline_nodes_user_id_idx ON timeline_nodes(user_id);
CREATE INDEX timeline_nodes_parent_id_idx ON timeline_nodes(parent_id);
CREATE INDEX timeline_nodes_type_idx ON timeline_nodes(type);
CREATE INDEX timeline_nodes_user_parent_idx ON timeline_nodes(user_id, parent_id);
```

## 3. API Endpoints

### Base URL
All endpoints are available at `/api/v2/timeline`

### Authentication
All endpoints require user authentication via existing Lighthouse auth system.

### 3.1 Node CRUD Operations

#### POST /nodes - Create Timeline Node
Creates a new timeline node with optional parent relationship.

**Request Body**:
```typescript
{
  type: 'job' | 'education' | 'project' | 'event' | 'action' | 'careerTransition';
  label: string;           // 1-255 characters
  parentId?: string;       // Optional parent node ID
  meta?: Record<string, unknown>;  // Type-specific metadata
}
```

**Response** (201 Created):
```typescript
{
  success: true,
  data: {
    id: string,
    type: NodeType,
    label: string,
    parentId: string | null,
    meta: Record<string, unknown>,
    userId: number,
    createdAt: string,
    updatedAt: string
  },
  meta: {
    timestamp: string
  }
}
```

#### GET /nodes - List User's Nodes
Returns list of nodes belonging to the authenticated user with optional filtering.

**Query Parameters**:
- `type` (optional): Filter by specific node type
- `includeChildren` (optional): Include child relationships in response (not implemented)
- `maxDepth` (optional): Maximum depth for tree operations (not implemented)

**Response** (200 OK):
```typescript
{
  success: true,
  data: HierarchyNode[],
  meta: {
    timestamp: string
  }
}
```

#### GET /nodes/:id - Get Single Node
Retrieves a specific node by ID (user must own the node).

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    id: string,
    type: NodeType,
    label: string,
    parentId: string | null,
    meta: Record<string, unknown>,
    userId: number,
    createdAt: string,
    updatedAt: string
  },
  meta: {
    timestamp: string
  }
}
```

#### PATCH /nodes/:id - Update Node
Updates node properties (label and/or meta only).

**Request Body**:
```typescript
{
  label?: string;          // New label (1-255 characters)
  meta?: Record<string, unknown>;  // Updated metadata
}
```

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    // Updated node object
  },
  meta: {
    timestamp: string
  }
}
```

#### DELETE /nodes/:id - Delete Node
Deletes a node. Child nodes become orphaned (parentId set to null).

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    deleted: true,
    nodeId: string
  },
  meta: {
    timestamp: string
  }
}
```

### 3.2 Utility Endpoints

#### GET /validate - Validate Hierarchy Integrity
Analyzes user's hierarchy for issues like cycles or orphaned nodes.

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    integrity: {
      hasCycles: boolean,
      cycles: string[][],
      orphanedNodes: string[],
      totalNodes: number,
      rootNodes: number,
      maxDepth: number
    },
    suggestions: string[]
  },
  meta: {
    timestamp: string
  }
}
```

#### GET /schema/:type - Get Node Type Schema
Returns validation schema and allowed children for a specific node type.

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    nodeType: string,
    allowedChildren: string[],
    metaSchema: {
      type: 'object',
      description: string,
      sample?: Record<string, unknown>
    }
  },
  meta: {
    timestamp: string
  }
}
```

#### GET /health - Service Health Check
Returns service status and available features.

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    service: 'timeline',
    status: 'healthy',
    version: '2.0.0',
    timestamp: string,
    features: {
      nodeTypes: string[],
      validation: boolean,
      userIsolation: boolean
    }
  }
}
```

#### GET /docs - API Documentation
Returns comprehensive API documentation including endpoints, node types, and error codes.

## 4. Node Types and Metadata

### 4.1 Supported Node Types

| Type | Description | Typical Children | Is Leaf |
|------|-------------|-----------------|---------|
| `careerTransition` | Major career changes | action, event, project | No |
| `job` | Employment experiences | project, event, action | No |
| `education` | Educational experiences | project, event, action | No |
| `action` | Specific actions/achievements | project | No |
| `event` | Timeline events/milestones | project, action | No |
| `project` | Individual projects/initiatives | None | Yes |

### 4.2 Metadata Validation
Each node type can have type-specific metadata stored in the `meta` JSONB field. Validation schemas are enforced server-side using Zod.

## 5. Business Rules

### 5.1 User Isolation
- Users can only create, read, update, and delete their own nodes
- All API operations are scoped to the authenticated user
- Foreign key constraints prevent cross-user data access

### 5.2 Hierarchy Constraints
- Nodes can have optional parent-child relationships via `parentId`
- No automatic cycle detection on creation (available via `/validate` endpoint)
- Deleting a parent node orphans children (sets `parentId` to null)
- No restrictions on nesting depth

### 5.3 Data Validation
- Node labels must be 1-255 characters
- Node types must be one of the 6 supported types
- Parent IDs must reference existing nodes owned by the same user
- Metadata follows type-specific Zod schemas

## 6. Error Handling

### 6.1 Standard Error Response Format
```typescript
{
  success: false,
  error: {
    code: string,           // Machine-readable error code
    message: string,        // Human-readable error message
    details?: any          // Additional error details (development only)
  }
}
```

### 6.2 Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `AUTHENTICATION_REQUIRED` | 401 | User must be authenticated |
| `ACCESS_DENIED` | 403 | User cannot access requested resource |
| `NODE_NOT_FOUND` | 404 | Requested node does not exist |
| `VALIDATION_ERROR` | 400 | Input validation failed |
| `BUSINESS_RULE_VIOLATION` | 409 | Request violates business rules |
| `SERVICE_UNAVAILABLE` | 503 | Timeline service temporarily unavailable |
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected server error |

## 7. Performance Characteristics

### 7.1 Expected Performance
- Node creation: < 100ms
- Node retrieval: < 50ms
- Node listing (50 nodes): < 200ms
- Hierarchy validation: < 500ms for typical datasets

### 7.2 Scalability Limits
- Designed for individual user hierarchies (50-1000 nodes)
- Database indexes optimize common query patterns
- JSONB metadata provides flexibility without schema migrations

## 8. Integration Points

### 8.1 Lighthouse Authentication
- Uses existing Lighthouse auth middleware
- Extracts user ID from session/request context
- Maintains consistent authentication patterns

### 8.2 Database Integration
- Integrates with existing Lighthouse database
- Uses existing connection pools and migration patterns
- Foreign key constraints ensure data integrity

### 8.3 API Versioning
- Mounted at `/api/v2/timeline` to avoid conflicts
- V1 API remains available for backward compatibility
- Clear migration path for client applications

## 9. Removed Features (From Original Hierarchy Specification)

The following endpoints were removed to simplify the API and focus on essential CRUD operations:

### Removed Endpoints
- `GET /nodes/:id/children` - Get child nodes
- `GET /nodes/:id/ancestors` - Get ancestor path  
- `GET /nodes/:id/subtree` - Get complete subtree
- `POST /nodes/:id/move` - Move nodes with cycle detection
- `GET /tree` - Complete hierarchy tree
- `GET /roots` - Root nodes only
- `GET /stats` - Hierarchy statistics

### Rationale for Removal
1. **Client-Side Responsibility**: Hierarchy traversal and tree building moved to client-side
2. **API Simplification**: Focus on core CRUD operations reduces complexity
3. **Performance**: Avoid expensive recursive queries on server-side
4. **Flexibility**: Clients can implement custom hierarchy logic as needed

## 10. Migration and Deployment

### 10.1 Database Migration
- Schema automatically created via Drizzle migrations
- Indexes optimized for common access patterns
- Safe to run on existing Lighthouse database

### 10.2 Service Deployment
- TSyringe container configured during server startup
- Health checks available for monitoring
- Graceful degradation if service unavailable

### 10.3 API Integration
- V2 API mounted alongside existing V1 endpoints
- No breaking changes to existing functionality
- Feature flags available for gradual rollout

## 11. Testing Strategy

### 11.1 Unit Testing
- Service layer business logic validation
- Repository data access patterns
- Validation schema enforcement
- Error handling edge cases

### 11.2 Integration Testing  
- API endpoint request/response cycles
- Database transaction integrity
- Authentication middleware integration
- User isolation enforcement

### 11.3 Performance Testing
- Load testing with realistic node hierarchies
- Database query performance monitoring
- Memory usage analysis for large datasets

## 12. Success Criteria

### Functional Success
- ✅ All 6 node types create, read, update, delete successfully
- ✅ Parent-child relationships work via parentId field
- ✅ User isolation enforced across all operations  
- ✅ Type-specific metadata validation working
- ✅ API responses follow Lighthouse patterns
- ✅ Integration with existing auth system complete

### Technical Success
- ✅ Database migration applied successfully
- ✅ TSyringe DI container configured
- ✅ API endpoints return consistent response formats
- ✅ Error handling follows established patterns
- ✅ Performance meets requirements for typical datasets

### API Simplification Success
- ✅ Complex hierarchy endpoints removed
- ✅ API focused on essential CRUD operations
- ✅ Client-side hierarchy management enabled
- ✅ Reduced server-side complexity while maintaining functionality

---

**Document Version**: 2.0 (Updated)  
**Last Updated**: January 2025  
**API Version**: v2.0.0  
**Implementation Status**: Complete

**Major Updates in v2.0**:
- Removed complex hierarchy endpoints (children, ancestors, subtree, move, tree, roots, stats)
- Simplified API to focus on core CRUD operations
- Updated documentation to reflect current implementation
- Clarified client-side vs server-side responsibilities
- Added performance characteristics for simplified API