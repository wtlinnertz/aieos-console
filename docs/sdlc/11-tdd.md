# TDD — aieos-console Technical Design Document

## 0. Document Control
- System / Component Name: aieos-console
- TDD ID: TDD-CONSOLE-001
- Author: AI-generated, human-reviewed
- Date: 2026-03-08
- Status: Frozen
- Governance Model Version: 1.0
- Prompt Version: 1.0
- Upstream Artifacts:
  - SAD: SAD-CONSOLE-001 (docs/sdlc/09-sad.md) — Frozen
  - ACF: ACF-CONSOLE-001 (docs/sdlc/08-acf.md) — Frozen
  - DCF: DCF-CONSOLE-001 (docs/sdlc/10-dcf.md) — Frozen
- Related ADRs: None

## 1. Intent Summary

- The system provides a browser-based guided wizard for the AIEOS happy path (PIK through EEK execution), reducing manual process navigation overhead (SAD §1, PRD G-1)
- The wizard is spec-driven: kit directories provide machine-readable flow definitions that declare artifact sequencing, dependencies, and step types; the console renders and executes flows from these definitions (SAD §5)
- LLM integration for artifact generation and validation, configurable per artifact type (SAD §4 LLM Service)
- Artifact state (draft, validated, frozen) persisted in the project directory via a service layer abstraction (SAD §4 State Service, §7)
- Three trust boundaries: browser ↔ server, server ↔ LLM provider, server ↔ filesystem (SAD §3)
- Single-user, single-process, local Docker deployment (SAD §5)
- Non-goal NG-1: No kit authoring or modification
- Non-goal NG-2: No multi-user concurrent access
- Non-goal NG-3: No authentication or authorization
- Non-goal NG-4: No non-happy-path flows
- Non-goal NG-5: No cloud deployment

## 2. Scope and Non-Goals (Hard Boundary)

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

## 3. Technical Overview

### Component Technology Map

| SAD Component | Technology | Key Libraries/Patterns |
|--------------|-----------|----------------------|
| UI Layer | Next.js App Router, React, TypeScript | Server Components for data fetching; Client Components for interactive wizard state; React Context for wizard navigation state |
| Server Layer | Next.js Route Handlers (App Router) | Request validation middleware; JSON response formatting |
| Orchestration Service | TypeScript module | Flow definition interpreter; state machine for step progression |
| Kit Service | TypeScript module | YAML parser for flow definitions; filesystem directory traversal; file content reader |
| State Service | TypeScript module | JSON file read/write for state metadata; Markdown file read/write for artifacts |
| LLM Service | TypeScript module | Provider abstraction interface; HTTP client for LLM API calls; Server-Sent Events for streaming |
| Filesystem Service | TypeScript module | Node.js `fs/promises`; path validation; atomic write (write-tmp + rename); lock file management |

### Key Data Flows

**Flow definition loading:**
Kit directories → Filesystem Service → Kit Service (parse YAML flow definitions) → Orchestration Service (interpret flow) → UI Layer (render wizard steps)

**Artifact generation:**
UI Layer (user initiates) → Server Layer → Orchestration Service (confirm dependencies frozen via State Service; assemble inputs via Kit Service) → LLM Service (send prompt + inputs) → Server Layer (stream response via SSE) → UI Layer (render progressively) → State Service (persist draft)

**Artifact validation:**
UI Layer (user initiates) → Server Layer → Orchestration Service (assemble validator + artifact via Kit Service) → LLM Service (send validator prompt + artifact) → State Service (record PASS/FAIL result) → UI Layer (display result)

**Artifact freeze:**
UI Layer (user approves) → Server Layer → Orchestration Service (confirm validated PASS) → State Service (write frozen artifact via Filesystem Service; update Engagement Record; update state metadata)

### Resolved Deferred Decisions

| SAD Deferred Decision | Resolution |
|----------------------|-----------|
| Flow definition file format and schema | YAML format; schema defined in §4.2 |
| Kit directory caching strategy | Cache parsed flow definitions and directory metadata in memory on first load; invalidate on explicit refresh action or application restart |
| LLM response streaming | Server-Sent Events (SSE) from Next.js Route Handlers to browser; LLM provider SDK streaming where available |
| Artifact state storage format | JSON metadata file per project (`.aieos/state.json`); artifacts stored as Markdown files in project `docs/sdlc/` directory |
| Content sanitization approach | Server-side HTML sanitization of Markdown-rendered LLM output before sending to browser; allowlist-based (permitted HTML tags only) |
| Lock file implementation | `.aieos/lock` file with PID and timestamp; stale lock detection via PID liveness check; cleanup on graceful shutdown |

## 4. Interfaces and Contracts (Hard)

### 4.1 Filesystem Service

**Boundary:** Infrastructure layer — all other services access the filesystem exclusively through this interface (SAD §4, ACF §8).

**Interface: `IFilesystemService`**

**`readFile(path: string): Promise<FileResult>`**
- Inputs: `path` — absolute or relative path (resolved against configured base directories)
- Outputs: `FileResult { content: string; encoding: 'utf-8' }`
- Error modes: `PathViolationError` (resolved path outside configured boundaries); `FileNotFoundError`; `PermissionError`; `ReadError` (I/O failure)
- Behavior: Validates resolved path is within configured project directory or kit directory boundaries. Resolves symlinks and re-validates. Returns file content as UTF-8 string.

