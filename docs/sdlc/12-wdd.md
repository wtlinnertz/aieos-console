# WDD — aieos-console Work Design Document

## 0. Document Control
- WDD ID: WDD-CONSOLE-001
- Author: AI-generated, human-reviewed
- Date: 2026-03-08
- Status: Frozen
- Governance Model Version: 1.0
- Prompt Version: 1.0
- Parent TDD:
  - TDD ID: TDD-CONSOLE-001 (docs/sdlc/11-tdd.md)
  - TDD Status: Frozen

## 1. Scope and Non-Goals (Copied from TDD)

### In Scope
- Technical design for all 7 SAD components: UI Layer, Server Layer, Orchestration Service, Kit Service, State Service, LLM Service, Filesystem Service
- Resolution of all 6 SAD deferred decisions: flow definition format/schema, kit directory caching, LLM response streaming, artifact state storage format, content sanitization approach, lock file implementation
- Interface contracts between all component boundaries
- Flow definition schema and parsing
- Build, test, and deployment specifications
- Failure handling for all identified failure modes

### Explicit Non-Goals (Must align with SAD)
- **NG-1:** Kit authoring or modification — no kit editing features
- **NG-2:** Multi-user concurrent access — no collaboration, sync, or conflict resolution
- **NG-3:** Authentication and authorization — no user identity or RBAC
- **NG-4:** Non-happy-path flows — no re-entry, escalation, or cross-initiative conflict
- **NG-5:** Cloud deployment — no hosted infrastructure
- No implementation code in this document — contracts and specifications only

---

## 2. Work Items

### WDD-CONSOLE-001 — Project Scaffolding and Configuration
- WDD Item ID: WDD-CONSOLE-001
- Parent TDD Section: §3 Technical Overview, §5 Build and Deployment
- Assignee Type: AI Agent
- Required Capabilities: infrastructure, frontend, backend
- Complexity Estimate: M — Multiple concerns (Next.js setup, TypeScript config, ESLint, Docker, CI); well-established patterns but broad scope

#### Intent
Initialize the aieos-console project with Next.js App Router, TypeScript strict mode, ESLint, Vitest, Playwright, and Docker configuration.

#### In Scope
- Next.js project initialization with App Router and TypeScript strict mode
- ESLint configuration with zero-warning enforcement
- Vitest configuration with React Testing Library
- Playwright configuration
- Dockerfile (multi-stage build, non-root user, health check)
- `.dockerignore`
- Environment variable configuration loading (PROJECT_DIR, KIT_DIRS, LLM_API_KEY, LLM_PROVIDER, LLM_MODEL, PORT)
- `package.json` with all dependencies pinned to exact versions

#### Out of Scope / Non-Goals
- Application business logic
- Any component implementation beyond project structure

#### Inputs
- TDD §5 Build and Deployment (Dockerfile structure, configuration inputs)
- TDD §10 Dependencies (exact dependency list)

#### Outputs
- Initialized Next.js project at `/home/todd/projects/aieos/aieos-console/`
- Working `npm ci && npm run build` pipeline
- Working `docker build` producing a valid image
- Vitest and Playwright configuration verified with placeholder tests
- ESLint and TypeScript configured and passing

#### Acceptance Criteria (Executable)
- AC1: Given a clean checkout, when `npm ci && npx tsc --noEmit` is run, then it exits 0 with zero type errors
- Failure: If `tsc` reports errors, the TypeScript configuration is incorrect
- AC2: Given a clean checkout, when `npx eslint . --max-warnings 0` is run, then it exits 0
- Failure: If ESLint reports errors or warnings, the configuration is incorrect
- AC3: Given a clean checkout, when `docker build -t aieos-console .` is run, then it produces a valid image with a non-root user and health check
- Failure: If the build fails or the image runs as root, the Dockerfile is incorrect
- AC4: Given the Docker image, when `docker run` is executed with required environment variables, then the application starts and the health check endpoint returns 200
- Failure: If the health check fails, the startup configuration is incorrect

#### Definition of Done (Hard)
- [ ] PR merged
- [ ] TypeScript strict mode passing (zero errors)
- [ ] ESLint passing (zero errors, zero warnings)
- [ ] Vitest placeholder test passes
- [ ] Playwright placeholder test passes
- [ ] Docker build succeeds
- [ ] Docker container starts and health check passes

#### Interface Contract References
None — project scaffolding, no component contracts implemented

#### Dependencies
None

#### Rollback / Failure Behavior
Project scaffolding is the first item. If it fails, no downstream items are affected. Delete the generated project and retry.

---

### WDD-CONSOLE-002 — Filesystem Service
- WDD Item ID: WDD-CONSOLE-002
- Parent TDD Section: §4.1 Filesystem Service
- Assignee Type: AI Agent
- Required Capabilities: backend, security
- Complexity Estimate: M — Single component but multiple operations (read, write, directory, lock); path validation requires security awareness; 4 ACs

#### Intent
Implement the Filesystem Service (`IFilesystemService`) providing path-validated file operations, atomic writes, and lock file management.

#### In Scope
- `IFilesystemService` TypeScript interface
- `readFile`, `writeFileAtomic`, `readDirectory`, `exists`, `acquireLock`, `releaseLock` implementations
- Path boundary validation (resolve path, check against configured boundaries, resolve symlinks, re-validate)
- Atomic write implementation (write to temp file, rename)
- Lock file implementation (`.aieos/lock` with PID, timestamp, hostname; stale detection via PID liveness; cleanup on release)
- Error types: `PathViolationError`, `FileNotFoundError`, `PermissionError`, `ReadError`, `WriteError`, `DirectoryNotFoundError`
- Unit tests for all operations and error paths

#### Out of Scope / Non-Goals
- Business logic consuming the filesystem
- State metadata format (State Service concern)
- Kit directory interpretation (Kit Service concern)

#### Inputs
- TDD §4.1 `IFilesystemService` contract
- Configured project directory and kit directory paths (from environment variables)

#### Outputs
- `IFilesystemService` interface definition (TypeScript)
- `FilesystemService` implementation
- Error type definitions
- Unit tests covering: path validation (accept valid, reject violations, handle symlinks), atomic write (success, failure cleanup), lock file (acquire, stale detection, refuse active, release)

#### Acceptance Criteria (Executable)
- AC1: Given a path within configured boundaries, when `readFile` is called, then file content is returned as UTF-8 string
- Failure: Given a path outside configured boundaries, when `readFile` is called, then `PathViolationError` is thrown
- AC2: Given valid content and path, when `writeFileAtomic` is called and the write succeeds, then the target file contains the complete content; when the write fails mid-write, then the target file is unchanged and no temporary file remains
- Failure: If a partial file exists after a failed write, the atomic write implementation is incorrect
- AC3: Given no existing lock file, when `acquireLock` is called, then a lock file is created with current PID and timestamp and `acquired: true` is returned; given an existing lock file with a dead PID, when `acquireLock` is called, then the stale lock is removed and a new lock acquired; given an existing lock file with a live PID, when `acquireLock` is called, then `acquired: false` is returned with existing lock details
- Failure: If a stale lock prevents acquisition, the PID liveness check is incorrect
- AC4: Given a path containing a symlink that resolves outside configured boundaries, when any file operation is called, then `PathViolationError` is thrown
- Failure: If the operation succeeds, symlink resolution validation is bypassed

#### Definition of Done (Hard)
- [ ] PR merged
- [ ] Unit tests passing (Vitest)
- [ ] All error paths tested
- [ ] Path validation tests include symlink scenarios
- [ ] Lock file tests include stale detection

#### Interface Contract References
- TDD §4.1 `IFilesystemService` — **provider** (this item implements the contract)

