# Client-Side Implementation Plan: Hierarchical Timeline UI

## 1. Executive Summary

### Project Overview
Implement a hierarchical timeline visualization system that transforms the current Lighthouse timeline into an interactive React Flow-based tree view, integrating seamlessly with the new v2 hierarchy API while preserving all existing UI behaviors (focus mode, chevron expansion, plus buttons).

### Key Deliverables
- React Flow + Dagre hierarchical timeline component
- Side panel for node CRUD operations with expansion controls
- Integration with existing focus mode and expansion systems
- Plus button system with blur logic preservation
- Migration from current timeline to hierarchy view

### Timeline Estimate: 10 Days (2 Weeks)
- **Phase 1**: Foundation & Dependencies (2 days)
- **Phase 2**: Core Visualization (2 days) 
- **Phase 3**: Side Panel & CRUD (2 days)
- **Phase 4**: Integration & Polish (2 days)
- **Phase 5**: Migration & Testing (2 days)

## 2. Technical Architecture Analysis

### 2.1 Dependencies Assessment
**New Dependencies Required**:
```json
{
  "reactflow": "^11.10.4",
  "@dagrejs/dagre": "^1.1.4"
}
```

**Existing Dependencies to Leverage**:
- React + TypeScript + Vite (current stack)
- Zustand for state management
- Existing design system components
- Current CSS/Tailwind styling approach

### 2.2 Component Architecture
```
client/src/components/timeline/
├── HierarchicalTimeline.tsx        # Main React Flow component
├── HierarchyNodePanel.tsx          # Side panel for CRUD operations
└── Timeline.tsx                    # Keep for backward compatibility

client/src/services/
├── hierarchy-api.ts                # New API service for v2 endpoints
└── node-api.ts                     # Existing API (keep)

client/src/stores/
├── hierarchy-store.ts              # New hierarchy state management
├── node-focus-store.ts             # Existing focus store (integrate)
└── existing stores...              # Keep all existing stores

client/src/hooks/
├── useExpandableNode.ts            # Existing expansion hook (integrate)
└── useHierarchyLayout.ts           # New hook for Dagre layout
```

### 2.3 Existing Component Integration
**Components to Reuse (Zero Changes)**:
- `client/src/components/nodes/` - All 6 node type components
- `client/src/components/ui/expand-chevron.tsx` - Existing chevron component
- `client/src/components/modals/` - All existing modals
- `client/src/components/nodes/PlusNode.tsx` - Existing plus node component

**Stores to Integrate**:
- `useNodeFocusStore` - For consistent focus mode behavior
- `useExpandableNode` - For chevron expansion logic

## 3. Implementation Plan by Phases

### Phase 1: Foundation & Dependencies (Days 1-2)

#### Day 1: Setup & API Integration
**Milestone 1.1: Environment Setup**
- [ ] Install React Flow and Dagre dependencies
- [ ] Create project structure for hierarchy components
- [ ] Set up TypeScript interfaces for hierarchy data

**Milestone 1.2: API Service Layer**
- [ ] Create `hierarchy-api.ts` service for v2 endpoints
- [ ] Implement API methods: createNode, getNode, updateNode, deleteNode, listNodes
- [ ] Add error handling and response type definitions
- [ ] Test API integration with existing auth system

#### Day 2: Data Layer & Store
**Milestone 1.3: State Management**
- [ ] Create `hierarchy-store.ts` with Zustand
- [ ] Implement core state (nodes, selectedNode, loading, error)
- [ ] Add expansion state management (expandedNodeIds)
- [ ] Implement CRUD actions (create, update, delete, load)
- [ ] Add layout state (direction TB/LR, rootNode selection)

**Milestone 1.4: Data Flow Integration**  
- [ ] Connect hierarchy store to existing `useNodeFocusStore`
- [ ] Test data loading and state synchronization
- [ ] Validate user isolation and authentication integration

### Phase 2: Core Visualization (Days 3-4)

#### Day 3: React Flow Setup
**Milestone 2.1: Basic Graph Rendering**
- [ ] Create `HierarchicalTimeline.tsx` component shell
- [ ] Set up React Flow with basic node/edge rendering
- [ ] Integrate existing node components as React Flow node types
- [ ] Add background grid and zoom/pan controls

