# ShareModal Test Specification

## Overview

This document outlines all the test cases for the ShareModal component based on the Figma design requirements. The tests ensure the sharing functionality works correctly for timeline nodes.

## Test Categories & Use Cases

### 1. Modal Display & Structure

**Purpose**: Verify the modal opens correctly and displays all required elements

#### Test Cases:

- ✅ **Modal opens with proper header**
  - Modal dialog should be visible
  - Should display "Share" title
  - Should show description "Control who can access your timeline"

- ✅ **Shows nodes being shared**
  - Display node titles (e.g., "Senior Software Engineer", "AI Assistant Project")
  - Shows in collapsible "What to share" section
  - Section is expanded by default to show nodes

### 2. Current Permissions Display

**Purpose**: Show existing access permissions for the selected nodes

#### Test Cases:

- **Shows existing permissions**
  - Display "Current Access" header
  - List users with access (name, email, access level)
  - List organizations with access
  - Show public access status if enabled

- **Shows access level badges**
  - Display "Overview" badge for basic access
  - Display "Full Access" badge for complete access
  - Color-coded badges (blue for Overview, purple for Full Access)

### 3. Adding New Recipients

**Purpose**: Allow users to grant access to new recipients

#### Test Cases:

- **Search and select users**
  - Check "Share with specific users" checkbox
  - Search field appears when checked
  - Type username/email to search
  - Display search results
  - Click to select user
  - Selected user appears as a tag

- **Search and select organizations**
  - Check "Share with organizations" checkbox
  - Toggle between "Search organizations" and "My organizations"
  - Search organizations by name
  - Select from search results or from user's organizations
  - Selected organizations appear as tags

- **Enable public access**
  - Check "Make publicly accessible" checkbox
  - Warning message appears: "Anyone with the link can view"
  - Public access is mutually exclusive with user/org selection

### 4. Setting Access Levels

**Purpose**: Configure what level of access each recipient has

#### Test Cases:

- **Set access level per recipient**
  - Each recipient shows in "Access levels" section
  - Radio buttons for "Overview" and "Full Access"
  - Can change access level for each recipient individually
  - Icons indicate access level (Eye for Overview, EyeOff for Full)

### 5. Sharing Execution

**Purpose**: Execute the sharing action and provide feedback

#### Test Cases:

- **Execute share on button click**
  - Share button is disabled when no recipients selected
  - Click Share button to execute
  - Shows "Sharing..." loading state
  - Makes API calls to create permissions

- **Show success confirmation**
  - Toast notification appears: "Successfully shared!"
  - Shows recipient count: "Shared with X recipient(s)"
  - Modal remains open for further actions
  - Success message auto-dismisses after 3 seconds

### 6. Removing Permissions

**Purpose**: Allow users to revoke existing permissions

#### Test Cases:

- **Remove existing permissions**
  - Existing permissions show in "Current Access" section
  - Each permission has a remove button (X icon)
  - Click remove button to delete permission
  - Confirmation dialog appears
  - Permission is removed after confirmation
  - UI updates to reflect removal

### 7. Empty States

**Purpose**: Handle cases where no permissions exist

#### Test Cases:

- **Show appropriate message when no one has access**
  - Display "Private" badge when no sharing is configured
  - Current Access section shows empty state
  - Clear messaging about privacy status

## Mock Data Requirements

### Mock Nodes

```javascript
[
  {
    id: 'node-1',
    type: 'Job',
    title: 'Senior Software Engineer',
    meta: { company: 'TechCorp' },
  },
  {
    id: 'node-2',
    type: 'Project',
    title: 'AI Assistant Project',
    parentId: 'node-1',
  },
];
```

### Mock Permissions

```javascript
[
  {
    principalType: 'user',
    principalName: 'Jane Smith',
    principalEmail: 'jane@example.com',
    accessLevel: 'Overview',
  },
  {
    principalType: 'organization',
    principalName: 'TechCorp',
    accessLevel: 'Full',
  },
];
```

### Mock Search Results

- Users: john@example.com, jane@example.com, bob@example.com, alice@example.com
- Organizations: TechCorp, StartupInc, University of Tech, Research Labs

## API Endpoints Mocked

1. `GET /api/v2/timeline/nodes/:nodeId/permissions` - Fetch current permissions
2. `POST /api/v2/timeline/nodes/:nodeId/permissions` - Create new permission
3. `DELETE /api/v2/timeline/nodes/:nodeId/permissions/:policyId` - Remove permission
4. `PUT /api/v2/timeline/permissions/:policyId` - Update permission access level
5. `POST /api/v2/timeline/nodes/permissions/bulk` - Bulk create permissions
6. `GET /api/v2/users/search` - Search for users
7. `GET /api/v2/organizations/search` - Search for organizations
8. `GET /api/v2/organizations/user` - Get user's organizations

## Success Criteria

- All test cases pass consistently
- No console errors or warnings
- Component renders correctly with mock data
- User interactions trigger appropriate state changes
- API calls are made with correct parameters
- Success/error states are handled appropriately
- Toast notifications appear for user feedback

## Testing Tools

- **Framework**: Vitest
- **Testing Library**: @testing-library/react
- **User Events**: @testing-library/user-event
- **API Mocking**: MSW (Mock Service Worker)
- **State Management**: Zustand store testing

## File Locations

- Test File: `/client/src/components/share/ShareModal.test.tsx`
- Component: `/client/src/components/share/ShareModal.tsx`
- Mock Handlers: `/client/src/mocks/permission-handlers.ts`
- Store: `/client/src/stores/share-store.ts`
