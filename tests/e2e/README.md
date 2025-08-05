# Enhanced Timeline Modal System - E2E Tests

This directory contains comprehensive Playwright E2E tests for the Enhanced Timeline Interactions modal system. The tests are designed to validate both current functionality and prepare for future multi-step modal implementation.

## Test Structure

### Current Implementation Tests
These tests validate existing functionality and prevent regressions:

- **`enhanced-timeline-modal.spec.ts`** - Main test suite covering all current modal functionality
- **`plus-button-interactions.spec.ts`** - Focused tests for plus button hover/click behavior  
- **`api-integration.spec.ts`** - API endpoint testing and error handling

### Future Implementation Tests  
These tests are designed to **FAIL initially** and pass once new features are implemented:

- **`multi-step-modal-future.spec.ts`** - Tests for the upcoming multi-step modal with visual type selection

## Test Coverage

### ✅ Current Functionality (Should Pass)

#### Plus Button Interactions
- [x] Plus buttons appear on timeline edge hover
- [x] Plus buttons trigger modal opening
- [x] Plus buttons have proper positioning and styling
- [x] Plus buttons support both timeline and branch edges
- [x] Plus buttons have accessibility attributes

#### Modal Behavior
- [x] AddNodeModal opens with type selection dropdown
- [x] Modal displays context information
- [x] Modal can be closed via cancel button or outside click
- [x] Modal prevents multiple simultaneous openings

#### Form Validation
- [x] Work Experience form validation (title, company, start date required)
- [x] Education form validation (school, degree, field, start date required)
- [x] Project form validation (title required)
- [x] Skill form validation (name, proficiency required)
- [x] Date format validation (YYYY-MM pattern)
- [x] Date logic validation (end date after start date)
- [x] Ongoing checkbox disables end date field

#### API Integration
- [x] Form submission calls `/api/save-milestone` endpoint
- [x] Request includes correct milestone data structure
- [x] Request includes context information
- [x] Authentication cookies are included
- [x] Content-Type headers are set correctly
- [x] Error responses are handled gracefully
- [x] Retry functionality works correctly
- [x] Modal closes on successful submission
- [x] Timeline data refreshes after successful submission

#### Accessibility
- [x] Modal has proper ARIA attributes
- [x] Form elements have associated labels
- [x] Error messages are announced to screen readers
- [x] Keyboard navigation works correctly

#### Responsive Design
- [x] Modal works on mobile devices
- [x] Plus buttons have appropriate touch targets
- [x] Form layouts adapt to smaller screens

### ❌ Future Requirements (Will Fail Until Implemented)

#### Multi-Step Modal Flow
- [ ] Step 1: Visual type selection grid (3x2 cards)
- [ ] Step 2: Dynamic form based on selected type
- [ ] Step navigation (back/next buttons)
- [ ] Step progress indicator
- [ ] Form state preservation between steps

#### 6 Node Types with Visual Cards
- [ ] Education card (blue) with icon and description
- [ ] Job card (green) with icon and description  
- [ ] Job Transition card (orange) with icon and description
- [ ] Project card (purple) with icon and description
- [ ] Event card (orange) with icon and description
- [ ] Action card (pink) with icon and description

#### New Node Type Support
- [ ] Job Transition form fields and validation
- [ ] Event form fields and validation
- [ ] Action form fields and validation
- [ ] API support for new node types

#### Enhanced Interactions
- [ ] Type card hover effects
- [ ] Single selection for type cards
- [ ] Selection state indicators
- [ ] Keyboard navigation for type selection

## Running Tests

### Prerequisites
```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install
```

### Test Commands
```bash
# Run all E2E tests
npm run test:e2e

# Run tests in headed mode (visible browser)
npm run test:e2e:headed

# Run tests in debug mode
npm run test:e2e:debug

# Open Playwright UI for interactive testing
npm run test:e2e:ui

# View test reports
npm run test:e2e:report
```

### Running Specific Test Files
```bash
# Run only current functionality tests
npx playwright test enhanced-timeline-modal.spec.ts plus-button-interactions.spec.ts api-integration.spec.ts

# Run only future requirement tests (these will fail)
npx playwright test multi-step-modal-future.spec.ts

# Run specific test by name
npx playwright test -g "should open AddNodeModal when plus button is clicked"
```

