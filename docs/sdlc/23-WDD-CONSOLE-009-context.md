### WDD-CONSOLE-009 — Orchestration Service

#### WDD Work Item

- **WDD Item ID:** WDD-CONSOLE-009
- **Parent TDD Section:** §4.5 Orchestration Service
- **Assignee Type:** AI Agent
- **Required Capabilities:** backend, API-design
- **Complexity Estimate:** L

**Intent:** Implement the Orchestration Service that executes flows from kit-provided flow definitions, manages step progression, and coordinates generation, validation, and freeze operations.

**In Scope:**
- `IOrchestrationService` TypeScript interface
- `FlowStatus`, `StepStatus`, `StepContext`, `GenerationEvent` types
- `getFlowStatus`: merge flow definition with artifact states to produce per-step status
- `initiateStep`: validate dependencies met; transition to in-progress; assemble inputs
- `generateArtifact`: resolve LLM config; stream generation; persist draft
- `validateArtifact`: assemble validator inputs; call LLM; record result
- `freezeArtifact`: confirm validated-pass; write frozen artifact; update ER
- `updateArtifactContent`: overwrite draft; reset validation state
- Unit tests with mocked Kit Service, State Service, LLM Service

**Out of Scope:**
- Kit-specific sequence logic (generic — reads flow definitions)
- HTTP transport (Server Layer)
- UI rendering (UI Layer)

**Inputs:** TDD §4.5, Kit Service (004, 005), State Service (006, 007), LLM Service (008)

**Outputs:** `IOrchestrationService` interface, types, implementation, unit tests

**Acceptance Criteria:**
- AC1: Given a flow with 3 steps where step 1 is frozen and step 2 depends on step 1, `getFlowStatus` identifies step 2 as current with dependenciesMet: true
- AC2: Given a step whose dependencies are not all frozen, `initiateStep` throws `DependenciesNotMetError`
- AC3: Given a step in `in-progress`, `generateArtifact` yields GenerationEvent objects and persists draft
- AC4: Given `validated-pass` state, `freezeArtifact` writes frozen artifact, updates ER, transitions to `frozen`
- AC5: Given `validated-pass`, `updateArtifactContent` with edits resets state to `draft`

**Definition of Done:**
- [ ] PR merged
- [ ] Unit tests passing
- [ ] Flow status calculations tested
- [ ] Dependency enforcement tested
- [ ] Generation streaming tested
- [ ] Freeze pipeline tested (artifact + ER + state)
- [ ] Content edit → state reset tested

**Interface Contract References:**
- TDD §4.5 `IOrchestrationService` — **provider**
- TDD §4.2 `IKitService` — **consumer**
- TDD §4.3 `IStateService` — **consumer**
- TDD §4.4 `ILlmService` — **consumer**

**Dependencies:** WDD-CONSOLE-004, 005, 007, 008

**Rollback:** All state mutations via State Service (atomic writes). Revert PR if logic incorrect.

**Mock impact note:** `IOrchestrationService` is consumed by: Server Layer/API Routes (WDD-CONSOLE-010). When `IOrchestrationService` changes, update mocks in: api-routes tests.

#### TDD Sections

**Technical Context:**

TDD §4.5 Orchestration Service (full interface):

```
getFlowStatus(projectDir: string, kitId: string): Promise<FlowStatus>
- Outputs: FlowStatus {
    steps: StepStatus[];
    currentStep: StepStatus | null;
    completedSteps: number;
    totalSteps: number
  }
- Error modes: KitNotFoundError; StateNotFoundError
- Behavior: Loads flow definition. Loads artifact states. Merges to produce per-step status.
  Identifies current step.

StepStatus {
  step: FlowStep;
  state: ArtifactState;
  dependenciesMet: boolean;
  isCurrentStep: boolean
}

initiateStep(projectDir: string, kitId: string, stepId: string): Promise<StepContext>
- Outputs: StepContext { step: FlowStep; inputs: StepInputs; state: ArtifactState }
- Error modes: DependenciesNotMetError; StepAlreadyFrozenError; KitNotFoundError
- Behavior: Validates all dependency steps frozen. Transitions to in-progress.
  Assembles inputs via Kit Service.

generateArtifact(projectDir: string, kitId: string, stepId: string): AsyncIterable<GenerationEvent>
- Error modes: StepNotInProgressError; LlmProviderError; LlmTimeoutError
- Behavior: Gets step context. Resolves LLM config. Calls LLM Service streaming.
  Yields GenerationEvent. On completion, persists draft.

GenerationEvent {
  type: 'chunk' | 'done' | 'error';
  content?: string;
  artifact?: string;
  usage?: LlmUsageRecord;
  error?: string
}

validateArtifact(projectDir: string, kitId: string, stepId: string): Promise<ValidationResult>
- Error modes: StepNotDraftError; LlmProviderError
- Behavior: Reads draft. Gets validator prompt and spec from Kit Service.
  Calls LLM Service. Records result.

freezeArtifact(projectDir: string, kitId: string, stepId: string, artifactId: string): Promise<void>
- Error modes: StepNotValidatedPassError; WriteError
- Behavior: Confirms validated-pass. Writes frozen artifact. Updates ER.
  Transitions to frozen.

updateArtifactContent(projectDir: string, kitId: string, stepId: string, content: string): Promise<void>
- Error modes: StepNotEditableError
- Behavior: Overwrites draft. If validated-pass/fail, resets to draft.
```

