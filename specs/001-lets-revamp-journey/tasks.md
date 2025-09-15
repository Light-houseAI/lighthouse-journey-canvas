# Task Plan: Timeline Journey Profile View

**Feature**: Profile View with Tree-based List Display  
**Branch**: `001-lets-revamp-journey`  
**Date**: 2025-01-12  
**Spec**: [spec.md](./spec.md)

## Summary

Implement a new profile view page that displays timeline nodes in a simplified tree-based list format. The feature transforms the existing timeline visualization into a profile page with current and past experiences sections, leveraging existing API endpoints and introducing new store architecture for better separation of concerns.

## Task Execution Order

Tasks are numbered for dependency tracking. Tasks marked with [P] can be executed in parallel with other [P] tasks in the same group. Tasks without [P] must be executed sequentially.

---

## Phase 1: Setup & Configuration (T001-T005)

### T001: Project Setup and Dependencies

- **File**: `package.json`
- **Description**: Install required dependencies (MSW for mocking) and verify existing TanStack Query setup
- **Commands**:
  ```bash
  pnpm add -D msw@^2.0.0
  pnpm add -D @tanstack/react-virtual@^3.0.0
  ```

### T002: MSW Configuration [P]

- **File**: `client/src/mocks/handlers.ts`, `client/src/mocks/browser.ts`
- **Description**: Set up MSW for API mocking in development and tests
- **Dependencies**: T001

### T003: Test Utilities Setup [P]

- **File**: `client/src/test-utils/profile-test-utils.ts`
- **Description**: Create factory functions for generating test profile data
- **Dependencies**: T001

### T004: Update TypeScript Types [P]

- **File**: `client/src/types/profile.ts`
- **Description**: Define ProfileData, TreeNode, and store interfaces
- **Dependencies**: T001

### T005: Environment Configuration [P]

- **File**: `.env.local`, `vite.config.ts`
- **Description**: Ensure proper environment setup for MSW and testing
- **Dependencies**: T001

---

## Phase 2: API Contract Tests (T006-T009)

### T006: Profile API Contract Test [P]

- **File**: `server/tests/contracts/profile-api.test.ts`
- **Description**: Write contract tests for GET /api/v2/timeline/nodes endpoint
- **Test Type**: Contract
- **Dependencies**: T002, T003

### T007: Node Details API Contract Test [P]

- **File**: `server/tests/contracts/node-details-api.test.ts`
- **Description**: Write contract tests for GET /api/v2/timeline/nodes/:nodeId endpoint
- **Test Type**: Contract
- **Dependencies**: T002, T003

### T008: Profile Response Schema Test [P]

- **File**: `server/tests/contracts/profile-response-schema.test.ts`
- **Description**: Validate response schemas match OpenAPI specification
- **Test Type**: Contract
- **Dependencies**: T002, T003

### T009: Error Response Contract Test [P]

- **File**: `server/tests/contracts/error-response.test.ts`
- **Description**: Test error scenarios (404, 401, 403) and response formats
- **Test Type**: Contract
- **Dependencies**: T002, T003

---

## Phase 3: Store Implementation (T010-T015)

### T010: Profile Store Test (TanStack Query)

- **File**: `client/src/stores/profile/useProfileStore.test.ts`
- **Description**: Write tests for profile data fetching with TanStack Query
- **Test Type**: Integration
- **Dependencies**: T004, T006

### T011: Profile Store Implementation

- **File**: `client/src/stores/profile/useProfileStore.ts`
- **Description**: Implement useProfileQuery and mutation hooks
- **Dependencies**: T010

### T012: Profile View Store Test (Zustand)

- **File**: `client/src/stores/profile/useProfileViewStore.test.ts`
- **Description**: Write tests for UI state management
- **Test Type**: Unit
- **Dependencies**: T004

### T013: Profile View Store Implementation

- **File**: `client/src/stores/profile/useProfileViewStore.ts`
- **Description**: Implement UI state store with node selection, expansion, panel state
- **Dependencies**: T012

### T014: Timeline Transform Store Test [P]

