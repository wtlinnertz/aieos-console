### WDD-CONSOLE-003 — Flow Definition Parser

#### WDD Work Item

- **WDD Item ID:** WDD-CONSOLE-003
- **Parent TDD Section:** §4.2 Kit Service (flow definition schema and parsing)
- **Assignee Type:** AI Agent
- **Required Capabilities:** backend, API-design
- **Complexity Estimate:** M

**Intent:** Implement the flow definition YAML parser and schema validator within the Kit Service, producing typed `FlowDefinition` objects from kit `flow.yaml` files.

**In Scope:**
- `FlowDefinition`, `FlowStep`, `HandoffDefinition` TypeScript types (from TDD §4.2)
- YAML parsing of `flow.yaml` files using the `yaml` library
- Schema validation: required fields present, step IDs unique, dependency references valid, `stepType` is one of the allowed enum values
- `FlowDefinitionNotFoundError`, `FlowDefinitionParseError` error types
- Unit tests for valid parsing, missing fields, invalid references, malformed YAML

**Out of Scope / Non-Goals:**
- Kit directory traversal (WDD-CONSOLE-004)
- Step input assembly (WDD-CONSOLE-005)
- File content reading (uses Filesystem Service)

**Inputs:**
- TDD §4.2 flow definition YAML schema
- TDD §4.2 `FlowDefinition` TypeScript type
- `flow.yaml` file content (read via Filesystem Service)

**Outputs:**
- TypeScript types: `FlowDefinition`, `FlowStep`, `HandoffDefinition`
- `parseFlowDefinition(content: string): FlowDefinition` function
- Error types: `FlowDefinitionNotFoundError`, `FlowDefinitionParseError`
- Unit tests

**Acceptance Criteria:**
- **AC1:** Given a valid `flow.yaml` string matching the TDD §4.2 schema, when `parseFlowDefinition` is called, then a correctly typed `FlowDefinition` object is returned with all fields populated. Failure: If any field is missing or incorrectly typed, the parser is incomplete
- **AC2:** Given a `flow.yaml` with a missing required field (e.g., no `steps`), when `parseFlowDefinition` is called, then `FlowDefinitionParseError` is thrown with a message identifying the missing field. Failure: If parsing succeeds or the error message is generic, validation is insufficient
- **AC3:** Given a `flow.yaml` where a step's `dependencies` reference a non-existent step ID, when `parseFlowDefinition` is called, then `FlowDefinitionParseError` is thrown identifying the invalid reference. Failure: If parsing succeeds with an invalid reference, dependency validation is missing

**Definition of Done:**
- [ ] PR merged
- [ ] Unit tests passing (Vitest)
- [ ] All schema validation error paths tested
- [ ] TypeScript types exported for consumer use

**Interface Contract References:** TDD §4.2 `IKitService.loadKit` — **provider** (partial; this item implements the parsing component)

**Dependencies:** WDD-CONSOLE-001 (project scaffolding — `yaml` library available)

**Rollback / Failure Behavior:** If the parser produces incorrect types, downstream consumers (Kit Service loader, Orchestration Service) will receive invalid data. Revert and fix. Parser is isolated — no state mutation.

---

#### TDD Sections

**Technical Context:**

##### §4.2 Kit Service — Flow Definition Schema (YAML)

```yaml
kit:
  name: string
  id: string
  version: string
steps:
  - id: string
    name: string
    artifact_type: string
    step_type: enum  # "llm-generated" | "human-intake" | "acceptance-check" | "consistency-check"
    dependencies: string[]
    four_files:
      spec: string
      template: string
      prompt: string | null
      validator: string
    required_inputs:
      - path: string
        role: string
    produces:
      artifact_id_prefix: string
      output_filename: string
    freeze_gate: boolean
handoff:
  target_kit: string
  artifact_placement:
    source_step: string
    target_path: string
    acceptance_check: string
```

##### §4.2 Kit Service — TypeScript Types

```typescript
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

**Testing Strategy:**

##### §8 Testing Strategy — Kit Service (Flow Definition Parsing)

- **Valid parsing tests:** Given a complete, valid `flow.yaml` content string, verify that `parseFlowDefinition` returns a correctly typed `FlowDefinition` with all fields mapped from YAML snake_case to TypeScript camelCase.
- **Missing required fields:** Test each required field omission (kit, steps, step.id, step.name, step.step_type, step.four_files, etc.) and verify `FlowDefinitionParseError` is thrown with a descriptive message.
- **Invalid step type:** Verify that an unrecognized `step_type` value throws `FlowDefinitionParseError`.
- **Duplicate step IDs:** Verify that duplicate step IDs within `steps` array throw `FlowDefinitionParseError`.
- **Invalid dependency references:** Verify that a step referencing a non-existent step ID in its `dependencies` array throws `FlowDefinitionParseError`.
- **Malformed YAML:** Verify that syntactically invalid YAML throws `FlowDefinitionParseError`.
- **Optional handoff:** Verify that a `flow.yaml` without a `handoff` section parses successfully with `handoff` as `undefined`.

**Interface Contracts:**

##### §4.2 Parser Function Contract

```typescript
function parseFlowDefinition(content: string): FlowDefinition
```

- **Input:** Raw YAML string content of a `flow.yaml` file.
- **Output:** A validated, typed `FlowDefinition` object.
- **Error modes:**
  - `FlowDefinitionParseError` — YAML syntax error, missing required field, invalid enum value, duplicate step ID, invalid dependency reference.

**YAML-to-TypeScript field mapping:**
- `artifact_type` → `artifactType`
- `step_type` → `stepType`
- `four_files` → `fourFiles`
- `required_inputs` → `requiredInputs`
- `artifact_id_prefix` → `artifactIdPrefix`
- `output_filename` → `outputFilename`
- `target_kit` → `targetKit`
- `artifact_placement` → `artifactPlacement`
- `source_step` → `sourceStep`
- `target_path` → `targetPath`
- `acceptance_check` → `acceptanceCheck`
- `freeze_gate` → `freezeGate`

---

#### ACF Sections

**Security and Compliance:**

##### §3 Security Guardrails — Input Validation
- **Input validation:** All user-provided input validated server-side. Client-side is supplementary. Flow definition content is external input and must be validated against the expected schema before use. Malformed or unexpected content must produce explicit errors, not silent failures.

---

#### DCF Sections

**Testing Expectations:**

##### §3 Quality Bars (applicable to this item)
- **Flow definition contract must be typed:** The `FlowDefinition`, `FlowStep`, and `HandoffDefinition` types must be explicit TypeScript interfaces with all fields typed. No `any` types.
- **Input validation at system boundaries:** The parser is a system boundary — it accepts raw string input and must validate all content before producing typed output.
- Interfaces and contracts must be explicit (typed inputs, outputs, error types).
- Failure and rollback behavior must be defined.
- Cyclomatic complexity <=10 per function, max nesting 3.
- No magic strings or hardcoded configuration.

##### §2 Design Principles (applicable to this item)
- **Readability over cleverness:** Parser logic should be straightforward validation, not clever metaprogramming.
- **Explicit error handling:** No silent failures, no empty catch blocks. Every validation failure must produce a descriptive `FlowDefinitionParseError`.
- **Single responsibility:** The parser validates and transforms YAML content. It does not read files (Filesystem Service concern) or traverse directories (Kit Loader concern).

##### §6 Testing Expectations

**Required test layers:**
- **Unit tests (Vitest):** All service layer functions, utility functions, validation logic, flow definition parsing. Mock only at service boundaries.
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