#### Dependencies
- WDD-CONSOLE-001 (project scaffolding)

#### Rollback / Failure Behavior
Filesystem Service is a foundational component. If implementation is incorrect, downstream items (Kit Service, State Service) cannot proceed. Revert the PR and fix.

---

### WDD-CONSOLE-003 — Kit Service: Flow Definition Parser
- WDD Item ID: WDD-CONSOLE-003
- Parent TDD Section: §4.2 Kit Service (flow definition schema and parsing)
- Assignee Type: AI Agent
- Required Capabilities: backend, API-design
- Complexity Estimate: M — Single concern (YAML parsing and schema validation) but novel schema design; 3 ACs; one dependency

#### Intent
Implement the flow definition YAML parser and schema validator within the Kit Service, producing typed `FlowDefinition` objects from kit `flow.yaml` files.

#### In Scope
- `FlowDefinition`, `FlowStep`, `HandoffDefinition` TypeScript types (from TDD §4.2)
- YAML parsing of `flow.yaml` files using the `yaml` library
- Schema validation: required fields present, step IDs unique, dependency references valid, `stepType` is one of the allowed enum values
- `FlowDefinitionNotFoundError`, `FlowDefinitionParseError` error types
- Unit tests for valid parsing, missing fields, invalid references, malformed YAML

#### Out of Scope / Non-Goals
- Kit directory traversal (WDD-CONSOLE-004)
- Step input assembly (WDD-CONSOLE-005)
- File content reading (uses Filesystem Service)

#### Inputs
- TDD §4.2 flow definition YAML schema
- TDD §4.2 `FlowDefinition` TypeScript type
- `flow.yaml` file content (read via Filesystem Service)

#### Outputs
- TypeScript types: `FlowDefinition`, `FlowStep`, `HandoffDefinition`
- `parseFlowDefinition(content: string): FlowDefinition` function
- Error types: `FlowDefinitionNotFoundError`, `FlowDefinitionParseError`
- Unit tests

#### Acceptance Criteria (Executable)
- AC1: Given a valid `flow.yaml` string matching the TDD §4.2 schema, when `parseFlowDefinition` is called, then a correctly typed `FlowDefinition` object is returned with all fields populated
- Failure: If any field is missing or incorrectly typed, the parser is incomplete
- AC2: Given a `flow.yaml` with a missing required field (e.g., no `steps`), when `parseFlowDefinition` is called, then `FlowDefinitionParseError` is thrown with a message identifying the missing field
- Failure: If parsing succeeds or the error message is generic, validation is insufficient
- AC3: Given a `flow.yaml` where a step's `dependencies` reference a non-existent step ID, when `parseFlowDefinition` is called, then `FlowDefinitionParseError` is thrown identifying the invalid reference
- Failure: If parsing succeeds with an invalid reference, dependency validation is missing

#### Definition of Done (Hard)
- [ ] PR merged
- [ ] Unit tests passing (Vitest)
- [ ] All schema validation error paths tested
- [ ] TypeScript types exported for consumer use

#### Interface Contract References
- TDD §4.2 `IKitService.loadKit` — **provider** (partial; this item implements the parsing component)

#### Dependencies
- WDD-CONSOLE-001 (project scaffolding — `yaml` library available)

#### Rollback / Failure Behavior
If the parser produces incorrect types, downstream consumers (Kit Service loader, Orchestration Service) will receive invalid data. Revert and fix. Parser is isolated — no state mutation.

---

### WDD-CONSOLE-004 — Kit Service: Kit Loader and Cache
- WDD Item ID: WDD-CONSOLE-004
- Parent TDD Section: §4.2 Kit Service (loadKit, invalidateCache)
- Assignee Type: AI Agent
- Required Capabilities: backend
- Complexity Estimate: M — Integrates parser with filesystem; caching logic; 3 ACs; two dependencies

#### Intent
Implement the Kit Service `loadKit` and `invalidateCache` methods, including kit directory reading, flow definition loading, four-file existence validation, and in-memory caching.

#### In Scope
- `IKitService` TypeScript interface (partial: `loadKit`, `invalidateCache`)
- `loadKit` implementation: read `flow.yaml` via Filesystem Service, parse via flow definition parser, validate four-file paths exist, cache result
- `invalidateCache` implementation: clear all cached flow definitions
- `KitResult` type
- Verification that all four-file paths declared in flow steps actually exist in the kit directory
- Unit tests with mocked Filesystem Service

#### Out of Scope / Non-Goals
- Step input assembly (WDD-CONSOLE-005)
- Flow definition parsing logic (WDD-CONSOLE-003)

#### Inputs
- TDD §4.2 `IKitService` contract (`loadKit`, `invalidateCache`)
- Filesystem Service interface (WDD-CONSOLE-002)
- Flow definition parser (WDD-CONSOLE-003)

#### Outputs
- `IKitService` interface definition (partial)
- `loadKit` and `invalidateCache` implementations
- `KitResult` type
- Unit tests

#### Acceptance Criteria (Executable)
- AC1: Given a kit directory containing a valid `flow.yaml` and all referenced four-file paths, when `loadKit` is called, then a `KitResult` is returned with the parsed `FlowDefinition` and kit path
- Failure: If `loadKit` fails on a valid kit directory, the integration between parser and filesystem is broken
- AC2: Given a kit directory with a valid `flow.yaml` but a missing four-file (e.g., spec file does not exist), when `loadKit` is called, then an error is reported identifying the missing file
- Failure: If `loadKit` succeeds with missing files, validation is incomplete
- AC3: Given a previously loaded kit, when `invalidateCache` is called and `loadKit` is called again, then the kit is re-read from the filesystem (not served from cache)
- Failure: If the cached version is returned after invalidation, the cache is not properly cleared

#### Definition of Done (Hard)
- [ ] PR merged
- [ ] Unit tests passing (Vitest)
- [ ] Cache invalidation tested
- [ ] Missing file validation tested

#### Interface Contract References
- TDD §4.2 `IKitService.loadKit` — **provider**
- TDD §4.1 `IFilesystemService` — **consumer**

#### Dependencies
- WDD-CONSOLE-002 (Filesystem Service)
- WDD-CONSOLE-003 (Flow Definition Parser)

#### Rollback / Failure Behavior
If kit loading fails incorrectly, flows cannot be rendered. Revert PR. No state mutation — read-only operations against kit directories.

---

### WDD-CONSOLE-005 — Kit Service: Step Input Assembly
- WDD Item ID: WDD-CONSOLE-005
- Parent TDD Section: §4.2 Kit Service (getStepInputs)
- Assignee Type: AI Agent
- Required Capabilities: backend
- Complexity Estimate: M — Integrates kit files with upstream artifacts from project directory; 3 ACs; two dependencies

#### Intent
Implement the Kit Service `getStepInputs` method that assembles all required inputs for a given step: four-file content, required_inputs, and upstream frozen artifacts.

#### In Scope
- `getStepInputs` implementation
- `StepInputs`, `NamedInput` types
- Reading four-file content from kit directory via Filesystem Service
- Reading `required_inputs` from kit directory via Filesystem Service
- Reading upstream frozen artifacts from project directory (determined by step dependencies and State Service artifact paths)
- `StepNotFoundError`, `InputFileNotFoundError` error types
- Unit tests with mocked Filesystem Service and State Service

#### Out of Scope / Non-Goals
- Determining which step to execute (Orchestration Service concern)
- LLM prompt construction (LLM Service concern)

