# PRD: Hierarchical Timeline UI Implementation (Simplified Meta-Driven Architecture)

## 1. Overview

### Purpose
Replace the current client-side timeline with a simplified hierarchical tree visualization that uses React Flow + Dagre, where all node rendering is driven by the `meta` field, eliminating type-specific components and creating a truly node-agnostic system.

### Goals
- **Complete replacement** of existing timeline with hierarchical tree visualization
- **Meta-driven node rendering** - single unified component that adapts based on `meta` field
- **Simplified architecture** - eliminate type-specific components and complexity
- **React Flow + Dagre** for automatic layout and visualization
- **Side-panel CRUD operations** - no inline editing on graph
- **Focus mode integration** - clicking nodes focuses them with blur effects
- **Expansion system** - chevron-based expand/collapse for hierarchy navigation
- **Performance optimized** for large hierarchies (100+ nodes)

### Success Metrics
- Users can visualize unlimited hierarchy levels in an intuitive tree layout
- Single unified node component handles all 6 node types through meta field
- All CRUD operations work seamlessly through the side panel
- Focus mode works seamlessly - clicking nodes focuses them and shows their children
- Expansion system works independently - users can expand/collapse individual node children
- Performance remains smooth with 100+ nodes in the hierarchy
- Timeline loads in < 1 second for typical user data
- **Complete replacement** - no backward compatibility or fallback needed

## 2. System Architecture

### Technology Stack (Updated)
- **Frontend**: React + TypeScript + Vite (existing)
- **Graph Visualization**: React Flow + Dagre layout engine (new)
- **API Integration**: Fetch API with v2 endpoints (new)
- **State Management**: Zustand stores (existing)
- **UI Components**: Existing design system components
- **Styling**: Existing CSS/Tailwind setup

### New Dependencies to Add
```json
{
  "reactflow": "^11.10.4",
  "@dagrejs/dagre": "^1.1.4"
}
```

### Simplified Architecture (Meta-Driven)
```
client/src/
├── components/
│   ├── timeline/
│   │   ├── HierarchicalTimeline.tsx        # Main React Flow component
│   │   ├── HierarchyNodePanel.tsx          # Side panel for CRUD
│   │   ├── UnifiedNode.tsx                 # Single node component (meta-driven)
│   │   └── NodeTypeRenderer.tsx            # Meta-field renderer logic
│   ├── ui/
│   │   └── expand-chevron.tsx              # Chevron component (keep existing)
├── services/
│   └── hierarchy-api.ts                    # API service for v2 endpoints
├── stores/
│   ├── hierarchy-store.ts                  # Unified hierarchy state
│   └── timeline-store.ts                   # Replace all existing timeline stores
└── hooks/
    ├── useHierarchyLayout.ts               # Dagre layout integration
    └── useNodeInteractions.ts              # Focus + expansion logic
```

### Eliminated Components
- ~~All type-specific node components~~ (ActionNode, JobNode, etc.)
- ~~Timeline.tsx~~ (complete replacement)
- ~~PlusNode.tsx~~ (integrated into unified system)
- ~~Multiple timeline stores~~ (single hierarchy store)
- ~~node-api.ts~~ (replaced by hierarchy-api.ts)

## 3. Data Model Changes

### Simplified Data Model (Meta-Driven)
```typescript
// Unified node structure - meta field drives all rendering
interface HierarchyNode {
  id: string;
  type: 'job' | 'education' | 'project' | 'event' | 'action' | 'careerTransition';
  label: string;
  parentId?: string | null;
  meta: NodeMetadata;  // All node-specific data lives here
  userId: number;
  createdAt: string;
  updatedAt: string;
  // UI-computed fields
  children?: HierarchyNode[];
  level?: number;
}

// Meta field contains ALL node-specific data
interface NodeMetadata {
  // Common fields for all node types
  description?: string;
  startDate?: string;
  endDate?: string;
  status?: 'active' | 'completed' | 'planned';
  
  // Type-specific fields (conditional based on node type)
  company?: string;        // for job nodes
  position?: string;       // for job nodes
  school?: string;         // for education nodes
  degree?: string;         // for education nodes
  technologies?: string[]; // for project nodes
  outcome?: string;        // for action nodes
  location?: string;       // for event nodes
  
  // Visual customization
  color?: string;          // node color override
  icon?: string;           // node icon override
  tags?: string[];         // categorization tags
}

// Simplified tree structure
interface HierarchyTree {
  nodes: HierarchyNode[];
  edges: { source: string; target: string }[];
}
```