- **File**: `client/src/stores/profile/useTimelineTransform.test.ts`
- **Description**: Test pure transformation functions
- **Test Type**: Unit
- **Dependencies**: T004

### T015: Timeline Transform Store Implementation [P]

- **File**: `client/src/stores/profile/useTimelineTransform.ts`
- **Description**: Implement data transformation utilities
- **Dependencies**: T014

---

## Phase 4: Component Implementation (T016-T025)

### T016: ProfileHeader Component Test [P]

- **File**: `client/src/components/profile/ProfileHeader.test.tsx`
- **Description**: Test profile header with name display and share/copy buttons
- **Test Type**: Unit
- **Dependencies**: T004

### T017: ProfileHeader Component Implementation [P]

- **File**: `client/src/components/profile/ProfileHeader.tsx`
- **Description**: Implement header with user info and action buttons
- **Dependencies**: T016

### T018: TreeList Component Test [P]

- **File**: `client/src/components/timeline/TreeList.test.tsx`
- **Description**: Test hierarchical tree list rendering
- **Test Type**: Unit
- **Dependencies**: T004

### T019: TreeList Component Implementation [P]

- **File**: `client/src/components/timeline/TreeList.tsx`
- **Description**: Implement tree structure with expand/collapse functionality
- **Dependencies**: T018

### T020: NodeListItem Component Test [P]

- **File**: `client/src/components/timeline/NodeListItem.test.tsx`
- **Description**: Test individual node rendering in list format
- **Test Type**: Unit
- **Dependencies**: T004

### T021: NodeListItem Component Implementation [P]

- **File**: `client/src/components/timeline/NodeListItem.tsx`
- **Description**: Wrapper component for displaying nodes in list view
- **Dependencies**: T020

### T022: ExperienceSection Component Test [P]

- **File**: `client/src/components/timeline/ExperienceSection.test.tsx`
- **Description**: Test current/past experience section rendering
- **Test Type**: Unit
- **Dependencies**: T004

### T023: ExperienceSection Component Implementation [P]

- **File**: `client/src/components/timeline/ExperienceSection.tsx`
- **Description**: Section component for grouping timeline nodes
- **Dependencies**: T022

### T024: ProfileListView Component Test

- **File**: `client/src/components/timeline/ProfileListView.test.tsx`
- **Description**: Test main profile list view component
- **Test Type**: Integration
- **Dependencies**: T011, T013, T017, T019, T021, T023

### T025: ProfileListView Component Implementation

- **File**: `client/src/components/timeline/ProfileListView.tsx`
- **Description**: Main component orchestrating profile view
- **Dependencies**: T024

---

## Phase 5: Page Integration (T026-T028)

### T026: Professional Journey Page Test

- **File**: `client/src/pages/professional-journey.test.tsx`
- **Description**: Test updated professional journey page
- **Test Type**: Integration
- **Dependencies**: T025

### T027: Professional Journey Page Update

- **File**: `client/src/pages/professional-journey.tsx`
- **Description**: Update existing page to use new ProfileListView component
- **Dependencies**: T026

### T028: Routing Integration Test

- **File**: `client/tests/integration/profile-routing.test.tsx`
- **Description**: Test routing between own profile (/) and other profiles (/:username)
- **Test Type**: Integration
- **Dependencies**: T027

---

## Phase 6: E2E Tests (T029-T033)

### T029: Profile View E2E Test [P]

- **File**: `client/tests/e2e/profile-view.spec.ts`
- **Description**: E2E test for viewing profile with current and past experiences
- **Test Type**: E2E
- **Dependencies**: T027

### T030: Node Navigation E2E Test [P]

- **File**: `client/tests/e2e/node-navigation.spec.ts`
- **Description**: E2E test for expanding/collapsing hierarchical nodes
- **Test Type**: E2E
- **Dependencies**: T027

### T031: Node Details Panel E2E Test [P]

- **File**: `client/tests/e2e/node-details.spec.ts`
- **Description**: E2E test for opening and viewing node details
- **Test Type**: E2E
- **Dependencies**: T027