#### Inputs
- TDD §4.2 `IKitService.getStepInputs` contract
- Loaded kit flow definition (from WDD-CONSOLE-004)
- Filesystem Service (WDD-CONSOLE-002)
- State Service artifact paths (WDD-CONSOLE-007)

#### Outputs
- `getStepInputs` implementation
- `StepInputs`, `NamedInput` types
- Error types
- Unit tests

#### Acceptance Criteria (Executable)
- AC1: Given a step with four files and two required_inputs, when `getStepInputs` is called, then all 6 file contents are returned with correct names and roles
- Failure: If any file content is missing or misnamed, the assembly is incomplete
- AC2: Given a step with dependencies on two upstream steps that are both frozen, when `getStepInputs` is called, then both upstream artifact contents are included in the result
- Failure: If upstream artifacts are missing, dependency resolution is broken
- AC3: Given a step where a declared required_input file does not exist in the kit directory, when `getStepInputs` is called, then `InputFileNotFoundError` is thrown identifying the missing file
- Failure: If the call succeeds silently, the error would surface later during LLM generation as poor output quality

#### Definition of Done (Hard)
- [ ] PR merged
- [ ] Unit tests passing (Vitest)
- [ ] All input assembly paths tested
- [ ] Error cases tested

#### Interface Contract References
- TDD §4.2 `IKitService.getStepInputs` — **provider**
- TDD §4.1 `IFilesystemService` — **consumer**
- TDD §4.3 `IStateService` (reads artifact paths) — **consumer**

#### Dependencies
- WDD-CONSOLE-002 (Filesystem Service)
- WDD-CONSOLE-004 (Kit Loader — provides flow definitions)

#### Rollback / Failure Behavior
If input assembly is incorrect, LLM generation will receive incomplete inputs. Revert PR. No state mutation — read-only operation.

---

### WDD-CONSOLE-006 — State Service: Project Initialization and State Loading
- WDD Item ID: WDD-CONSOLE-006
- Parent TDD Section: §4.3 State Service (initializeProject, loadState)
- Assignee Type: AI Agent
- Required Capabilities: backend
- Complexity Estimate: M — JSON schema validation, filesystem integration, state initialization; 3 ACs; one dependency

#### Intent
Implement the State Service `initializeProject` and `loadState` methods, including `.aieos/state.json` creation, schema validation, and state loading.

#### In Scope
- `IStateService` TypeScript interface (partial: `initializeProject`, `loadState`)
- `ProjectState`, `KitConfig`, `LlmConfig`, `ArtifactState`, `ValidationResult`, `LlmUsageRecord` TypeScript types
- `initializeProject`: create `.aieos/` directory, write initial `state.json` with empty artifacts
- `loadState`: read and parse `state.json`, validate schema
- `ProjectAlreadyInitializedError`, `StateNotFoundError`, `StateCorruptedError` error types
- Unit tests with mocked Filesystem Service

#### Out of Scope / Non-Goals
- State transitions (WDD-CONSOLE-007)
- Artifact file writing (WDD-CONSOLE-008)
- LLM usage recording (WDD-CONSOLE-008)

#### Inputs
- TDD §4.3 `IStateService` contract (initializeProject, loadState)
- TDD §4.3 type definitions (ProjectState and related types)
- Filesystem Service (WDD-CONSOLE-002)

#### Outputs
- `IStateService` interface definition (partial)
- Type definitions for all state-related types
- `initializeProject` and `loadState` implementations
- Error types
- Unit tests

#### Acceptance Criteria (Executable)
- AC1: Given a project directory with no `.aieos/` subdirectory, when `initializeProject` is called, then `.aieos/state.json` is created with valid initial schema and empty artifacts array
- Failure: If the directory or file is not created, or the JSON is invalid, initialization is broken
- AC2: Given a valid `state.json`, when `loadState` is called, then a correctly typed `ProjectState` object is returned
- Failure: If any field is missing or incorrectly typed, the schema validation is incomplete
- AC3: Given a `state.json` with invalid JSON or missing required fields, when `loadState` is called, then `StateCorruptedError` is thrown
- Failure: If loading succeeds with invalid state, data integrity is compromised

#### Definition of Done (Hard)
- [ ] PR merged
- [ ] Unit tests passing (Vitest)
- [ ] All state types exported
- [ ] Schema validation error paths tested

#### Interface Contract References
- TDD §4.3 `IStateService` — **provider** (partial)
- TDD §4.1 `IFilesystemService` — **consumer**

#### Dependencies
- WDD-CONSOLE-002 (Filesystem Service)

#### Rollback / Failure Behavior
If initialization writes invalid state, downstream operations will fail. Revert PR. State file is atomic-written so no partial state risk.

---

### WDD-CONSOLE-007 — State Service: State Transitions and Artifact Management
- WDD Item ID: WDD-CONSOLE-007
- Parent TDD Section: §4.3 State Service (getArtifactState, updateArtifactState, saveArtifact, recordLlmUsage, updateEngagementRecord)
- Assignee Type: AI Agent
- Required Capabilities: backend
- Complexity Estimate: L — Multiple operations; state transition validation logic; Engagement Record updates; 5 ACs; one dependency

#### Intent
Implement the remaining State Service methods: artifact state queries, state transition validation, artifact file persistence, LLM usage recording, and Engagement Record updates.

#### In Scope
- `getArtifactState`, `updateArtifactState`, `saveArtifact`, `recordLlmUsage`, `updateEngagementRecord` implementations
- State transition validation rules (TDD §4.3): legal transitions enforced, `InvalidTransitionError` on illegal transitions, frozen is terminal
- `saveArtifact`: write artifact Markdown file to `docs/sdlc/{filename}` via Filesystem Service atomic write
- `recordLlmUsage`: append LlmUsageRecord to state
- `updateEngagementRecord`: read ER file, update appropriate layer section, write back atomically
- `InvalidTransitionError`, `StepNotFoundError`, `EngagementRecordNotFoundError` error types
- Unit tests for all state transitions (valid and invalid) and all operations

#### Out of Scope / Non-Goals
- Project initialization and state loading (WDD-CONSOLE-006)
- Orchestration logic that decides when to trigger transitions (Orchestration Service concern)

#### Inputs
- TDD §4.3 `IStateService` contract (remaining methods)
- TDD §4.3 state transition validation rules
- Filesystem Service (WDD-CONSOLE-002)
- State types from WDD-CONSOLE-006

#### Outputs
- Remaining `IStateService` implementations
- Error types
- Unit tests for all transitions and operations

#### Acceptance Criteria (Executable)
- AC1: Given a step in `not-started` state where all dependency steps are frozen, when `updateArtifactState` is called with status `in-progress`, then the transition succeeds and state.json is updated
- Failure: If the transition fails when dependencies are met, the validation logic is too restrictive
- AC2: Given a step in `frozen` state, when `updateArtifactState` is called with any status, then `InvalidTransitionError` is thrown
- Failure: If the transition succeeds, frozen immutability is violated
- AC3: Given valid content, when `saveArtifact` is called, then the artifact file is written atomically to `docs/sdlc/{filename}` and the artifact state is updated with the file path
- Failure: If the file is partially written or the state is not updated, the save operation is broken
- AC4: Given a valid LLM usage record, when `recordLlmUsage` is called, then the record is appended to state and persisted atomically
- Failure: If the record is lost or state is corrupted, usage tracking is broken
- AC5: Given a frozen artifact, when `updateEngagementRecord` is called, then the Engagement Record file is updated with the artifact ID, type, status, and notes in the correct layer section
- Failure: If the ER is not updated or the wrong section is modified, traceability is broken

#### Definition of Done (Hard)
- [ ] PR merged
- [ ] Unit tests passing (Vitest)
- [ ] All valid state transitions tested
- [ ] All invalid state transitions tested (including frozen → any)
- [ ] Engagement Record update tested

