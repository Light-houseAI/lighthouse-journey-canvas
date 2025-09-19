# ShareModal Test Specification

## Overview

This document outlines all the test cases for the ShareModal component based on the Figma design requirements. The tests ensure the sharing functionality works correctly for timeline nodes.

## Implementation Status: Updated 2025-01-19

### Completed Components

- ✅ ShareModal with Networks/People tabs
- ✅ NetworksAccessSection for organization permissions
- ✅ PeopleAccessSection for user permissions
- ✅ SearchPeopleComponent with debounced search
- ✅ NetworkPermissionsView for detailed network permissions
- ✅ BulkPersonPermissionsView for bulk user permissions

### Test Infrastructure Updates

- ✅ Created share-store-mock helper for consistent test mocking
- ✅ Fixed share store configuration issues in tests
- ✅ Implemented MSW handlers for all API endpoints
- ✅ Created factory-based test data generation

## Test Categories & Use Cases

### 1. Modal Display & Structure

**Purpose**: Verify the modal opens correctly and displays all required elements

#### Test Cases:

- ✅ **Modal opens with proper header**
  - Modal dialog should be visible
  - Should display "Share" title
  - Should show tabbed interface (People/Networks)

- ✅ **Tab Navigation**
  - People tab is default selection
  - Can switch between People and Networks tabs
  - Tab content changes appropriately

### 2. People Tab (Default)

**Purpose**: Manage individual user access permissions

#### Test Cases:

- ✅ **Search for users**
  - Search input with icon and placeholder "Search by name"
  - Debounced search (300ms delay)
  - Shows loading state during search
  - Displays search results with user avatar, name, email

- ✅ **Display current user permissions**
  - Shows users who currently have access
  - Displays access level for each user
  - Shows permission details when expanded
  - Can remove user permissions

- ✅ **Add new user permissions**
  - Select users from search results
  - Set access level (View Only, Comment, Full Access)
  - Bulk add multiple users at once

### 3. Networks Tab

**Purpose**: Manage organization/team access permissions

#### Test Cases:

- ✅ **Display organizations**
  - Shows all user's organizations
  - Displays appropriate icons (GraduationCap for education, Building for companies)
  - Shows current access level for each organization

- ✅ **Access level indicators**
  - "No access" - gray text
  - "Limited access" - partial node access
  - "Full access" - all nodes accessible
  - Shows node count (e.g., "3/5 nodes")

- ✅ **Manage organization permissions**
  - Click organization to open NetworkPermissionsView
  - Select which nodes to share with organization
  - Update access levels
  - Save changes

### 4. Permission Views

#### NetworkPermissionsView Tests:

- ✅ **Component rendering**
  - Displays organization name and description
  - Shows organization type badge
  - Has back navigation

- ✅ **Journey scope selection**
  - Lists all user's timeline nodes
  - Checkboxes for node selection
  - Select/deselect all functionality
  - Shows node titles and types

- ✅ **Access level selection**
  - Radio buttons for access levels
  - View Only, Comment, Full Access options
  - Proper descriptions for each level

#### BulkPersonPermissionsView Tests:

- ✅ **Bulk user selection**
  - Shows selected users from search
  - Displays user avatars and names
  - Can remove individual users

- ✅ **Permission assignment**
  - Set access level for all selected users
  - Apply to selected nodes or all nodes
  - Save bulk permissions

### 5. Integration Tests

- ✅ **Full flow test**
  - Open modal → Search users → Select users → Set permissions → Save
  - Open modal → Switch to Networks → Select org → Set access → Save

- ✅ **State management**
  - Share store properly manages configuration
  - Permissions are loaded from API
  - Updates persist after save

### 6. Mock Data & API Tests

#### API Endpoints Mocked:

- ✅ GET `/api/v2/timeline/nodes` - List user's nodes
- ✅ GET `/api/v2/timeline/nodes/:nodeId/permissions` - Get node permissions
- ✅ POST `/api/v2/timeline/nodes/:nodeId/permissions` - Create permission
- ✅ DELETE `/api/v2/timeline/nodes/:nodeId/permissions/:policyId` - Remove permission
- ✅ PUT `/api/v2/timeline/permissions/:policyId` - Update permission
- ✅ PUT `/api/v2/timeline/permissions/bulk` - Bulk update permissions
- ✅ POST `/api/v2/timeline/nodes/permissions/bulk` - Get bulk permissions
- ✅ GET `/api/v2/users/search` - Search users
- ✅ GET `/api/v2/organizations` - List organizations

### 7. Error Handling Tests

- ⚠️ **Network errors** - Partially implemented
  - Show error toast on API failures
  - Retry mechanism for failed requests

- ⚠️ **Validation errors** - Needs improvement
  - Prevent saving without selection
  - Validate access level selection

## Test File Organization

```
client/src/components/share/
├── ShareModal.test.tsx (main modal tests)
├── ShareModal.integration.test.tsx ✅
├── ShareModal.networks.test.tsx ✅
├── ShareModal.people.test.tsx ✅
├── NetworksAccessSection.test.tsx ✅
├── PeopleAccessSection.test.tsx ✅
├── NetworkPermissionsView.test.tsx ✅
├── BulkPersonPermissionsView.test.tsx ✅
└── SearchPeopleComponent.test.tsx ✅

client/src/test-utils/
└── share-store-mock.ts ✅ (Helper for consistent mocking)
```

## Running Tests

```bash
# Run all share component tests
npx vitest run src/components/share/

# Run specific test file
npx vitest run ShareModal.integration.test.tsx

# Run with watch mode
npx vitest --watch

# Run with coverage
npx vitest run --coverage
```

## Known Issues & TODOs

1. **Test Failures**: Some tests need config property fixes
2. **HTTP 404 Errors**: MSW handlers need proper URL matching
3. **Missing Tests**: Error handling and edge cases need more coverage
4. **Performance**: Large dataset tests not yet implemented

## Next Steps

1. Fix remaining test failures with proper store mocking
2. Add comprehensive error handling tests
3. Implement performance tests with large datasets
4. Add accessibility tests for screen readers
5. Create E2E tests with Playwright
