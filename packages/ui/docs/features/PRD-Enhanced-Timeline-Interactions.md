# Product Requirements Document: Enhanced Timeline Interactions

## Executive Summary

Enhance the professional journey timeline with interactive plus buttons on edges for seamless node addition, supporting both chat-driven and manual workflows.

## Problem Statement

Current timeline lacks intuitive ways for users to add new career milestones. Users must rely solely on chat interface without visual cues for where to add content in their career progression.

## Solution Overview

Implement interactive plus buttons on timeline edges that provide contextual node addition capabilities with dual modes: AI-assisted chat and manual form entry.

## Target Users

- Professionals building career portfolios
- Users documenting career progression
- Job seekers organizing experience narratives

## Feature Requirements

### 1. Interactive Edge Plus Buttons

**Priority: P0 (Critical)**

**Description**: Plus buttons appear on timeline edges on hover, enabling contextual content addition.

**Acceptance Criteria:**

- Plus buttons appear on all timeline edges (main timeline and project branches)
- Buttons show on hover with smooth animation
- Clicking triggers appropriate action based on chat toggle state
- Visual styling consistent with existing purple theme
- Responsive design for different screen sizes

**Technical Requirements:**

- Modify `StraightTimelineEdge.tsx` and `LBranchEdge.tsx` components
- Add hover state management
- Implement click handlers with context collection
- SVG plus icon with hover animations

### 2. Chat Toggle System

**Priority: P0 (Critical)**

**Description**: Top-right toggle allowing users to switch between chat-assisted and manual node creation modes.

**Acceptance Criteria:**

- Toggle positioned in top-right corner of timeline view
- Clear visual indication of current mode (Chat/Manual)
- State persists across sessions
- Smooth transition animations

**Technical Requirements:**

- Create `ChatToggle.tsx` component
- Implement persistent state storage
- Integration with timeline interaction flow

### 3. Context-Aware Node Addition Modal

**Priority: P0 (Critical)**

**Description**: Modal for manual node creation with all available node types and dynamic forms.

**Acceptance Criteria:**

- Support for all node types: Work Experience, Education, Project, Skill
- Dynamic form fields based on selected type
- Pre-populated context data when available
- Form validation and error handling
- Integration with existing `/api/save-milestone` endpoint

**Node Type Specifications:**

- **Work Experience**: Title, Company, Start/End dates, Description, Location
- **Education**: Institution, Degree, Field, Start/End dates, Description
- **Project**: Name, Description, Technologies, Start/End dates, Parent Experience
- **Skill**: Skill name, Proficiency level, Context, Verification method

### 4. Enhanced Chat Integration

**Priority: P0 (Critical)**

**Description**: Context-aware chat interactions for AI-assisted node creation.

**Acceptance Criteria:**

- Pre-filled messages based on click context
- Automatic node creation from complete AI responses
- Support for clarification questions
- Integration with existing NaaviChat component

**Context Message Examples:**

- Between experiences: "Add a new work experience between Google and Microsoft"
- On experience branch: "Add a project to my Google experience"
- Timeline end: "Add a new milestone after my current timeline"

### 5. Node Color Coding System

**Priority: P1 (Important)**

**Description**: Visual distinction between completed and ongoing experiences.

**Acceptance Criteria:**

- Green styling for nodes with end dates (completed experiences)
- Blue styling for nodes without end dates (ongoing experiences)
- Consistent color application across all node types
- Accessibility compliance (sufficient color contrast)

### 6. Improved Tree Hierarchy Positioning

**Priority: P1 (Important)**

**Description**: Enhanced positioning algorithm for better visual organization of child nodes.

**Acceptance Criteria:**

- Children nodes properly aligned under parent experiences
- Consistent spacing between levels
- No overlapping nodes in complex hierarchies
- Smooth animations for expand/collapse operations

## User Flow Specifications

### Primary Flow: Chat Mode Enabled

1. User hovers over timeline edge → Plus button appears
2. User clicks plus button → System checks chat toggle state (ON)
3. NaaviChat opens with pre-filled contextual message
4. User converses with AI about new milestone
5. AI provides complete milestone information
6. System automatically creates and positions new node
7. Timeline updates with new node, proper color coding applied

### Secondary Flow: Manual Mode

1. User hovers over timeline edge → Plus button appears
2. User clicks plus button → System checks chat toggle state (OFF)
3. AddNodeModal opens with context information
4. User selects node type from available options
5. User fills dynamic form based on selected type
6. Form validation and submission to API
7. New node created and positioned on timeline

### Edge Cases:

- Incomplete AI responses → Prompt for more information
- API failures → Show error message with retry option
- Invalid form data → Show validation errors
- Network connectivity issues → Offline mode handling

## Technical Specifications

### API Integration

**Existing Endpoints:**

- `POST /api/save-milestone` - Node creation and profile updates
- `POST /api/ai/chat/message` - Chat interactions

**New Context Format:**

```json
{
  "action": "add_node",
  "context": {
    "insertionPoint": "between|after|branch",
    "parentNode": {
      "id": "experience-1",
      "title": "Google",
      "type": "workExperience"
    },
    "targetNode": {
      "id": "experience-2",
      "title": "Microsoft",
      "type": "workExperience"
    },
    "availableTypes": ["workExperience", "education", "project", "skill"]
  }
}
```

### Component Architecture

```
JourneyTimeline
├── ChatToggle (top-right)
├── ReactFlow
│   ├── Nodes (with color coding)
│   └── Edges (with plus buttons)
│       ├── StraightTimelineEdge
│       └── LBranchEdge
├── AddNodeModal
└── NaaviChat (enhanced with context)
```

### State Management

- Chat toggle state: `useChatToggleStore`
- Modal state: `useNodeAdditionStore`
- Existing stores: `useNodeFocusStore`, `useNodeSelectionStore`

## Success Metrics

### Engagement Metrics

- Plus button click rate (target: >40% of active users)
- Chat vs Manual mode usage distribution
- Node addition completion rate (target: >80%)

### Quality Metrics

- User satisfaction with node placement accuracy
- Time to add new milestone (target: <2 minutes)
- Error rate in node creation process (target: <5%)

### Technical Metrics

- Edge hover response time (target: <100ms)
- Modal loading time (target: <500ms)
- API response time for node creation (target: <2s)

## Risk Assessment

### High Risk

- **Chat Integration Complexity**: NaaviChat context handling may require significant refactoring
- **Performance Impact**: Additional hover states and animations may affect timeline performance

### Medium Risk

- **User Adoption**: Users may prefer existing chat-only workflow
- **API Load**: Increased node creation may impact server performance

### Mitigation Strategies

- Implement feature flag for gradual rollout
- Performance monitoring and optimization
- User testing with prototype before full implementation
- Fallback mechanisms for API failures

## Timeline & Milestones

### Phase 1: Core Infrastructure (Week 1)

- Chat toggle component
- Plus button edge modifications
- Basic modal structure

### Phase 2: Integration (Week 2)

- Chat context handling
- Node creation flows
- API integration testing

### Phase 3: Polish & Testing (Week 3)

- Color coding system
- Tree positioning improvements
- Comprehensive testing suite
- Performance optimization

### Phase 4: Launch (Week 4)

- User acceptance testing
- Documentation updates
- Production deployment
- Monitoring setup

## Dependencies

- Existing React Flow timeline implementation
- NaaviChat component functionality
- `/api/save-milestone` endpoint reliability
- User authentication system

## Future Enhancements

- Drag-and-drop node repositioning
- Bulk node operations
- Template-based node creation
- Social sharing of career timelines
- Integration with external career platforms