**Milestone 2.2: Dagre Layout Integration**
- [ ] Create `useHierarchyLayout.ts` hook with Dagre integration
- [ ] Implement automatic layout calculation (TB/LR directions)
- [ ] Add parent-child edge rendering with proper styling
- [ ] Test layout with various hierarchy shapes

#### Day 4: Focus Mode Integration
**Milestone 2.3: Focus System Integration**
- [ ] Connect React Flow node clicks to `useNodeFocusStore`
- [ ] Implement focus mode styling (blur/focus states)
- [ ] Add auto-expansion of focused node children
- [ ] Test focus mode transitions and visual feedback

**Milestone 2.4: Selection & Interaction**
- [ ] Add node selection highlighting independent of focus
- [ ] Connect selected node to side panel visibility
- [ ] Implement background click to clear focus/selection
- [ ] Test interaction patterns and state management

### Phase 3: Side Panel & CRUD Operations (Days 5-6)

#### Day 5: Side Panel Structure
**Milestone 3.1: Panel Component Foundation**
- [ ] Create `HierarchyNodePanel.tsx` with mode switching
- [ ] Implement View Mode (display node details)
- [ ] Add mode switching UI (View/Edit/Create/Move/Delete buttons)
- [ ] Connect panel to selected node state

**Milestone 3.2: Expansion Controls**
- [ ] Add expansion controls to View Mode
- [ ] Implement "Expand Children (N)" / "Collapse Children" buttons
- [ ] Connect expansion controls to hierarchy store expansion state
- [ ] Sync expansion controls with chevron buttons on nodes

#### Day 6: CRUD Operations
**Milestone 3.3: Edit Operations**
- [ ] Implement Edit Mode with label/meta form
- [ ] Add form validation using existing patterns
- [ ] Connect edit operations to hierarchy API
- [ ] Add loading states and success feedback

**Milestone 3.4: Create & Delete Operations**
- [ ] Implement Create Child Mode with type selection
- [ ] Add Move Mode for changing parent relationships
- [ ] Implement Delete functionality with confirmation
- [ ] Add error handling and user feedback for all operations

### Phase 4: Integration & Polish (Days 7-8)

#### Day 7: Chevron & Plus Button Integration
**Milestone 4.1: Chevron System**
- [ ] Integrate existing `ExpandChevron` component with nodes
- [ ] Connect chevron clicks to hierarchy store expansion methods
- [ ] Sync chevron state with side panel expansion controls
- [ ] Test chevron animations and visual feedback

**Milestone 4.2: Plus Button System**
- [ ] Integrate existing `PlusNode.tsx` with hierarchy layout
- [ ] Position plus buttons (timeline start/end/leaf/between)
- [ ] Implement existing blur logic with focused node context
- [ ] Connect plus button clicks to node creation workflow

#### Day 8: Advanced Features & Polish
**Milestone 4.3: Top Bar Controls**
- [ ] Add layout direction toggle (TB/LR)
- [ ] Implement root node selector dropdown
- [ ] Add "Clear Focus" button when node is focused
- [ ] Add "Expand All" / "Collapse All" buttons

**Milestone 4.4: UI Polish & Performance**
- [ ] Optimize rendering performance for large hierarchies
- [ ] Add loading states for async operations
- [ ] Implement proper error boundaries and error states
- [ ] Add responsive design adjustments

### Phase 5: Migration & Testing (Days 9-10)

#### Day 9: Migration Strategy
**Milestone 5.1: Feature Flag Implementation**
- [ ] Add feature flag to switch between old/new timeline
- [ ] Update navigation to conditionally use hierarchy view
- [ ] Test backward compatibility with existing timeline
- [ ] Implement migration path for existing user data

**Milestone 5.2: Integration Testing**
- [ ] Test complete workflows (create → edit → delete)
- [ ] Validate focus mode behavior across all node types
- [ ] Test expansion system with nested hierarchies
- [ ] Verify plus button behavior and blur logic

#### Day 10: Final Testing & Documentation
**Milestone 5.3: End-to-End Testing**
- [ ] Test with real user data and various hierarchy shapes
- [ ] Performance testing with 100+ nodes
- [ ] Cross-browser compatibility testing
- [ ] Mobile responsiveness testing

**Milestone 5.4: Handover & Documentation**
- [ ] Update component documentation
- [ ] Create usage examples and integration guides
- [ ] Document migration steps and feature flags
- [ ] Final code review and cleanup

