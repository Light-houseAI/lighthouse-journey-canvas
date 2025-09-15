# Implementation Plan: Timeline Journey Profile View

**Branch**: `001-lets-revamp-journey` | **Date**: 2025-01-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-lets-revamp-journey/spec.md`

## Execution Flow (/plan command scope)

```
1. Load feature spec from Input path
   → SUCCESS: Feature spec loaded and analyzed
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → All technical decisions clarified through research
   → Project Type: web (frontend + backend API)
3. Evaluate Constitution Check section below
   → Simplicity maintained: Single feature, 3 test types
   → No constitutional violations
4. Execute Phase 0 → research.md
   → COMPLETE: All unknowns resolved
5. Execute Phase 1 → contracts, data-model.md, quickstart.md
   → IN PROGRESS: Generating architecture artifacts
6. Re-evaluate Constitution Check section
   → Design maintains simplicity principles
7. Plan Phase 2 → Describe task generation approach
   → Task breakdown strategy defined
8. STOP - Ready for /tasks command
```

## Summary

Transform the existing timeline visualization into a simplified profile page with list view. Reuse existing routing pattern where logged-in users see their profile at `/` and view other profiles at `/:username`. Display career journey nodes separated into current and past experiences using a tree structure, leveraging existing API endpoints from hierarchy.routes.ts.

## Technical Context

**Language/Version**: TypeScript 5.x / React 18.x  
**Primary Dependencies**: TanStack Query v5, Zustand v4, React Router v6  
**Storage**: PostgreSQL (existing), no changes needed  
**Testing**: Vitest (unit/integration), Playwright (E2E), MSW (mocking)  
**Target Platform**: Web browsers (Chrome, Firefox, Safari, Edge)  
**Project Type**: web - Full-stack application  
**Performance Goals**: <200ms initial render, <100ms interactions  
**Constraints**: Must maintain existing node permissions, no sorting/filtering  
**Scale/Scope**: Support 1000+ nodes per user, responsive design

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

**Simplicity**:

- Projects: 2 (client, server API endpoints)
- Using framework directly? YES (TanStack Query, Zustand without wrappers)
- Single data model? YES (reusing existing timeline node models)
- Avoiding patterns? YES (no unnecessary abstractions)

**Architecture**:

- EVERY feature as library? N/A (React component feature)
- Libraries listed: profile-view, tree-list, node-details
- CLI per library: N/A (UI components)
- Library docs: Component documentation in TSDoc format

**Testing (NON-NEGOTIABLE)**:

- RED-GREEN-Refactor cycle enforced? YES
- Git commits show tests before implementation? YES
- Order: Contract→Integration→E2E→Unit strictly followed? YES
- Real dependencies used? YES (real API calls in integration tests)
- Integration tests for: API contracts, state management, data flow
- FORBIDDEN: Implementation before test ✓ Understood

**Observability**:

- Structured logging included? YES (console.log with context)
- Frontend logs → backend? YES (error boundary reporting)
- Error context sufficient? YES (user action, state snapshot)

**Versioning**:

- Version number assigned? 1.0.0
- BUILD increments on every change? YES
- Breaking changes handled? N/A (new feature)

## Project Structure

### Documentation (this feature)

```
specs/001-lets-revamp-journey/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command) ✓
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
│   ├── profile-api.yaml # OpenAPI spec for profile endpoints
│   └── node-api.yaml    # Updated node endpoints
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)

```
# Option 2: Web application (reusing existing infrastructure)
client/
├── src/
│   ├── pages/
│   │   └── professional-journey.tsx  # UPDATE existing page
│   ├── components/
│   │   ├── timeline/
│   │   │   ├── ProfileListView.tsx  # NEW list view component
│   │   │   ├── ExperienceSection.tsx
│   │   │   ├── TreeList.tsx
│   │   │   └── NodeListItem.tsx
│   │   └── timeline/  # Existing components to reuse
│   ├── hooks/
│   │   └── useTimelineStore.ts  # REUSE existing hook
│   ├── stores/
│   │   └── current-user-timeline-store.ts  # REUSE existing
│   └── services/
│       └── hierarchy-api.ts  # REUSE existing API service
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/

server/
├── routes/
│   └── hierarchy.routes.ts  # REUSE existing endpoints
└── tests/
```

**Structure Decision**: Option 2 - Web application (frontend React + backend Express)

## Phase 0: Outline & Research

1. **Extract unknowns from Technical Context** above:
   - TanStack Query patterns for timeline data ✓
   - Zustand store design for UI state ✓
   - MSW setup for mocking ✓
   - Tree structure rendering without React Flow ✓

2. **Generate and dispatch research agents**:
   - Research completed for all technology choices
   - Best practices identified for each library

3. **Consolidate findings** in `research.md`:
   - All decisions documented with rationale
   - Alternatives evaluated and documented

**Output**: research.md with all clarifications resolved ✓

## Phase 1: Design & Contracts

_Prerequisites: research.md complete_

1. **Extract entities from feature spec** → `data-model.md`:
   - ProfileView (aggregated view model)
   - CurrentExperience (nodes without end date)
   - PastExperience (nodes with end date)
   - NodeHierarchy (parent-child relationships)
   - NodeDetails (expanded node information)

2. **Generate API contracts** from functional requirements:

   ```yaml
   # GET /api/profile/:username
   # Returns profile data with timeline nodes

   # GET /api/nodes/:nodeId/details
   # Returns detailed node information

   # PATCH /api/nodes/:nodeId
   # Updates node (for inline editing if added)
   ```

3. **Generate contract tests** from contracts:
   - ProfileAPI contract tests
   - Node details contract tests
   - Response schema validation

4. **Extract test scenarios** from user stories:
   - View profile with current and past experiences
   - Navigate hierarchical nodes
   - Open/close node details panel
   - Share and copy profile URL

5. **Update agent file incrementally**:
   - Add TanStack Query patterns
   - Add Zustand store patterns
   - Add MSW mocking approach

**Output**: data-model.md, /contracts/\*, failing tests, quickstart.md

## Phase 2: Task Planning Approach

_This section describes what the /tasks command will do - DO NOT execute during /plan_

**Task Generation Strategy**:

- Break down by test type: Contract → Integration → E2E → Implementation
- Group related tasks for parallel execution
- Each component gets test + implementation task pair

**Ordering Strategy**:

1. API contract tests [P]
2. API implementation to pass contracts
3. Store setup and tests [P]
4. Component tests [P]
5. Component implementation
6. Integration tests
7. E2E test scenarios
8. Performance optimization

**Estimated Output**: 30-35 numbered, ordered tasks in tasks.md

**Task Categories**:

- **Setup Tasks** (5): MSW config, test utilities, route setup
- **API Tasks** (6): Endpoints, controllers, contract tests
- **Store Tasks** (4): Zustand store for profile view state
- **Component Tasks** (12): Each component with tests
- **Integration Tasks** (4): Data flow, API integration
- **E2E Tasks** (4): User journeys, accessibility

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation

_These phases are beyond the scope of the /plan command_

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks following TDD)  
**Phase 5**: Validation (run all tests, performance checks)

## Complexity Tracking

_No violations - feature maintains simplicity_

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| None      | -          | -                                    |

## Progress Tracking

_This checklist is updated during execution flow_

**Phase Status**:

- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:

- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none)

---

_Based on Constitution v2.1.1 - See `/memory/constitution.md`_
