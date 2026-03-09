# WDD-CONSOLE-016 — Test Specification

## Component: Project Setup Page

### ProjectSetup.test.tsx (7 tests)

| # | Test | Type | Description |
|---|------|------|-------------|
| 1 | renders all form fields | Unit | Verifies all five form inputs and submit button render |
| 2 | has correct default values | Unit | Provider defaults to "anthropic", API key env var to "LLM_API_KEY" |
| 3 | submits form with correct body | Integration | Verifies fetch called with POST, correct JSON body including parsed kit configs |
| 4 | redirects to first kit flow on success | Integration | On 200 with kitConfigs, window.location.href set to /flow/{kitId} |
| 5 | shows error on failed initialization | Integration | On non-ok response, displays error message from response body |
| 6 | handles already-initialized project (409) | Integration | On 409, displays "Project is already initialized." |
| 7 | shows network error on fetch failure | Integration | On fetch rejection, displays network error message |

### ProjectOverview.test.tsx (4 tests)

| # | Test | Type | Description |
|---|------|------|-------------|
| 1 | renders the project ID | Unit | Displays projectId from state prop |
| 2 | shows kit configs with links | Unit | Each kit renders as link to /flow/{kitId} |
| 3 | shows LLM configurations | Unit | Displays provider, model, and env var for each LLM config |
| 4 | shows message when no kits configured | Unit | Displays "No kits configured." when kitConfigs is empty |

### Test Infrastructure

- Framework: Vitest + React Testing Library + jsdom
- Mocking: `vi.stubGlobal('fetch', ...)` for API calls; `window.location` stubbed for redirect tests
- Cleanup: Explicit `cleanup()` in `afterEach` to prevent DOM leakage between tests
