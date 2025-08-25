# PRD: Username-Based Timeline Viewing with Permissions

## Executive Summary

This PRD outlines the implementation of username-based timeline viewing functionality for Lighthouse, enabling authenticated users to view other users' career timelines through clean URLs like `/username`, with appropriate permission filtering to respect privacy and access control settings.

**Impact**: Enables timeline sharing and viewing across users while maintaining security and privacy controls through the existing permission system.

## Problem Statement

Currently, users can only view their own timeline nodes in Lighthouse. There's no mechanism for:

1. **Sharing timelines** - Users cannot share their career journey with others through clean, memorable URLs
2. **Cross-user viewing** - No way for authenticated users to explore other users' career journeys
3. **Public profiles** - No concept of viewable user profiles based on permissions
4. **Username identification** - Users lack unique, human-readable identifiers beyond email

**Why solve this now**: This foundational feature enables social and collaborative aspects of career journey sharing, which is core to Lighthouse's value proposition of helping users showcase their professional development.

## Goals & Success Metrics

### Primary Goals

- **G1**: Enable username-based timeline viewing through `/username` URLs
- **G2**: Apply existing permission system to filter viewable nodes
- **G3**: Reuse existing HierarchicalTimeline component without modification
- **G4**: Maintain backward compatibility with current timeline functionality

### Success Metrics

- **M1**: Users can access other users' timelines via `/username` URLs
- **M2**: Permission filtering correctly hides restricted nodes (0% data leakage)
- **M3**: Timeline loading performance remains <500ms for filtered views
- **M4**: No breaking changes to existing user flows

### Non-Goals

- User discovery/search functionality
- Public (unauthenticated) timeline viewing
- Advanced permission management UI
- Username management/settings interface

## User Stories & Requirements

### Epic 1: Username System

**As a user, I want to have a unique username so that others can find and view my timeline.**

#### User Stories

- **US1.1**: As a user, I want my username included in my profile responses so the frontend can display it
- **US1.2**: As a user, I want to be identifiable by my username through API lookups
- **US1.3**: As a user, I want usernames to be optional (nullable) for backward compatibility

#### Acceptance Criteria

- Users table has `user_name` column (nullable text, unique)
- Auth APIs (signin, signup, me) return `userName` field
- Storage service can lookup users by username
- Database constraint prevents duplicate usernames

### Epic 2: Username-Based Timeline Viewing

**As an authenticated user, I want to view other users' timelines through `/username` URLs so that I can explore their career journeys.**

#### User Stories

- **US2.1**: As an authenticated user, when I visit `/username`, I should see that user's timeline nodes that I have permission to view
- **US2.2**: As an authenticated user, I should see the same timeline interface whether viewing my own nodes or another user's nodes
- **US2.3**: As an authenticated user, I should only see nodes that the node owner has granted me permission to view
- **US2.4**: As an authenticated user, I should see a 404 page if the username doesn't exist or I have no permissions

#### Acceptance Criteria

- `/username` route renders HierarchicalTimeline with filtered nodes
- Permission filtering uses existing NodePermissionService.canAccess
- UI remains identical between personal and other user timelines
- Proper error handling for non-existent users
- Node owners always see full timeline regardless of permissions

### Epic 3: Permission-Based Node Filtering

**As a node owner, I want my existing permission policies to automatically apply to username-based timeline viewing.**

#### User Stories

- **US3.1**: As a node owner, I want only users with `view` permission to see my nodes in username-based timeline viewing
- **US3.2**: As a node owner, I want my permission policies (public, organization, user-specific) to work seamlessly with the username viewing feature
- **US3.3**: As a viewing user, I want to see a clean timeline with only the nodes I have permission to view, without knowing about restricted nodes

#### Acceptance Criteria

- Each timeline node is checked against existing permission policies
- Filtering happens server-side for security
- No information leakage about restricted nodes
- Performance remains acceptable with permission checks

## Technical Specifications

### Architecture Overview

```
Browser Request: /username
    ↓
React Router → UserTimelinePage
    ↓
Hierarchy Store → loadNodes(username)
    ↓
Hierarchy API → GET /api/v2/timeline/nodes?username=xyz
    ↓
Hierarchy Controller → listNodes(req, res)
    ↓ (extracts authenticated user from session)
Hierarchy Service → getAllNodes(targetUsername)
    ↓ (looks up target user, filters nodes)
Node Permission Service → canAccess(authenticatedUserId, nodeId)
    ↓
Return filtered nodes → Same HierarchicalTimeline component
```

### Database Schema Changes

#### Users Table Update

```sql
-- Add username column to users table
ALTER TABLE users
ADD COLUMN user_name TEXT UNIQUE;

-- Create index for username lookups
CREATE INDEX IF NOT EXISTS idx_users_user_name ON users(user_name);
```

#### Updated Drizzle Schema

