# PRD: GraphRAG Profile Search Integration in JourneyHeader

## Document Control
- **Version**: 1.0
- **Last Updated**: 2025-09-09
- **Next Review**: 2025-09-16
- **Stakeholders**: Product Team, Frontend Engineering, Backend Engineering, UX/UI Design

---

## Executive Summary

This PRD defines the integration of GraphRAG-powered profile search functionality into the JourneyHeader component of Lighthouse AI. The feature will enable users to search for and discover other users' career profiles using natural language queries, leveraging the existing GraphRAG API to provide AI-powered semantic search with contextual insights.

**Business Impact**: Enhances user engagement and network discovery by providing intelligent profile search capabilities directly in the main navigation, increasing user retention and platform value.

**Timeline**: 2-week development cycle with incremental delivery milestones.

---

## Problem Statement

### Current State
- Users cannot easily discover other professionals with similar backgrounds or experiences
- No search functionality exists for finding users by career context, skills, or experiences
- Network discovery relies entirely on manual sharing and external discovery

### Target Problem
**Primary**: Users need an intuitive way to discover relevant professional profiles based on career experiences, skills, and context within the Lighthouse platform.

**Secondary**: The existing JourneyHeader has underutilized space that could provide high-value search functionality without disrupting the current user experience.

### Success Metrics
- **User Engagement**: 30% of active users use profile search within first month
- **Search Performance**: <500ms average response time for search queries
- **Discovery Rate**: 15% of searches result in profile views or connections
- **User Satisfaction**: >4.2/5 satisfaction rating for search functionality

---

## User Stories & Requirements

### Epic: Profile Search Integration

#### User Story 1: Basic Search Functionality
**As a** Lighthouse user  
**I want to** search for other users by typing natural language queries in the header  
**So that** I can discover professionals with relevant backgrounds and experiences

