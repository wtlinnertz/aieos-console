### WDD-CONSOLE-013 — Step Views (Generation, Validation, Freeze)

#### WDD Work Item

- **WDD Item ID:** WDD-CONSOLE-013
- **Parent TDD Section:** §4.7 UI Layer (StepView, GenerationStream, ValidationResultView)
- **Assignee Type:** AI Agent
- **Required Capabilities:** frontend
- **Complexity Estimate:** L

**Intent:** Implement the step detail views for LLM-generated and acceptance-check step types, including generation streaming, validation result display, and freeze approval.

**In Scope:**
- `StepView` component: renders appropriate view based on `stepType`
- `GenerationStream` component: connects to SSE endpoint; renders chunks progressively; loading/error/completion states
- `ValidationResultView` component: renders PASS/FAIL, hard gates table, blocking issues, warnings, completeness score
- Freeze approval UI: button with artifact ID input
- `ProcessTransparency` component: displays spec/template/prompt/validator file paths and required_inputs paths
- Component tests

**Out of Scope:**
- Human-intake form views (014)
- Artifact viewer/editor (015)
- Navigation between steps (012)

**Inputs:** TDD §4.7 StepView, GenerationStream, ValidationResultView, ProcessTransparency specs, API routes (010)

**Outputs:** StepView, GenerationStream, ValidationResultView, ProcessTransparency components, component tests

**Acceptance Criteria:**
- AC1: Given `llm-generated` step in `in-progress`, user clicks "Generate" → GenerationStream connects to SSE and renders chunks as they arrive
- AC2: Given validation result FAIL, ValidationResultView shows FAIL status, blocking issues with gate names, completeness score
- AC3: Given `validated-pass` step, user enters artifact ID and clicks "Freeze" → freeze API called, step transitions to frozen
- AC4: Given any step, ProcessTransparency displays file paths for spec, template, prompt, validator, and required_inputs
- AC5: Given SSE error event, GenerationStream displays error message and retry button

**Definition of Done:**
- [ ] PR merged
- [ ] Component tests passing
- [ ] SSE streaming tested with mock EventSource
- [ ] Validation result rendering tested for PASS and FAIL
- [ ] Process transparency displays file paths

**Interface Contract References:** TDD §4.6 `GET .../generate` (SSE), `POST .../validate`, `POST .../freeze` — **consumer**

**Dependencies:** WDD-CONSOLE-010 (API Routes), WDD-CONSOLE-011 (Content Sanitization)

**Rollback:** UI components are stateless. Revert PR.

#### TDD Sections

**Technical Context:**

TDD §4.7 UI Layer — StepView, GenerationStream, ValidationResultView, ProcessTransparency:

```
StepView — Renders current step based on stepType:
  - human-intake: guided form
  - llm-generated: "Generate" button, streams output, shows rendered artifact
  - acceptance-check: source artifact and PASS/FAIL
  - consistency-check: comparison view and PASS/FAIL

GenerationStream — Connects to SSE endpoint. Renders LLM output progressively. Shows loading/error/completion states.

ValidationResultView — Renders validation result: PASS/FAIL status, hard gates table, blocking issues, warnings, completeness score.

ProcessTransparency — Displays which files are used: spec path, template path, prompt path, validator path, required_inputs paths. Satisfies PRD C-1.
```

**Testing Strategy:**

TDD §8 — Component test expectations:

- "StepView: Renders correct view for each step type"
- "GenerationStream: Shows loading state; renders chunks progressively; handles error state; shows completion state"
- "ValidationResultView: Renders PASS/FAIL; displays gate details, blocking issues, warnings"
- "ProcessTransparency: Displays correct file paths for current step"

**Interface Contracts:**

TDD §4.6 — API routes consumed by these components:

- `GET /api/flow/:kitId/step/:stepId/generate` — SSE stream of LLM generation chunks
- `POST /api/flow/:kitId/step/:stepId/validate` — triggers validation, returns validation result JSON
- `POST /api/flow/:kitId/step/:stepId/freeze` — freezes artifact with provided artifact ID

#### ACF Sections

**Security and Compliance:**

ACF §3 Security Guardrails:
- LLM response handling — all LLM-generated content must be sanitized for XSS before rendering in the browser. GenerationStream and ValidationResultView must use sanitized output.

ACF §8 Forbidden Patterns:
- Automatic step completion without user awareness — the user must explicitly initiate each action (generate, validate, freeze). No step may auto-advance or auto-complete without explicit user interaction.

#### DCF Sections

**Testing Expectations:**

DCF §6 Testing Expectations:
- Component tests with React Testing Library for all four components (StepView, GenerationStream, ValidationResultView, ProcessTransparency)
- SSE streaming tested with mock EventSource
- Validation result rendering tested for both PASS and FAIL outcomes
- Process transparency file path display tested against expected paths