```typescript
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  userName: text('user_name').unique(), // New field
  interest: text('interest'),
  hasCompletedOnboarding: boolean('has_completed_onboarding').default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

### API Specifications

#### Modified Timeline Nodes Endpoint

```
GET /api/v2/timeline/nodes?username=<username>
```

**Query Parameters:**

- `username` (optional): Target user's username to view their timeline

**Authentication:** Required (session-based)

**Request Flow:**

1. Extract authenticated user ID from session
2. If `username` parameter provided:
   - Look up target user by username
   - Get target user's nodes from repository
   - Filter each node using NodePermissionService.canAccess(authenticatedUserId, nodeId)
   - Return filtered nodes
3. If no `username` parameter:
   - Return authenticated user's own nodes (existing behavior)

**Response:** Standard ApiResponse<TimelineNode[]> with filtered nodes

#### Updated Auth Endpoints

**GET /api/me**

```typescript
// Response now includes userName
{
  id: number,
  email: string,
  userName: string | null,
  interest: string,
  hasCompletedOnboarding: boolean
}
```

**POST /signin, /signup**

```typescript
// Responses now include userName in user object
{
  success: true,
  user: {
    id: number,
    email: string,
    userName: string | null,
    interest: string,
    hasCompletedOnboarding: boolean
  }
}
```

### Service Layer Changes

#### Storage Service

```typescript
interface IStorage {
  // New method
  getUserByUsername(username: string): Promise<User | undefined>;

  // Modified methods to include userName in responses
  getUserById(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
}
```

#### Hierarchy Service

```typescript
class HierarchyService {
  // Modified method signature
  async getAllNodes(
    userId: number,
    targetUsername?: string
  ): Promise<NodeWithParent[]> {
    if (targetUsername) {
      // Look up target user
      const targetUser =
        await this.storageService.getUserByUsername(targetUsername);
      if (!targetUser) return [];

      // Get target user's nodes
      const targetNodes = await this.repository.getAllNodes(targetUser.id);

      // Filter nodes based on permissions
      const filteredNodes = [];
      for (const node of targetNodes) {
        const canView = await this.nodePermissionService.canAccess(
          userId,
          node.id
        );
        if (canView) {
          filteredNodes.push(node);
        }
      }

      return Promise.all(
        filteredNodes.map((node) =>
          this.enrichWithParentInfo(node, targetUser.id)
        )
      );
    }

    // Existing behavior for own nodes
    return this.getAllNodesForUser(userId);
  }
}
```

### Frontend Architecture

#### Routing Structure

```typescript
// App.tsx or AuthenticatedApp.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function AuthenticatedApp() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Own timeline */}
        <Route path="/" element={<ProfessionalJourney />} />

        {/* Username-based timeline */}
        <Route path="/:username" element={<UserTimelinePage />} />
      </Routes>
    </BrowserRouter>
  );
}
```

#### New Component: UserTimelinePage

```typescript
function UserTimelinePage() {
  const { username } = useParams();
  const { loadNodes } = useHierarchyStore();

  useEffect(() => {
    if (username) {
      loadNodes(username); // Pass username to store
    }
  }, [username, loadNodes]);

  // Render same HierarchicalTimeline component
  return <HierarchicalTimeline />;
}
```

#### Hierarchy Store Updates

```typescript
interface HierarchyState {
  // Modified method
  loadNodes: (username?: string) => Promise<void>;
}

