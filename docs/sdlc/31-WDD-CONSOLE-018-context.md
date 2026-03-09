### WDD-CONSOLE-018 — E2E Tests

#### WDD Work Item

- **WDD Item ID:** WDD-CONSOLE-018
- **Parent TDD Section:** §8 Testing Strategy (E2E tests)
- **Assignee Type:** AI Agent
- **Required Capabilities:** testing, frontend, backend
- **Complexity Estimate:** L

**Intent:** Implement Playwright end-to-end tests covering critical user flows: project initialization, artifact generation through freeze, wizard navigation, error handling, and content editing.

**In Scope:**
- Project initialization flow test
- Artifact generation through freeze test
- Wizard navigation across multiple steps test
- Error handling test (simulated LLM provider error)
- Content editing test (edit → re-validation required)
- Test fixtures with sample kit directory containing valid flow.yaml
- Mock LLM provider for deterministic results

**Out of Scope:**
- Performance testing
- Visual regression testing
- Testing against real LLM providers

**Inputs:** TDD §8 E2E test specifications, all components (001-017)

**Outputs:** Playwright test files, test fixtures (sample kit, flow.yaml, mock LLM), CI configuration

**Acceptance Criteria:**
- AC1: Project initialization flow test completes: navigate → configure → initialize → verify state
- AC2: Artifact generation flow test completes: navigate → initiate → generate → review → validate → freeze → verify state
- AC3: Wizard navigation test: step progression works across multiple steps
- AC4: Error handling test: mock LLM error → error displayed → state unchanged → retry works
- AC5: Content editing test: edits saved → state resets to draft → re-validation succeeds

**Definition of Done:**
- [ ] PR merged
- [ ] All Playwright tests passing
- [ ] Test fixtures committed (sample kit, mock LLM)
- [ ] CI configuration included

**Interface Contract References:** None — E2E tests exercise full application stack

**Dependencies:** All prior work items (001-017)

**Rollback:** Tests are non-destructive.

#### TDD Sections

**Technical Context:**

TDD §8 Testing Strategy — E2E Tests (Playwright):

```
End-to-End Tests (Playwright):
- Project initialization flow: Navigate to app → configure project → verify project state created
- Artifact generation through freeze: Navigate to step → initiate → generate → review → validate → freeze → verify state updated and next step available
- Wizard navigation: Complete multiple steps in sequence → verify step progression → verify frozen artifacts accessible
- Error handling: Simulate LLM provider error → verify error message displayed → verify state unchanged → retry succeeds
- Content editing: Generate artifact → edit content → verify state resets to draft → re-validate

Failure Tests:
- LLM provider unavailable: Mock LLM API to return 500 → verify user sees error → verify no state corruption → verify retry works
- Malformed LLM response: Mock LLM API to return non-JSON for validation → verify ValidationResponseParseError handled gracefully
- Filesystem write failure: Mock write to throw → verify no partial state → verify user notification
- Invalid flow definition: Provide malformed YAML → verify parse error surfaced → verify other kits still functional
- Concurrent access: Create lock file with live PID → attempt startup → verify lock refused message

Pass/Fail Criteria:
- All unit tests pass
- All component tests pass
- All E2E tests pass
- TypeScript strict mode: zero errors
- ESLint: zero errors, zero warnings
- Dependency audit: no high or critical CVEs
- Secret scanning: no secrets detected
- SAST: no critical findings
```

**Testing Strategy:**

TDD §8 specifies the complete E2E test matrix above. Tests must exercise the full application stack end-to-end using Playwright. Mock LLM provider ensures deterministic, repeatable results. Failure tests verify graceful degradation across error scenarios.

**Interface Contracts:**

No specific interface contracts — E2E tests exercise the full stack including all API routes, UI components, and backend services as integrated consumers and providers.

#### ACF Sections

**Security and Compliance:**

ACF §3 Security Guardrails:
- All security guardrails are applicable for E2E validation. E2E tests should verify that content sanitization is effective end-to-end, that no XSS vectors survive the rendering pipeline, and that user actions are required for each step transition.

ACF §5 Reliability:
- Graceful degradation — E2E tests must verify that LLM provider failures, filesystem errors, and malformed responses are handled gracefully without state corruption.
- Failure isolation — E2E tests must verify that failures in one kit or step do not cascade to affect other kits or steps.

#### DCF Sections

**Testing Expectations:**

DCF §6 Testing Expectations:
- E2E tests for critical flows covering project initialization, artifact generation through freeze, wizard navigation, error handling, and content editing
- Evidence in machine-readable format (Playwright test reports)
- All E2E tests must pass as part of the overall pass/fail criteria

DCF §5 Operational Expectations:
- Deployment verification — E2E tests serve as deployment verification by exercising the full application stack. Startup log, health check, and flow definition parse results should be validated within the E2E test setup.