The Orchestration Service is the central coordinator. It does not contain kit-specific logic — all sequencing is driven by the flow definition loaded from the kit. This makes it generic across all AIEOS kits.

**Testing Strategy:**

TDD §8 Orchestration Service tests: "Flow status calculation, Step initiation, Freeze."

Required test cases:
- `getFlowStatus` with no steps started returns all steps as `not-started`, `currentStep` is first step
- `getFlowStatus` with step 1 frozen and step 2 depending on step 1 marks step 2 as `dependenciesMet: true`
- `getFlowStatus` with step 1 not frozen and step 2 depending on step 1 marks step 2 as `dependenciesMet: false`
- `getFlowStatus` correctly counts `completedSteps` (frozen steps) and `totalSteps`
- `initiateStep` succeeds when all dependencies frozen, transitions state to `in-progress`
- `initiateStep` throws `DependenciesNotMetError` when dependencies not frozen
- `initiateStep` throws `StepAlreadyFrozenError` when step is already frozen
- `generateArtifact` yields `GenerationEvent` chunks and a final `done` event
- `generateArtifact` persists draft and records LLM usage on completion
- `generateArtifact` yields `error` event on LLM failure without corrupting state
- `validateArtifact` calls LLM with validator prompt and spec, records `ValidationResult`
- `validateArtifact` updates state to `validated-pass` or `validated-fail` based on result
- `freezeArtifact` writes frozen artifact, updates ER, transitions to `frozen`
- `freezeArtifact` throws `StepNotValidatedPassError` when step is not `validated-pass`
- `updateArtifactContent` overwrites draft content
- `updateArtifactContent` resets `validated-pass` or `validated-fail` state back to `draft`

**Interface Contracts:**

TDD §4.5 `IOrchestrationService` — this item is the **provider**. Exposes all flow management operations to the Server Layer.

TDD §4.2 `IKitService` — this item is a **consumer**. Uses `loadKit` to get flow definitions and `getStepInputs` to assemble step inputs for generation and validation.

TDD §4.3 `IStateService` — this item is a **consumer**. Uses `loadState` to get current project state, `getArtifactState` and `updateArtifactState` for step state management, `saveArtifact` for draft and frozen artifact persistence, `recordLlmUsage` for usage tracking, and `updateEngagementRecord` for ER updates on freeze.

TDD §4.4 `ILlmService` — this item is a **consumer**. Uses `generateArtifactStreaming` for artifact generation and `validateArtifact` for validation. Resolves the appropriate `LlmConfig` based on artifact type and project configuration.

#### ACF Sections

**Security and Compliance:**

ACF §3 Security Guardrails — LLM response handling: The Orchestration Service receives LLM-generated content (both artifact drafts and validation results) which is untrusted input. Artifact content is persisted as-is (it is Markdown reviewed by users), but validation results must be parsed through the LLM Service's validation response parser.

ACF §5 Reliability — Failure isolation: LLM failures must not corrupt state. If generation fails mid-stream, the step remains in `in-progress` (not `draft`) so the user can retry. If validation fails, the step remains in its current state. If freeze fails after writing the artifact but before updating state, the atomic state write ensures consistency.

ACF §8 Forbidden Patterns:
- Automatic step completion without user awareness: The Orchestration Service must never automatically advance a step beyond what the user explicitly requested. Each operation (`initiateStep`, `generateArtifact`, `validateArtifact`, `freezeArtifact`) is a discrete user-initiated action.
- Hardcoded kit structure: The service reads flow definitions from loaded kit data; it does not contain knowledge of specific kit directory layouts or artifact types.

#### DCF Sections

**Testing Expectations:**

DCF §2 Design Principles — Data-driven flow not code-driven flow: The Orchestration Service derives all sequencing from the kit's flow definition, not from hardcoded step lists. Service boundary discipline: each downstream service (Kit, State, LLM) is accessed only through its interface. Design for failure: every method handles errors from downstream services gracefully.

DCF §3 Quality Bars — Interfaces explicit: `IOrchestrationService` is the public contract. Failure/rollback defined: each method documents its error modes and the state the system is left in on failure.

DCF §6 Testing Expectations — Unit tests must mock all three downstream services (Kit Service, State Service, LLM Service). Tests must cover:
- Flow status calculation with various step states and dependency configurations
- Dependency enforcement: steps cannot be initiated until dependencies are frozen
- Generation streaming: chunks yielded, draft persisted, usage recorded
- Generation failure: error event yielded, state not corrupted
- Validation: result recorded, state updated based on PASS/FAIL
- Freeze pipeline: artifact written, ER updated, state transitioned to frozen — all three must succeed
- Content edit: draft overwritten, validation state reset
- Error propagation: downstream service errors wrapped in appropriate Orchestration Service error types