#### Interface Contract References
- TDD §4.3 `IStateService` — **provider** (remaining methods)
- TDD §4.1 `IFilesystemService` — **consumer**

#### Dependencies
- WDD-CONSOLE-006 (State Service initialization and types)

#### Rollback / Failure Behavior
All state writes use atomic operations via Filesystem Service. If a transition fails mid-write, the previous state is preserved. Revert PR if logic is incorrect.

---

### WDD-CONSOLE-008 — LLM Service
- WDD Item ID: WDD-CONSOLE-008
- Parent TDD Section: §4.4 LLM Service
- Assignee Type: AI Agent
- Required Capabilities: backend, API-design
- Complexity Estimate: L — Provider abstraction pattern; streaming implementation; response parsing; external API integration; 5 ACs; one dependency

#### Intent
Implement the LLM Service with the provider abstraction interface, Anthropic Claude provider implementation, streaming support, and validation response parsing.

#### In Scope
- `ILlmService` TypeScript interface
- `ILlmProvider` interface with `sendRequest` and `sendStreamingRequest`
- `LlmRequest`, `LlmResponse`, `LlmChunk` types
- `AnthropicProvider` implementation using `@anthropic-ai/sdk`
- `generateArtifact` (non-streaming), `generateArtifactStreaming` (streaming), `validateArtifact` methods
- Validation response parsing: extract `ValidationResult` JSON from LLM response
- Error types: `LlmProviderError`, `LlmTimeoutError`, `LlmResponseParseError`, `LlmStreamError`, `ValidationResponseParseError`
- Provider resolution from `LlmConfig`
- Unit tests with mocked HTTP responses

#### Out of Scope / Non-Goals
- Prompt construction (Orchestration Service assembles inputs)
- Non-Anthropic provider implementations (architecture supports them; initial release targets Anthropic only)

#### Inputs
- TDD §4.4 `ILlmService` contract
- TDD §4.4 `ILlmProvider` interface
- `@anthropic-ai/sdk` library
- LLM API key via environment variable

#### Outputs
- `ILlmService` interface definition
- `ILlmProvider` interface definition
- `AnthropicProvider` implementation
- All type definitions
- Error types
- Unit tests with mocked provider

#### Acceptance Criteria (Executable)
- AC1: Given a valid LLM configuration and prompt, when `generateArtifact` is called, then a complete `LlmResponse` is returned with content, token counts, model, and duration
- Failure: If any response field is missing, the provider implementation is incomplete
- AC2: Given a valid LLM configuration and prompt, when `generateArtifactStreaming` is called, then `LlmChunk` objects are yielded incrementally, with the final chunk containing usage metrics
- Failure: If chunks are not yielded incrementally or the final chunk lacks metrics, streaming is broken
- AC3: Given a validation response that is valid JSON matching `ValidationResult` schema, when `validateArtifact` is called, then the parsed `ValidationResult` is returned
- Failure: If parsing fails on valid JSON, the schema matching is too strict
- AC4: Given a validation response that is not valid JSON, when `validateArtifact` is called, then `ValidationResponseParseError` is thrown
- Failure: If the call succeeds, untrusted LLM output is not being validated
- AC5: Given an LLM API that returns a 500 error, when `generateArtifact` is called, then `LlmProviderError` is thrown with the error details
- Failure: If the error is swallowed silently, error handling is missing

#### Definition of Done (Hard)
- [ ] PR merged
- [ ] Unit tests passing (Vitest)
- [ ] Provider abstraction interface exported
- [ ] Streaming tested with mock chunks
- [ ] All error types tested
- [ ] API key never appears in test output or logs

#### Interface Contract References
- TDD §4.4 `ILlmService` — **provider**
- TDD §4.4 `ILlmProvider` — **provider** (AnthropicProvider)

#### Dependencies
- WDD-CONSOLE-001 (project scaffolding — `@anthropic-ai/sdk` available)

#### Rollback / Failure Behavior
LLM Service is stateless — no state mutation. If the provider implementation is incorrect, generation/validation calls will fail. Revert PR. No downstream data corruption.

---

### WDD-CONSOLE-009 — Orchestration Service
- WDD Item ID: WDD-CONSOLE-009
- Parent TDD Section: §4.5 Orchestration Service
- Assignee Type: AI Agent
- Required Capabilities: backend, API-design
- Complexity Estimate: L — Core business logic; coordinates all services; flow execution engine; 5 ACs; four dependencies

#### Intent
Implement the Orchestration Service that executes flows from kit-provided flow definitions, manages step progression, and coordinates generation, validation, and freeze operations.

#### In Scope
- `IOrchestrationService` TypeScript interface
- `FlowStatus`, `StepStatus`, `StepContext`, `GenerationEvent` types
- `getFlowStatus`: merge flow definition with artifact states to produce per-step status; identify current step
- `initiateStep`: validate dependencies met; transition to in-progress; assemble inputs
- `generateArtifact`: resolve LLM config; stream generation; persist draft
- `validateArtifact`: assemble validator inputs; call LLM; record result
- `freezeArtifact`: confirm validated-pass; write frozen artifact; update ER
- `updateArtifactContent`: overwrite draft; reset validation state
- Unit tests with mocked Kit Service, State Service, LLM Service

#### Out of Scope / Non-Goals
- Kit-specific sequence logic (the Orchestration Service is generic — it reads flow definitions)
- HTTP transport (Server Layer concern)
- UI rendering (UI Layer concern)

#### Inputs
- TDD §4.5 `IOrchestrationService` contract
- Kit Service (WDD-CONSOLE-004, WDD-CONSOLE-005)
- State Service (WDD-CONSOLE-006, WDD-CONSOLE-007)
- LLM Service (WDD-CONSOLE-008)

#### Outputs
- `IOrchestrationService` interface definition
- All type definitions
- Full implementation
- Unit tests

#### Acceptance Criteria (Executable)
- AC1: Given a flow with 3 steps where step 1 is frozen and step 2 has step 1 as a dependency, when `getFlowStatus` is called, then step 2 is identified as the current step with `dependenciesMet: true`
- Failure: If step 2 is not identified as current, the dependency evaluation is broken
- AC2: Given a step whose dependencies are not all frozen, when `initiateStep` is called, then `DependenciesNotMetError` is thrown
- Failure: If initiation succeeds, freeze-before-promote is not enforced
- AC3: Given a step in `in-progress` state, when `generateArtifact` is called, then `GenerationEvent` objects are yielded (chunks followed by done with full content and usage), and the artifact is persisted as draft
- Failure: If the draft is not persisted or events are not yielded, the generation pipeline is broken
- AC4: Given a step in `validated-pass` state, when `freezeArtifact` is called, then the artifact is written as frozen, the Engagement Record is updated, and the state transitions to `frozen`
- Failure: If any of these three actions does not occur, the freeze is incomplete
- AC5: Given a step in `validated-pass` state, when `updateArtifactContent` is called with edited content, then the state resets to `draft` (requiring re-validation)
- Failure: If the state remains `validated-pass` after editing, stale validation results persist

#### Definition of Done (Hard)
- [ ] PR merged
- [ ] Unit tests passing (Vitest)
- [ ] All flow status calculations tested
- [ ] Dependency enforcement tested
- [ ] Generation streaming tested
- [ ] Freeze pipeline tested (artifact + ER + state)
- [ ] Content edit → state reset tested

#### Interface Contract References
- TDD §4.5 `IOrchestrationService` — **provider**
- TDD §4.2 `IKitService` — **consumer**
- TDD §4.3 `IStateService` — **consumer**
- TDD §4.4 `ILlmService` — **consumer**