### Simplified API Integration
```typescript
// Simplified API service - only essential operations
class HierarchyApiService {
  private baseUrl = '/api/v2/timeline';
  
  // Core CRUD operations (maps to simplified server API)
  async createNode(payload: CreateNodePayload): Promise<HierarchyNode>
  async updateNode(id: string, patch: UpdateNodePayload): Promise<HierarchyNode>
  async deleteNode(id: string): Promise<void>
  async listNodes(): Promise<HierarchyNode[]>  // Gets all user nodes
  
  // Client-side hierarchy building
  buildHierarchyTree(nodes: HierarchyNode[]): HierarchyTree
  findRoots(nodes: HierarchyNode[]): HierarchyNode[]
  findChildren(nodeId: string, nodes: HierarchyNode[]): HierarchyNode[]
}

// Payload interfaces
interface CreateNodePayload {
  type: NodeType;
  label: string;
  parentId?: string | null;
  meta: NodeMetadata;
}

interface UpdateNodePayload {
  label?: string;
  meta?: Partial<NodeMetadata>;
}
```

## 4. Simplified Component Architecture

### 4.1 HierarchicalTimeline (Main Component)

**File**: `client/src/components/timeline/HierarchicalTimeline.tsx`

```typescript
interface HierarchicalTimelineProps {
  className?: string;
  style?: React.CSSProperties;
}
```

**Features**:
- React Flow + Dagre automatic layout
- Single UnifiedNode component for all node types
- Focus mode - click to focus, blur others
- Chevron expansion system
- Side panel integration
- Add node functionality (plus buttons)
- Performance optimized rendering

### 4.2 UnifiedNode (Meta-Driven Node Component)

**File**: `client/src/components/timeline/UnifiedNode.tsx`

```typescript
interface UnifiedNodeProps {
  node: HierarchyNode;
  isSelected: boolean;
  isFocused: boolean;
  isExpanded: boolean;
  hasChildren: boolean;
  onSelect: () => void;
  onFocus: () => void;
  onExpand: () => void;
}
```

**Features**:
- Single component handles all 6 node types
- Meta field drives all rendering logic
- Type-specific styling and content
- Chevron for nodes with children
- Focus/blur visual states
- Click handlers for selection/focus

### 4.3 NodeTypeRenderer (Meta-Field Logic)

**File**: `client/src/components/timeline/NodeTypeRenderer.tsx`

```typescript
interface NodeTypeRendererProps {
  node: HierarchyNode;
  isCompact?: boolean;
}
```

**Features**:
- Renders node content based on type and meta
- Handles type-specific field display
- Responsive layout (compact vs full)
- Icon and color customization from meta
- Common field handling (dates, status, tags)

**Focus Mode Behavior**:
- Integrates with existing `useNodeFocusStore` for consistent focus state
- Clicking a node focuses it (sets `focusedExperienceId`)
- Focused node shows full opacity, all other nodes blur to 30% opacity
- If focused node has children, automatically expand them in tree view
- Plus buttons hide when unrelated to focused node context
- Clicking background clears focus and restores full visibility

**Expansion System**:
- Each node with children displays chevron button (bottom-right corner)
- Uses existing `ExpandChevron` component with rotation animations
- Independent from focus mode - can expand multiple nodes simultaneously
- Expansion state stored in hierarchy store with `expandedNodeIds: Set<string>`
- Side panel shows expansion controls for selected node

**Layout Algorithm**:
- Use Dagre for deterministic hierarchical layout
- Treat parent-child relationships as edges for layout calculation
- Support both top-to-bottom and left-to-right orientations
- Automatic spacing based on node count and depth

### 4.2 HierarchyNodePanel Component

**File**: `client/src/components/timeline/HierarchyNodePanel.tsx`

