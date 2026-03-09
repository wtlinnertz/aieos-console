# Plan — WDD-CONSOLE-018 (E2E Tests)

## Implementation Plan

### 1. Mock LLM Provider
- Create `src/lib/services/mock-provider.ts` implementing `ILlmProvider`
- `sendRequest` returns validation JSON (PASS result) — used only by `validateArtifact`
- `sendStreamingRequest` yields artifact content chunks — used by `generateArtifact`
- Register in `service-factory.ts` when `LLM_PROVIDER=mock`

### 2. Test Fixtures
- Create `e2e/fixtures/test-kit/` with complete kit structure
- `flow.yaml` with 2 steps: step-prd (no deps) and step-acf (depends on step-prd)
- All four-files (spec, template, prompt, validator) for both steps
- Required input file (brief.md) for step-prd

### 3. Playwright Configuration
- Update `playwright.config.ts` with webServer env vars (PROJECT_DIR, KIT_DIRS, LLM_PROVIDER=mock)
- Serial execution (workers: 1, fullyParallel: false)
- Temp project directory via `os.tmpdir()`

### 4. E2E Test Files
- `e2e/health.spec.ts` — Health check
- `e2e/project-init.spec.ts` — Project initialization flow
- `e2e/flow-lifecycle.spec.ts` — Full artifact lifecycle
- `e2e/content-edit.spec.ts` — Content editing and state reset
- `e2e/error-handling.spec.ts` — Error responses (404, 409)

### 5. State Machine Fix
- Add `'draft'` to valid transitions from `validated-pass` in state-service
- Required for content edit → state reset flow (orchestration service edits reset validated artifacts to draft)

### 6. Webpack Config
- Add `extensionAlias` in `next.config.ts` for `.js` → `.ts` resolution
- Needed because service files use ESM-style `.js` import extensions