## Test Environment

### Test Server
Tests are configured to run against the development server:
- **Base URL**: `http://localhost:5173`
- **Auto-start**: Server starts automatically via `webServer` config
- **Test Data**: Uses mock API responses for predictable testing

### Browser Coverage
Tests run against multiple browsers:
- Chromium (Desktop)
- Firefox (Desktop)  
- WebKit/Safari (Desktop)
- Mobile Chrome (Pixel 5)
- Mobile Safari (iPhone 12)

## Test Data and Mocking

### API Mocking
Tests use Playwright's `page.route()` to mock API responses:

```typescript
// Mock successful response
await page.route('/api/save-milestone', route => {
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, id: 'milestone-123' })
  });
});

// Mock error response
await page.route('/api/save-milestone', route => {
  route.fulfill({
    status: 500,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'Server error' })
  });
});
```

### Test Data Factories
Use the test utilities to create consistent test data:

```typescript
import { TestData } from './helpers/test-utils';

const workExperience = TestData.workExperience({
  title: 'Senior Developer',
  company: 'Custom Company'
});
```

## Debugging Tests

### Visual Debugging
```bash
# Run with visible browser
npm run test:e2e:headed

# Run with debug mode (pauses execution)
npm run test:e2e:debug

# Use UI mode for interactive debugging
npm run test:e2e:ui
```

### Screenshots and Videos
- Screenshots are captured on test failures
- Videos are recorded for failed tests
- Traces are captured on retry attempts
- All artifacts are stored in `test-results/`

### Console Logging
Tests monitor console errors and filter out known acceptable ones:
- ResizeObserver warnings (acceptable)
- Non-passive event listener warnings (acceptable)
- Favicon 404s (acceptable)

## Adding New Tests

### Test File Structure
```typescript
import { test, expect } from '@playwright/test';
import { openModal, selectNodeType, TestData } from './helpers/test-utils';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/professional-journey');
    await page.waitForSelector('[data-testid="journey-timeline"]');
  });

  test('should do something', async ({ page }) => {
    // Test implementation
  });
});
```

### Best Practices
1. **Use data-testid selectors** for reliable element selection
2. **Wait for elements to be visible** before interacting
3. **Mock API responses** for predictable testing  
4. **Use helper functions** to reduce code duplication
5. **Test edge cases** and error conditions
6. **Follow AAA pattern** (Arrange, Act, Assert)

### Future Test Implementation
When implementing new features, convert the failing tests:

1. Remove `test.skip(true, 'Will pass when...')` 
2. Update selectors to match actual implementation
3. Verify test passes with new functionality
4. Add any additional edge cases discovered

## Continuous Integration

Tests are configured to run in CI environments:
- Parallel execution disabled in CI for stability
- Retries enabled for flaky test handling  
- HTML reports generated for test results
- Browser installation handled automatically

## Troubleshooting

### Common Issues

**Timeline not loading**: Increase timeout for `journey-timeline` selector
```typescript
await page.waitForSelector('[data-testid="journey-timeline"]', { timeout: 15000 });
```

**Plus buttons not appearing**: Ensure proper hover and timing
```typescript
await edges.first().hover();
await expect(plusButton).toBeVisible({ timeout: 5000 });
```

**Modal not opening**: Check for JavaScript errors in console
```typescript
const errors = await checkForConsoleErrors(page);
expect(errors).toHaveLength(0);
```

**API tests failing**: Verify request/response structure matches actual API
```typescript
const requestBody = request.postDataJSON();
console.log('Actual request body:', requestBody);
```

### Performance Issues
If tests are slow or timing out:
1. Increase timeouts for slow operations
2. Reduce animation delays in test environment
3. Use `page.waitForLoadState('networkidle')` for complex pages
4. Mock heavy API endpoints

## Future Enhancements

As the modal system evolves, consider adding:
1. **Visual regression tests** using screenshot comparison
2. **Performance tests** measuring modal open/close times
3. **Cross-browser compatibility tests** for edge cases
4. **Accessibility tests** using axe-core integration
5. **Mobile-specific gesture tests** for touch interactions