**Modes**:
1. **View Mode**: Display node details (ID, type, label, parentId, meta, timestamps)
2. **Edit Mode**: Form to edit label and meta (no inline editing)
3. **Create Child Mode**: Form to create child node with type selection
4. **Move Mode**: Input field to change parent (supports null for root)

**Actions**:
- View/Edit/Create Child/Move/Delete buttons
- **Expansion controls** - Expand/Collapse Children button for nodes with children
- All mutations go through hierarchy API
- Form validation using existing patterns
- Loading states for async operations

**Expansion Controls**:
- "Expand Children" / "Collapse Children" toggle button
- Shows number of children when collapsed: "Expand Children (3)"
- Visual indicator when node has expandable content
- Integrates with chevron expansion state in hierarchy store

### 4.3 Node Type Components (Reuse Existing)

**Reuse**: All existing node components from `client/src/components/nodes/`
- ActionNode.tsx
- CareerTransitionNode.tsx  
- EducationNode.tsx
- EventNode.tsx
- JobNode.tsx
- ProjectNode.tsx
- BaseNode.tsx

**Changes Required**: Minimal integration updates
- Pass `hasExpandableContent: node.children?.length > 0` for chevron visibility
- Pass `isExpanded: expandedNodeIds.has(node.id)` for chevron state
- Pass `onExpandToggle: () => toggleNodeExpansion(node.id)` for chevron clicks
- Pass `isFocused/isBlurred` props for focus mode styling
- All existing chevron animations and styling preserved

### 4.4 Modal Components (Reuse Existing)

**Reuse**: All existing modals from `client/src/components/modals/`
- Keep existing modal functionality
- Integrate with new hierarchy API where needed
- No breaking changes to modal interfaces

### 4.5 Plus Button Integration (Reuse Existing)

**Component**: Existing `PlusNode.tsx` component with full functionality preserved

**Plus Button Types**:
- **Timeline Start**: Plus button before first node in root timeline
- **Timeline End**: Plus button after last node in any timeline level
- **Leaf Node**: Plus button below nodes without children (for adding child nodes)
- **Timeline Between**: Plus button between nodes on timeline edges

**Blur Logic Integration**:
- Maintains existing `globalFocusedNodeId` prop system
- Plus buttons hide when unrelated to focused node context
- Timeline plus buttons show when related parent/target node is focused
- Leaf plus buttons show when their parent node is focused

**Positioning & Styling**:
- All existing animations, hover effects, and connecting lines preserved
- Different color themes for timeline (indigo) vs leaf (purple) plus buttons
- Maintains existing accessibility features and ARIA labels

## 5. State Management

### 5.1 New Hierarchy Store

**File**: `client/src/stores/hierarchy-store.ts`

```typescript
interface HierarchyState {
  // Data
  nodes: HierarchyNode[];
  selectedNodeId: string | null;
  rootNodeId: string | null;
  
  // UI state
  layoutDirection: 'TB' | 'LR';
  loading: boolean;
  error: string | null;
  
  // Expansion state
  expandedNodeIds: Set<string>;
  
  // Actions
  loadTree: () => Promise<void>;
  selectNode: (nodeId: string | null) => void;
  setRootNode: (nodeId: string | null) => void;
  toggleLayoutDirection: () => void;
  
  // Expansion actions
  expandNode: (nodeId: string) => void;
  collapseNode: (nodeId: string) => void;
  toggleNodeExpansion: (nodeId: string) => void;
  isNodeExpanded: (nodeId: string) => boolean;
  expandAllNodes: () => void;
  collapseAllNodes: () => void;
  
  // CRUD operations
  createNode: (payload: CreateNodePayload) => Promise<void>;
  updateNode: (nodeId: string, patch: UpdateNodePayload) => Promise<void>;
  deleteNode: (nodeId: string) => Promise<void>;
  moveNode: (nodeId: string, parentId: string | null) => Promise<void>;
}
```

### 5.2 Integration with Existing Stores

**Keep Existing**: 
- auth-store.ts
- ui-store.ts  
- **node-focus-store.ts** - Integrate for focus mode functionality
- All other existing stores