**`writeFileAtomic(path: string, content: string): Promise<void>`**
- Inputs: `path` — target file path; `content` — file content as string
- Outputs: void on success
- Error modes: `PathViolationError`; `WriteError` (I/O failure, disk full); `PermissionError`
- Behavior: Writes content to a temporary file in the same directory, then renames to target path. If rename fails, temporary file is cleaned up. Target file is either fully written or unchanged — never partial.

**`readDirectory(path: string): Promise<DirectoryEntry[]>`**
- Inputs: `path` — directory path
- Outputs: `DirectoryEntry { name: string; type: 'file' | 'directory' }`
- Error modes: `PathViolationError`; `DirectoryNotFoundError`; `PermissionError`
- Behavior: Returns directory entries. Path boundary validation applied.

**`exists(path: string): Promise<boolean>`**
- Inputs: `path` — file or directory path
- Outputs: boolean
- Error modes: `PathViolationError`
- Behavior: Returns true if path exists within configured boundaries.

**`acquireLock(projectDir: string): Promise<LockResult>`**
- Inputs: `projectDir` — project directory path
- Outputs: `LockResult { acquired: boolean; existingLock?: LockInfo }`
- Error modes: `WriteError`
- Behavior: Checks for `.aieos/lock` file. If present, reads PID and checks liveness. If PID is dead, removes stale lock and acquires. If PID is alive, returns `acquired: false` with `existingLock` details. If no lock exists, creates lock file with current PID and ISO timestamp.

**`releaseLock(projectDir: string): Promise<void>`**
- Inputs: `projectDir` — project directory path
- Outputs: void
- Error modes: `WriteError`
- Behavior: Removes `.aieos/lock` file if it exists and was created by current process.

**Lock file format:**
```
{ "pid": number, "timestamp": "ISO-8601", "hostname": "string" }
```

### 4.2 Kit Service

**Boundary:** Reads kit directories (read-only); provides parsed flow definitions and kit file content to Orchestration Service and UI Layer (SAD §4).

**Interface: `IKitService`**

**Flow Definition Schema (YAML):**

```yaml
# flow.yaml — placed in each kit's root directory
kit:
  name: string                    # e.g., "Product Intelligence Kit"
  id: string                      # e.g., "pik"
  version: string                 # e.g., "1.0"

steps:
  - id: string                    # e.g., "work-classification"
    name: string                  # e.g., "Work Classification Record"
    artifact_type: string         # e.g., "wcr"
    step_type: enum               # "llm-generated" | "human-intake" | "acceptance-check" | "consistency-check"
    dependencies: string[]        # list of step IDs that must be frozen before this step can start
    four_files:
      spec: string                # relative path from kit root, e.g., "docs/specs/wcr-spec.md"
      template: string            # relative path
      prompt: string | null       # null for human-intake steps
      validator: string           # relative path
    required_inputs:              # additional files beyond four-file set
      - path: string              # relative path from kit root
        role: string              # e.g., "principles", "upstream-artifact", "playbook"
    produces:
      artifact_id_prefix: string  # e.g., "WCR"
      output_filename: string     # e.g., "{nn}-wcr.md" where {nn} is sequence number
    freeze_gate: boolean          # whether this step requires explicit freeze approval (default: true)

handoff:                          # optional — defines cross-kit boundary
  target_kit: string              # e.g., "eek"
  artifact_placement:
    source_step: string           # step ID of the artifact to hand off
    target_path: string           # e.g., "docs/sdlc/01-prd.md"
    acceptance_check: string      # step ID in target kit that validates the handoff
```

**TypeScript type for parsed flow definition:**

```
FlowDefinition {
  kit: { name: string; id: string; version: string }
  steps: FlowStep[]
  handoff?: HandoffDefinition
}

FlowStep {
  id: string
  name: string
  artifactType: string
  stepType: 'llm-generated' | 'human-intake' | 'acceptance-check' | 'consistency-check'
  dependencies: string[]
  fourFiles: { spec: string; template: string; prompt: string | null; validator: string }
  requiredInputs: { path: string; role: string }[]
  produces: { artifactIdPrefix: string; outputFilename: string }
  freezeGate: boolean
}

HandoffDefinition {
  targetKit: string
  artifactPlacement: { sourceStep: string; targetPath: string; acceptanceCheck: string }
}
```

**`loadKit(kitPath: string): Promise<KitResult>`**
- Inputs: `kitPath` — path to kit root directory
- Outputs: `KitResult { flow: FlowDefinition; kitPath: string }`
- Error modes: `FlowDefinitionNotFoundError` (no flow.yaml in kit root); `FlowDefinitionParseError` (invalid YAML or schema violation); `PathViolationError`
- Behavior: Reads `flow.yaml` from kit root via Filesystem Service. Parses YAML. Validates against FlowDefinition schema (all required fields present, step IDs unique, dependency references valid, four-file paths exist). Caches result in memory.

**`getStepInputs(kitPath: string, stepId: string, projectDir: string): Promise<StepInputs>`**
- Inputs: `kitPath`; `stepId`; `projectDir` — project directory for reading upstream frozen artifacts
- Outputs: `StepInputs { spec: string; template: string; prompt: string | null; validator: string; requiredInputs: NamedInput[]; upstreamArtifacts: NamedInput[] }`
- Error modes: `StepNotFoundError`; `InputFileNotFoundError` (a declared input file does not exist); `PathViolationError`
- Behavior: Reads the step's four-file set and all `required_inputs` from the kit directory. Reads upstream frozen artifacts from the project directory as determined by the step's dependencies. Returns all content assembled and named.

**`invalidateCache(): void`**
- Behavior: Clears all cached flow definitions and directory metadata. Next `loadKit` call will re-read from filesystem.

### 4.3 State Service