#### Dependencies
- WDD-CONSOLE-004 (Kit Loader)
- WDD-CONSOLE-005 (Step Input Assembly)
- WDD-CONSOLE-007 (State Transitions)
- WDD-CONSOLE-008 (LLM Service)

#### Rollback / Failure Behavior
Orchestration Service coordinates but all state mutations go through State Service (which uses atomic writes). If orchestration logic is incorrect, state remains consistent — just the flow behavior is wrong. Revert PR and fix.

---

### WDD-CONSOLE-010 — Server Layer (API Routes)
- WDD Item ID: WDD-CONSOLE-010
- Parent TDD Section: §4.6 Server Layer
- Assignee Type: AI Agent
- Required Capabilities: backend, API-design
- Complexity Estimate: L — 9 API routes; SSE streaming endpoint; request validation; error formatting; 5 ACs; one dependency

#### Intent
Implement all Next.js API Route Handlers that expose the Orchestration Service to the UI Layer, including request validation, error response formatting, and the SSE streaming endpoint for artifact generation.

#### In Scope
- All 9 routes defined in TDD §4.6: `GET /api/flow/:kitId`, `GET /api/flow/:kitId/step/:stepId`, `POST .../initiate`, `GET .../generate` (SSE), `POST .../validate`, `POST .../freeze`, `PUT .../content`, `GET /api/project`, `POST /api/project/initialize`, `POST /api/kit/refresh`
- `GET /api/health` health check endpoint
- Request validation: path parameters, JSON body schemas
- Error response format: `{ error, code, details }` — no stack traces
- SSE implementation for `/generate` endpoint
- Unit tests for request validation and error formatting
- Integration tests with mocked Orchestration Service

#### Out of Scope / Non-Goals
- Business logic (delegated to Orchestration Service)
- UI rendering (UI Layer concern)

#### Inputs
- TDD §4.6 API route specifications
- Orchestration Service interface (WDD-CONSOLE-009)

#### Outputs
- Next.js Route Handler implementations for all routes
- Request validation middleware/utilities
- Error response formatting utilities
- SSE streaming implementation for generate endpoint
- Unit and integration tests

#### Acceptance Criteria (Executable)
- AC1: Given a valid `GET /api/flow/:kitId` request, when the route handler is called, then a JSON `FlowStatus` response is returned with 200 status
- Failure: If the response is malformed or missing fields, the route handler is incorrect
- AC2: Given a `GET /api/flow/:kitId/step/:stepId/generate` request for a step in `in-progress` state, when the route handler is called, then an SSE stream is returned with `Content-Type: text/event-stream`, yielding `GenerationEvent` objects
- Failure: If the response is not SSE format or events are not streamed incrementally, the streaming implementation is broken
- AC3: Given a request with an invalid JSON body (e.g., missing `artifactId` on freeze), when the route handler is called, then a 400 response with `{ error, code, details }` is returned
- Failure: If a 500 is returned or stack traces are exposed, input validation or error formatting is broken
- AC4: Given an Orchestration Service that throws `DependenciesNotMetError`, when the route handler is called, then a 409 response is returned with the appropriate error message
- Failure: If a 500 is returned, error mapping is incorrect
- AC5: Given a `GET /api/health` request, when the route handler is called, then a 200 response is returned
- Failure: If the health check fails, the deployment verification will fail

#### Definition of Done (Hard)
- [ ] PR merged
- [ ] Unit tests passing (Vitest)
- [ ] All routes tested with mocked Orchestration Service
- [ ] SSE streaming tested
- [ ] Error responses verified to never contain stack traces
- [ ] Health check endpoint working

#### Interface Contract References
- TDD §4.6 API Routes — **provider**
- TDD §4.5 `IOrchestrationService` — **consumer**

#### Dependencies
- WDD-CONSOLE-009 (Orchestration Service)

#### Rollback / Failure Behavior
API routes are stateless transport — all state mutations are delegated. If routes are incorrect, UI will receive wrong responses but no data corruption. Revert PR.

---

### WDD-CONSOLE-011 — Content Sanitization
- WDD Item ID: WDD-CONSOLE-011
- Parent TDD Section: §4.8 Content Sanitization
- Assignee Type: AI Agent
- Required Capabilities: security, frontend
- Complexity Estimate: S — Single concern (HTML sanitization); well-established library pattern; 2 ACs; one dependency

#### Intent
Implement the content sanitization layer that converts Markdown to HTML and sanitizes the output using an allowlist before it reaches the browser.

#### In Scope
- Markdown to HTML rendering (using `remark` + `rehype` or equivalent)
- HTML sanitization with the allowlist defined in TDD §4.8
- `sanitizeContent(markdown: string): string` function returning safe HTML
- Unit tests including XSS attack vectors (script tags, event handlers, javascript: URLs, iframe, object, embed)

#### Out of Scope / Non-Goals
- UI rendering of sanitized HTML (UI Layer concern)
- LLM response handling (LLM Service concern)

#### Inputs
- TDD §4.8 allowlist specification
- Markdown content (from LLM-generated artifacts)

#### Outputs
- `sanitizeContent` function
- Unit tests with XSS attack vectors

#### Acceptance Criteria (Executable)
- AC1: Given Markdown content with standard formatting (headings, lists, tables, code blocks), when `sanitizeContent` is called, then correctly rendered HTML is returned with only allowed elements
- Failure: If allowed elements are stripped or formatting is lost, the allowlist is too restrictive
- AC2: Given Markdown content containing `<script>alert('xss')</script>` or `<img onerror="alert('xss')">` or `<a href="javascript:alert('xss')">`, when `sanitizeContent` is called, then all malicious elements and attributes are stripped from the output
- Failure: If any script, event handler, or javascript: URL survives sanitization, the XSS prevention is broken

#### Definition of Done (Hard)
- [ ] PR merged
- [ ] Unit tests passing (Vitest)
- [ ] XSS attack vector tests included and passing
- [ ] Allowed elements render correctly

#### Interface Contract References
None — internal utility consumed by Server Layer and UI Layer

#### Dependencies
- WDD-CONSOLE-001 (project scaffolding — sanitization and Markdown libraries available)

#### Rollback / Failure Behavior
Sanitization is stateless. If incorrect, LLM content could be rendered unsafely. Revert PR immediately — this is a security-critical component.

---

### WDD-CONSOLE-012 — UI: Flow Stepper and Navigation
- WDD Item ID: WDD-CONSOLE-012
- Parent TDD Section: §4.7 UI Layer (FlowStepper, page structure)
- Assignee Type: AI Agent
- Required Capabilities: frontend
- Complexity Estimate: M — App Router pages, flow visualization, navigation state; 3 ACs; one dependency

#### Intent
Implement the Next.js App Router page structure and the FlowStepper component that renders the wizard step sequence from flow status data.

#### In Scope
- App Router pages: `/` (project overview), `/flow/[kitId]` (flow overview), `/flow/[kitId]/step/[stepId]` (step detail shell)
- `FlowStepper` component: renders step sequence from `FlowStatus`; shows completed/current/remaining; navigation between steps
- Server Components for data fetching (flow status from API)
- Client Component wrapper for interactive navigation state
- Component tests (React Testing Library)

#### Out of Scope / Non-Goals
- Step detail views (WDD-CONSOLE-013, WDD-CONSOLE-014)
- Artifact viewer and editor (WDD-CONSOLE-015)
- Project initialization UI (WDD-CONSOLE-016)

#### Inputs
- TDD §4.7 page structure and FlowStepper spec
- API routes (WDD-CONSOLE-010) for flow status data