**Focus Mode Integration**:
- Use existing `useNodeFocusStore` with `focusedExperienceId` state
- HierarchicalTimeline subscribes to focus changes for blur logic
- Node clicks call `setFocusedExperience(nodeId)` for focus mode
- Plus buttons receive `globalFocusedNodeId` for blur behavior

**Expansion State Management**:
- Hierarchy store manages `expandedNodeIds: Set<string>` for chevron state
- Independent from focus mode - users can expand/collapse without affecting focus
- Expansion state persists during focus mode changes
- Side panel shows expansion controls for currently selected node

**Hook Integration**:
- Reuse patterns from existing `useExpandableNode` hook
- Integrate chevron click handlers with hierarchy store expansion methods
- Maintain existing animation and UI behavior from current implementation

## 6. API Integration

### 6.1 New Hierarchy API Service

**File**: `client/src/services/hierarchy-api.ts`

**Base URL**: `/api/v2/timeline` (from hierarchy PRD)

**Key Methods**:
```typescript
// Fetch wrapper with error handling
async function http<T>(path: string, init?: RequestInit): Promise<T>

// Node operations
const HierarchyApi = {
  createNode: (payload) => http('/nodes', { method: 'POST', body: JSON.stringify(payload) }),
  getNode: (id) => http(`/nodes/${id}`),
  updateNode: (id, patch) => http(`/nodes/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteNode: (id) => http(`/nodes/${id}`, { method: 'DELETE' }),
  
  // Hierarchy operations
  getTree: () => http('/tree'),
  getRoots: () => http('/roots'),
  getSubtree: (id) => http(`/nodes/${id}/subtree`),
  moveNode: (id, parentId) => http(`/nodes/${id}/move`, { method: 'POST', body: JSON.stringify({ parentId }) })
};
```

### 6.2 Migration Strategy

**Phase 1**: Create new hierarchy components alongside existing timeline
**Phase 2**: Add feature flag to switch between old/new timeline
**Phase 3**: Replace old timeline with new hierarchy implementation
**Phase 4**: Remove old timeline code

## 7. User Experience Design

### 7.1 Visual Design

**Graph Visualization**:
- Clean, minimal node design consistent with existing UI
- Dashed lines for parent-child relationships
- Solid lines for same-level connections (if applicable)
- Color coding by node type (reuse existing colors)
- Hover states and selection highlighting

**Focus Mode Styling**:
- **Focused Node**: Full opacity (1.0), highlighted border, vibrant colors
- **Focused Node Children**: Medium opacity (0.7) to show relationship
- **Blurred Nodes**: Reduced opacity (0.3), desaturated colors
- **Smooth Transitions**: 200ms ease transitions between focus states
- **Background Blur**: Subtle background dimming when focus is active

**Expansion Visual Indicators**:
- **Chevron Buttons**: Bottom-right corner of nodes with children
- **Chevron Animation**: Smooth 180° rotation on expand/collapse (200ms ease)
- **Expanded Subtrees**: Visual hierarchy with connecting lines
- **Collapsed Indicators**: Small badge showing child count when collapsed
- **Tree Structure Lines**: Subtle dashed lines connecting parents to children

**Plus Button Styling** (Preserved from Existing):
- **Timeline Plus Buttons**: Indigo theme (#6366f1) with dashed connecting lines
- **Leaf Plus Buttons**: Purple theme (#a855f7) with vertical connecting lines
- **Hover Effects**: Scale (1.1) and glow effects on hover
- **Blur State**: Hidden with fade out (opacity 0) when unrelated to focus
- **Active State**: Full visibility when related to focused context

**Side Panel**:
- Fixed width (320px like reference implementation)
- Scrollable content area
- Button group for mode switching (View/Edit/Create/Move/Delete)
- **Expansion Controls Section**:
  - "Expand Children (3)" / "Collapse Children" button
  - Visual indicator for expandable nodes
  - Chevron state synchronization with tree view
- Form validation feedback
- Loading states for operations

**Top Controls**:
- Root node selector dropdown
- Layout direction toggle buttons (TB/LR)
- **Focus Controls**: "Clear Focus" button when node is focused
- **Expansion Controls**: "Expand All" / "Collapse All" buttons
- Hierarchy UI title/breadcrumb
- **Focus Indicator**: Shows currently focused node name in breadcrumb

### 7.2 Interaction Patterns

**Node Focus + Selection**:
- Click node to focus it (triggers focus mode)
- Focused node shows full opacity, all others blur to 30%
- If focused node has children, automatically expand them in tree view
- Selected node highlighted with border and shown in side panel
- Click background to clear focus and restore full visibility
- Side panel updates automatically with selected node details

**Chevron Expansion (Independent from Focus)**:
- Nodes with children display chevron button in bottom-right corner
- Click chevron to expand/collapse that node's children only
- Multiple nodes can be expanded simultaneously
- Chevron rotates 180° with smooth animation on expand/collapse
- Expansion state persists during focus mode changes
- Side panel shows expansion controls for selected node

**Plus Button Interactions**:
- **Timeline Plus Buttons**: Appear at start/end of timeline levels
  - Show when no node is focused OR when related to focused node
  - Timeline start: adds sibling before first node
  - Timeline end: adds sibling after last node
- **Leaf Node Plus Buttons**: Appear below nodes without children
  - Show when parent node is focused or no focus active
  - Click to add child node to the leaf node
- **Between Nodes**: Plus buttons on timeline edges for inserting between nodes
- All plus buttons hide when unrelated to focused context (existing blur logic)

**Creating Nodes**:
- **Via Side Panel**: Click "Create Child" button, select type, fill form
- **Via Plus Buttons**: Click any plus button to open node creation modal
- Plus button context determines parent relationship and insertion point
- Submit creates node and updates tree with proper hierarchy

**Moving Nodes**:
- Click "Move" in side panel
- Input field for new parent ID (blank = root)
- Validates move doesn't create cycles
- Submit moves node and refreshes tree layout

**Deleting Nodes**:
- Click "Delete" in side panel
- Confirm action with warning about child nodes
- Node removed from tree, children handled per API behavior
- Focus clears if deleted node was focused

**Multi-Node Operations**:
- Expand All / Collapse All buttons in top bar
- Bulk expansion operations work independently of focus mode
- Focus mode can work with any combination of expanded nodes

## 8. Simplified Implementation Plan (Complete Replacement)

### Milestone 1: Foundation Setup (Day 1)
**Goal**: Install dependencies and create basic API service

- [ ] **M1.1**: Install React Flow and Dagre dependencies
- [ ] **M1.2**: Create simplified hierarchy API service (`hierarchy-api.ts`)
- [ ] **M1.3**: Create base TypeScript interfaces for HierarchyNode and NodeMetadata
- [ ] **M1.4**: Test API integration with existing v2 endpoints
- [ ] **M1.5**: Create hierarchy Zustand store with basic state

### Milestone 2: Core Components (Day 2)
**Goal**: Build UnifiedNode and basic React Flow setup

- [ ] **M2.1**: Create UnifiedNode component with meta-driven rendering
- [ ] **M2.2**: Create NodeTypeRenderer for type-specific display logic
- [ ] **M2.3**: Create basic HierarchicalTimeline component with React Flow
- [ ] **M2.4**: Implement Dagre layout integration
- [ ] **M2.5**: Test basic node rendering and layout

### Milestone 3: Interactions & Focus (Day 3)
**Goal**: Add focus mode, selection, and expansion

- [ ] **M3.1**: Integrate focus mode with node clicks
- [ ] **M3.2**: Add expansion state management to store
- [ ] **M3.3**: Add chevron buttons to nodes with children
- [ ] **M3.4**: Implement focus/blur visual states
- [ ] **M3.5**: Add parent-child edge rendering

### Milestone 4: Side Panel CRUD (Day 4)
**Goal**: Complete side panel with all CRUD operations

- [ ] **M4.1**: Create HierarchyNodePanel component
- [ ] **M4.2**: Implement View Mode with node details
- [ ] **M4.3**: Implement Edit Mode with meta field editing
- [ ] **M4.4**: Implement Create Child Mode with type selection
- [ ] **M4.5**: Add Delete functionality with confirmation

### Milestone 5: Polish & Integration (Day 5)
**Goal**: Add final features and replace existing timeline

- [ ] **M5.1**: Add plus buttons for node creation
- [ ] **M5.2**: Add top bar controls (layout toggle, expand all, etc.)
- [ ] **M5.3**: Performance optimization and error handling
- [ ] **M5.4**: Replace existing Timeline component completely
- [ ] **M5.5**: Integration testing and final polish

## 9. Technical Requirements

### 9.1 Performance Requirements
- Tree rendering < 1 second for typical datasets (50-100 nodes)
- Smooth interactions (node selection, panel updates)
- Memory efficient for large hierarchies (1000+ nodes)
- Lazy loading for deep hierarchies if needed

### 9.2 Browser Compatibility
- Same requirements as existing application
- React Flow supports modern browsers (Chrome, Firefox, Safari, Edge)

### 9.3 Accessibility
- Keyboard navigation support
- Screen reader compatible
- Focus management between graph and panel
- High contrast mode support

## 10. Testing Strategy

### 10.1 Unit Testing
- API service methods
- Store actions and state updates
- Node panel form validation
- Graph layout calculations

### 10.2 Integration Testing
- Complete CRUD workflows
- Node selection and panel updates
- Layout algorithm with various tree shapes
- API error handling

### 10.3 E2E Testing
- Create hierarchy with multiple levels
- Edit node properties via panel
- Move nodes between parents
- Delete nodes and verify tree structure

## 11. Risks and Mitigations

### Risk 1: React Flow Performance with Large Trees
**Mitigation**: Implement virtual scrolling or lazy loading, limit initial render depth

### Risk 2: Complex Parent-Child Relationships
**Mitigation**: Follow reference implementation patterns, extensive testing with various tree shapes

### Risk 3: API Integration Complexity
**Mitigation**: Build incremental API service with comprehensive error handling

### Risk 4: User Experience Disruption
**Mitigation**: Phased rollout with feature flag, maintain existing timeline as fallback

## 12. Success Criteria

### Functional Success
- [ ] All 6 node types render correctly in hierarchy view
- [ ] Multi-level hierarchies display with clear visual relationships
- [ ] **Focus mode works seamlessly - clicking nodes focuses and shows children**
- [ ] **Chevron expansion works independently of focus mode**
- [ ] **Plus buttons maintain existing behavior with proper blur logic**
- [ ] Side panel CRUD operations work for all node types
- [ ] **Expansion controls work in side panel**
- [ ] Move operations work correctly without breaking tree structure
- [ ] Layout algorithms produce readable, organized trees

### Technical Success
- [ ] Performance meets requirements (< 1s load time)
- [ ] No memory leaks with large datasets
- [ ] Proper error handling for all API operations
- [ ] Clean separation between hierarchy and existing timeline code

### User Experience Success
- [ ] Intuitive navigation between graph and panel
- [ ] **Smooth focus mode transitions and blur effects**
- [ ] **Chevron animations and expansion visual feedback**
- [ ] **Plus button animations and hover effects preserved**
- [ ] Clear visual hierarchy with proper spacing
- [ ] Responsive design works on all supported screen sizes
- [ ] Smooth transitions and loading states

## 13. Future Enhancements

### Phase 2 Features (Post-MVP)
- Drag-and-drop node reparenting
- Bulk operations (select multiple nodes)
- Search and filter nodes in tree
- Export tree to various formats
- Undo/redo for tree operations

### Advanced Features
- Real-time collaboration on shared hierarchies
- Version history and change tracking
- Advanced tree layouts (radial, force-directed)
- Integration with external tools (calendar, task managers)

---

**Document Version**: 1.1  
**Last Updated**: January 2025  
**Next Review**: Post Phase 1 completion  
**Implementation Target**: Replace existing timeline by end of Phase 5

**Major Updates in v1.1**:
- Added comprehensive focus mode integration with existing `useNodeFocusStore`
- Detailed chevron expansion functionality using existing `ExpandChevron` component
- Complete plus button system preservation with existing blur logic
- Enhanced state management with expansion state tracking
- Updated interaction patterns for focus + expansion behavior
- Visual design specifications for focus/blur/expansion states
- Implementation plan updates with focus/expansion integration phases