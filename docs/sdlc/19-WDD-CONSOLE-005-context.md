### WDD-CONSOLE-005 — Step Input Assembly

#### WDD Work Item

- **WDD Item ID:** WDD-CONSOLE-005
- **Parent TDD Section:** §4.2 Kit Service (getStepInputs)
- **Assignee Type:** AI Agent
- **Required Capabilities:** backend
- **Complexity Estimate:** M

**Intent:** Implement the Kit Service `getStepInputs` method that assembles all required inputs for a given step: four-file content, required_inputs, and upstream frozen artifacts.

**In Scope:**
- `getStepInputs` implementation
- `StepInputs`, `NamedInput` types
- Reading four-file content from kit directory via Filesystem Service
- Reading `required_inputs` from kit directory via Filesystem Service
- Reading upstream frozen artifacts from project directory
- `StepNotFoundError`, `InputFileNotFoundError` error types
- Unit tests with mocked Filesystem Service and State Service

**Out of Scope:**
- Determining which step to execute (Orchestration Service)
- LLM prompt construction (LLM Service)

**Inputs:** TDD §4.2 `IKitService.getStepInputs` contract, Loaded kit flow definition (from 004), Filesystem Service (002), State Service artifact paths (007)

**Outputs:** `getStepInputs` implementation, types, error types, unit tests

**Acceptance Criteria:**
- AC1: Given a step with four files and two required_inputs, when `getStepInputs` is called, then all 6 file contents are returned with correct names and roles
- AC2: Given a step with dependencies on two upstream steps that are both frozen, when `getStepInputs` is called, then both upstream artifact contents are included
- AC3: Given a step where a declared required_input file does not exist, when `getStepInputs` is called, then `InputFileNotFoundError` is thrown

**Definition of Done:**
- [ ] PR merged
- [ ] Unit tests passing (Vitest)
- [ ] All input assembly paths tested
- [ ] Error cases tested

**Interface Contract References:**
- TDD §4.2 `IKitService.getStepInputs` — **provider**
- TDD §4.1 `IFilesystemService` — **consumer**
- TDD §4.3 `IStateService` (reads artifact paths) — **consumer**

**Dependencies:** WDD-CONSOLE-002 (Filesystem Service), WDD-CONSOLE-004 (Kit Loader)

**Rollback:** Read-only operation, no state mutation. Revert PR.

#### TDD Sections

**Technical Context:**

TDD §4.2 `IKitService.getStepInputs` contract:

```
getStepInputs(kitPath: string, stepId: string, projectDir: string): Promise<StepInputs>
- Outputs: StepInputs { spec: string; template: string; prompt: string | null; validator: string; requiredInputs: NamedInput[]; upstreamArtifacts: NamedInput[] }
- Error modes: StepNotFoundError; InputFileNotFoundError; PathViolationError
- Behavior: Reads the step's four-file set and all required_inputs from kit directory. Reads upstream frozen artifacts from project directory. Returns all content assembled and named.
```

The method relies on the flow definition loaded by `loadKit` (WDD-CONSOLE-004) to determine which files belong to each step. Each step in the flow definition declares its four-file paths (spec, template, prompt, validator), its `required_inputs` list, and its upstream dependency steps. The method resolves upstream frozen artifact paths by querying the State Service for each dependency step's `artifactPath`.

**Testing Strategy:**

TDD §8 Kit Service tests: "Step input assembly: all four-file content returned; required_inputs resolved; upstream frozen artifacts included; missing files reported"

Required test cases:
- Four-file content correctly read and returned with roles (spec, template, prompt, validator)
- Prompt file is nullable — test with step that has no prompt file
- Required inputs resolved from kit directory and returned as NamedInput array
- Upstream frozen artifacts resolved from project directory via State Service artifact paths
- `StepNotFoundError` when stepId does not exist in flow definition
- `InputFileNotFoundError` when a declared required_input file is missing from disk
- `PathViolationError` when resolved paths escape allowed directories

**Interface Contracts:**

TDD §4.2 `IKitService.getStepInputs` — this item is the **provider**.

TDD §4.1 `IFilesystemService` — this item is a **consumer**. Uses `readFile` to read four-file content, required_inputs, and upstream frozen artifacts. All file reads go through the Filesystem Service path-validation layer.

TDD §4.3 `IStateService` — this item is a **consumer**. Uses `getArtifactState` to look up `artifactPath` for each upstream dependency step, so frozen artifact content can be read from the project directory.

#### ACF Sections

**Security and Compliance:**

ACF §3 Security Guardrails — Path traversal prevention: All file paths resolved by `getStepInputs` must be validated to stay within the kit directory (for four-file and required_inputs reads) or the project directory (for upstream frozen artifacts). Paths derived from flow definition content are untrusted and must be normalized and checked before use.

ACF §8 Forbidden Patterns — Hardcoded kit structure: The method must not assume fixed directory layouts or file naming conventions. All paths must be derived from the flow definition and resolved dynamically.

#### DCF Sections

**Testing Expectations:**

DCF §2 Design Principles — Complete input assembly from flow definitions: The method must assemble all inputs a downstream consumer (the Orchestration Service) needs to invoke LLM generation, without requiring the consumer to understand kit directory structure. Dependency injection: the Filesystem Service and State Service are injected, not instantiated internally.

DCF §6 Testing Expectations — Unit tests must mock the Filesystem Service and State Service. Tests must cover:
- Happy path: all files present, all upstream artifacts frozen and available
- Partial path: step with no prompt file (prompt is null)
- Error path: missing required_input file
- Error path: stepId not found in flow definition
- Error path: upstream artifact not yet frozen (artifactPath is null)
- Path validation: paths that attempt directory traversal are rejected