**Boundary:** Authoritative owner for all writes to the project directory (SAD §7). All state access from other services goes through this interface.

**Interface: `IStateService`**

**State metadata file:** `.aieos/state.json` in the project directory.

```
ProjectState {
  projectId: string
  kitConfigs: KitConfig[]           # configured kit paths
  llmConfigs: LlmConfig[]           # LLM provider configurations
  artifacts: ArtifactState[]        # per-artifact state
  llmUsage: LlmUsageRecord[]       # per-artifact LLM usage
}

KitConfig {
  kitId: string
  kitPath: string
}

LlmConfig {
  providerId: string
  model: string
  apiKeyEnvVar: string              # name of env var holding the API key
  artifactTypes?: string[]          # if set, use this config for these artifact types only
}

ArtifactState {
  stepId: string
  kitId: string
  artifactId: string | null         # null until generated
  status: 'not-started' | 'in-progress' | 'draft' | 'validated-pass' | 'validated-fail' | 'frozen'
  artifactPath: string | null       # relative path to artifact file
  validationResult: ValidationResult | null
  frozenAt: string | null           # ISO timestamp
  lastModified: string              # ISO timestamp
}

ValidationResult {
  status: 'PASS' | 'FAIL'
  summary: string
  hardGates: Record<string, 'PASS' | 'FAIL'>
  blockingIssues: { gate: string; description: string; location: string }[]
  warnings: { description: string; location: string }[]
  completenessScore: number
}

LlmUsageRecord {
  stepId: string
  artifactId: string
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  durationMs: number
  timestamp: string
  phase: 'generation' | 'validation'
}
```

**`initializeProject(projectDir: string, kitConfigs: KitConfig[], llmConfigs: LlmConfig[]): Promise<void>`**
- Inputs: project directory path, kit configurations, LLM configurations
- Outputs: void
- Error modes: `ProjectAlreadyInitializedError`; `WriteError`
- Behavior: Creates `.aieos/` directory. Writes initial `state.json` with empty artifacts array. Does not overwrite existing state.

**`loadState(projectDir: string): Promise<ProjectState>`**
- Inputs: project directory path
- Outputs: ProjectState
- Error modes: `StateNotFoundError` (no `.aieos/state.json`); `StateCorruptedError` (invalid JSON or schema violation)
- Behavior: Reads and parses `.aieos/state.json`. Validates schema. Reports inconsistencies.

**`getArtifactState(projectDir: string, stepId: string): Promise<ArtifactState>`**
- Inputs: project directory, step ID
- Outputs: ArtifactState for the step
- Error modes: `StepNotFoundError`
- Behavior: Returns current state for the specified step.

**`updateArtifactState(projectDir: string, stepId: string, update: Partial<ArtifactState>): Promise<void>`**
- Inputs: project directory, step ID, partial state update
- Outputs: void
- Error modes: `InvalidTransitionError` (e.g., draft → frozen without validation); `WriteError`
- Behavior: Validates state transition is legal (see state transition rules in SAD §7). Updates state.json atomically via Filesystem Service. Updates `lastModified` timestamp.

**`saveArtifact(projectDir: string, stepId: string, content: string, filename: string): Promise<string>`**
- Inputs: project directory, step ID, artifact content (Markdown), output filename
- Outputs: artifact file path (relative)
- Error modes: `WriteError`; `PathViolationError`
- Behavior: Writes artifact file to `docs/sdlc/{filename}` via Filesystem Service atomic write. Updates artifact state with path.

**`recordLlmUsage(projectDir: string, record: LlmUsageRecord): Promise<void>`**
- Inputs: project directory, usage record
- Outputs: void
- Error modes: `WriteError`
- Behavior: Appends usage record to state. Writes state atomically.

**`updateEngagementRecord(projectDir: string, artifactId: string, artifactType: string, status: string, notes: string): Promise<void>`**
- Inputs: project directory, artifact details
- Outputs: void
- Error modes: `WriteError`; `EngagementRecordNotFoundError`
- Behavior: Reads the Engagement Record file, updates the appropriate layer section with the artifact entry, writes back atomically.

**State transition validation rules:**
- `not-started` → `in-progress`: Allowed only if all dependency steps are `frozen`
- `in-progress` → `draft`: Allowed (artifact content generated)
- `draft` → `validated-pass`: Allowed (validator returned PASS)
- `draft` → `validated-fail`: Allowed (validator returned FAIL)
- `validated-fail` → `draft`: Allowed (user edits artifact for re-validation)
- `validated-pass` → `frozen`: Allowed (user explicitly approves freeze)
- `frozen` → any: Not allowed (terminal state in happy path)
- All other transitions: `InvalidTransitionError`

### 4.4 LLM Service

**Boundary:** Manages all communication with external LLM provider APIs (SAD §4). No other component calls LLM APIs directly.

**Interface: `ILlmService`**

**Provider abstraction:**

```
ILlmProvider {
  providerId: string
  sendRequest(request: LlmRequest): Promise<LlmResponse>
  sendStreamingRequest(request: LlmRequest): AsyncIterable<LlmChunk>
}

LlmRequest {
  systemPrompt: string
  userContent: string
  model: string
  maxTokens?: number
}

LlmResponse {
  content: string
  inputTokens: number
  outputTokens: number
  model: string
  durationMs: number
}

LlmChunk {
  content: string          # incremental text
  done: boolean            # true on final chunk
  inputTokens?: number     # present on final chunk
  outputTokens?: number    # present on final chunk
}
```