## 4. Detailed Task Breakdown

### 4.1 Foundation Tasks (Phase 1)

#### API Integration Tasks
- [ ] **API-001**: Install React Flow (`npm install reactflow@^11.10.4`)
- [ ] **API-002**: Install Dagre (`npm install @dagrejs/dagre@^1.1.4`)
- [ ] **API-003**: Create `client/src/services/hierarchy-api.ts`
- [ ] **API-004**: Implement `HierarchyApiService` class with methods:
  - `createNode(payload: CreateNodePayload): Promise<HierarchyNode>`
  - `getNode(id: string): Promise<HierarchyNode>`
  - `updateNode(id: string, patch: UpdateNodePayload): Promise<HierarchyNode>`
  - `deleteNode(id: string): Promise<void>`
  - `getTree(): Promise<HierarchyNode[]>`
- [ ] **API-005**: Add TypeScript interfaces for API request/response types
- [ ] **API-006**: Implement error handling and HTTP status code mapping
- [ ] **API-007**: Test API integration with v2 endpoints

#### Store Implementation Tasks  
- [ ] **STORE-001**: Create `client/src/stores/hierarchy-store.ts`
- [ ] **STORE-002**: Implement base state interface with Zustand
- [ ] **STORE-003**: Add node data management (nodes, selectedNode, rootNode)
- [ ] **STORE-004**: Add UI state (layoutDirection, loading, error)
- [ ] **STORE-005**: Add expansion state (expandedNodeIds: Set<string>)
- [ ] **STORE-006**: Implement CRUD actions (loadTree, createNode, updateNode, deleteNode)
- [ ] **STORE-007**: Implement expansion actions (expandNode, collapseNode, toggleExpansion)
- [ ] **STORE-008**: Add layout actions (toggleDirection, setRootNode)
- [ ] **STORE-009**: Connect to existing `useNodeFocusStore` for focus integration

### 4.2 Visualization Tasks (Phase 2)

#### React Flow Setup Tasks
- [ ] **FLOW-001**: Create `client/src/components/timeline/HierarchicalTimeline.tsx`
- [ ] **FLOW-002**: Set up React Flow provider and basic configuration
- [ ] **FLOW-003**: Create node type mappings for existing node components
- [ ] **FLOW-004**: Set up background grid and viewport controls
- [ ] **FLOW-005**: Add zoom and pan functionality
- [ ] **FLOW-006**: Implement basic edge rendering for parent-child relationships

#### Layout Integration Tasks
- [ ] **LAYOUT-001**: Create `client/src/hooks/useHierarchyLayout.ts`
- [ ] **LAYOUT-002**: Integrate Dagre for automatic tree layout
- [ ] **LAYOUT-003**: Implement TB (top-to-bottom) layout algorithm
- [ ] **LAYOUT-004**: Implement LR (left-to-right) layout algorithm  
- [ ] **LAYOUT-005**: Add automatic spacing based on node count and depth
- [ ] **LAYOUT-006**: Handle edge cases (single nodes, deep hierarchies, wide trees)
- [ ] **LAYOUT-007**: Optimize layout performance for large datasets

#### Focus Integration Tasks
- [ ] **FOCUS-001**: Connect React Flow node clicks to focus store
- [ ] **FOCUS-002**: Implement blur styling (30% opacity) for unfocused nodes
- [ ] **FOCUS-003**: Implement focus styling (full opacity + highlighting)
- [ ] **FOCUS-004**: Add auto-expansion of focused node children
- [ ] **FOCUS-005**: Add smooth transitions between focus states (200ms ease)
- [ ] **FOCUS-006**: Implement background click to clear focus
- [ ] **FOCUS-007**: Add focus indicator in top bar/breadcrumb

### 4.3 Side Panel Tasks (Phase 3)

#### Panel Structure Tasks
- [ ] **PANEL-001**: Create `client/src/components/timeline/HierarchyNodePanel.tsx`
- [ ] **PANEL-002**: Implement fixed width panel (320px) with scrollable content
- [ ] **PANEL-003**: Add mode switching buttons (View/Edit/Create/Move/Delete)
- [ ] **PANEL-004**: Implement View Mode with node details display
- [ ] **PANEL-005**: Connect panel visibility to selected node state
- [ ] **PANEL-006**: Add loading states for async panel operations

