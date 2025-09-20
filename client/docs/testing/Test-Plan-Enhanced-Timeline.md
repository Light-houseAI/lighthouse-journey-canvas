# Test Plan: Enhanced Timeline Interactions

## Test Overview

Comprehensive testing strategy for the enhanced timeline interaction features including plus buttons, chat integration, and node creation workflows.

## Test Environment Setup

### Prerequisites

- React Testing Library with Jest
- Cypress for E2E testing
- Mock API endpoints for isolated testing
- Test user profiles with various data scenarios

### Test Data Requirements

```javascript
// Test profiles with different scenarios
const testProfiles = {
  emptyProfile: { experiences: [], education: [], projects: [] },
  basicProfile: {
    experiences: [
      { title: "Software Engineer", company: "Google", start: "2020-01", end: "2023-06" },
      { title: "Senior Engineer", company: "Microsoft", start: "2023-07", end: null }
    ]
  },
  complexProfile: {
    experiences: [...], // Multiple experiences with projects
    education: [...],   // Various education entries
    projects: [...]     // Nested project hierarchies
  }
};
```

## Unit Tests

### 1. ChatToggle Component Tests

**File**: `src/components/ui/__tests__/ChatToggle.test.tsx`

```javascript
describe('ChatToggle Component', () => {
  it('renders in default manual mode', () => {
    // Test initial state
  });

  it('toggles between chat and manual modes', () => {
    // Test state transitions
  });

  it('persists state across sessions', () => {
    // Test localStorage integration
  });

  it('displays correct visual indicators', () => {
    // Test UI state representation
  });
});
```

### 2. Enhanced Edge Components Tests

**File**: `src/components/edges/__tests__/StraightTimelineEdge.test.tsx`

```javascript
describe('StraightTimelineEdge with Plus Button', () => {
  it('shows plus button on hover', () => {
    // Test hover state activation
  });

  it('hides plus button when not hovering', () => {
    // Test hover state deactivation
  });

  it('positions plus button at edge midpoint', () => {
    // Test button positioning calculation
  });

  it('triggers correct handler on plus button click', () => {
    // Test click event handling
  });

  it('passes correct context data', () => {
    // Test context collection and passing
  });
});
```

### 3. AddNodeModal Component Tests

**File**: `src/components/modals/__tests__/AddNodeModal.test.tsx`

```javascript
describe('AddNodeModal Component', () => {
  it('renders all node type options', () => {
    // Test type selection display
  });

  it('shows dynamic form fields based on selection', () => {
    // Test form field rendering
  });

  it('validates form data correctly', () => {
    // Test form validation logic
  });

  it('submits data to correct API endpoint', () => {
    // Test API integration
  });

  it('handles API errors gracefully', () => {
    // Test error handling
  });
});
```

### 4. Node Color Coding Tests

**File**: `src/components/nodes/__tests__/NodeColorCoding.test.tsx`

```javascript
describe('Node Color Coding', () => {
  it('applies green color for completed experiences', () => {
    // Test green color for nodes with end dates
  });

  it('applies blue color for ongoing experiences', () => {
    // Test blue color for nodes without end dates
  });

  it('maintains color consistency across node types', () => {
    // Test color application across WorkExperience, Education, Project nodes
  });
});
```

### 5. Positioning Algorithm Tests

**File**: `src/utils/__tests__/date-parser.test.tsx`

```javascript
describe('Enhanced Timeline Positioning', () => {
  it('positions child nodes in proper hierarchy', () => {
    // Test tree structure positioning
  });

  it('avoids node overlapping in complex hierarchies', () => {
    // Test collision detection and spacing
  });

  it('maintains consistent spacing between levels', () => {
    // Test vertical spacing consistency
  });

  it('handles dynamic node addition correctly', () => {
    // Test positioning updates when new nodes added
  });
});
```

## Integration Tests

### 1. Plus Button to Chat Flow

**File**: `src/tests/integration/PlusButtonChatFlow.test.tsx`

```javascript
describe('Plus Button to Chat Integration', () => {
  beforeEach(() => {
    // Set chat mode ON
    setChatToggleState(true);
  });

  it('opens NaaviChat with correct context message', async () => {
    // 1. Hover over edge
    // 2. Click plus button
    // 3. Verify NaaviChat opens
    // 4. Verify context message is pre-filled
  });

  it('creates node automatically from complete AI response', async () => {
    // 1. Trigger chat flow
    // 2. Mock AI response with complete node data
    // 3. Verify node creation API call
    // 4. Verify timeline updates
  });

  it('handles incomplete AI responses', async () => {
    // Test clarification request flow
  });
});
```

### 2. Plus Button to Modal Flow

**File**: `src/tests/integration/PlusButtonModalFlow.test.tsx`

```javascript
describe('Plus Button to Modal Integration', () => {
  beforeEach(() => {
    // Set chat mode OFF
    setChatToggleState(false);
  });

  it('opens AddNodeModal with correct context', async () => {
    // Test modal opening with pre-populated context
  });

  it('creates node through manual form submission', async () => {
    // Test complete manual creation flow
  });

  it('handles form validation errors', async () => {
    // Test error handling in manual flow
  });
});
```

### 3. API Integration Tests

**File**: `src/tests/integration/APIIntegration.test.tsx`

```javascript
describe('API Integration for Node Creation', () => {
  it('saves work experience nodes correctly', async () => {
    // Test work experience creation and profile update
  });

  it('saves education nodes correctly', async () => {
    // Test education creation and profile update
  });

  it('saves project nodes with parent relationships', async () => {
    // Test project creation under experience
  });

  it('handles API failures with proper error messages', async () => {
    // Test error handling and user feedback
  });
});
```