**`generateArtifact(config: LlmConfig, prompt: string, inputs: string): Promise<LlmResponse>`**
- Inputs: LLM configuration, assembled prompt (from kit prompt file), assembled inputs (spec + template + upstream artifacts + required inputs concatenated)
- Outputs: LlmResponse with generated artifact content
- Error modes: `LlmProviderError` (API error, auth failure); `LlmTimeoutError`; `LlmResponseParseError` (malformed response)
- Behavior: Resolves provider from config. Sends request with prompt as system message and inputs as user content. Returns complete response with usage metrics.

**`generateArtifactStreaming(config: LlmConfig, prompt: string, inputs: string): AsyncIterable<LlmChunk>`**
- Inputs: Same as `generateArtifact`
- Outputs: Async iterable of LlmChunk
- Error modes: Same as `generateArtifact`; plus `LlmStreamError` (stream interrupted)
- Behavior: Same as `generateArtifact` but returns chunks as they arrive. Final chunk includes usage metrics.

**`validateArtifact(config: LlmConfig, validatorPrompt: string, artifact: string, spec: string): Promise<LlmResponse>`**
- Inputs: LLM configuration, validator prompt, artifact content, spec content
- Outputs: LlmResponse with validation result (expected to be JSON matching ValidationResult schema)
- Error modes: Same as `generateArtifact`; plus `ValidationResponseParseError` (response is not valid ValidationResult JSON)
- Behavior: Sends validator prompt as system message. Sends artifact + spec as user content. Parses response as ValidationResult JSON. If response is not valid JSON or does not match schema, throws `ValidationResponseParseError`.

**Initial provider implementation:** Anthropic Claude API via `@anthropic-ai/sdk`. Additional providers added by implementing `ILlmProvider`.

### 4.5 Orchestration Service

**Boundary:** Executes flows from kit-provided flow definitions. Contains no kit-specific sequence logic (SAD §4, §5).

**Interface: `IOrchestrationService`**

**`getFlowStatus(projectDir: string, kitId: string): Promise<FlowStatus>`**
- Inputs: project directory, kit ID
- Outputs: `FlowStatus { steps: StepStatus[]; currentStep: StepStatus | null; completedSteps: number; totalSteps: number }`
- Error modes: `KitNotFoundError`; `StateNotFoundError`
- Behavior: Loads flow definition from Kit Service. Loads artifact states from State Service. Merges flow steps with state to produce per-step status. Identifies current step (first non-frozen step whose dependencies are all frozen). Returns flow status for UI rendering.

```
StepStatus {
  step: FlowStep                    # from flow definition
  state: ArtifactState              # from project state
  dependenciesMet: boolean          # all dependency steps frozen
  isCurrentStep: boolean            # this is the next actionable step
}
```

**`initiateStep(projectDir: string, kitId: string, stepId: string): Promise<StepContext>`**
- Inputs: project directory, kit ID, step ID
- Outputs: `StepContext { step: FlowStep; inputs: StepInputs; state: ArtifactState }`
- Error modes: `DependenciesNotMetError` (upstream steps not frozen); `StepAlreadyFrozenError`; `KitNotFoundError`
- Behavior: Validates all dependency steps are frozen. Transitions state to `in-progress`. Assembles step inputs via Kit Service (four-file set + required_inputs + upstream frozen artifacts). Returns everything needed for the UI to present the step.

**`generateArtifact(projectDir: string, kitId: string, stepId: string): AsyncIterable<GenerationEvent>`**
- Inputs: project directory, kit ID, step ID
- Outputs: Async iterable of generation events (for SSE streaming to browser)
- Error modes: `StepNotInProgressError`; `LlmProviderError`; `LlmTimeoutError`
- Behavior: Gets step context. Resolves LLM config for this artifact type. Calls LLM Service streaming. Yields `GenerationEvent` objects (chunk, done, error). On completion, persists draft via State Service.

```
GenerationEvent {
  type: 'chunk' | 'done' | 'error'
  content?: string          # present for 'chunk'
  artifact?: string         # present for 'done' — full content
  usage?: LlmUsageRecord   # present for 'done'
  error?: string            # present for 'error'
}
```

**`validateArtifact(projectDir: string, kitId: string, stepId: string): Promise<ValidationResult>`**
- Inputs: project directory, kit ID, step ID
- Outputs: ValidationResult
- Error modes: `StepNotDraftError`; `LlmProviderError`
- Behavior: Reads current draft artifact from State Service. Gets validator prompt and spec from Kit Service. Calls LLM Service `validateArtifact`. Records validation result in State Service. Returns result.

**`freezeArtifact(projectDir: string, kitId: string, stepId: string, artifactId: string): Promise<void>`**
- Inputs: project directory, kit ID, step ID, artifact ID assigned by user
- Outputs: void
- Error modes: `StepNotValidatedPassError`; `WriteError`
- Behavior: Confirms step is in `validated-pass` state. Writes final frozen artifact via State Service. Updates Engagement Record. Transitions state to `frozen`.

**`updateArtifactContent(projectDir: string, kitId: string, stepId: string, content: string): Promise<void>`**
- Inputs: project directory, kit ID, step ID, updated content
- Outputs: void
- Error modes: `StepNotEditableError` (frozen steps cannot be edited)
- Behavior: Overwrites draft artifact content via State Service. If step was `validated-pass` or `validated-fail`, resets state to `draft` (edited content requires re-validation).

### 4.6 Server Layer (API Routes)

**Boundary:** HTTP interface between UI Layer and Service Layer. Handles request validation and response formatting.

**Route: `GET /api/flow/:kitId`**
- Purpose: Get flow status for a kit
- Inputs: `kitId` path parameter
- Outputs: JSON `FlowStatus`
- Error responses: 404 (kit not found); 500 (internal error)

