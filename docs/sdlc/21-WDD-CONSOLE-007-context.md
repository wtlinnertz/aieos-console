### WDD-CONSOLE-007 — State Transitions

#### WDD Work Item

- **WDD Item ID:** WDD-CONSOLE-007
- **Parent TDD Section:** §4.3 State Service (getArtifactState, updateArtifactState, saveArtifact, recordLlmUsage, updateEngagementRecord)
- **Assignee Type:** AI Agent
- **Required Capabilities:** backend
- **Complexity Estimate:** L

**Intent:** Implement the remaining State Service methods: artifact state queries, state transition validation, artifact file persistence, LLM usage recording, and Engagement Record updates.

**In Scope:**
- `getArtifactState`, `updateArtifactState`, `saveArtifact`, `recordLlmUsage`, `updateEngagementRecord` implementations
- State transition validation rules: legal transitions enforced, `InvalidTransitionError` on illegal, frozen is terminal
- `saveArtifact`: write artifact Markdown to `docs/sdlc/{filename}` via Filesystem Service atomic write
- `recordLlmUsage`: append LlmUsageRecord to state
- `updateEngagementRecord`: read ER file, update layer section, write back atomically
- Error types: `InvalidTransitionError`, `StepNotFoundError`, `EngagementRecordNotFoundError`
- Unit tests for all state transitions (valid and invalid) and all operations

**Out of Scope:**
- Project initialization and state loading (WDD-CONSOLE-006)
- Orchestration logic that decides when to trigger transitions

**Inputs:** TDD §4.3 remaining methods, State types from 006, Filesystem Service (002)

**Outputs:** Remaining `IStateService` implementations, error types, unit tests

**Acceptance Criteria:**
- AC1: Given a step in `not-started` state where all dependency steps are frozen, when `updateArtifactState` is called with `in-progress`, then transition succeeds
- AC2: Given a step in `frozen` state, when `updateArtifactState` is called, then `InvalidTransitionError` is thrown
- AC3: Given valid content, when `saveArtifact` is called, then file is written atomically and state updated
- AC4: Given a valid LLM usage record, when `recordLlmUsage` is called, then record is appended and persisted
- AC5: Given a frozen artifact, when `updateEngagementRecord` is called, then ER file is updated in correct layer section

**Definition of Done:**
- [ ] PR merged
- [ ] Unit tests passing
- [ ] All valid state transitions tested
- [ ] All invalid state transitions tested (including frozen → any)
- [ ] Engagement Record update tested

**Interface Contract References:**
- TDD §4.3 `IStateService` — **provider** (remaining methods)
- TDD §4.1 `IFilesystemService` — **consumer**

**Dependencies:** WDD-CONSOLE-006 (State Service initialization and types)

**Rollback:** All state writes use atomic operations. Previous state preserved on failure.

#### TDD Sections

**Technical Context:**

TDD §4.3 remaining State Service methods:

```
getArtifactState(projectDir: string, stepId: string): Promise<ArtifactState>
- Error modes: StepNotFoundError

updateArtifactState(projectDir: string, stepId: string, update: Partial<ArtifactState>): Promise<void>
- Error modes: InvalidTransitionError; WriteError
- Behavior: Validates state transition is legal. Updates state.json atomically. Updates lastModified.

saveArtifact(projectDir: string, stepId: string, content: string, filename: string): Promise<string>
- Outputs: artifact file path (relative)
- Error modes: WriteError; PathViolationError
- Behavior: Writes artifact file to docs/sdlc/{filename} via atomic write. Updates artifact state with path.

recordLlmUsage(projectDir: string, record: LlmUsageRecord): Promise<void>
- Error modes: WriteError
- Behavior: Appends usage record to state. Writes state atomically.

updateEngagementRecord(projectDir: string, artifactId: string, artifactType: string, status: string, notes: string): Promise<void>
- Error modes: WriteError; EngagementRecordNotFoundError
- Behavior: Reads ER file, updates appropriate layer section, writes back atomically.
```

State transition validation rules:
- `not-started` → `in-progress`: Allowed only if all dependency steps are frozen
- `in-progress` → `draft`: Allowed
- `draft` → `validated-pass`: Allowed
- `draft` → `validated-fail`: Allowed
- `validated-fail` → `draft`: Allowed (user edits for re-validation)
- `validated-pass` → `frozen`: Allowed
- `frozen` → any: Not allowed (terminal)
- All other transitions: `InvalidTransitionError`

**Testing Strategy:**

TDD §8 State Service tests: "State transitions: all valid transitions succeed; invalid transitions throw InvalidTransitionError; frozen → any throws error. State persistence: state roundtrips through JSON serialization; atomic write used for state updates. LLM usage recording: records appended correctly; metrics queryable."

Required test cases:
- Each valid transition succeeds and persists updated state
- `not-started` → `in-progress` only when all dependencies frozen (dependency check)
- `frozen` → every other status throws `InvalidTransitionError`
- Invalid transitions (e.g., `not-started` → `draft`, `in-progress` → `frozen`) throw `InvalidTransitionError`
- `lastModified` updated on every state change
- `saveArtifact` writes file and updates `artifactPath` in state
- `saveArtifact` rejects paths that escape `docs/sdlc/`
- `recordLlmUsage` appends record and persists atomically
- `updateEngagementRecord` reads, updates, and writes ER file
- `updateEngagementRecord` throws `EngagementRecordNotFoundError` when ER file missing

**Interface Contracts:**

TDD §4.3 `IStateService` — this item is the **provider** (remaining methods). Combined with WDD-CONSOLE-006, this completes the full `IStateService` interface.

TDD §4.1 `IFilesystemService` — this item is a **consumer**. Uses `readFile` for loading state and ER files, `writeFileAtomic` for persisting state and artifact files, and path validation for `saveArtifact` output paths.

#### ACF Sections

**Security and Compliance:**

ACF §5 Reliability — Failure isolation: each state mutation is atomic; a failure during write preserves the previous state. Atomic writes ensure no partial state corruption.

ACF §6 Observability — Artifact state transitions logged: every transition should produce a log entry with the step ID, previous status, new status, and timestamp. This enables audit trails for artifact lifecycle.

#### DCF Sections

**Testing Expectations:**

DCF §2 Design Principles — Explicit error handling: every illegal transition has a named error type (`InvalidTransitionError`). Design for failure: atomic writes ensure crash safety.

DCF §3 Quality Bars — Failure/rollback defined: each method documents its error modes. Atomic write guarantees that state.json is never left in a partial state.

DCF §5 Operational Expectations — Auditability: state transitions include timestamps via `lastModified`. LLM usage records are persisted with full metadata (provider, model, tokens, duration, phase) for cost tracking and debugging.

DCF §6 Testing Expectations — Unit tests must mock the Filesystem Service. Tests must cover:
- Every valid state transition (6 transitions)
- Every invalid state transition (frozen → all, plus illegal jumps)
- Dependency checking for `not-started` → `in-progress`
- Artifact file writing and path validation
- LLM usage record append and persistence
- Engagement Record read-modify-write cycle
- Error paths: missing step, missing ER file, write failures
