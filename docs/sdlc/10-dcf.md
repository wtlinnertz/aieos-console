# DCF — aieos-console Design Standards

## 0. Document Control
- DCF ID: DCF-CONSOLE-001
- Owner: Initiative Owner
- Date: 2026-03-08
- Status: Frozen
- Governance Model Version: 1.0
- Prompt Version: 1.0
- Applies To: aieos-console service only

## 1. Purpose
Define design-level standards and quality expectations that constrain all Technical Design Documents for aieos-console. These standards enforce code quality, testing rigor, operational readiness, and scope discipline derived from organizational engineering principles (code-craftsmanship.md, security-principles.md, product-craftsmanship.md) and the frozen ACF and SAD.

## 2. Design Principles (Hard)

- **Readability over cleverness:** Code must optimize for clarity. A mid-level engineer must understand any function's logic within 30 seconds. Dense expressions and clever shortcuts are prohibited.
- **Single responsibility:** Functions must do one thing (soft limit ≤ 30 lines, hard limit 50 lines unless justified). Modules must represent one cohesive responsibility. No "manager", "helper", or "util" dumping grounds.
- **Explicit error handling:** No silent failures. No empty catch blocks. All external calls (LLM API, filesystem) must handle failure explicitly with contextual error information. Fail fast on invariant violations.
- **Dependency injection:** Dependencies must be injected, not hidden. No implicit globals. Infrastructure must not leak into domain logic. Core logic must be testable without network, filesystem, or external systems.
- **Service boundary discipline:** Business logic (artifact sequencing, state management, validation orchestration) must be separated from infrastructure concerns (filesystem I/O, HTTP transport, LLM API communication). This separation is enforced by the SAD component boundaries.
- **Data-driven flow, not code-driven flow:** The Orchestration Service and UI must be designed as generic renderers and executors of kit-provided flow definitions. No kit-specific sequencing logic may be embedded in application code. If a behavior cannot be expressed through the flow definition, it belongs in a deferred decision — not in a special case.
- **Complete input assembly from flow definitions:** Flow definitions must declare all required inputs for each step — not just the four-file set (spec, template, prompt, validator), but also principles files, upstream frozen artifacts, and any other context files. The Kit Service must assemble everything declared; the user must never need to remember which files to include. This prevents the class of error where required inputs (e.g., principles files) are silently omitted because the human forgot them.
- **Design for failure:** All designs must specify failure behavior explicitly. LLM calls, filesystem operations, and user inputs are fallible. Designs must define what happens when each fails.
- **Smallest safe change:** Prefer incremental, reversible design decisions. Avoid speculative extensibility beyond what the PRD and SAD require.
- **Clear naming:** Names must reveal intent. No ambiguous abbreviations. No single-letter variables except loop counters. Boolean variables must read as predicates (isValid, hasPermission, shouldRetry). Names must eliminate the need for explanatory comments.
- **Self-documenting code:** Code must read top-to-bottom as a narrative. Public API at the top, private helpers below. Use guard clauses and early returns. Extract well-named functions instead of writing comments that explain *what* code does. Comments are required only for *why* (business rationale, non-obvious design choices), warnings (performance traps, ordering dependencies), and public API contracts.
- **Strict DRY:** Repeated logic must be extracted. Magic strings must be constants. Configuration must not be hardcoded. Cross-module duplication must be refactored.
- **Secure defaults:** Debug mode must be disabled in production. Feature flags must not bypass security controls. Security-relevant configuration must be environment-specific.

## 3. Quality Bars (Hard)

- **Interfaces and contracts must be explicit:** Every service boundary (State Service, Kit Service, LLM Service, Filesystem Service, Orchestration Service) must have a defined TypeScript interface with typed inputs, outputs, and error types.
- **Failure and rollback behavior must be defined:** Every TDD section that describes a write operation or state transition must specify what happens on failure and how rollback or recovery works.
- **Cyclomatic complexity ≤ 10 per function:** Functions exceeding this threshold must be refactored. Maximum nesting depth: 3 levels.
- **No magic strings or hardcoded configuration:** All configuration values, artifact type names, file paths, and state identifiers must be defined as typed constants or loaded from configuration. Artifact sequencing and step types must come from parsed flow definitions, never from application constants.
- **Flow definition contract must be typed:** The parsed flow definition structure must have a defined TypeScript type that the Kit Service produces and the Orchestration Service and UI Layer consume. The TDD must specify this type and its validation rules.
- **Input validation at system boundaries:** All user input from forms, all file paths, and all LLM responses must be validated at the point of entry. Validation logic must be explicit in the TDD.
- **Content sanitization for rendered output:** All LLM-generated content rendered in the browser must pass through a sanitization layer. The TDD must specify the sanitization contract.
- **Structured logging with context:** All log statements must use structured JSON format with contextual identifiers (request ID, artifact ID). No console.log or unstructured output in production code. Never log passwords, tokens, secrets, or full PII records. Automated secret pattern detection in logs where feasible.
- **Error response sanitization:** Stack traces and infrastructure details must not be exposed to the browser. Error responses must be sanitized before reaching the client. Production profiles must disable debug output.
- **No unsafe string construction:** String concatenation must not be used for shell commands, file paths, or query construction. Use parameterized or builder patterns. All filesystem paths must go through the Filesystem Service path validation.
- **CI security gates:** SAST scanning, dependency vulnerability scanning, secret scanning, and container image scanning are required for production-bound builds. Pipelines must fail on critical vulnerabilities, detected secrets, and disallowed configurations. No manual override without a formal exception record.

