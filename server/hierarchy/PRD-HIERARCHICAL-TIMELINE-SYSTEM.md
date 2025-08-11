# PRD: Hierarchical Timeline System

## 1. Overview

### Purpose
Build a hierarchical timeline system that allows users to create multi-level timelines where nodes can contain child nodes, enabling complex career journey visualization like: Career Transition → Action → Project.

### Goals
- Enable multi-level timeline relationships (parent-child node hierarchies)
- Provide type-safe validation for node-specific metadata 
- Ensure data integrity with cycle prevention
- Create a robust API for timeline hierarchy management
- Maintain separation from existing timeline system for safe parallel development

### Success Metrics
- Users can create unlimited hierarchy levels (Career → Action → Project → Sub-project)
- 100% type safety with runtime validation using Zod schemas
- Zero data corruption with proper cycle detection
- API response times < 200ms for hierarchy operations
- Complete test coverage (unit + integration)

## 2. System Architecture

### Technology Stack
- **Backend**: Node.js + TypeScript + Express
- **Database**: PostgreSQL with Drizzle ORM
- **Validation**: Zod schemas with type inference
- **DI Container**: tsyringe (following PDF architecture)
- **Testing**: Vitest + Supertest

### Architecture Pattern
Following the PDF's domain-driven architecture:
```
server/hierarchy/
├── domain/           # Business logic, validation schemas, interfaces
├── infrastructure/   # Database, repositories, external services  
├── services/         # Application services, business rules
├── api/             # Controllers, routes, HTTP layer
└── di/              # Dependency injection setup
```

## 3. Data Model

### Node Types
Six node types with hierarchical relationships:
- `careerTransition` - Can contain: actions, events, projects
- `job` - Can contain: projects, events, actions  
- `education` - Can contain: projects, events, actions
- `action` - Can contain: projects
- `event` - Can contain: projects, actions
- `project` - Leaf nodes (no children)

### Database Schema
```sql
timeline_nodes (
  id TEXT PRIMARY KEY,                    -- UUID, globally unique
  type timeline_node_type NOT NULL,       -- Enum of 6 node types
  label TEXT NOT NULL,                    -- Human-readable name
  parent_id TEXT REFERENCES timeline_nodes(id) ON DELETE SET NULL,
  meta JSONB NOT NULL DEFAULT '{}',       -- Type-specific metadata
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)
```

### Type-Specific Metadata Schemas

#### Job Metadata
```typescript
{
  company?: string;
  position?: string; 
  location?: string;
  startDate?: string;
  endDate?: string;
  skills?: string[];
  salary?: number;
  remote?: boolean;
}
```

#### Education Metadata  
```typescript
{
  institution?: string;
  degree?: string;
  field?: string;
  gpa?: number; // 0-4 scale
  honors?: string[];
}
```

#### Project Metadata
```typescript
{
  description?: string;
  technologies?: string[];
  projectType?: 'personal' | 'professional' | 'academic';
  githubUrl?: string;
  status?: 'planning' | 'active' | 'completed';
}
```

#### Event Metadata
```typescript
{
  eventType?: string;
  location?: string;
  organizer?: string;
  participants?: string[];
}
```

#### Action Metadata
```typescript
{
  category?: string;
  status?: 'planned' | 'active' | 'completed';
  impact?: string;
  verification?: string;
}
```

#### Career Transition Metadata
```typescript
{
  fromRole?: string;
  toRole?: string;
  reason?: string;
  challenges?: string[];
}
```

## 4. API Specification

### Base URL
`/api/v2/timeline`

### Authentication
- All endpoints require user authentication
- User ID extracted from session/JWT token
- Users can only access their own timeline nodes

### Endpoints

#### Node CRUD Operations
```
POST   /nodes                    # Create node
GET    /nodes/:id               # Get single node
PATCH  /nodes/:id               # Update node  
DELETE /nodes/:id               # Delete node
GET    /nodes                   # List user's nodes (with filters)
```

#### Hierarchy Operations
```
GET    /nodes/:id/children      # Get direct children
GET    /nodes/:id/ancestors     # Get ancestor chain
GET    /nodes/:id/subtree       # Get full subtree
POST   /nodes/:id/move          # Move node to new parent
```

#### Timeline Views
```
GET    /tree                    # Full hierarchical tree
GET    /roots                   # Root nodes only
```

### Request/Response Formats

#### Create Node Request
```json
{
  "type": "action",
  "label": "Complete React certification",
  "parentId": "uuid-of-career-transition", // null for root
  "meta": {
    "category": "skill-building",
    "status": "planned",
    "impact": "Career advancement"
  }
}
```

#### Node Response
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "type": "action", 
    "label": "Complete React certification",
    "parentId": "uuid-of-parent",
    "parent": {
      "id": "uuid-of-parent",
      "type": "careerTransition",
      "label": "Move to Tech Lead"
    },
    "meta": {
      "category": "skill-building",
      "status": "planned", 
      "impact": "Career advancement"
    },
    "userId": 123,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