**Route: `GET /api/flow/:kitId/step/:stepId`**
- Purpose: Get step context (inputs, state, flow step details)
- Inputs: `kitId`, `stepId` path parameters
- Outputs: JSON `StepContext`
- Error responses: 404 (kit or step not found); 409 (dependencies not met); 500

**Route: `POST /api/flow/:kitId/step/:stepId/initiate`**
- Purpose: Initiate a step (transition to in-progress, assemble inputs)
- Inputs: `kitId`, `stepId` path parameters
- Outputs: JSON `StepContext`
- Error responses: 404; 409 (dependencies not met or step already frozen); 500

**Route: `GET /api/flow/:kitId/step/:stepId/generate`**
- Purpose: Generate artifact via LLM (SSE streaming endpoint)
- Inputs: `kitId`, `stepId` path parameters
- Outputs: Server-Sent Events stream of `GenerationEvent`
- Error responses: 404; 409 (step not in-progress); 500; SSE error events for LLM failures
- Content-Type: `text/event-stream`

**Route: `POST /api/flow/:kitId/step/:stepId/validate`**
- Purpose: Validate current draft artifact
- Inputs: `kitId`, `stepId` path parameters
- Outputs: JSON `ValidationResult`
- Error responses: 404; 409 (step not in draft state); 500

**Route: `POST /api/flow/:kitId/step/:stepId/freeze`**
- Purpose: Freeze validated artifact
- Inputs: `kitId`, `stepId` path parameters; JSON body `{ artifactId: string }`
- Outputs: JSON `{ success: true }`
- Error responses: 404; 409 (step not validated-pass); 500

**Route: `PUT /api/flow/:kitId/step/:stepId/content`**
- Purpose: Update draft artifact content (user edits)
- Inputs: `kitId`, `stepId` path parameters; JSON body `{ content: string }`
- Outputs: JSON `{ success: true }`
- Error responses: 404; 409 (step frozen); 500

**Route: `GET /api/project`**
- Purpose: Get project state overview
- Outputs: JSON `ProjectState`
- Error responses: 500

**Route: `POST /api/project/initialize`**
- Purpose: Initialize a new project
- Inputs: JSON body `{ projectDir: string, kitConfigs: KitConfig[], llmConfigs: LlmConfig[] }`
- Outputs: JSON `{ success: true }`
- Error responses: 409 (already initialized); 400 (validation failure); 500

**Route: `POST /api/kit/refresh`**
- Purpose: Invalidate kit cache and reload flow definitions
- Outputs: JSON `{ success: true, kits: string[] }` (list of loaded kit IDs)
- Error responses: 500

**Request validation:** All routes validate path parameters and request bodies server-side. Invalid inputs return 400 with a structured error response `{ error: string; details?: string }`. No stack traces or infrastructure details in error responses.

**Error response format:**
```
{ "error": "Human-readable error message", "code": "ERROR_CODE", "details": "Additional context if available" }
```

### 4.7 UI Layer

**Boundary:** Browser-based React interface. Communicates exclusively with Server Layer via HTTP/SSE. No direct access to services.

**Page structure (Next.js App Router):**

| Route | Purpose | Component Type |
|-------|---------|---------------|
| `/` | Project setup / overview | Server Component (loads project state) |
| `/flow/[kitId]` | Flow overview — shows all steps with status | Server Component (loads flow status) |
| `/flow/[kitId]/step/[stepId]` | Step detail — intake form, generation, review, validation, freeze | Client Component (interactive wizard state) |

**Key UI components:**

- **`FlowStepper`** — Renders the step sequence from the parsed flow definition. Shows completed/current/remaining steps. Driven entirely by `FlowStatus` data from the API.
- **`StepView`** — Renders the current step based on `stepType`:
  - `human-intake`: Renders a guided form mapped to the template structure
  - `llm-generated`: Shows "Generate" button, streams output, shows rendered artifact
  - `acceptance-check`: Shows source artifact and PASS/FAIL result
  - `consistency-check`: Shows comparison view and PASS/FAIL result
- **`ArtifactViewer`** — Renders Markdown artifact content as formatted HTML. Uses sanitized HTML output (see §4.8). Shows process transparency: which kit, which artifact type, which spec/prompt/validator files are being used.
- **`ArtifactEditor`** — Markdown text editor for user edits to draft artifacts. Edits trigger `PUT /api/flow/:kitId/step/:stepId/content`.
- **`ValidationResultView`** — Renders validation result: PASS/FAIL status, hard gates table, blocking issues, warnings, completeness score.
- **`GenerationStream`** — Connects to SSE endpoint. Renders LLM output progressively as chunks arrive. Shows loading state, error state, and completion state.
- **`ProcessTransparency`** — Displays which files are being used for the current step: spec path, template path, prompt path, validator path, and any required_inputs paths. Satisfies PRD C-1.

### 4.8 Content Sanitization

**Purpose:** All LLM-generated content is treated as untrusted (ACF §3). Content must be sanitized before rendering in the browser.

**Approach:** Server-side sanitization. The Server Layer renders Markdown to HTML, then sanitizes the HTML using an allowlist before sending to the UI.

