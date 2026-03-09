# Tests — WDD-CONSOLE-018 (E2E Tests)

## Test Strategy

E2E tests exercise the full application stack via Playwright. Tests cover five categories:

1. **Health Check** (1 test) — Verifies health endpoint returns 200 + `{ status: 'ok' }`
2. **Project Initialization** (3 tests) — Init creates state, state is readable, re-init returns 409
3. **Flow Lifecycle** (7 tests) — Full cycle: init → flow status → initiate → generate (SSE) → validate → freeze → status update
4. **Content Editing** (3 tests) — Edit preserves draft state, edit after validation resets to draft
5. **Error Handling** (4 tests) — 404 for unknown kit, 409 for unmet deps, 409 for freeze without validation

## Test Infrastructure

- **Mock LLM Provider**: `MockLlmProvider` implements `ILlmProvider` with deterministic responses
- **Test Fixtures**: Sample kit directory (`e2e/fixtures/test-kit/`) with flow.yaml and four-file content
- **Test Project Dir**: Temp directory cleaned between test suites
- **Serial Execution**: Single worker, tests within each suite run in order (state-dependent)

## Acceptance Tests

- AT-1: Health check returns 200
- AT-2: Project initialization creates valid state.json
- AT-3: Flow status returns correct step count and structure
- AT-4: Full artifact lifecycle (initiate → generate → validate → freeze)
- AT-5: Content editing preserves and resets state correctly

## Failure Tests

- FT-1: Unknown kit returns 404
- FT-2: Initiating step with unmet dependencies returns 409
- FT-3: Freezing non-validated step returns 409

## Edge Cases

- EC-1: SSE stream contains chunk events and done event with artifact content
- EC-2: Re-initialization after init returns 409 (conflict)
- EC-3: Edit after validation resets state from validated-pass to draft

## Total: 18 E2E tests
