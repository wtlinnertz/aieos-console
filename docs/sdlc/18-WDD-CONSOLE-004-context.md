### WDD-CONSOLE-004 — Kit Loader and Cache

#### WDD Work Item

- **WDD Item ID:** WDD-CONSOLE-004
- **Parent TDD Section:** §4.2 Kit Service (loadKit, invalidateCache)
- **Assignee Type:** AI Agent
- **Required Capabilities:** backend
- **Complexity Estimate:** M

**Intent:** Implement the Kit Service `loadKit` and `invalidateCache` methods, including kit directory reading, flow definition loading, four-file existence validation, and in-memory caching.

**In Scope:**
- `IKitService` TypeScript interface (partial: `loadKit`, `invalidateCache`)
- `loadKit` implementation: read `flow.yaml` via Filesystem Service, parse via flow definition parser, validate four-file paths exist, cache result
- `invalidateCache` implementation: clear all cached flow definitions
- `KitResult` type
- Verification that all four-file paths declared in flow steps actually exist in the kit directory
- Unit tests with mocked Filesystem Service

**Out of Scope / Non-Goals:**
- Step input assembly (WDD-CONSOLE-005)
- Flow definition parsing logic (WDD-CONSOLE-003)

**Inputs:**
- TDD §4.2 `IKitService` contract (`loadKit`, `invalidateCache`)
- Filesystem Service interface (WDD-CONSOLE-002)
- Flow definition parser (WDD-CONSOLE-003)

**Outputs:**
- `IKitService` interface definition (partial)
- `loadKit` and `invalidateCache` implementations
- `KitResult` type
- Unit tests

**Acceptance Criteria:**
- **AC1:** Given a kit directory containing a valid `flow.yaml` and all referenced four-file paths, when `loadKit` is called, then a `KitResult` is returned with the parsed `FlowDefinition` and kit path. Failure: If `loadKit` fails on a valid kit directory, the integration between parser and filesystem is broken
- **AC2:** Given a kit directory with a valid `flow.yaml` but a missing four-file (e.g., spec file does not exist), when `loadKit` is called, then an error is reported identifying the missing file. Failure: If `loadKit` succeeds with missing files, validation is incomplete
- **AC3:** Given a previously loaded kit, when `invalidateCache` is called and `loadKit` is called again, then the kit is re-read from the filesystem (not served from cache). Failure: If the cached version is returned after invalidation, the cache is not properly cleared

**Definition of Done:**
- [ ] PR merged
- [ ] Unit tests passing (Vitest)
- [ ] Cache invalidation tested
- [ ] Missing file validation tested

**Interface Contract References:**
- TDD §4.2 `IKitService.loadKit` — **provider**
- TDD §4.1 `IFilesystemService` — **consumer**

**Dependencies:**
- WDD-CONSOLE-002 (Filesystem Service)
- WDD-CONSOLE-003 (Flow Definition Parser)

**Rollback / Failure Behavior:** If kit loading fails incorrectly, flows cannot be rendered. Revert PR. No state mutation — read-only operations against kit directories.

**Mock impact note:** `IKitService` is consumed by: Orchestration Service (WDD-CONSOLE-009), Step Input Assembly (WDD-CONSOLE-005). When `IKitService.loadKit` changes, update mocks in: orchestration-service tests, step-input-assembly tests.

---

#### TDD Sections

**Technical Context:**

##### §4.2 Kit Service — loadKit and invalidateCache

```typescript
interface IKitService {
  loadKit(kitPath: string): Promise<KitResult>;
  getStepInputs(kitPath: string, stepId: string, projectDir: string): Promise<StepInputs>;
  invalidateCache(): void;
}
```

**`loadKit(kitPath: string): Promise<KitResult>`**
- **Outputs:** `KitResult { flow: FlowDefinition; kitPath: string }`
- **Error modes:** `FlowDefinitionNotFoundError`, `FlowDefinitionParseError`, `PathViolationError`
- **Behavior:** Reads `flow.yaml` from kit root via Filesystem Service. Parses YAML. Validates schema. Caches result in memory. Subsequent calls for the same `kitPath` return cached result without re-reading filesystem.

**`invalidateCache(): void`**
- **Behavior:** Clears all cached flow definitions. Next `loadKit` call will re-read from filesystem.

##### §4.2 Kit Service — Types

