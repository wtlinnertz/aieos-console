# ACF — aieos-console Architectural Guardrails

## 0. Document Control
- ACF ID: ACF-CONSOLE-001
- Owner: Initiative Owner
- Date: 2026-03-07
- Status: Frozen
- Governance Model Version: 1.0
- Prompt Version: 1.0
- Applies To: aieos-console service only

## 1. Purpose
Define architectural guardrails that constrain the design of aieos-console — a guided wizard application for running AIEOS governance processes. These guardrails ensure security, operability, and structural integrity for a locally deployed, single-user, browser-based application that integrates with external LLM providers and reads/writes project files on the host filesystem.

## 2. Platform Assumptions (High Level)
- Runtime environment(s): Node.js (current LTS), TypeScript strict mode, ESM modules
- Deployment model(s): Local deployment via Docker; single container; no cloud hosting
- Networking posture: Local network only; no public ingress; outbound HTTPS to configured LLM provider API endpoints only
- Identity model: No authentication or authorization; single-user operation on a trusted local network; concurrent access prevented via lock file mechanism

## 3. Security Guardrails (Hard)

- **Input validation:** All user-provided input (form fields, configuration values, file paths) must be validated server-side. Client-side validation is supplementary only.
- **Path traversal prevention:** All filesystem operations must validate that resolved paths remain within the configured project directory and kit directory boundaries. No arbitrary filesystem access.
- **Secret management:** LLM API keys and other secrets must not be hardcoded. Secrets must be provided via environment variables or a secrets configuration file excluded from version control. Secrets must never appear in logs, generated artifacts, or browser-rendered content.
- **Dependency vulnerability posture:** No known high or critical severity CVEs permitted in production dependencies. Automated dependency scanning required on all production-bound builds. Transitive dependencies are not exempt.
- **Cryptography constraints:** Custom cryptographic implementations are prohibited. Use platform-approved libraries only. TLS 1.2+ required for all outbound connections (LLM API calls). Deprecated algorithms (MD5, SHA-1 for security purposes, DES, RC4) are prohibited.
- **Error handling:** Stack traces and infrastructure details must not be exposed to the browser. Error responses must be sanitized before reaching the client.
- **LLM response handling:** LLM-generated content must be treated as untrusted input. Content rendered in the browser must be sanitized to prevent XSS. LLM responses must not be used to construct filesystem paths, shell commands, or executable code without explicit validation.
- **No custom authentication mechanisms:** If authentication is added in the future, it must use platform-standard identity providers, not custom implementations.

### Security Review Triggers
A dedicated security review is required during execution when any of the following occur:
- Changes to filesystem access patterns or path resolution logic
- Changes to LLM API integration or response handling
- Introduction of new external dependencies
- Changes to secret handling or configuration mechanisms
- Addition of any network-facing endpoints beyond localhost
- Changes to content rendering that affect XSS prevention

When triggered, the review phase must include security-specific verification against the guardrails in this section.

## 4. Compliance / Regulatory Constraints (Hard)
None applicable. Justification: aieos-console is an internal productivity tool deployed locally on the user's own machine. It does not process regulated data (no PII, PHI, PCI, or financial data beyond what users voluntarily include in their own project artifacts). It does not operate in a regulated industry context. No data leaves the local environment except outbound LLM API calls containing user-authored project content, which is governed by the user's own agreement with the LLM provider.

## 5. Reliability & Resilience Guardrails (Hard)
- **Availability expectations:** The application must be available whenever the local Docker container is running. No external service dependency may prevent the application from starting or rendering previously generated artifacts. LLM provider unavailability must degrade gracefully (user notified, able to retry, no data loss).
- **Failure isolation:** LLM API failures must not corrupt local state. Filesystem write failures must not leave artifacts in an inconsistent state (use write-then-rename or equivalent atomic write patterns). A failure in one artifact generation step must not affect previously frozen artifacts.
- **Rollback expectations:** All state is file-based in the project directory. Rollback is achieved through filesystem-level operations (git, file restore). The application must not maintain state that cannot be reconstructed from the project directory contents.

## 6. Observability Guardrails (Hard)
- **Required telemetry types:** Structured application logs (JSON format). Per-artifact LLM usage metrics (tokens consumed, provider used, model used, request duration).
- **Minimum operational signals:** Application startup/shutdown events. LLM API call success/failure with latency. Artifact state transitions (draft → validated → frozen). Validation results (PASS/FAIL with gate details). Errors with sufficient context for debugging.

## 7. Approved Architectural Patterns
- Service layer abstraction for all state access (filesystem reads/writes go through a service interface, not direct file operations in business logic)
- Provider abstraction for LLM integration (single interface, pluggable provider implementations)
- Server-side rendering with hydration (Next.js model)
- Component-based UI architecture (React)
- Structured logging with contextual identifiers

## 8. Forbidden Patterns (Hard)
- **Direct filesystem access from business logic:** All file operations must go through the service layer abstraction. Business logic must not import filesystem modules directly.
- **Hardcoded kit structure:** The application must read kit file structures dynamically from configured directories. Artifact types, file names, and sequencing must not be hardcoded in application code.
- **Automatic step completion without user awareness:** The application must not complete governance steps (generation, validation, freeze) without explicit user initiation and awareness. Automated batch processing of multiple steps is prohibited.
- **LLM response as trusted input:** Generated content must never be written to the filesystem, used in path construction, or rendered in the browser without validation and sanitization.
- **Secrets in logs or rendered output:** API keys, tokens, or other secrets must never appear in application logs, browser-rendered content, or generated artifacts.
- **Mixing infrastructure and domain logic:** Business logic (artifact sequencing, state management, validation orchestration) must be separated from infrastructure concerns (filesystem I/O, HTTP transport, LLM API communication).
- **Unpinned dependencies:** All dependencies must be version-pinned to exact versions. Floating version ranges (^, ~, *, latest) are prohibited.

## 9. Standard Interfaces / Integrations (Optional)
- **Change management:** Not applicable for initial release (local single-user tool)
- **CI/CD expectations:** Automated build, lint, type-check, and test execution. Dependency vulnerability scanning. Secret scanning. Container image scanning.
- **Artifact storage:** All AIEOS artifacts stored as Markdown files in the project directory, readable and inspectable without the console application
- **Audit expectations:** LLM usage tracked per artifact for cost monitoring. Artifact state transitions logged.

## 10. Open Items
- None

## 11. Freeze Declaration (when ready)
This ACF is approved and frozen. SAD and downstream artifacts must comply.

- Approved By: Initiative Owner
- Date: 2026-03-07
