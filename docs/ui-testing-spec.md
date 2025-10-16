# UI Automated Testing Spec

## Purpose
Redesign the `@ui` testing strategy around fast, deterministic feedback by doubling down on component/unit coverage and replacing flaky Playwright end-to-end flows with lighter integration checks and guided user journeys.

## Scope
- React front end in `packages/ui`
- Vitest + React Testing Library suites in `src/**/*.test.tsx`
- Current Playwright suites in `tests/e2e` and `tests/e2e-playwright`
- Shared mocks (`src/mocks/**`) and test utilities

## Goals & Success Criteria
- **Developer Speed:** Component/unit suites run in <2 minutes locally with >80% critical-path coverage (stores, hooks, key screens).
- **Deterministic Feedback:** No reliance on `waitForTimeout` or UI-driven account creation; tests wait on observable state.
- **Confidence:** Critical user journeys (auth, profile permissions, timeline CRUD) validated via API-level workflow tests instead of Playwright UI automation.
- **Maintainability:** Testing utilities are centralized; new components require minimal boilerplate to test.

## Current Pain Points
- Playwright specs create users through the UI and sleep for state changes (`tests/e2e/profile-permissions.spec.ts`), causing flakiness and slow builds.
- Component tests duplicate provider bootstrapping to mock stores, router, theme, and MSW in each file (`src/pages/signin.test.tsx`).
- Store “integration” tests re-implement production logic rather than exercise the real store with mocked network responses (`src/stores/auth-store.test.tsx`).
- Verbose logging in `src/test/setup.ts` makes CI noise high and obscures actionable failures.

## Strategy

### 1. Replace Playwright Suites with API-Level Workflow Tests
- Retire UI-driven Playwright specs (`tests/e2e`, `tests/e2e-playwright`) in favour of:
  - API workflow suites in `packages/server/tests/workflows/**` that call REST endpoints in realistic sequences.
  - Lightweight smoke checks using component tests that render key pages with providers and assert navigation + state transitions.
- Create a migration checklist before deleting Playwright files to ensure each user journey keeps coverage (auth, onboarding, profile permissions, timeline editing).
- Document the deprecation plan and point developers to faster alternatives.

### 2. Centralized Render Helper (`renderWithProviders`)
- Build a helper in `src/test/renderWithProviders.tsx` that mounts components with:
  - React Router memory router
  - QueryClientProvider
  - ThemeContext + Chakra/Tailwind wrappers as needed
  - Zustand store preloaded state (via helper that can inject partial slices)
- Update existing specs (`src/pages/signin.test.tsx`, share modal suites, etc.) to consume the helper, reducing repetitive mocks and clarifying intent.
- Export optional overrides so tests can plug in MSW handlers or custom auth states on demand.

### 3. Component Contract Tests via Stories
- Encourage colocating Storybook stories with components and generate tests from them using `@storybook/testing-react`.
- For each critical component (share modals, timeline node editors), add a “contract test” that renders the primary story and asserts key affordances (buttons, validation messages).
- Benefits: shared fixtures between design review and automated tests; reduces divergence between story and test data.

### 4. Enhanced Store & Hook Testing
- Swap manual fetch mocks in `src/stores/auth-store.test.tsx` for MSW handlers defined in `src/mocks/handlers.ts`.
- Add regression tests for:
  - Auth happy path + error branches
  - Permission gating hooks (`useSearchResults`, `useExperienceMatches`)
  - Timeline stores (ensuring optimistic updates roll back correctly)
- Introduce typed factory functions in `src/test/factories.ts` to generate user/timeline/update data that matches schema defaults.

### 5. Test Setup Streamlining
- Gate verbose logging in `src/test/setup.ts` behind `process.env.DEBUG_TESTS === 'true'`.
- Move mock observers (`IntersectionObserver`, `ResizeObserver`) and `matchMedia` into a single exported function to avoid patch collisions.
- Document how to add new global mocks and when to use timers vs. fake timers.

## Implementation Blueprint
1. **Week 1**
   - Build `renderWithProviders` + state factory helpers.
   - Update 3–5 representative tests to validate ergonomics; measure runtime improvements.
2. **Week 2**
   - Introduce MSW-backed store/hook suites; replace manual fetch mocks.
   - Add DEBUG flag for test logging and clean up `setup.ts`.
3. **Week 3**
   - Map every Playwright journey to either component + workflow coverage; confirm gaps are filled.
   - Remove Playwright configs and workflows after migration checklist passes; update CI configuration accordingly.
4. **Week 4**
   - Integrate Storybook contract tests for high-traffic components.
   - Document testing guidelines in `docs/TESTING_UI.md`.

## Risks & Mitigations
- **Coverage Gap During Migration:** Freeze Playwright removal until replacement suites land; run both in CI temporarily.
- **Developer Adoption:** Provide lint rule or generator template that scaffolds new component tests with providers.
- **Storybook Dependency:** Ensure Storybook build stays green; run contract tests in parallel with storybook build to catch drift early.

## Measuring Success
- CI pipeline drop of X minutes from removing Playwright jobs.
- Increase in component/unit test count with corresponding coverage metrics (tracked via existing Vitest V8 reports).
- Reduced flaky test incidents (trackable via CI flake issue tag).

## Open Questions
- Do we need a minimal smoke test (Happy path login) using Playwright or Cypress to ensure the bundle boots, or is API + component coverage sufficient?
- Should workflow tests live in `@server` or a shared package to emphasize end-to-end scope?
- Can we leverage visual regression tooling (Chromatic) once stories become canonical?