### T032: Share Profile E2E Test [P]

- **File**: `client/tests/e2e/share-profile.spec.ts`
- **Description**: E2E test for share and copy URL functionality
- **Test Type**: E2E
- **Dependencies**: T027

### T033: Accessibility E2E Test [P]

- **File**: `client/tests/e2e/profile-accessibility.spec.ts`
- **Description**: E2E test for keyboard navigation and screen reader support
- **Test Type**: E2E
- **Dependencies**: T027

---

## Phase 7: Polish & Optimization (T034-T037)

### T034: Virtual Scrolling Implementation

- **File**: `client/src/components/timeline/VirtualTreeList.tsx`
- **Description**: Implement virtual scrolling for large datasets (50+ nodes)
- **Dependencies**: T019

### T035: Store Persistence with LocalStorage

- **File**: `client/src/stores/profile/persistence.ts`
- **Description**: Add localStorage persistence for UI state (expanded nodes, selected node) using Zustand persist middleware
- **Implementation Notes**:
  - Persist expandedNodeIds Set to localStorage
  - Persist selectedNodeId for returning users
  - Clear on logout
- **Dependencies**: T013

### T036: Error Boundaries

- **File**: `client/src/components/profile/ProfileErrorBoundary.tsx`
- **Description**: Add error boundaries with proper error reporting
- **Dependencies**: T025

### T037: Documentation

- **File**: `docs/features/profile-view.md`
- **Description**: Create feature documentation with usage examples
- **Dependencies**: All previous tasks

---

## Parallel Execution Examples

### Group 1: Initial Setup (After T001)

```bash
# Execute in parallel
Task run T002 &  # MSW Configuration
Task run T003 &  # Test Utilities
Task run T004 &  # TypeScript Types
Task run T005 &  # Environment Config
wait
```

### Group 2: Contract Tests (After T002, T003)

```bash
# Execute all contract tests in parallel
Task run T006 &  # Profile API Contract
Task run T007 &  # Node Details Contract
Task run T008 &  # Schema Validation
Task run T009 &  # Error Response
wait
```

### Group 3: Component Tests (After T004)

```bash
# Execute component tests in parallel
Task run T016 &  # ProfileHeader Test
Task run T018 &  # TreeList Test
Task run T020 &  # NodeListItem Test
Task run T022 &  # ExperienceSection Test
wait
```

### Group 4: E2E Tests (After T027)

```bash
# Execute all E2E tests in parallel
Task run T029 &  # Profile View E2E
Task run T030 &  # Node Navigation E2E
Task run T031 &  # Node Details E2E
Task run T032 &  # Share Profile E2E
Task run T033 &  # Accessibility E2E
wait
```

---

## Success Criteria

- ✅ All contract tests pass (T006-T009)
- ✅ All component tests pass (T016-T023)
- ✅ All integration tests pass (T024, T026, T028)
- ✅ All E2E tests pass (T029-T033)
- ✅ Accessibility audit passes (T033)
- ✅ No console errors in development or production
- ✅ UI state persists across sessions via localStorage (T035)
- ✅ Documentation complete (T037)

## Notes

- Each task follows TDD: write test first, then implementation
- Tasks in the same phase marked [P] can run in parallel
- Sequential tasks depend on previous task completion
- Use `pnpm test:watch` during development for immediate feedback
- Commit after each test-implementation pair with descriptive messages

## Test Execution Commands

```bash
# Unit tests
pnpm test:client -- --run

# Integration tests
pnpm test:integration

# E2E tests
pnpm test:e2e

# All tests
pnpm test:all
```

## Estimated Timeline

- **Phase 1-2**: 2 hours (Setup & Contract Tests)
- **Phase 3**: 3 hours (Store Implementation)
- **Phase 4-5**: 4 hours (Components & Integration)
- **Phase 6**: 2 hours (E2E Tests)
- **Phase 7**: 1.5 hours (Polish & Optimization)
- **Total**: ~12.5 hours of focused development

---

_Generated from specifications in `/specs/001-lets-revamp-journey/`_