#### Outputs
- Page components for all three routes
- `FlowStepper` component
- Component tests

#### Acceptance Criteria (Executable)
- AC1: Given a `FlowStatus` with 5 steps where 2 are frozen and 1 is current, when the FlowStepper renders, then 2 steps show completed state, 1 shows current state, and 2 show remaining state
- Failure: If step states are not correctly distinguished visually, the stepper is not rendering from the data
- AC2: Given the flow overview page, when a user clicks on a step, then they are navigated to the step detail page for that step
- Failure: If navigation does not work, the routing is broken
- AC3: Given the flow overview page, when the page loads, then flow status is fetched from the API and the stepper renders without client-side loading spinner for the initial render (SSR)
- Failure: If a loading spinner appears before the stepper, server-side rendering is not working

#### Definition of Done (Hard)
- [ ] PR merged
- [ ] Component tests passing (Vitest + React Testing Library)
- [ ] All three page routes render
- [ ] FlowStepper renders from FlowStatus data

#### Interface Contract References
- TDD §4.6 `GET /api/flow/:kitId` — **consumer**

#### Dependencies
- WDD-CONSOLE-010 (API Routes — provides flow status data)

#### Rollback / Failure Behavior
UI components are stateless renderers. If incorrect, the wizard displays wrong information but no data corruption. Revert PR.

---

### WDD-CONSOLE-013 — UI: Step Views (Generation, Validation, Freeze)
- WDD Item ID: WDD-CONSOLE-013
- Parent TDD Section: §4.7 UI Layer (StepView, GenerationStream, ValidationResultView)
- Assignee Type: AI Agent
- Required Capabilities: frontend
- Complexity Estimate: L — Multiple interactive components; SSE consumption; step type branching; 5 ACs; two dependencies

#### Intent
Implement the step detail views for LLM-generated and acceptance-check step types, including generation streaming, validation result display, and freeze approval.

#### In Scope
- `StepView` component: renders appropriate view based on `stepType` (llm-generated, acceptance-check, consistency-check)
- `GenerationStream` component: connects to SSE endpoint; renders chunks progressively; shows loading/error/completion states
- `ValidationResultView` component: renders PASS/FAIL, hard gates table, blocking issues, warnings, completeness score
- Freeze approval UI: button to freeze validated artifact with artifact ID input
- `ProcessTransparency` component: displays spec/template/prompt/validator file paths and required_inputs paths
- Component tests

#### Out of Scope / Non-Goals
- Human-intake form views (WDD-CONSOLE-014)
- Artifact viewer/editor (WDD-CONSOLE-015)
- Navigation between steps (WDD-CONSOLE-012)

#### Inputs
- TDD §4.7 StepView, GenerationStream, ValidationResultView, ProcessTransparency specs
- API routes for generation (SSE), validation, freeze (WDD-CONSOLE-010)

#### Outputs
- StepView, GenerationStream, ValidationResultView, ProcessTransparency components
- Component tests

#### Acceptance Criteria (Executable)
- AC1: Given an `llm-generated` step in `in-progress` state, when the user clicks "Generate", then the GenerationStream component connects to the SSE endpoint and renders chunks as they arrive
- Failure: If content only appears after generation completes, streaming is not working
- AC2: Given a completed generation, when the validation result is FAIL, then the ValidationResultView shows the FAIL status, lists blocking issues with gate names, and shows the completeness score
- Failure: If blocking issues or gate details are missing, the validation display is incomplete
- AC3: Given a step in `validated-pass` state, when the user enters an artifact ID and clicks "Freeze", then the freeze API is called and the step transitions to frozen
- Failure: If the step does not transition, the freeze pipeline is broken
- AC4: Given any step, when the step detail page loads, then the ProcessTransparency component displays the file paths for spec, template, prompt, validator, and any required_inputs
- Failure: If file paths are not shown, PRD constraint C-1 (process transparency) is violated
- AC5: Given an SSE connection that receives an error event, when the error occurs, then the GenerationStream component displays an error message and a retry button
- Failure: If the error is swallowed or no retry is available, error handling is broken

#### Definition of Done (Hard)
- [ ] PR merged
- [ ] Component tests passing (Vitest + React Testing Library)
- [ ] SSE streaming tested with mock EventSource
- [ ] Validation result rendering tested for PASS and FAIL
- [ ] Process transparency displays file paths

#### Interface Contract References
- TDD §4.6 `GET .../generate` (SSE), `POST .../validate`, `POST .../freeze` — **consumer**

#### Dependencies
- WDD-CONSOLE-010 (API Routes)
- WDD-CONSOLE-011 (Content Sanitization — for rendering generated artifacts)

#### Rollback / Failure Behavior
UI components are stateless. Revert PR if rendering is incorrect. No data corruption risk.

---

### WDD-CONSOLE-014 — UI: Human Intake Forms
- WDD Item ID: WDD-CONSOLE-014
- Parent TDD Section: §4.7 UI Layer (StepView for human-intake step type)
- Assignee Type: AI Agent
- Required Capabilities: frontend
- Complexity Estimate: M — Form rendering from template structure; input validation; 3 ACs; one dependency

#### Intent
Implement the step detail view for `human-intake` step types, rendering guided forms that map to the AIEOS template structure.

#### In Scope
- `IntakeForm` component: renders a guided form experience for human-intake steps
- Form fields derived from the template content (headings become sections, bullet points become form fields)
- Client-side form validation (supplementary — server validates on save)
- Save draft and submit actions (save content via `PUT .../content` API)
- Component tests

#### Out of Scope / Non-Goals
- LLM-generated step views (WDD-CONSOLE-013)
- Template parsing logic beyond rendering form fields from template structure
- Kit authoring (NG-1)

#### Inputs
- TDD §4.7 StepView spec for human-intake type
- Template content from Kit Service (via step context)
- API route for content updates (WDD-CONSOLE-010)

#### Outputs
- IntakeForm component
- Component tests

#### Acceptance Criteria (Executable)
- AC1: Given a human-intake step with template content, when the step detail page loads, then a form is rendered with sections and fields corresponding to the template structure
- Failure: If the form does not reflect the template, the form generation is broken
- AC2: Given a form with user-entered content, when the user clicks "Save Draft", then the content is sent to the API via `PUT .../content` and saved
- Failure: If the content is not saved, the save pipeline is broken
- AC3: Given a previously saved intake form, when the step detail page loads again, then the form is pre-populated with the saved content
- Failure: If the form is empty, state persistence for intake forms is broken

#### Definition of Done (Hard)
- [ ] PR merged
- [ ] Component tests passing (Vitest + React Testing Library)
- [ ] Form renders from template content
- [ ] Save and reload tested

#### Interface Contract References
- TDD §4.6 `PUT .../content`, `GET .../step/:stepId` — **consumer**

#### Dependencies
- WDD-CONSOLE-010 (API Routes)

#### Rollback / Failure Behavior
Form components are stateless renderers. Content is saved via the API and persisted by State Service. Revert PR if forms are incorrect. No data corruption risk.

---

### WDD-CONSOLE-015 — UI: Artifact Viewer and Editor
- WDD Item ID: WDD-CONSOLE-015
- Parent TDD Section: §4.7 UI Layer (ArtifactViewer, ArtifactEditor)
- Assignee Type: AI Agent
- Required Capabilities: frontend
- Complexity Estimate: M — Markdown rendering with sanitization; text editor; 3 ACs; two dependencies

#### Intent
Implement the ArtifactViewer (sanitized Markdown rendering) and ArtifactEditor (text editing with save and re-validation tracking) components.

