# WDD-CONSOLE-013 — Test Specification

## Component: Step Views (Generation, Validation, Freeze)

### StepView.test.tsx (7 tests)

| # | Test | Type | Description |
|---|------|------|-------------|
| 1 | renders generate button for llm-generated in-progress step | Unit | Verifies Generate button appears when stepType is llm-generated and status is in-progress |
| 2 | renders validate button for draft step | Unit | Verifies Validate button appears when status is draft |
| 3 | shows freeze UI for validated-pass step | Unit | Verifies freeze section with artifact ID input and Freeze button renders |
| 4 | shows frozen badge for frozen step | Unit | Verifies Frozen badge displays and action buttons are absent |
| 5 | shows GenerationStream when generate button is clicked | Unit | Clicking Generate renders the GenerationStream component |
| 6 | shows "Use Intake Form" for human-intake step type | Unit | Verifies human-intake view renders placeholder message |
| 7 | shows acceptance-check view with validate button | Unit | Verifies acceptance-check view renders with validate button |

### GenerationStream.test.tsx (5 tests)

| # | Test | Type | Description |
|---|------|------|-------------|
| 1 | shows loading state initially | Unit | Verifies "Connecting to generation stream..." message on mount |
| 2 | renders content chunks progressively | Unit | Simulates two chunk events; verifies content accumulates |
| 3 | shows error message on error event | Unit | Simulates error event from SSE; verifies error text and retry button |
| 4 | shows completion state when done | Unit | Simulates done event; verifies "Generation complete" and onComplete callback |
| 5 | shows error on EventSource connection error | Unit | Simulates onerror; verifies "Connection lost" message |

### ValidationResultView.test.tsx (5 tests)

| # | Test | Type | Description |
|---|------|------|-------------|
| 1 | renders PASS status | Unit | Verifies PASS badge and summary text render |
| 2 | renders FAIL with blocking issues | Unit | Verifies FAIL badge and blocking issues list with gate names |
| 3 | shows completeness score | Unit | Verifies score displayed as "72/100" |
| 4 | displays hard gates table | Unit | Verifies gate rows with PASS/FAIL results for each gate |
| 5 | displays warnings when present | Unit | Verifies warnings section renders warning descriptions |

### ProcessTransparency.test.tsx (4 tests)

| # | Test | Type | Description |
|---|------|------|-------------|
| 1 | shows file paths when expanded | Unit | Expands section and verifies spec, template, prompt, validator paths |
| 2 | shows N/A for null prompt | Unit | Verifies "N/A" when fourFiles.prompt is null |
| 3 | shows required inputs when present | Unit | Verifies required input paths and roles render |
| 4 | is collapsed by default | Unit | Verifies details hidden and toggle shows "Show Process Details" |

### Test Infrastructure

- Framework: Vitest + React Testing Library + jsdom
- Mocking: MockEventSource class with simulateMessage/simulateError for SSE tests; vi.mock for GenerationStream in StepView tests
- Cleanup: Explicit `cleanup()` in `afterEach` to prevent DOM leakage between tests