#### Expansion Controls Tasks
- [ ] **EXPAND-001**: Add expansion section to View Mode
- [ ] **EXPAND-002**: Implement "Expand Children (N)" button with child count
- [ ] **EXPAND-003**: Implement "Collapse Children" button
- [ ] **EXPAND-004**: Add visual indicators for expandable nodes  
- [ ] **EXPAND-005**: Connect expansion controls to hierarchy store
- [ ] **EXPAND-006**: Sync expansion state with chevron buttons

#### CRUD Operation Tasks
- [ ] **CRUD-001**: Implement Edit Mode with form for label/meta
- [ ] **CRUD-002**: Add form validation using existing patterns
- [ ] **CRUD-003**: Implement Create Child Mode with type selection dropdown
- [ ] **CRUD-004**: Add Move Mode with parent ID input field
- [ ] **CRUD-005**: Implement Delete functionality with confirmation dialog
- [ ] **CRUD-006**: Add success/error feedback for all operations
- [ ] **CRUD-007**: Handle optimistic updates and rollback on failure

### 4.4 Integration Tasks (Phase 4)

#### Chevron Integration Tasks  
- [ ] **CHEVRON-001**: Import existing `ExpandChevron` component
- [ ] **CHEVRON-002**: Add chevron buttons to nodes with children
- [ ] **CHEVRON-003**: Position chevrons in bottom-right corner of nodes
- [ ] **CHEVRON-004**: Connect chevron clicks to expansion store methods
- [ ] **CHEVRON-005**: Implement 180° rotation animation on expand/collapse
- [ ] **CHEVRON-006**: Add chevron state synchronization with panel controls
- [ ] **CHEVRON-007**: Test chevron behavior with various node types

#### Plus Button Integration Tasks
- [ ] **PLUS-001**: Import existing `PlusNode.tsx` component
- [ ] **PLUS-002**: Position timeline plus buttons (start/end of timelines)
- [ ] **PLUS-003**: Position leaf plus buttons (below nodes without children)
- [ ] **PLUS-004**: Position between-node plus buttons on timeline edges
- [ ] **PLUS-005**: Implement existing blur logic with `globalFocusedNodeId`
- [ ] **PLUS-006**: Connect plus button clicks to node creation modal
- [ ] **PLUS-007**: Preserve existing animations and hover effects
- [ ] **PLUS-008**: Test plus button visibility logic with focus mode

#### Top Bar Controls Tasks
- [ ] **CONTROLS-001**: Add layout direction toggle buttons (TB/LR)
- [ ] **CONTROLS-002**: Implement root node selector dropdown
- [ ] **CONTROLS-003**: Add "Clear Focus" button with conditional visibility
- [ ] **CONTROLS-004**: Add "Expand All" / "Collapse All" buttons
- [ ] **CONTROLS-005**: Add focused node indicator in breadcrumb
- [ ] **CONTROLS-006**: Style top controls consistent with existing design

### 4.5 Migration Tasks (Phase 5)

#### Feature Flag Tasks
- [ ] **MIGRATION-001**: Add feature flag configuration for hierarchy vs timeline
- [ ] **MIGRATION-002**: Update navigation routing to conditionally use hierarchy
- [ ] **MIGRATION-003**: Create migration utility for existing timeline data
- [ ] **MIGRATION-004**: Add user preference for timeline view selection
- [ ] **MIGRATION-005**: Test backward compatibility with existing features

#### Testing Tasks
- [ ] **TEST-001**: Create comprehensive test scenarios for each node type
- [ ] **TEST-002**: Test focus mode behavior across all interaction patterns
- [ ] **TEST-003**: Test expansion system with deeply nested hierarchies
- [ ] **TEST-004**: Test plus button system with various hierarchy shapes
- [ ] **TEST-005**: Performance test with 100+ nodes
- [ ] **TEST-006**: Test CRUD operations with error conditions
- [ ] **TEST-007**: Test responsive design on various screen sizes
- [ ] **TEST-008**: Cross-browser compatibility testing
- [ ] **TEST-009**: Integration test with existing Lighthouse features
- [ ] **TEST-010**: User acceptance testing with real workflow scenarios

## 5. Risk Assessment & Mitigation

### 5.1 Technical Risks

