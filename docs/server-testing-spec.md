# Server Automated Testing Spec

## Purpose
Strengthen automated API coverage for `@server` by introducing contract-driven tests, reliable database isolation, and dependency-injection smoke checks. The goal is to reduce production regressions, catch breaking schema changes early, and make local/CI suites faster and more deterministic.

## Scope
- Express REST APIs exposed under `/api/**`
- Vitest-based integration suites in `packages/server/tests/**`
- Awilix container configuration and service-layer dependencies
- Out of scope: data model migrations and non-HTTP batch jobs

## Goals & Success Criteria
- **Contract Confidence:** CI fails within minutes when an endpoint diverges from `openapi-schema.yaml`.
- **Deterministic Runs:** API suites run in parallel without cross-test pollution (<5% flake rate).
- **Wiring Assurance:** Breaking container registrations are caught by tests before merge.
- **Time to Feedback:** Keep the full API suite under 8 minutes in CI even after new checks.

## Current Pain Points
- Tests rely on long-lived seeded users (`tests/helpers/auth.helper.ts`) which cause side effects across suites.
- Hand-authored endpoint specs (`tests/api/*.test.ts`) are hard to keep in sync with the OpenAPI contract.
- Container misconfigurations (e.g., missing Awilix bindings) slip through until runtime.
- LLM and embedding services are mocked, but failure-path behaviours are not asserted.

## Proposed Initiatives

### 1. Schemathesis Contract Testing
- **Implementation**
  - Add `schemathesis` to dev dependencies and pin in a Docker image invoked via `pnpm test:contract`.
  - Generate a temporary Postman-like env that points at `http://localhost:5004` (reusing `npm run test:server`).
  - Maintain a curated allowlist of endpoints to exclude (e.g., destructive admin routes) under `tests/contract/exclusions.yaml`.
  - Store schema snapshot under version control; gate PRs on `schemathesis run` with `--checks all`.
- **Output**
  - Contract suite artifacts in `packages/server/tests/contract/`.
  - GitHub workflow step that boots API, runs contract tests, uploads failure report.
- **Risks / Mitigation**
  - *Risk:* Randomized data may create false negatives when responses depend on DB state.
  - *Mitigation:* Seed deterministic fixtures for contract runs and add explicit examples where necessary via `--examples`.

### 2. Transactional Test Harness
- **Implementation**
  - Create a Vitest setup module that wraps each `describe` in a DB transaction using `TransactionManager`.
  - Expose helper `withIsolatedDb(testFn)` that begins a transaction before the test and rolls back in `afterEach`.
  - Migrate high-churn suites (`tests/api/auth.test.ts`, `experience-matches.test.ts`, etc.) to use the helper.
  - Provide factory helpers (user/org/timeline node) that operate within the transaction and respect type safety.
- **Output**
  - New utilities under `packages/server/tests/utils/db.ts`.
  - Updated suites demonstrating isolation; documentation in `docs/TESTING.md`.
- **Risks / Mitigation**
  - *Risk:* Long tests could exceed transaction timeouts.
  - *Mitigation:* Allow opt-out per suite; add fail-fast logging when rollbacks exceed threshold.

### 3. Awilix Container Smoke Tests
- **Implementation**
  - Add a test file `src/core/__tests__/container-smoke.test.ts` that iterates the token map in `CONTAINER_TOKENS`.
  - For each control plane (services, controllers), attempt to resolve from a fresh container configured with mocked infrastructure (mock Pg pool, OpenAI provider).
  - Assert that resolution throws descriptive errors if bindings or constructor parameters change.
- **Output**
  - Lightweight smoke test that runs in <1s and guards against missing registrations.
- **Risks / Mitigation**
  - *Risk:* Changes to constructor signatures will require updating the mocks.
  - *Mitigation:* Centralize mock implementations so adjustments are quick and obvious.

### 4. LLM Service Resiliency Tests
- **Implementation**
  - Extend `tests/setup/openai-mocks.ts` to offer failure scenarios (timeouts, bad payloads).
  - Add targeted tests in `services/__tests__` ensuring services log and fall back gracefully.
- **Value**
  - Ensures AI-backed features degrade predictably without blocking API responses.

## Roadmap & Milestones
1. **Week 1**
   - Prototype transactional harness on one suite; measure runtime deltas.
   - Draft GitHub Action job for Schemathesis (dry run, non-blocking).
2. **Week 2**
   - Roll out harness across remaining API suites.
   - Land container smoke test with mocked dependencies.
3. **Week 3**
   - Make Schemathesis job required; add documentation & troubleshooting guide.
   - Add LLM resiliency cases and update release checklist to include contract suite.

## Dependencies & Tooling
- PostgreSQL test database available via `docker-compose.test.yml`.
- Ability to run `npm run test:server` headlessly in CI.
- Additional dev dependency: `schemathesis` (Python).
- Optional: Docker image to encapsulate Schemathesis runtime for consistency.

## Open Questions
- Should destructive endpoints (delete user/node) run against ephemeral DB snapshots instead of shared instance?
- Are there endpoints missing from `openapi-schema.yaml` that must be documented before contract testing?
- Do we want to publish Schemathesis reports (HTML) as CI artifacts for triage?

## Acceptance Criteria
- Contract suite integrated into CI and green on baseline.
- All API integration tests pass when run in parallel (no manual DB cleanup required).
- Container smoke test fails when a required binding is removed.
- Documented playbook in `docs/TESTING.md` explaining how to run new suites locally.