**Acceptance Criteria**:
- Search input appears in JourneyHeader between logo and user menu
- Search is only visible when viewing my own timeline (not other users')
- Query input supports natural language (e.g., "software engineers at Google", "product managers in fintech")
- Search results appear in real-time dropdown below the input
- Maximum 3 results displayed in dropdown
- Debounced search with 300ms delay to prevent excessive API calls

#### User Story 2: Rich Search Results Display
**As a** user performing a profile search  
**I want to** see comprehensive profile information in search results  
**So that** I can quickly assess relevance and decide whether to explore further

**Acceptance Criteria**:
- Each result shows: name, current role, company, profile photo
- "Why Matched" section displays 2-3 relevant bullet points
- Matched timeline nodes shown with type-specific badges (Job, Education, Project, etc.)
- AI insights summary displayed when available
- Results exclude: match percentage, detailed skills list, node scores
- Clean, scannable visual design consistent with existing UI patterns

#### User Story 3: Interactive Search Experience
**As a** user interacting with search results  
**I want to** navigate through results and access profiles easily  
**So that** I can efficiently explore relevant connections

**Acceptance Criteria**:
- Keyboard navigation support (arrow keys, enter to select)
- Click on result navigates to user's timeline
- Search input clears after selection
- Dropdown closes when clicking outside or pressing escape
- Loading states during search API calls
- Empty states when no results found
- Smooth animations using Framer Motion

#### User Story 4: Performance & UX Optimization
**As a** user of the search feature  
**I want** fast, responsive search with smooth interactions  
**So that** the feature feels polished and doesn't disrupt my workflow

**Acceptance Criteria**:
- Search responses complete within 500ms under normal conditions
- Progressive loading states for slow connections
- Error handling for API failures with user-friendly messages
- Search input remains accessible during loading
- Dropdown positioning adjusts based on viewport constraints
- Mobile-responsive design maintaining functionality on smaller screens

---

## Non-Functional Requirements

### Performance Requirements
- **Search Latency**: <500ms average response time
- **UI Responsiveness**: <100ms input responsiveness
- **Debounce Optimization**: 300ms delay prevents excessive API calls
- **Memory Usage**: Minimal impact on application bundle size
- **Cache Strategy**: In-memory result caching for recent queries (5-minute TTL)

### Security Requirements
- **Authentication**: Leverages existing session-based authentication
- **Authorization**: Users can only search within their accessible tenant/organization
- **Data Privacy**: No sensitive personal information exposed in search results
- **Rate Limiting**: Backend rate limiting prevents abuse (100 requests/minute per user)

### Reliability Requirements
- **Availability**: 99.5% uptime aligned with main application
- **Error Handling**: Graceful degradation when GraphRAG API is unavailable
- **Fallback**: Search gracefully handles API errors without breaking header functionality
- **Data Consistency**: Search results reflect current user data state

### Usability Requirements
- **Accessibility**: WCAG 2.1 AA compliance with keyboard navigation
- **Mobile Support**: Fully functional on mobile devices with touch interactions
- **Visual Consistency**: Matches existing Lighthouse design system
- **Loading States**: Clear indication of search progress and states

---

## Technical Requirements

### Frontend Architecture

#### Component Structure
```
JourneyHeader
├── ProfileSearch (new)
│   ├── SearchInput
│   ├── SearchDropdown
│   │   ├── SearchResult (repeated)
│   │   │   ├── ProfileInfo
│   │   │   ├── MatchReasons
│   │   │   ├── MatchedNodes
│   │   │   └── InsightsSummary
│   │   ├── LoadingState
│   │   ├── EmptyState
│   │   └── ErrorState
│   └── SearchProvider (context)
```

#### State Management
- **Local State**: Search query, dropdown visibility, loading states
- **TanStack Query**: API data fetching, caching, error handling
- **Context**: Search configuration and shared state if needed

#### Dependencies
- **cmdk**: Command palette functionality for search interactions
- **framer-motion**: Smooth animations for dropdown and state transitions
- **@tanstack/react-query**: API data management and caching
- **lucide-react**: Search icons and UI elements
- **existing shadcn/ui components**: Badge, Button, Card, etc.

### API Integration

#### Endpoint Usage
- **URL**: `POST /api/v2/graphrag/search`
- **Authentication**: Session-based (inherited from existing middleware)
- **Rate Limiting**: 100 requests/minute per authenticated user

#### Request Schema
```typescript
interface GraphRAGSearchRequest {
  query: string;           // Natural language search query
  limit?: number;          // Fixed at 3 for header search
  similarityThreshold?: number; // Default 0.5
}
```

#### Response Schema
```typescript
interface GraphRAGSearchResponse {
  query: string;
  totalResults: number;
  profiles: ProfileResult[];
  timestamp: string;
}

interface ProfileResult {
  id: string;                    // User ID for navigation
  name: string;                  // Display name
  email: string;                 // Contact info
  currentRole?: string;          // Current position
  company?: string;              // Current employer
  matchScore: string;            // Relevance score (hidden from UI)
  whyMatched: string[];          // 2-3 relevance bullets
  skills: string[];              // Extracted skills (hidden from UI)
  matchedNodes: MatchedNode[];   // Relevant timeline entries
  insightsSummary?: string[];    // AI-generated insights
}
```

### Data Processing
- **Query Preprocessing**: Trim whitespace, validate length (1-500 chars)
- **Result Filtering**: Client-side filtering to ensure exactly 3 results
- **Data Transformation**: Map API response to UI-friendly format
- **Error Mapping**: Transform API errors to user-friendly messages

---

## API Integration Details

### Request Flow
1. User types in search input (debounced 300ms)
2. Frontend validates query length and content
3. POST request to `/api/v2/graphrag/search` with query and limit=3
4. Backend processes query through pgvector GraphRAG pipeline
5. Response mapped to ProfileResult[] for UI rendering

### Error Handling
- **Network Errors**: "Search temporarily unavailable" message
- **API Errors**: "Unable to complete search" with retry option
- **Timeout**: "Search is taking longer than expected" with cancel option
- **Empty Results**: "No profiles found matching your search" with suggestion to try different terms

### Caching Strategy
- **TanStack Query cache**: 5-minute TTL for search results
- **Key Strategy**: `['graphrag-search', query]` for predictable cache invalidation
- **Stale-while-revalidate**: Show cached results while fetching updated data
- **Memory Management**: Automatic cleanup of old cache entries

### Performance Optimization
- **Request Debouncing**: 300ms delay reduces API load
- **Query Cancellation**: Cancel previous requests when new query initiated
- **Parallel Fetching**: No dependencies, single endpoint for optimal performance
- **Bundle Optimization**: Lazy loading of search components if needed

---

## UI/UX Specifications

### Visual Design

#### Search Input
- **Placement**: Between Lighthouse logo and right-side actions (Share/User Menu)
- **Width**: 300px default, responsive scaling on smaller screens
- **Height**: 36px to match existing header elements
- **Styling**: Rounded border input with search icon, consistent with existing form elements
- **Placeholder**: "Search profiles..." with subtle hint text

#### Search Dropdown
- **Position**: Absolute positioned below search input
- **Width**: 400px (wider than input for content)
- **Max Height**: 300px with scroll if needed
- **Shadow**: Consistent with existing dropdown shadows
- **Border**: 1px border matching theme colors
- **Background**: Card background with proper contrast

#### Search Results Layout
```
[Profile Photo] [Name]           [Current Role at Company]
               [Why Matched bullet 1]
               [Why Matched bullet 2]
               [Node Badges: Job | Project | Education]
               [AI Insights summary if available]
```

#### Typography & Spacing
- **Name**: font-medium, text-sm
- **Role/Company**: text-xs, text-muted-foreground
- **Match Reasons**: text-xs, regular weight
- **Node Badges**: Badge component with type-specific colors
- **Padding**: 12px vertical, 16px horizontal per result
- **Separator**: 1px border between results

### Interaction Design

#### Keyboard Navigation
- **Tab**: Enter/exit search input
- **Arrow Down/Up**: Navigate through results
- **Enter**: Select highlighted result
- **Escape**: Close dropdown, clear focus
- **Cmd/Ctrl+K**: Focus search (optional enhancement)

#### Mouse/Touch Interactions
- **Click Input**: Focus and show recent/suggested searches (future enhancement)
- **Click Result**: Navigate to user timeline
- **Click Outside**: Close dropdown
- **Hover**: Visual feedback on result items

### State Indicators

#### Loading State
- **Input**: Subtle spinner icon in input field
- **Dropdown**: Skeleton loading placeholders for 3 results
- **Animation**: Smooth fade-in/fade-out transitions

#### Empty State
- **Message**: "No profiles found matching your search"
- **Suggestion**: "Try different keywords or search terms"
- **Visual**: Search icon with muted styling

#### Error State
- **Message**: "Search temporarily unavailable"
- **Action**: "Try again" button
- **Visual**: Alert icon with error styling

### Responsive Design
- **Desktop (>768px)**: Full layout as specified
- **Tablet (768px-1024px)**: Reduced search input width to 250px
- **Mobile (<768px)**: Search input expands to available space, dropdown width adjusts to screen

---

## Component Architecture

### File Structure
```
client/src/components/search/
├── ProfileSearch.tsx              # Main search container
├── SearchInput.tsx               # Input field with debouncing
├── SearchDropdown.tsx            # Results dropdown container
├── SearchResult.tsx              # Individual result component
├── SearchStates.tsx              # Loading, empty, error states
├── hooks/
│   ├── useProfileSearch.ts       # TanStack Query hook
│   ├── useSearchKeyboard.ts      # Keyboard navigation
│   └── useSearchDropdown.ts      # Dropdown visibility logic
└── types/
    └── search.types.ts           # Frontend type definitions
```

### Component Interfaces

#### ProfileSearch Props
```typescript
interface ProfileSearchProps {
  className?: string;
  placeholder?: string;
  maxResults?: number; // Default 3
}
```

#### SearchResult Props
```typescript
interface SearchResultProps {
  result: ProfileResult;
  isHighlighted: boolean;
  onSelect: (userId: string) => void;
  onClick: (userId: string) => void;
}
```

### Hook Definitions

#### useProfileSearch
```typescript
interface UseProfileSearchReturn {
  search: (query: string) => void;
  results: ProfileResult[];
  isLoading: boolean;
  error: Error | null;
  clear: () => void;
}
```

#### useSearchDropdown
```typescript
interface UseSearchDropdownReturn {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}
```

### Integration Points

#### JourneyHeader Integration
```typescript
// Add to existing JourneyHeader component
import { ProfileSearch } from '@/components/search/ProfileSearch';

// Insert between logo and right actions
<div className="flex items-center gap-2">
  {/* Existing logo */}
  <div className="text-black text-xl font-semibold">
    Lighthouse AI
  </div>
</div>

{/* New search - only when not viewing other users */}
{!isViewingOtherUser && (
  <div className="flex-1 max-w-md mx-8">
    <ProfileSearch />
  </div>
)}

{/* Existing right content */}
<div className="flex items-center gap-4">
  {/* ... existing content ... */}
</div>
```

---

## Implementation Planning

### Phase 1: Foundation (Week 1)
**Duration**: 3-4 days

#### Tasks:
1. **Setup Component Structure**
   - Create search component files and folder structure
   - Define TypeScript interfaces and types
   - Setup TanStack Query configuration for GraphRAG endpoint

2. **Basic Search Input**
   - Implement SearchInput component with debouncing
   - Add search icon and placeholder text
   - Integrate with JourneyHeader layout

3. **API Integration**
   - Create useProfileSearch hook with TanStack Query
   - Implement request/response handling
   - Add error handling and loading states

**Deliverables**:
- Functional search input with API connection
- Basic error handling and loading states
- TypeScript interfaces defined

**Definition of Done**:
- Search input appears correctly in JourneyHeader
- API calls trigger with proper debouncing
- Loading states display during requests
- Errors are handled gracefully

### Phase 2: Search Results & UI (Week 1-2)
**Duration**: 4-5 days

#### Tasks:
1. **Search Dropdown Implementation**
   - Create SearchDropdown with proper positioning
   - Implement SearchResult component layout
   - Add ProfileResult data mapping and display

2. **Visual Polish**
   - Implement Badge components for timeline node types
   - Style match reasons and insights display  
   - Add Framer Motion animations for dropdown

3. **State Management**
   - Implement empty and error state components
   - Add result highlighting and selection logic
   - Create dropdown visibility management

**Deliverables**:
- Complete search dropdown with styled results
- All UI states implemented (loading, empty, error)
- Smooth animations and transitions

**Definition of Done**:
- Search results display all required information
- Visual design matches specifications
- All state transitions work smoothly
- Mobile responsive design implemented

### Phase 3: Interactions & Polish (Week 2)
**Duration**: 2-3 days

#### Tasks:
1. **Keyboard Navigation**
   - Implement arrow key navigation through results
   - Add Enter key selection and Escape to close
   - Focus management and accessibility improvements

2. **Click Interactions**
   - Add result selection and navigation to user timelines
   - Implement click-outside-to-close functionality
   - Add hover states and visual feedback

3. **Performance Optimization**
   - Implement result caching strategy
   - Add request cancellation for new searches
   - Optimize bundle size and lazy loading if needed

**Deliverables**:
- Complete keyboard and mouse interaction support
- Optimized performance and caching
- Accessibility compliance (WCAG 2.1 AA)

**Definition of Done**:
- All keyboard shortcuts work as specified
- Click interactions provide proper feedback
- Performance targets met (<500ms search, <100ms UI response)
- Accessibility testing passed

### Phase 4: Testing & Integration (Week 2)
**Duration**: 1-2 days

#### Tasks:
1. **Unit Testing**
   - Test search hooks and component logic
   - Test API integration and error handling
   - Test keyboard navigation and interactions

2. **Integration Testing**
   - Test JourneyHeader integration
   - Test responsive design on various devices
   - Test performance under various network conditions

3. **User Acceptance Testing**
   - Gather feedback from stakeholders
   - Refine UI/UX based on feedback
   - Final polish and bug fixes

**Deliverables**:
- Comprehensive test suite with >90% coverage
- Integration testing completed
- User acceptance criteria validated

**Definition of Done**:
- All tests passing
- Performance benchmarks met
- Stakeholder approval received
- Ready for production deployment

---

## Testing Strategy

### Unit Testing
**Framework**: Vitest with React Testing Library

#### Test Coverage Areas:
1. **Component Rendering**
   - ProfileSearch renders correctly in different states
   - SearchResult displays all required information
   - State components (loading, empty, error) render properly

2. **Hook Logic**
   - useProfileSearch handles API calls correctly
   - Debouncing works as expected (300ms delay)
   - Error states are managed properly

3. **User Interactions**
   - Keyboard navigation works correctly
   - Click handlers trigger proper actions
   - Dropdown visibility logic functions correctly

#### Key Test Cases:
```typescript
describe('ProfileSearch', () => {
  it('debounces search queries by 300ms');
  it('displays loading state during API calls');
  it('handles API errors gracefully');
  it('navigates to user timeline on result selection');
  it('supports keyboard navigation through results');
  it('closes dropdown on escape key');
});
```

### Integration Testing
**Framework**: Playwright for E2E testing

#### Test Scenarios:
1. **Search Flow End-to-End**
   - User types query → sees results → clicks result → navigates to timeline
   - Search with no results shows appropriate empty state
   - API error displays user-friendly error message

2. **JourneyHeader Integration**
   - Search appears only when viewing own timeline
   - Search does not appear when viewing other users' timelines
   - Layout remains intact with search component added

3. **Performance Testing**
   - Search responses complete within 500ms
   - UI remains responsive during searches
   - Multiple rapid searches handle properly (debouncing)

#### Accessibility Testing:
- Keyboard-only navigation works completely
- Screen reader compatibility (ARIA labels, semantic HTML)
- Color contrast meets WCAG 2.1 AA standards
- Focus indicators are visible and logical

### Performance Testing
1. **Load Testing**: Simulate multiple concurrent searches
2. **Network Testing**: Test under various connection speeds
3. **Memory Testing**: Monitor memory usage during extended use
4. **Bundle Analysis**: Verify minimal impact on application bundle size

### User Acceptance Testing
1. **Stakeholder Review**: Product team validates functionality
2. **Designer Review**: UI/UX team approves visual implementation  
3. **User Testing**: Internal team members test real-world usage
4. **Performance Validation**: Confirm all performance targets met

---

## Risk Assessment & Mitigation

### High-Risk Items

#### Risk 1: API Performance Issues
**Probability**: Medium | **Impact**: High
- **Description**: GraphRAG API responses exceed 500ms target consistently
- **Mitigation**: 
  - Implement client-side caching with 5-minute TTL
  - Add progressive loading states for slow responses
  - Backend optimization of GraphRAG queries
  - Fallback to simpler search if GraphRAG unavailable

#### Risk 2: Mobile UX Complexity
**Probability**: Medium | **Impact**: Medium
- **Description**: Search dropdown doesn't work well on mobile devices
- **Mitigation**:
  - Dedicated mobile search modal for smaller screens
  - Touch-optimized result selection
  - Responsive design testing across device ranges
  - Progressive enhancement approach

### Medium-Risk Items

#### Risk 3: Search Result Quality
**Probability**: Low | **Impact**: High
- **Description**: GraphRAG returns irrelevant or poor-quality results
- **Mitigation**:
  - Adjust similarity threshold based on result quality feedback
  - Implement result scoring and filtering improvements
  - Add user feedback mechanism for result quality
  - Backend tuning of GraphRAG parameters

#### Risk 4: Integration Complexity
**Probability**: Medium | **Impact**: Medium
- **Description**: JourneyHeader integration disrupts existing functionality
- **Mitigation**:
  - Feature flag implementation for gradual rollout
  - Comprehensive regression testing of header functionality
  - Modular component design for easy removal if needed
  - Thorough testing of conditional rendering logic

### Low-Risk Items

#### Risk 5: Bundle Size Impact
**Probability**: Low | **Impact**: Low
- **Description**: Search components significantly increase application bundle size
- **Mitigation**:
  - Lazy loading of search components
  - Tree-shaking optimization for unused code
  - Bundle analysis and size monitoring
  - Use of existing dependencies where possible

---

## Success Metrics & Monitoring

### Primary Success Metrics

#### User Engagement
- **Search Usage Rate**: Target 30% of active users use search within first month
- **Search Frequency**: Average 2-3 searches per user session
- **Result Click-Through Rate**: Target 15% of searches result in profile views

#### Performance Metrics
- **Search Response Time**: <500ms average (95th percentile <800ms)
- **UI Response Time**: <100ms input responsiveness
- **Error Rate**: <1% of search requests fail

#### Business Impact
- **Profile Discovery**: 20% increase in user profile views
- **User Retention**: 5% improvement in weekly active users
- **User Satisfaction**: >4.2/5 rating for search functionality

### Monitoring Implementation

#### Technical Monitoring
- **API Performance**: Response time monitoring via application metrics
- **Error Tracking**: Error rate and type monitoring via error reporting
- **Usage Analytics**: Search query patterns and result interactions
- **Performance Metrics**: Client-side performance monitoring

#### User Experience Monitoring
- **A/B Testing**: Compare engagement with and without search feature
- **User Feedback**: In-app feedback collection for search experience
- **Support Tickets**: Monitor for search-related user issues
- **Heat Mapping**: Track user interaction patterns with search interface

### Success Criteria for Launch
- ✅ All acceptance criteria met and validated
- ✅ Performance targets achieved in production environment
- ✅ Error rate below 1% for first week post-launch
- ✅ User satisfaction score >4.0 in initial feedback
- ✅ No regression issues in existing JourneyHeader functionality

### Post-Launch Optimization
- **Week 1**: Monitor for critical issues and performance problems
- **Week 2-4**: Analyze usage patterns and optimize based on data
- **Month 1**: User feedback analysis and UX improvements
- **Month 2**: Advanced features consideration based on adoption metrics

---

## Appendices

### Appendix A: API Response Example
```json
{
  "query": "software engineers at Google",
  "totalResults": 12,
  "profiles": [
    {
      "id": "user-123",
      "name": "Jane Smith",
      "email": "jane.smith@email.com",
      "currentRole": "Senior Software Engineer",
      "company": "Google",
      "matchScore": "92.5",
      "whyMatched": [
        "5+ years software engineering at Google",
        "Led multiple full-stack projects",
        "Expertise in distributed systems"
      ],
      "skills": ["JavaScript", "Python", "Kubernetes"],
      "matchedNodes": [
        {
          "id": "node-456",
          "type": "job",
          "meta": {
            "company": "Google",
            "role": "Senior Software Engineer",
            "startDate": "2020-01"
          },
          "score": 0.95,
          "insights": [
            {
              "text": "Led scalable backend architecture",
              "category": "technical",
              "resources": []
            }
          ]
        }
      ],
      "insightsSummary": [
        "Strong background in distributed systems",
        "Leadership experience in technical projects"
      ]
    }
  ],
  "timestamp": "2025-09-09T14:30:00Z"
}
```

### Appendix B: Component Props Reference
```typescript
// ProfileSearch component props
interface ProfileSearchProps {
  className?: string;
  placeholder?: string;
  maxResults?: number;
  disabled?: boolean;
  onResultSelect?: (result: ProfileResult) => void;
}

// SearchResult component props
interface SearchResultProps {
  result: ProfileResult;
  isHighlighted: boolean;
  showInsights?: boolean;
  onSelect: (userId: string) => void;
  className?: string;
}
```

### Appendix C: Keyboard Shortcuts Reference
| Key | Action |
|-----|--------|
| `Tab` | Focus search input |
| `↓` `↑` | Navigate through results |
| `Enter` | Select highlighted result |
| `Escape` | Close dropdown / clear focus |
| `Cmd/Ctrl+K` | Focus search (future enhancement) |

### Appendix D: Error Messages Reference
| Scenario | Message | Action |
|----------|---------|---------|
| Network Error | "Search temporarily unavailable" | Retry button |
| API Error | "Unable to complete search" | Try again link |
| Timeout | "Search is taking longer than expected" | Cancel button |
| Empty Results | "No profiles found matching your search" | Suggestion text |
| Invalid Query | "Please enter a search term" | Input validation |

---

**Document Status**: Ready for Review and Approval  
**Next Steps**: Stakeholder review → Technical feasibility validation → Development kickoff