**Risk 1: React Flow Performance with Large Hierarchies**
- *Impact*: High - Could make UI unusable with complex hierarchies
- *Likelihood*: Medium - React Flow handles most cases well
- *Mitigation*: Implement virtualization, lazy loading, or depth limits

**Risk 2: Complex Focus + Expansion Interactions**
- *Impact*: Medium - Could confuse users or break existing behavior
- *Likelihood*: High - Complex state interactions
- *Mitigation*: Extensive testing, clear separation of concerns, fallback modes

**Risk 3: Plus Button Positioning in Tree Layout**
- *Impact*: Medium - Plus buttons might not position correctly
- *Likelihood*: Medium - Tree layouts differ from linear timelines
- *Mitigation*: Custom positioning logic, visual testing, iterative refinement

### 5.2 Integration Risks

**Risk 4: Breaking Existing Focus Mode Behavior**
- *Impact*: High - Core user experience could be disrupted
- *Likelihood*: Medium - Tight integration with existing stores
- *Mitigation*: Feature flags, comprehensive testing, rollback plan

**Risk 5: API Integration Issues**
- *Impact*: Medium - CRUD operations might fail
- *Likelihood*: Low - API is well-tested and documented
- *Mitigation*: Error handling, retry logic, offline capability

### 5.3 Timeline Risks

**Risk 6: Scope Creep**
- *Impact*: High - Could delay delivery significantly
- *Likelihood*: Medium - Complex feature with many integration points
- *Mitigation*: Strict milestone tracking, MVP focus, phased delivery

## 6. Success Criteria & Acceptance Tests

### 6.1 Functional Acceptance Criteria
- [ ] **F1**: All 6 node types render correctly in hierarchy tree view
- [ ] **F2**: Multi-level hierarchies display with clear visual relationships
- [ ] **F3**: Focus mode works seamlessly - clicking nodes focuses and shows children
- [ ] **F4**: Chevron expansion works independently of focus mode
- [ ] **F5**: Plus buttons maintain existing behavior with proper blur logic
- [ ] **F6**: Side panel CRUD operations work for all node types
- [ ] **F7**: Expansion controls work correctly in side panel
- [ ] **F8**: Move operations work without breaking tree structure
- [ ] **F9**: Layout algorithms produce readable, organized trees
- [ ] **F10**: Feature flag allows switching between old/new timeline

### 6.2 Technical Acceptance Criteria
- [ ] **T1**: Performance meets requirements (< 1s load time for typical datasets)
- [ ] **T2**: No memory leaks with large datasets (tested with 500+ nodes)
- [ ] **T3**: Proper error handling for all API operations
- [ ] **T4**: Clean separation between hierarchy and existing timeline code
- [ ] **T5**: All existing timeline functionality remains intact
- [ ] **T6**: Responsive design works on all supported screen sizes

### 6.3 User Experience Acceptance Criteria
- [ ] **UX1**: Intuitive navigation between graph and panel
- [ ] **UX2**: Smooth focus mode transitions and blur effects
- [ ] **UX3**: Chevron animations and expansion visual feedback
- [ ] **UX4**: Plus button animations and hover effects preserved
- [ ] **UX5**: Clear visual hierarchy with proper spacing
- [ ] **UX6**: Loading states and error feedback provide clear user guidance

## 7. Deployment Strategy

### 7.1 Phased Rollout Plan
1. **Internal Testing** (Day 9): Feature flag disabled, internal team testing
2. **Beta Release** (Day 10): Feature flag enabled for select users
3. **Gradual Rollout** (Week 3): Percentage-based rollout (10%, 25%, 50%, 100%)
4. **Full Migration** (Week 4): Default to hierarchy view, remove old timeline

### 7.2 Rollback Plan
- Feature flag allows instant rollback to existing timeline
- Database schema is non-destructive (existing data preserved)
- API v1 remains available for emergency fallback
- Monitoring alerts for performance degradation or error rates

---

**Document Version**: 1.0  
**Created**: January 2025  
**Implementation Target**: 10 days (2 weeks)  
**Next Review**: End of Phase 2 (Day 4)

**Key Dependencies**:
- Server-side v2 API (✅ Complete)  
- Existing focus mode store (✅ Available)
- Existing node components (✅ Available)
- Existing plus button system (✅ Available)
- React Flow + Dagre libraries (⏳ To install)