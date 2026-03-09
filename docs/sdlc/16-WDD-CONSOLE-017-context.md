### WDD-CONSOLE-017 — Structured Logging

#### WDD Work Item

- **WDD Item ID:** WDD-CONSOLE-017
- **Parent TDD Section:** §7 Observability
- **Assignee Type:** AI Agent
- **Required Capabilities:** backend, observability
- **Complexity Estimate:** S

**Intent:** Implement the structured logging utility that produces JSON-formatted log entries with contextual identifiers, used by all server-side components.

**In Scope:**
- Logger utility producing JSON to stdout
- Required fields: `timestamp` (ISO-8601), `level`, `event`, `requestId` (where applicable)
- Log levels: INFO, ERROR
- All log events defined in TDD §7
- Verification that secrets are never included in log output
- Unit tests

**Out of Scope / Non-Goals:**
- Log aggregation or external log shipping
- Client-side logging

**Inputs:** TDD §7 log event specifications

**Outputs:** Logger utility module, unit tests

**Acceptance Criteria:**
- **AC1:** Given a log call with event, level, and context fields, when the logger is invoked, then a JSON line is written to stdout with `timestamp`, `level`, `event`, and all provided context fields. Failure: If the output is not valid JSON or fields are missing, the logger is broken
- **AC2:** Given a log call that includes a field named `apiKey` or `secret`, when the logger is invoked, then those fields are redacted or excluded from the output. Failure: If secrets appear in log output, the secret redaction is broken

**Definition of Done:**
- [ ] PR merged
- [ ] Unit tests passing (Vitest)
- [ ] All TDD §7 log events covered
- [ ] Secret redaction tested

**Interface Contract References:** None — internal utility consumed by all server-side components

**Dependencies:** WDD-CONSOLE-001 (project scaffolding)

**Rollback / Failure Behavior:** Logging is a cross-cutting utility. If incorrect, logs will be malformed but no data corruption. Revert PR.

---

#### TDD Sections

**Technical Context:**

##### §7 Observability — Full Section

All logs are structured JSON written to stdout.

**Required log events:**

| Event | Level | Fields |
|-------|-------|--------|
| Application startup | INFO | event: 'app.startup', port, kitIds, projectDir |
| Application shutdown | INFO | event: 'app.shutdown' |
| Kit loaded | INFO | event: 'kit.loaded', kitId, stepCount, kitPath |
| Kit load error | ERROR | event: 'kit.load_error', kitId, kitPath, error |
| Step initiated | INFO | event: 'step.initiated', kitId, stepId, artifactType |
| Generation started | INFO | event: 'llm.generation_started', kitId, stepId, provider, model |
| Generation completed | INFO | event: 'llm.generation_completed', kitId, stepId, inputTokens, outputTokens, durationMs |
| Generation failed | ERROR | event: 'llm.generation_failed', kitId, stepId, error |
| Validation completed | INFO | event: 'validation.completed', kitId, stepId, status, completenessScore |
| Artifact frozen | INFO | event: 'artifact.frozen', kitId, stepId, artifactId |
| State transition | INFO | event: 'state.transition', kitId, stepId, from, to |
| Error (general) | ERROR | event: 'error', requestId, error, stack (server-side only) |

All log entries include: `timestamp` (ISO-8601), `requestId` (where applicable).

**Testing Strategy:**

- Unit tests must verify each log event produces valid JSON output to stdout.
- Unit tests must verify that all required fields are present for each event type.
- Unit tests must verify that secret-named fields (`apiKey`, `secret`, `LLM_API_KEY`, and similar) are redacted or excluded from output.
- Tests should capture stdout and parse JSON to validate structure.

**Interface Contracts:**

The logger is an internal utility, not a service interface. It is consumed directly by all server-side components. The contract is implicit:

```typescript
// Logger API (internal utility)
function log(level: 'INFO' | 'ERROR', event: string, context?: Record<string, unknown>): void

// Output format (one JSON line per call):
// { "timestamp": "ISO-8601", "level": "INFO|ERROR", "event": "string", ...context }
```

---

#### ACF Sections

**Security and Compliance:**

##### §6 Observability Guardrails
- Structured application logs (JSON format).
- Per-artifact LLM usage metrics.
- Minimum signals: startup/shutdown, LLM call success/failure with latency, artifact state transitions, validation results, errors with context.

##### §3 Security Guardrails — Secrets in Logs
- **Secret management:** LLM API keys not hardcoded. Via env vars or secrets file excluded from VCS. Never in logs, artifacts, or browser.
- The logger must implement field-level redaction for any field whose name matches secret-like patterns (`apiKey`, `secret`, `key`, `token`, `password`, `credential`). These fields must be replaced with `[REDACTED]` or excluded entirely.

---

#### DCF Sections

**Testing Expectations:**

##### §3 Quality Bars (applicable to this item)
- **Structured logging with context:** JSON format, contextual IDs (`requestId`), never log secrets.
- **Error response sanitization:** No stack traces to browser (stack traces are logged server-side only, via the `error` event).
- Interfaces and contracts must be explicit (typed inputs, outputs, error types).
- Cyclomatic complexity <=10 per function, max nesting 3.
- No magic strings or hardcoded configuration.

##### §6 Testing Expectations

**Required test layers:**
- **Unit tests (Vitest):** All service layer functions, utility functions, validation logic. Mock only at service boundaries.
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
