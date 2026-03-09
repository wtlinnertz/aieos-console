### WDD-CONSOLE-006 — State Service Init/Load

#### WDD Work Item

- **WDD Item ID:** WDD-CONSOLE-006
- **Parent TDD Section:** §4.3 State Service (initializeProject, loadState)
- **Assignee Type:** AI Agent
- **Required Capabilities:** backend
- **Complexity Estimate:** M

**Intent:** Implement the State Service `initializeProject` and `loadState` methods, including `.aieos/state.json` creation, schema validation, and state loading.

**In Scope:**
- `IStateService` TypeScript interface (partial: `initializeProject`, `loadState`)
- `ProjectState`, `KitConfig`, `LlmConfig`, `ArtifactState`, `ValidationResult`, `LlmUsageRecord` TypeScript types
- `initializeProject`: create `.aieos/` directory, write initial `state.json`
- `loadState`: read and parse `state.json`, validate schema
- `ProjectAlreadyInitializedError`, `StateNotFoundError`, `StateCorruptedError` error types
- Unit tests with mocked Filesystem Service

**Out of Scope:**
- State transitions (WDD-CONSOLE-007)
- Artifact file writing (WDD-CONSOLE-008)
- LLM usage recording (WDD-CONSOLE-008)

**Inputs:** TDD §4.3 `IStateService` contract, TDD §4.3 type definitions, Filesystem Service (002)

**Outputs:** `IStateService` interface (partial), type definitions, implementations, error types, unit tests

**Acceptance Criteria:**
- AC1: Given a project directory with no `.aieos/` subdirectory, when `initializeProject` is called, then `.aieos/state.json` is created with valid initial schema
- AC2: Given a valid `state.json`, when `loadState` is called, then a correctly typed `ProjectState` object is returned
- AC3: Given a `state.json` with invalid JSON or missing required fields, when `loadState` is called, then `StateCorruptedError` is thrown

**Definition of Done:**
- [ ] PR merged
- [ ] Unit tests passing (Vitest)
- [ ] All state types exported
- [ ] Schema validation error paths tested

**Interface Contract References:**
- TDD §4.3 `IStateService` — **provider** (partial)
- TDD §4.1 `IFilesystemService` — **consumer**

**Dependencies:** WDD-CONSOLE-002 (Filesystem Service)

**Rollback:** State file is atomic-written. Revert PR.

**Mock impact note:** `IStateService` is consumed by: Orchestration Service (WDD-CONSOLE-009), Step Input Assembly (WDD-CONSOLE-005). When `IStateService` changes, update mocks in: orchestration-service tests, step-input-assembly tests.

#### TDD Sections

**Technical Context:**

TDD §4.3 State Service interface — type definitions and methods covered by this work item:

```
ProjectState {
  projectId: string;
  kitConfigs: KitConfig[];
  llmConfigs: LlmConfig[];
  artifacts: ArtifactState[];
  llmUsage: LlmUsageRecord[]
}

KitConfig { kitId: string; kitPath: string }

LlmConfig {
  providerId: string;
  model: string;
  apiKeyEnvVar: string;
  artifactTypes?: string[]
}

ArtifactState {
  stepId: string;
  kitId: string;
  artifactId: string | null;
  status: 'not-started' | 'in-progress' | 'draft' | 'validated-pass' | 'validated-fail' | 'frozen';
  artifactPath: string | null;
  validationResult: ValidationResult | null;
  frozenAt: string | null;
  lastModified: string
}

ValidationResult {
  status: 'PASS' | 'FAIL';
  summary: string;
  hardGates: Record<string, 'PASS' | 'FAIL'>;
  blockingIssues: { gate: string; description: string; location: string }[];
  warnings: { description: string; location: string }[];
  completenessScore: number
}

LlmUsageRecord {
  stepId: string;
  artifactId: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  timestamp: string;
  phase: 'generation' | 'validation'
}

initializeProject(projectDir: string, kitConfigs: KitConfig[], llmConfigs: LlmConfig[]): Promise<void>
- Error modes: ProjectAlreadyInitializedError; WriteError
- Behavior: Creates .aieos/ directory. Writes initial state.json with empty artifacts array.

loadState(projectDir: string): Promise<ProjectState>
- Error modes: StateNotFoundError; StateCorruptedError
- Behavior: Reads and parses .aieos/state.json. Validates schema.
```

**Testing Strategy:**

TDD §8 State Service tests: "State persistence: state roundtrips through JSON serialization; atomic write used for state updates."

Required test cases for this work item:
- `initializeProject` creates `.aieos/` directory and `state.json` with valid initial schema
- `initializeProject` throws `ProjectAlreadyInitializedError` when `.aieos/` already exists
- `loadState` returns correctly typed `ProjectState` from valid `state.json`
- `loadState` throws `StateNotFoundError` when `.aieos/state.json` does not exist
- `loadState` throws `StateCorruptedError` on invalid JSON
- `loadState` throws `StateCorruptedError` on valid JSON missing required fields
- State roundtrips: `initializeProject` then `loadState` returns equivalent object
- All type definitions are exported and usable by consumers

**Interface Contracts:**

TDD §4.3 `IStateService` — this item is the **provider** (partial: `initializeProject`, `loadState`, and all type definitions). The remaining methods (`getArtifactState`, `updateArtifactState`, `saveArtifact`, `recordLlmUsage`, `updateEngagementRecord`) are provided by WDD-CONSOLE-007.

TDD §4.1 `IFilesystemService` — this item is a **consumer**. Uses `readFile` for loading state, `writeFileAtomic` for persisting state, `createDirectory` for creating `.aieos/`, and `exists` for checking pre-existing initialization.

#### ACF Sections

**Security and Compliance:**

ACF §5 Reliability — Rollback via filesystem: State files are written atomically so that a crash mid-write does not corrupt state. No state that cannot be reconstructed: the state file captures all artifact progress and can be rebuilt from the filesystem if needed.

#### DCF Sections

**Testing Expectations:**

DCF §2 Design Principles — Explicit error handling: every failure mode has a named error type. Dependency injection: the Filesystem Service is injected, not instantiated internally.

DCF §3 Quality Bars — Interfaces explicit: `IStateService` interface and all types must be exported as the public contract. Failure/rollback defined: each method documents its error modes and rollback behavior.

DCF §6 Testing Expectations — Unit tests must mock the Filesystem Service. Tests must cover:
- Happy path: initialize and load roundtrip
- Error path: double initialization
- Error path: load without prior initialization
- Error path: corrupted JSON
- Error path: JSON with missing required fields
- Schema validation: all required fields enforced
- Type exports: all state types are importable by consumer modules
