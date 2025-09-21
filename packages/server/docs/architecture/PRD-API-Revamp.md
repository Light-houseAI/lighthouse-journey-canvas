# Product Requirements Document: API Revamp with Repository & Service Layers

## Executive Summary

This document outlines the refactoring of the existing API to implement a clean layered architecture using Repository and Service patterns. As an early-stage startup, we'll focus on a Minimum Viable Product (MVP) approach while planning for future scalability.

## 1. Overview

### 1.1 Purpose

Refactor the existing monolithic API into a maintainable, testable, and scalable architecture without modifying the database schema. All node data will continue to be stored in the `filteredData` JSON field of the `profiles` table.

### 1.2 Startup Context

- **Stage**: Early-stage proof of concept
- **Priority**: Speed to market with maintainable foundation
- **Approach**: MVP-first with clear growth path

## 2. Architecture

### 2.1 Technology Stack

- **Language**: TypeScript
- **Runtime**: Node.js
- **DI Framework**: typed-inject (lightweight, no decorators needed)
- **Database**: PostgreSQL with Drizzle ORM
- **Testing**: Vitest

### 2.2 Layer Structure

```
┌─────────────────────────┐
│   API Routes/Controllers │
├─────────────────────────┤
│      Services           │
├─────────────────────────┤
│    Repositories         │
├─────────────────────────┤
│     Database            │
└─────────────────────────┘
```

## 3. Node Types

### 3.1 All Node Types (Complete Implementation)

1. **job**: Employment history and roles (renamed from workExperience)
2. **education**: Academic qualifications
3. **project**: Personal/professional projects
4. **event**: Conferences, meetups, presentations
5. **action**: Achievements, milestones, certifications
6. **careerTransition**: Job changes, career pivots

## 4. Implementation Strategy

### Single Milestone: Complete CRUD Implementation

**Goal**: Implement clean CRUD endpoints for all 6 node types

#### Tasks:

1. **Core Infrastructure** (Complete)
   - typed-inject DI container
   - Base interfaces and types
   - Zod validation schemas

2. **Repository Layer** (Complete + Updates)
   - Base repository pattern
   - All 6 node type repositories
   - JSON storage in profiles.filteredData

3. **Service Layer** (Complete + Updates)
   - Base service with validation
   - Business logic for all node types
   - Error handling and transformation

4. **API Layer** (Updates Required)
   - Rename work-experience to jobs
   - Add Event, Action, CareerTransition controllers
   - Remove all non-CRUD endpoints
   - Clean up aggregation endpoints

5. **Testing** (Updates Required)
   - CRUD tests for all node types
   - Remove advanced feature tests
   - Focus on core functionality

**Success Criteria**:

- 6 complete node types with CRUD operations
- Clean, consistent API design
- All endpoints follow same pattern
- Basic tests passing for all types

## 5. API Endpoints - CRUD Only

### 5.1 Complete Node Type Endpoints

```
# Jobs (renamed from work-experiences)
GET    /api/v1/profiles/:profileId/jobs
POST   /api/v1/profiles/:profileId/jobs
GET    /api/v1/profiles/:profileId/jobs/:id
PUT    /api/v1/profiles/:profileId/jobs/:id
DELETE /api/v1/profiles/:profileId/jobs/:id

# Education
GET    /api/v1/profiles/:profileId/education
POST   /api/v1/profiles/:profileId/education
GET    /api/v1/profiles/:profileId/education/:id
PUT    /api/v1/profiles/:profileId/education/:id
DELETE /api/v1/profiles/:profileId/education/:id

# Projects
GET    /api/v1/profiles/:profileId/projects
POST   /api/v1/profiles/:profileId/projects
GET    /api/v1/profiles/:profileId/projects/:id
PUT    /api/v1/profiles/:profileId/projects/:id
DELETE /api/v1/profiles/:profileId/projects/:id

# Events
GET    /api/v1/profiles/:profileId/events
POST   /api/v1/profiles/:profileId/events
GET    /api/v1/profiles/:profileId/events/:id
PUT    /api/v1/profiles/:profileId/events/:id
DELETE /api/v1/profiles/:profileId/events/:id

# Actions
GET    /api/v1/profiles/:profileId/actions
POST   /api/v1/profiles/:profileId/actions
GET    /api/v1/profiles/:profileId/actions/:id
PUT    /api/v1/profiles/:profileId/actions/:id
DELETE /api/v1/profiles/:profileId/actions/:id

# Career Transitions
GET    /api/v1/profiles/:profileId/career-transitions
POST   /api/v1/profiles/:profileId/career-transitions
GET    /api/v1/profiles/:profileId/career-transitions/:id
PUT    /api/v1/profiles/:profileId/career-transitions/:id
DELETE /api/v1/profiles/:profileId/career-transitions/:id
```

### 5.2 Removed Endpoints

- All aggregation endpoints (/nodes)
- All milestone endpoints
- All advanced query endpoints (date-range, overlaps, etc.)
- All insight endpoints
- All utility endpoints (stats, technologies, etc.)

## 6. Test Strategy

### 6.1 MVP Tests (Milestone 1)