**Allowlist (permitted HTML elements):**
- Block: `h1`–`h6`, `p`, `blockquote`, `pre`, `code`, `ul`, `ol`, `li`, `table`, `thead`, `tbody`, `tr`, `th`, `td`, `hr`, `br`, `div`
- Inline: `strong`, `em`, `a` (href allowlisted to http/https only), `code`, `span`
- Attributes: `class` (for syntax highlighting), `href` (on `a` only, http/https schemes only), `id` (for heading anchors)
- All other elements and attributes stripped
- All `javascript:` URLs stripped
- All event handler attributes (`onclick`, etc.) stripped
- All `<script>`, `<iframe>`, `<object>`, `<embed>`, `<form>` elements stripped

**Implementation:** Use a well-maintained HTML sanitization library (e.g., `sanitize-html` or `DOMPurify` with server-side adapter). The specific library is an implementation choice; the contract is the allowlist above.

## 5. Build and Deployment Approach (Deterministic)

### Build Steps

1. Install dependencies: `npm ci` (uses lockfile for exact versions)
2. Type check: `npx tsc --noEmit` (must exit 0)
3. Lint: `npx eslint . --max-warnings 0` (must exit 0)
4. Unit and component tests: `npx vitest run` (must exit 0)
5. Build application: `npx next build` (produces `.next/` output)
6. Build Docker image: `docker build -t aieos-console .`

### Deployment Steps

1. Ensure kit directories are accessible at configured paths on the host
2. Ensure project directory exists on the host (or will be created on initialization)
3. Run container: `docker run -v /path/to/kits:/kits:ro -v /path/to/project:/project -e LLM_API_KEY=<key> -p 3000:3000 aieos-console`
4. Verify: Access `http://localhost:3000` and confirm application loads; check Docker logs for startup confirmation log entry
5. On first use: Initialize project via the UI (project setup page)

### Configuration Inputs Required

| Name | Source | Purpose |
|------|--------|---------|
| `PROJECT_DIR` | Environment variable or container mount | Path to project directory inside container |
| `KIT_DIRS` | Environment variable (comma-separated) or container mounts | Paths to kit directories inside container |
| `LLM_API_KEY` | Environment variable | API key for the configured LLM provider |
| `LLM_PROVIDER` | Environment variable (default: `anthropic`) | LLM provider identifier |
| `LLM_MODEL` | Environment variable (default: provider-specific) | Model identifier |
| `PORT` | Environment variable (default: `3000`) | HTTP port |

### Secrets Required (names only)

- `LLM_API_KEY` — API key for the LLM provider; injected via environment variable; never logged, never written to artifacts or state files

### Dockerfile Structure

- Base: `node:{LTS}-alpine`
- Multi-stage: build stage (install deps, build Next.js) → production stage (copy build output, run)
- Non-root user in production stage
- Health check: `HEALTHCHECK CMD curl -f http://localhost:3000/api/health || exit 1`

## 6. Failure Handling and Rollback (Hard)

| Failure Mode | Detection Signal | Rollback / Compensation | Partial Failure Behavior |
|-------------|-----------------|------------------------|------------------------|
| LLM API unavailable | HTTP error or timeout from LLM provider SDK | No state change; user notified; retry available | Application remains functional for viewing existing artifacts; only generation/validation disabled |
| LLM response malformed | LLM Service response parsing fails | Draft not persisted; error returned to UI | Previous state unchanged; user can retry |
| LLM validation response not valid JSON | `ValidationResponseParseError` from LLM Service | Validation result not recorded; error returned to UI | Artifact remains in `draft` state; user can retry validation |
| Filesystem write failure | `WriteError` from Filesystem Service; atomic write ensures no partial files | Temporary file cleaned up; state unchanged | Previous artifact file and state.json remain consistent |
| Flow definition parse error | `FlowDefinitionParseError` from Kit Service | Kit not loaded; error surfaced to user | Other kits with valid flow definitions remain usable |
| State metadata corrupted | `StateCorruptedError` from State Service on load | User notified; state can be reconstructed from artifact files in `docs/sdlc/` | Application can start but project state must be re-initialized or manually repaired |
| Lock file stale (dead PID) | PID liveness check fails | Stale lock removed; new lock acquired | Normal operation proceeds |
| Lock file active (live PID) | PID liveness check succeeds | Application does not proceed; user notified | No state modification; user must close other instance |
| SSE stream interrupted | Client-side EventSource error event | Generation in progress may have partial content; draft not persisted until stream completes | User can retry generation; previous state unchanged |

## 7. Observability (Hard)

### Logs

All logs are structured JSON written to stdout (Docker container convention).

**Required log events:**

| Event | Level | Fields |
|-------|-------|--------|
| Application startup | INFO | `event: 'app.startup'`, `port`, `kitIds`, `projectDir` |
| Application shutdown | INFO | `event: 'app.shutdown'` |
| Kit loaded | INFO | `event: 'kit.loaded'`, `kitId`, `stepCount`, `kitPath` |
| Kit load error | ERROR | `event: 'kit.load_error'`, `kitId`, `kitPath`, `error` |
| Step initiated | INFO | `event: 'step.initiated'`, `kitId`, `stepId`, `artifactType` |
| Generation started | INFO | `event: 'llm.generation_started'`, `kitId`, `stepId`, `provider`, `model` |
| Generation completed | INFO | `event: 'llm.generation_completed'`, `kitId`, `stepId`, `inputTokens`, `outputTokens`, `durationMs` |
| Generation failed | ERROR | `event: 'llm.generation_failed'`, `kitId`, `stepId`, `error` |
| Validation completed | INFO | `event: 'validation.completed'`, `kitId`, `stepId`, `status`, `completenessScore` |
| Artifact frozen | INFO | `event: 'artifact.frozen'`, `kitId`, `stepId`, `artifactId` |
| State transition | INFO | `event: 'state.transition'`, `kitId`, `stepId`, `from`, `to` |
| Error (general) | ERROR | `event: 'error'`, `requestId`, `error`, `stack` (server-side only, never sent to client) |

