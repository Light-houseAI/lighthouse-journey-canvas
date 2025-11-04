# Test Coverage Analysis - LIG-223

## Current State

- **Total Tests:** 620 passing
- **Coverage:** 39.92% statements (Target: 80%)
- **Component Files:** 62 total, 31 tested (50%)
- **Hook Files:** 11 tested (good coverage)

## ✅ What's Working

1. **No MSW in Tests** - All tests properly mock at API service level
2. **Hook Tests Are Good** - Test real logic, mock external APIs only
3. **New Tests Added:**
   - SearchStates (100% coverage)
   - MaterialsSummaryCard (100% coverage)
   - NetworkingStep (comprehensive)
   - 11 hook test files

## ❌ Problems Found

### 1. Heavy Internal Mocking (9 Tests Contributing ~0% Coverage)

These tests mock internal components/hooks, preventing coverage:

**High Priority - Refactor These:**

- `src/components/nodes/career-transition/wizard/CareerUpdateWizard.test.tsx`
  - Mocks: useApplicationMaterials, useCareerTransitionNode, hierarchy-api
  - Issue: Tests wizard orchestration but mocks all child components

- `src/components/nodes/shared/InsightForm.test.tsx`
  - Mocks: useNodeInsights hook
  - Issue: Mocks the main logic it should be testing

- `src/components/nodes/shared/InsightCard.test.tsx`
  - Mocks: useNodeInsights hook
  - Issue: Mocks deletion logic

- `src/components/ui/user-menu.test.tsx`
  - Mocks: wouter, useAuth, use-toast
  - Issue: Mocks routing and auth logic

**Medium Priority:**

- `src/components/modals/MultiStepAddNodeModal.test.tsx`
- `src/components/share/ShareButton.test.tsx`
- `src/components/share/NetworksAccessSection.test.tsx`
- `src/components/share/PeopleAccessSection.test.tsx`
- `src/components/file-upload/__tests__/file-drop-zone.test.tsx`

### 2. Missing Tests (31 Components, 50%)

**High Impact Components (User-Facing):**

- `src/components/nodes/career-transition/wizard/steps/ActivitySelectionStep.tsx` ⚠️ CRITICAL
- `src/components/nodes/career-transition/wizard/steps/ApplicationMaterialsModal.tsx`
- `src/components/nodes/career-transition/wizard/steps/ApplicationMaterialsStep.tsx`
- `src/components/nodes/career-transition/wizard/steps/ResumeModal.tsx`
- `src/components/nodes/career-transition/wizard/steps/ApplicationModal.tsx`
- `src/components/search/page/ProfileView.tsx`
- `src/components/timeline/ProfileListView.tsx`
- `src/components/timeline/ExperienceMatchesModal.tsx`

**Modal/Router Components:**

- `src/components/modals/NodeModalRouter.tsx`
- `src/components/modals/NodeTypeSelector.tsx`

**Profile Components:**

- `src/components/user/UserProfileCard.tsx`
- `src/components/profile/ProfileHeader.tsx`

**Layout/Infrastructure:**

- `src/components/journey/JourneyHeader.tsx`
- `src/components/search/HeaderSearchInput.tsx`
- `src/components/AuthenticatedApp.tsx`
- `src/components/UnauthenticatedApp.tsx`

**Utility Components (Lower Priority):**

- `src/components/ui/toaster.tsx`
- `src/components/icons/NodeIcons.tsx`
- `src/components/errors/ErrorFallbacks.tsx`
- `src/components/errors/GlobalErrorBoundary.tsx`
- `src/components/errors/SectionErrorBoundary.tsx`

## 📋 Recommendations

### Phase 1: Fix High-Priority Internal Mocking (Target: +10-15% coverage)

**CareerUpdateWizard.test.tsx** - Refactor to integration-style test:

```typescript
// BAD (current)
vi.mock('../../../../hooks/use-application-materials');

// GOOD (refactor to)
// Don't mock hooks, test real wizard flow
// Mock only external APIs (hierarchy-api, updates-api)
```

**InsightForm.test.tsx & InsightCard.test.tsx** - Remove hook mocking:

```typescript
// BAD (current)
vi.mock('../../../hooks/useNodeInsights');

// GOOD (refactor to)
// Test real form submission/deletion logic
// Mock only the API layer
```

**user-menu.test.tsx** - Test real behavior:

```typescript
// BAD (current)
vi.mock('../../hooks/useAuth');

// GOOD (refactor to)
// Provide real QueryClient with mock data
// Test actual menu interactions
```

### Phase 2: Add Critical Missing Tests (Target: +15-20% coverage)

**Priority 1 - User Interactions (Career Wizard Steps):**

1. ActivitySelectionStep.test.tsx - Just modified, needs tests!
2. ApplicationMaterialsModal.test.tsx
3. ApplicationMaterialsStep.test.tsx
4. ResumeModal.test.tsx
5. ApplicationModal.test.tsx

**Priority 2 - Search & Timeline:** 6. ProfileView.test.tsx 7. ProfileListView.test.tsx 8. ExperienceMatchesModal.test.tsx 9. HeaderSearchInput.test.tsx

**Priority 3 - Core Navigation:** 10. NodeModalRouter.test.tsx 11. NodeTypeSelector.test.tsx

### Phase 3: Add Lower Priority Tests (Target: +5-10% coverage)

12. UserProfileCard.test.tsx
13. ProfileHeader.test.tsx
14. JourneyHeader.test.tsx
15. Error boundary components

## 🎯 Action Plan to Reach 80% Coverage

### Week 1: Fix Internal Mocking (Days 1-2)

- [ ] Refactor CareerUpdateWizard.test.tsx
- [ ] Refactor InsightForm.test.tsx & InsightCard.test.tsx
- [ ] Refactor user-menu.test.tsx
- [ ] Run coverage: Target 50%

### Week 2: Career Wizard Tests (Days 3-5)

- [ ] ActivitySelectionStep.test.tsx
- [ ] ApplicationMaterialsModal.test.tsx
- [ ] ApplicationMaterialsStep.test.tsx
- [ ] ResumeModal.test.tsx
- [ ] ApplicationModal.test.tsx
- [ ] Run coverage: Target 65%

### Week 3: Search & Timeline (Days 6-7)

- [ ] ProfileView.test.tsx
- [ ] ProfileListView.test.tsx
- [ ] ExperienceMatchesModal.test.tsx
- [ ] HeaderSearchInput.test.tsx
- [ ] Run coverage: Target 75%

### Week 4: Remaining Components (Days 8-9)

- [ ] NodeModalRouter.test.tsx
- [ ] Core profile/header components
- [ ] Run coverage: Target 80%+

## 🔍 Test Quality Checklist

For each test file, ensure:

- ✅ Mock only external APIs (not internal components/hooks)
- ✅ Test user interactions (clicks, typing, form submission)
- ✅ Test conditional rendering (error states, loading states)
- ✅ Test edge cases (empty data, invalid input)
- ✅ Avoid "it renders" tests - test behavior!

## 📊 Expected Coverage Impact

| Phase   | Action                 | Coverage Gain | Target |
| ------- | ---------------------- | ------------- | ------ |
| Current | Baseline               | -             | 39.92% |
| Phase 1 | Fix internal mocking   | +10-15%       | ~50%   |
| Phase 2 | Critical missing tests | +15-20%       | ~70%   |
| Phase 3 | Remaining tests        | +10%          | 80%+   |

## 🚨 Critical Issues to Address

1. **ActivitySelectionStep.tsx** - Just modified but no test coverage!
2. **CareerUpdateWizard** - Heavy mocking prevents testing actual wizard logic
3. **50% of components untested** - Major gap in coverage

## 💡 Quick Wins (High Impact, Low Effort)

Start with these for fastest coverage gains:

1. **ActivitySelectionStep.test.tsx** (NEW, high priority)
2. **Refactor InsightForm/InsightCard tests** (remove hook mocking)
3. **Add ProfileView.test.tsx** (search feature)
4. **Add HeaderSearchInput.test.tsx** (user-facing)
