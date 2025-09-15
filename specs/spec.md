# Feature Specification: Timeline Journey Profile View

**Feature Branch**: `001-lets-revamp-journey`  
**Created**: 2025-01-12  
**Status**: Ready for Planning  
**Input**: User description: "Revamp journey into UI to see all info in list view in separate page like profile page"

## Execution Flow (main)

```
1. Parse user description from Input
   → Extract: Create profile page with list-based journey view
2. Extract key concepts from description
   → Actors: Users viewing their career journey
   → Actions: Browse timeline nodes in organized list format
   → Data: Existing timeline nodes (jobs, education, projects, etc.)
   → Constraints: Simplify visualization for better usability
3. For each unclear aspect:
   → All clarifications resolved based on user feedback
4. Fill User Scenarios & Testing section
   → Primary: User views career journey in organized profile format
5. Generate Functional Requirements
   → Separate current and past experiences
   → Display hierarchical relationships as tree structure
   → Include profile header with share functionality
6. Identify Key Entities
   → Timeline nodes, hierarchical relationships, user profile
7. Run Review Checklist
   → All requirements clarified and documented
8. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines

- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

---

## User Scenarios & Testing _(mandatory)_

### Primary User Story

A user wants to view their career journey information in a clean, organized profile page format. They need to see their career nodes (jobs, education, projects, events, actions, career transitions) separated into current and past experiences, with hierarchical relationships displayed in a tree-like structure that's easy to browse and understand.

### Acceptance Scenarios

1. **Given** a user has timeline nodes with ongoing activities, **When** they view the profile page, **Then** they see current experiences (nodes without end dates) displayed in a separate section from past experiences
2. **Given** a user views the profile, **When** they look at the header, **Then** they see their profile name along with share and copy URL buttons
3. **Given** a user has hierarchical timeline nodes, **When** they browse the list, **Then** they see parent-child relationships displayed in a tree-like structure with proper indentation
4. **Given** a user clicks on a timeline node in the list, **When** the node is selected, **Then** a side panel opens showing detailed information about that node
5. **Given** a user clicks the share button, **When** on their profile page, **Then** they can share their profile with others
6. **Given** a user clicks the copy button, **When** on their profile page, **Then** the profile URL is copied to their clipboard

### Edge Cases

- What happens when a user has no current experiences (all nodes have end dates)?
- How does the system handle deeply nested hierarchical relationships in the tree view?
- What happens when a user has very large numbers of timeline nodes?
- How does the side panel behave on smaller screen sizes?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST display timeline nodes separated into "Current Experiences" (nodes without end dates) and "Past Experiences" sections
- **FR-002**: System MUST show a profile header containing the user's profile name
- **FR-003**: Profile header MUST include a share button for sharing the profile
- **FR-004**: Profile header MUST include a copy button to copy the profile URL to clipboard
- **FR-005**: System MUST display all timeline node types (jobs, education, projects, events, actions, career transitions) in the appropriate section based on their end dates
- **FR-006**: System MUST display hierarchical parent-child relationships in a tree-like structure with visual indentation
- **FR-007**: System MUST maintain all existing node permissions and access controls in the profile view
- **FR-008**: Users MUST be able to click on any node to view its detailed information
- **FR-009**: System MUST display a side panel with node details when a node is selected
- **FR-010**: System MUST close the side panel when user deselects the node or selects a different node
- **FR-011**: System MUST NOT provide sorting or filtering options within the profile view
- **FR-012**: System MUST display all node metadata that was previously available in the timeline view

### Key Entities _(include if feature involves data)_

- **Timeline Node**: Career journey element with type, metadata, dates, hierarchical relationships, and permissions
- **Current Experience**: Timeline node without an end date, representing ongoing activities
- **Past Experience**: Timeline node with an end date, representing completed activities
- **Node Hierarchy**: Parent-child relationships displayed as a tree structure with indentation
- **Profile Header**: Section containing profile name and action buttons (share, copy URL)
- **Node Details Panel**: Side panel displaying comprehensive information about a selected node

---

## Review & Acceptance Checklist

_GATE: Automated checks run during main() execution_

### Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

---

## Execution Status

_Updated by main() during processing_

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities resolved
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [x] Review checklist passed

---