### Prohibited Patterns
The following are not permitted without explicit justification documented with a mitigation plan:
- God classes or god modules
- Functions exceeding 200 lines
- Nesting depth exceeding 3 levels
- Boolean flags controlling multi-behavior flows
- Hard-coded environment values
- Copy-pasted logic blocks
- Silent error swallowing (empty catch blocks, ignored promise rejections)
- Mixing business logic and infrastructure logic in the same module
- TODO comments without an issue reference
- Custom cryptographic implementations
- Deprecated algorithms (MD5, SHA-1 for security purposes, DES, RC4)

### AI-Assisted Development
When code is generated via AI tools:
- AI must prioritize structural integrity over feature completion
- AI must not comply with requests that violate these standards without proposing safer alternatives
- AI must flag quality degradation in existing code
- AI must recommend refactoring when code complexity exceeds the limits defined above
- Functionality alone is insufficient for approval — all quality bars apply equally to AI-generated code

## 4. Non-Goals Enforcement (Hard)

- TDD must explicitly restate non-goals from the SAD (NG-1 through NG-5)
- TDD must not design components, interfaces, or data structures that implement excluded functionality (kit authoring, multi-user, auth/authz, non-happy-path flows, cloud deployment)
- "Helpful" scope expansion is not allowed — no "future-proofing" designs for non-goals beyond the service layer abstraction, provider abstraction, and spec-driven flow architecture already specified in the SAD
- Any design element that could be construed as implementing a non-goal must include explicit justification showing it serves an in-scope requirement

## 5. Operational Expectations (Hard)

- **Deployment verification:** After Docker container starts, the application must emit a structured log confirming successful startup, kit directory accessibility, flow definition parse results (per kit), and project directory accessibility. Health check endpoint must be available.
- **Monitoring/alerting:** LLM API call success/failure rates and latencies must be observable. Artifact state transitions must be logged. Application errors must be logged with sufficient context for debugging without access to the running process.
- **Auditability:** All artifact state transitions (draft → validated → frozen) must be recorded with timestamps. LLM usage per artifact (tokens, provider, model, duration) must be persisted in the project directory. All records must be human-readable without the console application.

## 6. Testing Expectations (Hard)

- **Required test layers:**
  - Unit tests (Vitest): All service layer functions, all utility functions, all validation logic, flow definition parsing and validation. Mock only at service boundaries (filesystem, LLM API).
  - Component tests (Vitest + React Testing Library): All React components that handle user interaction (forms, wizard navigation, artifact review, freeze approval). Test behavior, not implementation.
  - End-to-end tests (Playwright): Critical user flows — project setup, artifact generation through freeze, wizard navigation across multiple steps.

- **Evidence requirements:**
  - Test results in machine-readable format (Vitest JSON reporter, Playwright JSON reporter)
  - Code coverage report (statement and branch coverage)
  - Lint and type-check results (zero errors required)

- **Promotion gates (what blocks progression):**
  - All unit and component tests must pass
  - No TypeScript type errors (strict mode)
  - No ESLint errors
  - No known high or critical CVEs in dependencies
  - No secrets detected by secret scanning
  - SAST scan passes with no critical findings
  - Container image scan passes with no critical vulnerabilities
  - E2E tests must pass for critical flows

### Evidence Management
- Required evidence formats: Vitest JSON test reports, Playwright HTML/JSON reports, TypeScript compiler output, ESLint output, dependency audit output
- Evidence storage location: Generated in the project build output directory; CI artifacts for automated runs
- Retention requirements: Current build results retained; historical results managed by CI system
- Accessibility requirements: All evidence reproducible by running the test commands locally

## 7. Documentation Expectations (Hard)

- **Required sections in a TDD:** Document Control, Intent Summary (with SAD traceability), Non-Goals (restated), Component Design (per SAD component), Interface Contracts (TypeScript interfaces), Data Structures (including flow definition schema), State Management, Error Handling, Testing Strategy (per test layer), Migration/Deployment Notes
- **Required diagram types:** Component interaction diagram (Mermaid); state transition diagram for artifact lifecycle (Mermaid)
- **Required traceability markers:** Each TDD design decision must reference the SAD component or architectural decision it implements. Each interface must reference the SAD service boundary it fulfills.

## 8. Open Items
- None

## 9. Freeze Declaration (when ready)
This DCF is approved and frozen. All TDDs must comply.

- Approved By: Initiative Owner
- Date: 2026-03-08