```
WorkExperienceRepository Tests:
✓ should create work experience
✓ should find by ID
✓ should update experience
✓ should delete experience

WorkExperienceService Tests:
✓ should validate required fields
✓ should auto-generate unique IDs
✓ should handle "Present" as end date

API Integration Tests:
✓ should create work experience via API
✓ should return 401 for unauthenticated
✓ should return 404 for not found
```

### 6.2 Comprehensive Tests (Milestone 3+)

- Unit tests for all repositories
- Service layer business logic tests
- End-to-end workflow tests
- Performance tests
- Security tests

## 7. Technical Specifications

### 7.1 Core Interfaces

```typescript
// Base node structure
interface BaseNode {
  id: string;
  type: NodeType;
  title: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

// Repository pattern
interface IRepository<T> {
  findAll(profileId: number): Promise<T[]>;
  findById(profileId: number, id: string): Promise<T | null>;
  create(profileId: number, data: Omit<T, 'id'>): Promise<T>;
  update(profileId: number, id: string, data: Partial<T>): Promise<T | null>;
  delete(profileId: number, id: string): Promise<boolean>;
}

// Service pattern
interface IService<T> {
  getAll(profileId: number): Promise<T[]>;
  getById(profileId: number, id: string): Promise<T>;
  create(profileId: number, data: CreateDTO): Promise<T>;
  update(profileId: number, id: string, data: UpdateDTO): Promise<T>;
  delete(profileId: number, id: string): Promise<void>;
}
```

### 7.2 Data Storage

All nodes stored in `profiles.filteredData` as:

```json
{
  "workExperiences": [...],
  "education": [...],
  "projects": [...],
  "events": [...],
  "actions": [...],
  "careerTransitions": [...]
}
```

## 8. Success Metrics

### 8.1 MVP Metrics

- [ ] One complete node type (work experience) fully functional
- [ ] Basic CRUD operations working
- [ ] Response time < 300ms
- [ ] Zero critical bugs

### 8.2 Production Metrics

- [ ] All node types implemented
- [ ] 80%+ test coverage
- [ ] Response time < 200ms (single operations)
- [ ] Response time < 500ms (aggregations)
- [ ] Zero data loss
- [ ] 100% backward compatibility

## 9. Risks & Mitigation

### 9.1 Technical Risks

| Risk                      | Impact | Mitigation                            |
| ------------------------- | ------ | ------------------------------------- |
| JSON query performance    | High   | Index JSONB fields, implement caching |
| Data migration complexity | Medium | Maintain backward compatibility       |
| Type safety with JSON     | Medium | Strong TypeScript interfaces          |

### 9.2 Business Risks

| Risk                       | Impact | Mitigation              |
| -------------------------- | ------ | ----------------------- |
| Over-engineering for POC   | High   | Focus on MVP first      |
| Breaking existing features | High   | Comprehensive testing   |
| Delayed timeline           | Medium | Phased rollout approach |

## 10. Future Considerations

### 10.1 Potential Enhancements

- GraphQL API layer
- Real-time updates via WebSockets
- Separate node tables (major refactor)
- AI-powered insights
- Version history for nodes

### 10.2 Scalability Path

1. Start with JSON storage (current)
2. Add caching layer
3. Optimize queries
4. Consider separate tables if needed
5. Potential microservices split

## 11. Timeline

### Week 1: MVP Foundation

- Days 1-2: Infrastructure setup
- Days 3-4: Work experience implementation
- Day 5: Testing and refinement

### Week 2: Core Features

- Days 1-2: Education nodes
- Days 3-4: Project nodes
- Day 5: Integration testing

### Week 3-4: Extended Features

- Insights system
- Remaining node types
- Advanced queries

### Week 5-6: Production Polish

- Performance optimization
- Security hardening
- Documentation

## 12. Approval & Sign-off

**Product Owner**: ********\_\_\_******** Date: ****\_\_\_****

**Tech Lead**: **********\_\_********** Date: ****\_\_\_****

**QA Lead**: **********\_\_\_********** Date: ****\_\_\_****

---

## Appendix A: Task List by Priority

### High Priority (MVP - Week 1)

1. Set up TypeScript DI framework (typed-inject) and core interfaces
2. Create base repository interface and abstract implementation
3. Implement WorkExperienceRepository with tests
4. Create base service interface and abstract implementation
5. Implement WorkExperienceService with tests
6. Create API route structure and base controller
7. Implement work-experiences API endpoints with integration tests
8. Implement ProfileService for node aggregation with tests
9. Implement node aggregation endpoint with tests

### Medium Priority (Core Features - Week 2)

10. Implement EducationRepository with tests
11. Implement ProjectRepository with tests
12. Implement remaining core node services with tests
13. Create comprehensive integration tests

### Low Priority (Future Enhancements)

14. Implement EventRepository with tests
15. Implement ActionRepository with tests
16. Implement CareerTransitionRepository with tests
17. Implement InsightRepository with tests
18. Create end-to-end tests for complete workflows
19. Update existing code to use new architecture
20. Create migration guide and deprecation notices