const useHierarchyStore = create<HierarchyState>((set, get) => ({
  loadNodes: async (username?: string) => {
    const apiNodes = await hierarchyApi.listNodes(username);
    // ... existing tree building logic
  },
}));
```

#### API Service Updates

```typescript
class HierarchyApiService {
  async listNodes(username?: string): Promise<TimelineNode[]> {
    const queryParams = username
      ? `?username=${encodeURIComponent(username)}`
      : '';
    return httpClient<TimelineNode[]>(`/nodes${queryParams}`);
  }
}
```

## Implementation Plan

### Phase 1: Database & Backend Services (Days 1-2)

1. **Database Migration**
   - Add `user_name` column to users table
   - Update Drizzle schema in shared/schema.ts
   - Run migration and verify

2. **Storage Service Updates**
   - Add `getUserByUsername` method
   - Update existing methods to include userName
   - Add unit tests

3. **Hierarchy Service Updates**
   - Modify `getAllNodes` to support targetUsername parameter
   - Implement permission filtering logic
   - Add comprehensive unit tests

4. **Auth Route Updates**
   - Update response objects to include userName
   - Test all auth endpoints

### Phase 2: API Layer (Day 3)

1. **Controller Updates**
   - Modify `listNodes` to handle username query parameter
   - Add proper error handling for invalid usernames
   - Test API endpoints with various scenarios

2. **Integration Testing**
   - Test permission filtering with various user/node combinations
   - Verify performance with large node sets
   - Test edge cases (non-existent users, no permissions)

### Phase 3: Frontend Implementation (Days 4-5)

1. **Install Dependencies**
   - Add react-router-dom package
   - Update package.json

2. **Routing Implementation**
   - Add BrowserRouter to App.tsx
   - Create UserTimelinePage component
   - Set up route structure

3. **Store & API Updates**
   - Modify hierarchy store loadNodes method
   - Update hierarchy API service
   - Test data flow from URL to component

4. **Integration & Testing**
   - End-to-end testing of username-based viewing
   - Cross-browser testing
   - Performance testing

### Phase 4: Testing & Validation (Day 6)

1. **Comprehensive Testing**
   - Unit tests for all new/modified methods
   - Integration tests for complete user flows
   - Permission boundary testing
   - Performance validation

2. **Security Review**
   - Verify no information leakage
   - Test permission edge cases
   - Validate input sanitization

## Testing Strategy

### Unit Tests

- **Storage Service**: Test getUserByUsername with valid/invalid usernames
- **Hierarchy Service**: Test getAllNodes with permission filtering
- **Node Permission Service**: Test canAccess with various scenarios
- **Frontend Components**: Test UserTimelinePage with different props

### Integration Tests

- **API Endpoints**: Test /nodes with username parameter
- **Permission Flows**: Test viewing restricted/allowed nodes
- **Error Cases**: Test non-existent usernames, unauthorized access

### End-to-End Tests (Playwright)

- User visits `/username` and sees filtered timeline
- User visits non-existent username and sees 404
- User visits own username and sees full timeline
- Permission changes reflect immediately in timeline view

### Performance Tests

- Timeline loading with permission filtering <500ms
- Memory usage validation for large filtered datasets
- Database query performance with permission checks

## Risk Assessment

### High-Risk Areas

#### Security Risks

- **R1: Information Leakage**: Users might see nodes they shouldn't have access to
  - **Mitigation**: Server-side filtering using existing permission system, comprehensive testing
  - **Detection**: Automated tests checking permission boundaries

- **R2: Permission Bypass**: Flaws in permission checking logic could allow unauthorized access
  - **Mitigation**: Reuse existing NodePermissionService, security review
  - **Detection**: Penetration testing, audit logs

#### Technical Risks

- **R3: Performance Impact**: Permission checking for each node could slow down timeline loading
  - **Mitigation**: Database-level permission function, performance monitoring
  - **Detection**: Load testing, APM monitoring

- **R4: Database Migration Issues**: Adding unique constraint to existing users table
  - **Mitigation**: Careful migration script, backup strategy
  - **Detection**: Migration testing on staging environment

### Medium-Risk Areas

#### User Experience Risks

- **R5: Confusing Navigation**: Users might not understand they're viewing another user's timeline
  - **Mitigation**: Clear UI indicators, breadcrumbs
  - **Detection**: User testing, feedback collection

- **R6: Broken Links**: Username changes or deletions could break shared links
  - **Mitigation**: Username immutability policy, proper 404 handling
  - **Detection**: Monitoring 404 rates, user reports

### Low-Risk Areas

- **Frontend Routing**: Well-established React Router patterns
- **API Modifications**: Minimal changes to existing endpoints
- **Component Reuse**: Using existing HierarchicalTimeline without changes

## Success Criteria & Acceptance

### Technical Acceptance Criteria

- ✅ Users table has `user_name` column with unique constraint
- ✅ All auth endpoints return `userName` field
- ✅ `/username` route renders filtered timeline nodes
- ✅ Permission filtering uses existing NodePermissionService.canAccess
- ✅ Performance remains <500ms for timeline loading
- ✅ Zero information leakage in permission filtering

### User Acceptance Criteria

- ✅ Authenticated users can visit `/username` URLs
- ✅ Users only see nodes they have permission to view
- ✅ Timeline interface is identical for own/other user views
- ✅ Non-existent usernames show appropriate 404 page
- ✅ Existing personal timeline functionality unchanged

### Quality Gates

- ✅ All existing tests continue to pass
- ✅ New functionality has >90% test coverage
- ✅ Security review passes with no high/critical findings
- ✅ Performance tests meet defined SLAs
- ✅ Cross-browser compatibility verified

## Dependencies & Prerequisites

### Technical Dependencies

- Existing NodePermissionService implementation
- Existing HierarchicalTimeline component
- Database migration capabilities
- React Router DOM package

### User Dependencies

- Users must be authenticated to view any timelines
- Node owners must have set appropriate permissions for sharing

### External Dependencies

- No external service dependencies
- Uses existing authentication and permission systems

## Post-Launch Monitoring

### Key Metrics to Track

- **Usage**: Number of unique username-based timeline views per day
- **Performance**: Average timeline loading time with permission filtering
- **Errors**: 404 rates for username lookups, permission errors
- **Security**: Failed permission checks, unauthorized access attempts

### Monitoring & Alerting

- Database query performance alerts for permission checks
- Error rate monitoring for username-based routes
- Security audit log monitoring for suspicious access patterns

## Future Enhancements

### Short-term (Next 2-3 months)

- Username settings interface for users to set/change usernames
- User discovery/search functionality
- Timeline sharing UI improvements

### Long-term (6+ months)

- Public (unauthenticated) timeline viewing
- Advanced permission management UI
- Social features (following, favorites)
- Timeline collaboration features

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-19  
**Next Review**: Upon implementation completion  
**Stakeholders**: Engineering Team, Product Owner