#### In Scope
- `ArtifactViewer` component: renders sanitized HTML from Markdown content; displays formatted artifacts (not raw source)
- `ArtifactEditor` component: Markdown text editor; tracks dirty state; saves via API; indicates that editing resets validation state
- Toggle between viewer and editor modes for draft artifacts
- Component tests

#### Out of Scope / Non-Goals
- Sanitization logic (WDD-CONSOLE-011 — consumed as a dependency)
- Rich text editing (plain text/Markdown editing is sufficient)

#### Inputs
- TDD §4.7 ArtifactViewer and ArtifactEditor specs
- Content sanitization function (WDD-CONSOLE-011)
- API route for content updates (WDD-CONSOLE-010)

#### Outputs
- ArtifactViewer and ArtifactEditor components
- Component tests

#### Acceptance Criteria (Executable)
- AC1: Given Markdown content, when ArtifactViewer renders, then formatted HTML is displayed (headings, lists, tables, code blocks rendered correctly) and no raw Markdown source is visible
- Failure: If raw Markdown is shown or formatting is lost, the rendering pipeline is broken
- AC2: Given a draft artifact, when the user edits content in ArtifactEditor and clicks save, then the updated content is sent to the API and the UI indicates validation must be re-run
- Failure: If the save fails or no re-validation indicator appears, the edit pipeline is incomplete
- AC3: Given a frozen artifact, when ArtifactViewer renders, then no edit button is available
- Failure: If editing is available for frozen artifacts, immutability is not enforced in the UI

#### Definition of Done (Hard)
- [ ] PR merged
- [ ] Component tests passing (Vitest + React Testing Library)
- [ ] Markdown rendering tested with common formatting
- [ ] Edit → save → re-validation indicator tested
- [ ] Frozen artifact read-only mode tested

#### Interface Contract References
- TDD §4.6 `PUT .../content` — **consumer**

#### Dependencies
- WDD-CONSOLE-011 (Content Sanitization)
- WDD-CONSOLE-010 (API Routes)

#### Rollback / Failure Behavior
UI components are stateless. Revert PR. No data corruption risk.

---

### WDD-CONSOLE-016 — UI: Project Setup Page
- WDD Item ID: WDD-CONSOLE-016
- Parent TDD Section: §4.7 UI Layer (root page `/`), §4.6 (`POST /api/project/initialize`)
- Assignee Type: AI Agent
- Required Capabilities: frontend
- Complexity Estimate: S — Single form page; straightforward; 2 ACs; one dependency

#### Intent
Implement the project setup page at `/` that allows users to configure kit directories, LLM settings, and initialize a new project.

#### In Scope
- Project configuration form: project directory, kit directory paths, LLM provider, model, API key env var name
- Initialize button calling `POST /api/project/initialize`
- Display existing project state if already initialized
- Component tests

#### Out of Scope / Non-Goals
- Flow navigation (WDD-CONSOLE-012)
- Kit configuration editing after initialization

#### Inputs
- TDD §4.6 `POST /api/project/initialize`, `GET /api/project` specs
- API routes (WDD-CONSOLE-010)

#### Outputs
- Project setup page component
- Component tests

#### Acceptance Criteria (Executable)
- AC1: Given no existing project, when the user fills in the configuration form and clicks "Initialize", then the project is initialized via the API and the user is navigated to the flow overview
- Failure: If initialization fails or navigation does not occur, the setup pipeline is broken
- AC2: Given an existing initialized project, when the root page loads, then the existing project configuration is displayed and the user can navigate to flows
- Failure: If the existing state is not shown, project detection is broken

#### Definition of Done (Hard)
- [ ] PR merged
- [ ] Component tests passing (Vitest + React Testing Library)
- [ ] Initialize flow tested
- [ ] Existing project detection tested

#### Interface Contract References
- TDD §4.6 `POST /api/project/initialize`, `GET /api/project` — **consumer**

#### Dependencies
- WDD-CONSOLE-010 (API Routes)

#### Rollback / Failure Behavior
UI component. Revert PR. No data corruption risk.

---

### WDD-CONSOLE-017 — Structured Logging
- WDD Item ID: WDD-CONSOLE-017
- Parent TDD Section: §7 Observability
- Assignee Type: AI Agent
- Required Capabilities: backend, observability
- Complexity Estimate: S — Single utility; well-established pattern; 2 ACs; one dependency

#### Intent
Implement the structured logging utility that produces JSON-formatted log entries with contextual identifiers, used by all server-side components.

#### In Scope
- Logger utility producing JSON to stdout
- Required fields: `timestamp` (ISO-8601), `level`, `event`, `requestId` (where applicable)
- Log levels: INFO, ERROR
- All log events defined in TDD §7
- Verification that secrets are never included in log output
- Unit tests

#### Out of Scope / Non-Goals
- Log aggregation or external log shipping
- Client-side logging

#### Inputs
- TDD §7 log event specifications

#### Outputs
- Logger utility module
- Unit tests

#### Acceptance Criteria (Executable)
- AC1: Given a log call with event, level, and context fields, when the logger is invoked, then a JSON line is written to stdout with `timestamp`, `level`, `event`, and all provided context fields
- Failure: If the output is not valid JSON or fields are missing, the logger is broken
- AC2: Given a log call that includes a field named `apiKey` or `secret`, when the logger is invoked, then those fields are redacted or excluded from the output
- Failure: If secrets appear in log output, the secret redaction is broken

#### Definition of Done (Hard)
- [ ] PR merged
- [ ] Unit tests passing (Vitest)
- [ ] All TDD §7 log events covered
- [ ] Secret redaction tested

#### Interface Contract References
None — internal utility consumed by all server-side components

#### Dependencies
- WDD-CONSOLE-001 (project scaffolding)

#### Rollback / Failure Behavior
Logging is a cross-cutting utility. If incorrect, logs will be malformed but no data corruption. Revert PR.

---

### WDD-CONSOLE-018 — End-to-End Tests
- WDD Item ID: WDD-CONSOLE-018
- Parent TDD Section: §8 Testing Strategy (E2E tests)
- Assignee Type: AI Agent
- Required Capabilities: testing, frontend, backend
- Complexity Estimate: L — Full application integration; multiple user flows; requires running application; 5 ACs; multiple dependencies

#### Intent
Implement Playwright end-to-end tests covering critical user flows: project initialization, artifact generation through freeze, wizard navigation, error handling, and content editing.

#### In Scope
- Project initialization flow test
- Artifact generation through freeze test (at least one complete step)
- Wizard navigation across multiple steps test
- Error handling test (simulated LLM provider error)
- Content editing test (edit → re-validation required)
- Test fixtures with sample kit directory containing a valid `flow.yaml`
- Mock LLM provider for deterministic test results

#### Out of Scope / Non-Goals
- Performance testing
- Visual regression testing
- Testing against real LLM providers

#### Inputs
- TDD §8 E2E test specifications
- All application components (WDD-CONSOLE-001 through WDD-CONSOLE-017)

#### Outputs
- Playwright test files
- Test fixtures (sample kit directory, sample flow.yaml, mock LLM responses)
- CI configuration for running Playwright tests

#### Acceptance Criteria (Executable)
- AC1: Given a running application with a sample kit directory, when the project initialization flow test runs, then it completes successfully: navigate to app → configure → initialize → verify state created
- Failure: If any step in the flow fails, the integration is broken
- AC2: Given an initialized project, when the artifact generation flow test runs, then it completes: navigate to step → initiate → generate → review → validate → freeze → verify state
- Failure: If the artifact does not reach frozen state, the end-to-end pipeline is broken
- AC3: Given multiple frozen steps, when the wizard navigation test runs, then step progression works correctly across multiple steps
- Failure: If navigation fails between steps, the flow progression is broken
- AC4: Given a mock LLM provider configured to return errors, when the error handling test runs, then the error is displayed, state is unchanged, and retry works
- Failure: If state is corrupted after an error, failure isolation is broken
- AC5: Given a generated artifact, when the content editing test runs, then edits are saved, state resets to draft, and re-validation succeeds
- Failure: If state does not reset after editing, stale validation results persist