## End-to-End Tests

### 1. Complete User Journey - Chat Mode

**File**: `cypress/e2e/timeline-interactions-chat.cy.ts`

```javascript
describe('Timeline Interactions - Chat Mode', () => {
  beforeEach(() => {
    cy.login('test@example.com');
    cy.visit('/professional-journey');
    cy.enableChatMode();
  });

  it('completes full node addition via chat', () => {
    // 1. Hover over timeline edge
    cy.get('[data-testid="timeline-edge"]').first().trigger('mouseover');

    // 2. Verify plus button appears
    cy.get('[data-testid="edge-plus-button"]').should('be.visible');

    // 3. Click plus button
    cy.get('[data-testid="edge-plus-button"]').click();

    // 4. Verify NaaviChat opens with context
    cy.get('[data-testid="naavi-chat"]').should('be.visible');
    cy.get('[data-testid="chat-input"]').should('contain.value', 'Add');

    // 5. Simulate AI response
    cy.mockAIResponse({
      type: 'workExperience',
      title: 'Product Manager',
      company: 'Apple',
      start: '2024-01',
      end: null,
    });

    // 6. Verify node creation
    cy.get('[data-testid="timeline-node"]').should(
      'contain',
      'Product Manager'
    );
    cy.get('[data-testid="timeline-node"]').should(
      'have.css',
      'background-color',
      'rgb(59, 130, 246)'
    ); // Blue for ongoing
  });
});
```

### 2. Complete User Journey - Manual Mode

**File**: `cypress/e2e/timeline-interactions-manual.cy.ts`

```javascript
describe('Timeline Interactions - Manual Mode', () => {
  beforeEach(() => {
    cy.login('test@example.com');
    cy.visit('/professional-journey');
    cy.disableChatMode();
  });

  it('completes full node addition via manual form', () => {
    // 1. Click plus button
    cy.get('[data-testid="timeline-edge"]').first().trigger('mouseover');
    cy.get('[data-testid="edge-plus-button"]').click();

    // 2. Verify modal opens
    cy.get('[data-testid="add-node-modal"]').should('be.visible');

    // 3. Select node type
    cy.get('[data-testid="node-type-selector"]').select('workExperience');

    // 4. Fill form
    cy.get('[data-testid="form-title"]').type('Senior Developer');
    cy.get('[data-testid="form-company"]').type('Facebook');
    cy.get('[data-testid="form-start-date"]').type('2022-03');
    cy.get('[data-testid="form-end-date"]').type('2024-01');

    // 5. Submit form
    cy.get('[data-testid="submit-button"]').click();

    // 6. Verify node creation
    cy.get('[data-testid="timeline-node"]').should(
      'contain',
      'Senior Developer'
    );
    cy.get('[data-testid="timeline-node"]').should(
      'have.css',
      'background-color',
      'rgb(34, 197, 94)'
    ); // Green for completed
  });
});
```

### 3. Edge Cases and Error Handling

**File**: `cypress/e2e/edge-cases.cy.ts`

```javascript
describe('Edge Cases and Error Handling', () => {
  it('handles network failures gracefully', () => {
    // Test offline scenarios
  });

  it('handles API timeouts', () => {
    // Test slow API responses
  });

  it('prevents duplicate node creation', () => {
    // Test rapid clicking prevention
  });

  it('maintains timeline state during errors', () => {
    // Test state preservation during failures
  });
});
```

## Performance Tests

### 1. Edge Interaction Performance

```javascript
describe('Performance Tests', () => {
  it('hover response time under 100ms', () => {
    // Measure hover state activation time
  });

  it('modal opening time under 500ms', () => {
    // Measure modal rendering time
  });

  it('handles 50+ nodes without performance degradation', () => {
    // Test large timeline performance
  });
});
```

### 2. Memory Usage Tests

```javascript
describe('Memory Usage', () => {
  it('prevents memory leaks from hover states', () => {
    // Test cleanup of event listeners
  });

  it('efficiently handles multiple edge interactions', () => {
    // Test memory usage during extensive interactions
  });
});
```

## Accessibility Tests

### 1. Keyboard Navigation

```javascript
describe('Keyboard Accessibility', () => {
  it('supports tab navigation to plus buttons', () => {
    // Test keyboard focus management
  });

  it('supports Enter key activation', () => {
    // Test keyboard activation
  });

  it('maintains focus during modal operations', () => {
    // Test focus management
  });
});
```

### 2. Screen Reader Compatibility

```javascript
describe('Screen Reader Support', () => {
  it('provides appropriate ARIA labels', () => {
    // Test ARIA attributes
  });

  it('announces state changes correctly', () => {
    // Test screen reader announcements
  });
});
```

## Test Execution Strategy

### Continuous Integration

- Unit tests run on every commit
- Integration tests run on PR creation
- E2E tests run on staging deployment
- Performance tests run weekly

### Test Data Management

- Automated test data setup and teardown
- Isolated test environments
- Mock API responses for consistent testing

### Coverage Requirements

- Unit test coverage: >90%
- Integration test coverage: >80%
- Critical path E2E coverage: 100%

## Monitoring and Alerting

### Production Monitoring

- Plus button click rate tracking
- Node creation success/failure rates
- Performance metrics for timeline interactions
- Error rate monitoring for API calls

### User Experience Metrics

- Time to complete node addition
- User preference distribution (chat vs manual)
- Abandonment rate during node creation flow

## Test Maintenance

### Regular Updates

- Update tests when API contracts change
- Refresh test data quarterly
- Review and update performance benchmarks
- Maintain browser compatibility matrix

### Documentation

- Keep test documentation current with features
- Document known issues and workarounds
- Maintain troubleshooting guides for test failures