All log entries include: `timestamp` (ISO-8601), `requestId` (where applicable).

### Metrics

LLM usage metrics are persisted in state.json (via State Service `recordLlmUsage`). These are queryable through the project state API and visible in the UI.

| Metric | Source |
|--------|--------|
| Tokens consumed per artifact | LlmUsageRecord in state.json |
| Provider and model per artifact | LlmUsageRecord in state.json |
| Request duration per LLM call | LlmUsageRecord in state.json |
| Validation cycles per artifact | Count of validation events per stepId in state.json |

### Evidence Required to Prove Success

- Application startup log with all kits loaded successfully
- For each artifact: generation log, validation log with PASS status, freeze log
- LLM usage records for each artifact in state.json
- Final project state.json showing all steps in `frozen` status

## 8. Testing Strategy (Hard)

### Unit Tests (Vitest)

**Filesystem Service:**
- Path validation: paths within boundaries allowed; paths outside boundaries throw `PathViolationError`; symlink resolution validated
- Atomic write: successful write produces correct file; failed write leaves no partial file; temporary file cleaned up on failure
- Lock file: acquire when no lock exists; detect stale lock (dead PID); refuse when active lock exists; release cleans up

**Kit Service:**
- Flow definition parsing: valid YAML produces correct FlowDefinition; missing required fields throw `FlowDefinitionParseError`; invalid step references throw parse error; duplicate step IDs throw parse error
- Step input assembly: all four-file content returned; required_inputs resolved; upstream frozen artifacts included; missing files reported

**State Service:**
- State transitions: all valid transitions succeed; invalid transitions throw `InvalidTransitionError`; frozen → any throws error
- State persistence: state roundtrips through JSON serialization; atomic write used for state updates
- LLM usage recording: records appended correctly; metrics queryable

**LLM Service:**
- Provider resolution: correct provider selected from config; unknown provider throws error
- Response parsing: valid LLM response parsed; malformed response throws error
- Validation response parsing: valid ValidationResult JSON parsed; invalid JSON throws `ValidationResponseParseError`

**Orchestration Service:**
- Flow status calculation: dependencies correctly evaluated; current step identified; completed count accurate
- Step initiation: dependencies-met check enforced; state transition triggered; inputs assembled
- Freeze: only `validated-pass` steps can be frozen; state updated; Engagement Record updated

### Component Tests (Vitest + React Testing Library)

- **FlowStepper:** Renders correct number of steps from flow definition; highlights current step; shows completed/remaining status
- **StepView:** Renders correct view for each step type (human-intake form, llm-generated with generate button, acceptance-check)
- **ArtifactViewer:** Renders sanitized HTML from Markdown; does not render script tags or event handlers
- **ArtifactEditor:** User edits trigger content update; tracks dirty state
- **ValidationResultView:** Renders PASS/FAIL; displays gate details, blocking issues, warnings
- **GenerationStream:** Shows loading state; renders chunks progressively; handles error state; shows completion state
- **ProcessTransparency:** Displays correct file paths for current step

### End-to-End Tests (Playwright)

- **Project initialization flow:** Navigate to app → configure project → verify project state created
- **Artifact generation through freeze:** Navigate to a step → initiate → generate → review output → validate → freeze → verify state updated and next step available
- **Wizard navigation:** Complete multiple steps in sequence → verify step progression → verify frozen artifacts accessible
- **Error handling:** Simulate LLM provider error → verify error message displayed → verify state unchanged → retry succeeds
- **Content editing:** Generate artifact → edit content → verify state resets to draft → re-validate

### Failure Tests

- **LLM provider unavailable:** Mock LLM API to return 500 → verify user sees error → verify no state corruption → verify retry works
- **Malformed LLM response:** Mock LLM API to return non-JSON for validation → verify `ValidationResponseParseError` handled gracefully → verify artifact remains in draft state
- **Filesystem write failure:** Mock Filesystem Service write to throw → verify no partial state → verify user notification
- **Invalid flow definition:** Provide malformed YAML → verify parse error surfaced → verify other kits still functional
- **Concurrent access:** Create lock file with live PID → attempt startup → verify lock refused message

### Pass/Fail Criteria

- All unit tests pass
- All component tests pass
- All E2E tests pass
- TypeScript strict mode: zero errors
- ESLint: zero errors, zero warnings
- Dependency audit: no high or critical CVEs
- Secret scanning: no secrets detected
- SAST: no critical findings
- Code coverage: measured and reported (no minimum threshold for initial release — baseline established)

## 9. Operational Notes (Minimum Runbook)

### Deploy Procedure
1. Build Docker image: `docker build -t aieos-console .`
2. Run container with volume mounts for kit directories (read-only) and project directory (read-write), and environment variables for LLM configuration
3. Verify startup log confirms all kits loaded and project directory accessible

### Verify Procedure
1. Access `http://localhost:3000` — application loads
2. Check Docker logs for `app.startup` event with no errors
3. Navigate to flow overview — verify kit steps are displayed
4. If project exists: verify artifact states are loaded correctly

### Rollback Procedure
1. Stop current container: `docker stop aieos-console`
2. Run previous image version: `docker run ... aieos-console:<previous-tag>`
3. Verify: access application and confirm project state loads correctly
4. Project state is forward-compatible within the same major version; state.json schema changes require explicit migration

### Ownership / On-Call Expectations
- Single-user local tool — no on-call rotation required
- User is responsible for Docker container lifecycle
- LLM provider availability is outside the application's control; the application handles provider outages gracefully