```typescript
interface KitResult {
  flow: FlowDefinition;
  kitPath: string;
}

interface FlowDefinition {
  kit: { name: string; id: string; version: string };
  steps: FlowStep[];
  handoff?: HandoffDefinition;
}

interface FlowStep {
  id: string;
  name: string;
  artifactType: string;
  stepType: 'llm-generated' | 'human-intake' | 'acceptance-check' | 'consistency-check';
  dependencies: string[];
  fourFiles: {
    spec: string;
    template: string;
    prompt: string | null;
    validator: string;
  };
  requiredInputs: { path: string; role: string }[];
  produces: { artifactIdPrefix: string; outputFilename: string };
  freezeGate: boolean;
}

interface HandoffDefinition {
  targetKit: string;
  artifactPlacement: {
    sourceStep: string;
    targetPath: string;
    acceptanceCheck: string;
  };
}
```

##### §4.1 Filesystem Service — Interface (consumed by Kit Loader)

```
IFilesystemService:
  readFile(path: string): Promise<FileResult>
  - Outputs: FileResult { content: string; encoding: 'utf-8' }
  - Error modes: PathViolationError, FileNotFoundError, PermissionError, ReadError

  exists(path: string): Promise<boolean>
  - Error modes: PathViolationError
```

The Kit Loader consumes `readFile` to read `flow.yaml` content and `exists` to validate that four-file paths declared in flow steps actually exist in the kit directory.

**Testing Strategy:**

##### §8 Testing Strategy — Kit Service (Loading and Caching)

- **Successful load:** Mock Filesystem Service to return valid `flow.yaml` content and `exists` returning `true` for all four-file paths. Verify `loadKit` returns a correctly typed `KitResult`.
- **Missing flow.yaml:** Mock Filesystem Service `readFile` to throw `FileNotFoundError`. Verify `loadKit` throws `FlowDefinitionNotFoundError`.
- **Missing four-file:** Mock `exists` to return `false` for one four-file path. Verify `loadKit` reports the missing file with its path.
- **Cache hit:** Call `loadKit` twice with same `kitPath`. Verify Filesystem Service `readFile` is called only once (second call served from cache).
- **Cache invalidation:** Call `loadKit`, then `invalidateCache`, then `loadKit` again. Verify Filesystem Service `readFile` is called twice (cache was cleared).
- **Parse error propagation:** Mock Filesystem Service to return malformed YAML. Verify `FlowDefinitionParseError` propagates from the parser.

**Interface Contracts:**

This item implements `IKitService.loadKit` and `IKitService.invalidateCache`. It consumes `IFilesystemService.readFile` and `IFilesystemService.exists`.

**Provider contract (this item implements):**
- `loadKit` must return `KitResult` with a valid `FlowDefinition` for valid kit directories.
- `loadKit` must validate that all four-file paths referenced in `FlowStep.fourFiles` exist in the kit directory.
- `invalidateCache` must clear the in-memory cache so subsequent `loadKit` calls re-read from filesystem.

**Consumer contract (this item depends on):**
- `IFilesystemService.readFile` — used to read `flow.yaml` content.
- `IFilesystemService.exists` — used to validate four-file path existence.

---

#### ACF Sections

**Security and Compliance:**

##### §8 Forbidden Patterns
- **Hardcoded kit structure:** Kit structure must be derived from the `flow.yaml` definition, not hardcoded in application code. The Kit Loader must read and interpret the flow definition dynamically. No assumptions about specific step names, artifact types, or file paths should be embedded in the loader logic.

---

#### DCF Sections

**Testing Expectations:**

##### §2 Design Principles (applicable to this item)
- **Data-driven flow, not code-driven flow:** The Kit Loader reads flow definitions from YAML files and interprets them at runtime. Kit structure is never hardcoded. Adding a new kit or modifying a flow requires only changing the `flow.yaml` file, not application code.
- **Dependency injection:** The Kit Loader receives its dependencies (`IFilesystemService`, flow definition parser) via injection. Unit tests mock these dependencies at service boundaries.
- **Service boundary discipline:** The Kit Loader orchestrates reading and parsing but does not implement parsing logic (that is the Flow Definition Parser's concern, WDD-CONSOLE-003) or raw file operations (Filesystem Service concern, WDD-CONSOLE-002).

##### §6 Testing Expectations

**Required test layers:**
- **Unit tests (Vitest):** All service layer functions, utility functions, validation logic. Mock only at service boundaries. For the Kit Loader, mock `IFilesystemService` and the flow definition parser.
- **Component tests (Vitest + React Testing Library):** All React components with user interaction.
- **End-to-end tests (Playwright):** Critical user flows.

**Evidence requirements:**
- Test results in machine-readable format
- Code coverage report
- Lint and type-check results (zero errors required)

**Promotion gates:**
- All unit and component tests pass
- No TypeScript type errors (strict mode)
- No ESLint errors
- No known high/critical CVEs
- No secrets detected
- SAST scan passes
- Container image scan passes
- E2E tests pass for critical flows