#### Hierarchy Tree Response
```json
{
  "success": true,
  "data": [
    {
      "id": "transition-1",
      "type": "careerTransition",
      "label": "Move to Tech Lead",
      "parentId": null,
      "children": [
        {
          "id": "action-1",
          "type": "action", 
          "label": "Complete certification",
          "parentId": "transition-1",
          "children": [
            {
              "id": "project-1",
              "type": "project",
              "label": "Build portfolio app",
              "parentId": "action-1",
              "children": []
            }
          ]
        }
      ]
    }
  ]
}
```

### Error Responses
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid meta for job: company is required",
    "details": [
      {
        "path": ["meta", "company"],
        "message": "Required field missing"
      }
    ]
  }
}
```

## 5. Business Rules

### Hierarchy Rules
- `careerTransition` can have children: `action`, `event`, `project`
- `job` can have children: `project`, `event`, `action` 
- `education` can have children: `project`, `event`, `action`
- `action` can have children: `project`
- `event` can have children: `project`, `action`
- `project` cannot have children (leaf nodes)

### Data Integrity Rules
- **No Cycles**: A node cannot be moved to its own descendant
- **User Isolation**: Users can only access their own nodes
- **Parent Validation**: Parent must exist and belong to same user
- **Type Compatibility**: Parent-child relationships must follow hierarchy rules
- **Referential Integrity**: Deleting a parent sets children's parentId to NULL

### Validation Rules
- **Node Labels**: 1-255 characters, required
- **Node IDs**: UUIDs, generated server-side if not provided
- **Meta Validation**: Each node type has specific required/optional fields
- **Parent Assignment**: Cannot create cycles, parent must exist

## 6. Implementation Phases

### Phase 1: Foundation (Days 1-2)
- [ ] Domain schemas with Zod validation
- [ ] Dependency injection setup  
- [ ] Database schema and migration
- [ ] Basic repository structure

### Phase 2: Core Functionality (Days 3-4)  
- [ ] Repository with hierarchy queries
- [ ] Service layer with business rules
- [ ] Cycle detection implementation
- [ ] Type-specific meta validation

### Phase 3: API Layer (Days 5-6)
- [ ] Controllers with error handling
- [ ] Route definitions
- [ ] Request/response validation
- [ ] Authentication integration

### Phase 4: Testing & Documentation (Days 7-8)
- [ ] Unit tests for all services
- [ ] Integration tests for APIs
- [ ] Performance testing for hierarchy queries
- [ ] API documentation generation

## 7. Technical Requirements

### Performance Requirements
- Hierarchy queries (ancestors, descendants) < 200ms
- Node CRUD operations < 100ms
- Support for 10,000+ nodes per user
- Efficient indexing for parent-child relationships

### Security Requirements
- User authentication required for all operations
- User isolation (cannot access other users' data)
- Input validation on all endpoints
- SQL injection prevention with parameterized queries

### Scalability Requirements
- Horizontal scaling ready (stateless services)
- Database connection pooling
- Efficient recursive CTEs for hierarchy operations
- Pagination support for large result sets

## 8. Testing Strategy

### Unit Testing
- Zod schema validation tests
- Service layer business logic tests
- Repository hierarchy query tests
- Cycle detection algorithm tests

### Integration Testing  
- End-to-end API workflow tests
- Database transaction integrity tests
- Authentication/authorization tests
- Error handling and edge case tests

### Performance Testing
- Hierarchy query performance with large datasets
- Concurrent user load testing
- Memory usage optimization tests

## 9. Deployment Strategy

### Development Environment
- Local PostgreSQL with test data
- Hot reload with tsx/nodemon
- Separate port (3001) from main app

### Staging Environment
- Isolated database schema
- Feature flags for gradual rollout
- Performance monitoring setup

### Production Deployment
- Database migration scripts
- API versioning (v2 namespace)
- Rollback capability
- Monitoring and alerting

## 10. Success Criteria

### Functional Success
- [ ] All 6 node types can be created with proper validation
- [ ] Multi-level hierarchies work correctly (3+ levels deep)
- [ ] Cycle prevention works in all scenarios
- [ ] All hierarchy operations return correct data
- [ ] Type-specific metadata validation catches invalid data

### Technical Success  
- [ ] 100% test coverage (unit + integration)
- [ ] API response times meet performance requirements
- [ ] Zero data corruption incidents
- [ ] Proper error handling for all edge cases
- [ ] Clean separation from existing timeline system

### User Experience Success
- [ ] Clear error messages for validation failures
- [ ] Intuitive API design for frontend integration
- [ ] Consistent response formats across all endpoints
- [ ] Fast response times for common operations

## 11. Future Enhancements

### Phase 2 Features (Post-MVP)
- Node search and filtering capabilities
- Bulk operations (move multiple nodes)
- Node templates for common hierarchies
- Timeline analytics and insights
- Export capabilities (JSON, CSV)

### Advanced Features
- Real-time collaboration on shared timelines
- Version history and change tracking
- Advanced querying with GraphQL
- Integration with external calendar systems
- AI-powered timeline suggestions

---

**Document Version**: 1.0  
**Last Updated**: January 2024  
**Next Review**: Post Phase 1 completion