## 10. Dependencies

| Dependency | Purpose | Version Strategy |
|-----------|---------|-----------------|
| Next.js | Application framework (React SSR, API routes, routing) | Exact version pinned |
| React | UI component library | Exact version pinned (paired with Next.js) |
| TypeScript | Type system | Exact version pinned |
| `@anthropic-ai/sdk` | Initial LLM provider (Anthropic Claude API) | Exact version pinned |
| `yaml` | YAML parsing for flow definitions | Exact version pinned |
| HTML sanitization library | Content sanitization (e.g., `sanitize-html`) | Exact version pinned |
| Markdown rendering library | Markdown to HTML conversion (e.g., `remark` + `rehype`) | Exact version pinned |
| Vitest | Unit and component testing | Exact version pinned (dev) |
| `@testing-library/react` | Component testing | Exact version pinned (dev) |
| Playwright | End-to-end testing | Exact version pinned (dev) |
| ESLint | Linting | Exact version pinned (dev) |

All dependencies pinned to exact versions (ACF §8). No floating version ranges.

## 11. Risks and Assumptions

### Risks

- **Flow definition schema may need iteration:** The YAML schema defined in §4.2 is designed from the current kit structures but has not been validated against all existing kits. The schema may need refinement during implementation. Mitigation: schema is versioned (`kit.version`); Kit Service validates and reports parse errors with specific diagnostics.
- **SSE streaming through Next.js:** Server-Sent Events from Next.js Route Handlers may have edge cases with connection management, buffering, or proxy behavior in Docker. Mitigation: E2E tests cover streaming; fallback to non-streaming generation available if SSE proves unreliable.
- **LLM response quality for complex artifacts:** Validation response parsing assumes the LLM returns valid JSON matching the ValidationResult schema. If the LLM fails to produce parseable JSON, validation cannot proceed. Mitigation: `ValidationResponseParseError` handled gracefully; retry available; prompt engineering for reliable JSON output.

### Assumptions

- **Kit directories contain `flow.yaml` files:** Each kit must provide a flow definition in the expected schema. If a kit lacks a flow.yaml, it cannot be used with the console. This is a new requirement introduced by the spec-driven architecture (SAD §5, §12).
- **Single-process sufficient for SSE + rendering:** A single Node.js process can handle SSE streaming and concurrent page rendering for one user without degradation. If false: worker thread for LLM streaming may be needed.
- **`.aieos/` directory convention is acceptable:** Using a `.aieos/` subdirectory in the project directory for state metadata and lock files will not conflict with other tools or user conventions.

## 12. Freeze Declaration (when ready)
This TDD is approved and frozen. Downstream artifacts may not reinterpret or expand this design.

- Approved By: Initiative Owner
- Date: 2026-03-08

<!-- PRINCIPLES COVERAGE
| Principles File | Section | TDD Section Addressed | Status |
|---|---|---|---|
| security-principles.md | §2.1 Input Handling | §4.6 Request validation; §4.7 form validation; §8 Unit tests for path validation | Addressed |
| security-principles.md | §2.2 Auth & Authz | §2 Non-Goals NG-3 (excluded); noted in §4.6 | N/A — auth excluded by PRD NG-3 |
| security-principles.md | §2.3 Secret Management | §5 Secrets Required; §4.3 LlmConfig uses env var reference; §7 logging rules exclude secrets | Addressed |
| security-principles.md | §2.4 Dependency Security | §10 all deps pinned; §8 pass/fail criteria includes dependency audit and SAST | Addressed |
| security-principles.md | §2.5 Error Handling | §4.6 error response format (no stack traces); §4.8 sanitization; §6 failure handling | Addressed |
| security-principles.md | §2.6 Logging | §7 log events defined; secrets never logged; structured JSON format | Addressed |
| security-principles.md | §2.7 Cryptography | §4.4 TLS via LLM provider SDK; no custom crypto in design | Addressed |
| security-principles.md | §2.8 Secure Configuration | §5 Dockerfile non-root user; env-specific config; feature flags not used | Addressed |
| security-principles.md | §3 CI/CD Gates | §8 pass/fail criteria: SAST, dependency scanning, secret scanning, container scanning | Addressed |
| security-principles.md | §4 Runtime Security | §5 Dockerfile non-root user; container-level security context | Addressed |
| code-craftsmanship.md | §1.1 Readability | DCF §2 enforces; TDD does not add implementation constraints beyond DCF | Deferred to DCF |
| code-craftsmanship.md | §1.2 SRP | DCF §2 enforces; SAD component boundaries enforce separation | Deferred to DCF |
| code-craftsmanship.md | §1.5 DRY | DCF §2 enforces | Deferred to DCF |
| code-craftsmanship.md | §1.7 Error Handling | §6 failure handling table; §4 error modes on every interface | Addressed |
| code-craftsmanship.md | §1.8 Dependency Discipline | §4 all services injected via interfaces; no implicit globals | Addressed |
| code-craftsmanship.md | §3 Test Design | §8 behavior-focused tests; coverage across unit/component/E2E; failure tests required | Addressed |
| code-craftsmanship.md | §4.3 Security Baseline | §4.1 path validation; §4.8 sanitization; §10 pinned deps; no custom crypto | Addressed |
| code-craftsmanship.md | §5 Red Flag Patterns | DCF §2 Prohibited Patterns enforces | Deferred to DCF |
| code-craftsmanship.md | §8 Definition of Done | §8 pass/fail criteria covers all DoD items | Addressed |
-->