#### Definition of Done (Hard)
- [ ] PR merged
- [ ] All Playwright tests passing
- [ ] Test fixtures committed (sample kit, mock LLM)
- [ ] CI configuration for Playwright included

#### Interface Contract References
None — E2E tests exercise the full application stack

#### Dependencies
- All prior work items (WDD-CONSOLE-001 through WDD-CONSOLE-017)

#### Rollback / Failure Behavior
Tests are non-destructive. If tests fail, they indicate application defects — no rollback needed for the tests themselves.

---

### WDD-CONSOLE-019 — Docker and Deployment Finalization
- WDD Item ID: WDD-CONSOLE-019
- Parent TDD Section: §5 Build and Deployment, §9 Operational Notes
- Assignee Type: AI Agent
- Required Capabilities: infrastructure
- Complexity Estimate: S — Verification of existing Docker setup; deployment documentation; 2 verification items

#### Intent
Verify the Docker deployment works end-to-end with real kit directories and project directory, and document the deployment and rollback procedures.

#### In Scope
- Verify Docker image builds and runs with real AIEOS kit directories mounted
- Verify environment variable configuration works correctly
- Verify health check endpoint works in Docker
- Verify volume mount permissions (read-only for kits, read-write for project)
- Document deploy, verify, and rollback procedures per TDD §9

#### Out of Scope / Non-Goals
- Cloud deployment (NG-5)
- CI/CD pipeline setup (separate concern)

#### Inputs
- TDD §5 Build and Deployment, §9 Operational Notes
- Docker image from WDD-CONSOLE-001
- Real AIEOS kit directories

#### Outputs
- Verified Docker deployment with real kit directories
- Deployment documentation (deploy, verify, rollback procedures)

#### Acceptance Criteria (Executable)
- AC1: Given the project source, when `docker build -t aieos-console .` is run, then the image builds successfully with a non-root user and health check configured
- Failure: If the build fails or the image runs as root, the Dockerfile is incorrect
- AC2: Given the Docker image and real AIEOS kit directories, when the container is started with kit directories mounted read-only and project directory mounted read-write, then the application starts, the health check returns 200, and the startup log confirms all kits loaded
- Failure: If the health check fails or kits are not loaded, the deployment configuration is broken
- AC3: Given a running container, when environment variables (LLM_API_KEY, LLM_PROVIDER, LLM_MODEL) are set, then the application reads them correctly and the LLM Service is configured
- Failure: If environment variables are not picked up, the configuration loading is broken
- AC4: Given a running container with project state, when the container is stopped and restarted with the same volume mounts, then the project state loads correctly from the persisted state.json
- Failure: If state is lost between restarts, the volume mount or state persistence is broken

#### Definition of Done (Hard)
- [ ] PR merged
- [ ] Docker build succeeds
- [ ] Container starts with real kit directories
- [ ] Health check passes
- [ ] Deployment documentation written (deploy, verify, rollback procedures)
- [ ] Evidence logs generated

#### Interface Contract References
None

#### Dependencies
- All prior work items (complete application)

#### Rollback / Failure Behavior
Deployment verification is non-destructive. If the Docker setup fails, fix the Dockerfile or configuration and retry.

---

## 3. Work Groups

### Work Group WG-1: Foundation
- Group ID: WG-1
- Group Name: Foundation
- Business Capability: Project infrastructure is established and the core filesystem abstraction is operational, enabling all downstream component development
- Member Items: WDD-CONSOLE-001, WDD-CONSOLE-002, WDD-CONSOLE-017
- Acceptance Criteria (Group-Level):
  - Project builds, lints, type-checks, and runs in Docker
  - Filesystem Service passes all unit tests including path validation and atomic writes
  - Structured logging produces valid JSON to stdout

### Work Group WG-2: Kit and Flow Engine
- Group ID: WG-2
- Group Name: Kit and Flow Engine
- Business Capability: The application can read kit directories, parse flow definitions, and assemble step inputs — the spec-driven flow engine is operational
- Member Items: WDD-CONSOLE-003, WDD-CONSOLE-004, WDD-CONSOLE-005
- Acceptance Criteria (Group-Level):
  - A valid `flow.yaml` is parsed into a typed `FlowDefinition`
  - Kit directories are scanned and cached with four-file validation
  - Step inputs (four-file set + required_inputs + upstream artifacts) are assembled correctly

### Work Group WG-3: State Management
- Group ID: WG-3
- Group Name: State Management
- Business Capability: Project state can be initialized, loaded, and updated with full state transition enforcement, including artifact persistence and Engagement Record updates
- Member Items: WDD-CONSOLE-006, WDD-CONSOLE-007
- Acceptance Criteria (Group-Level):
  - Project initialization creates valid state
  - All legal state transitions succeed; all illegal transitions are rejected
  - Artifacts are saved atomically
  - Engagement Record is updated on freeze

### Work Group WG-4: LLM Integration
- Group ID: WG-4
- Group Name: LLM Integration
- Business Capability: The application can generate and validate artifacts via an LLM provider, with streaming support and provider abstraction
- Member Items: WDD-CONSOLE-008
- Acceptance Criteria (Group-Level):
  - Artifact generation returns complete responses with usage metrics
  - Streaming yields incremental chunks
  - Validation responses are parsed as structured JSON
  - Provider errors are handled gracefully

### Work Group WG-5: Orchestration and API
- Group ID: WG-5
- Group Name: Orchestration and API
- Business Capability: The complete backend is operational — flows can be loaded, steps initiated, artifacts generated/validated/frozen, all accessible via HTTP API
- Member Items: WDD-CONSOLE-009, WDD-CONSOLE-010, WDD-CONSOLE-011
- Acceptance Criteria (Group-Level):
  - Flow status correctly reflects step states and dependencies
  - Generation streaming works end-to-end (Orchestration → LLM → SSE → client)
  - Validation and freeze pipeline operates correctly
  - Content sanitization prevents XSS

### Work Group WG-6: User Interface
- Group ID: WG-6
- Group Name: User Interface
- Business Capability: Users can interact with the complete wizard: navigate flows, view steps, generate/validate/freeze artifacts, fill intake forms, edit content, and set up projects
- Member Items: WDD-CONSOLE-012, WDD-CONSOLE-013, WDD-CONSOLE-014, WDD-CONSOLE-015, WDD-CONSOLE-016
- Acceptance Criteria (Group-Level):
  - Flow stepper renders from flow definition data
  - All step types render appropriate views
  - SSE streaming displays progressive generation
  - Intake forms map to template structure
  - Artifacts render as formatted content, not raw Markdown
  - Project setup works for new and existing projects

### Work Group WG-7: Integration and Deployment
- Group ID: WG-7
- Group Name: Integration and Deployment
- Business Capability: The complete application is verified end-to-end with real kit directories and Docker deployment
- Member Items: WDD-CONSOLE-018, WDD-CONSOLE-019
- Acceptance Criteria (Group-Level):
  - All E2E tests pass
  - Docker deployment works with real kit directories
  - Deployment procedures documented and verified

---

## 4. Freeze Declaration (when ready)
This WDD is approved and frozen. Execution may proceed.

- Approved By: Initiative Owner
- Date: 2026-03-08
