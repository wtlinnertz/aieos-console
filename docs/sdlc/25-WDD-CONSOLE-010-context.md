### WDD-CONSOLE-010 — API Routes

#### WDD Work Item

- WDD Item ID: WDD-CONSOLE-010
- Parent TDD Section: §4.6 Server Layer
- Assignee Type: AI Agent
- Required Capabilities: backend, API-design
- Complexity Estimate: L

Intent: Implement all Next.js API Route Handlers that expose the Orchestration Service to the UI Layer, including request validation, error response formatting, and the SSE streaming endpoint.

In Scope:
- All 9 routes: GET /api/flow/:kitId, GET /api/flow/:kitId/step/:stepId, POST .../initiate, GET .../generate (SSE), POST .../validate, POST .../freeze, PUT .../content, GET /api/project, POST /api/project/initialize, POST /api/kit/refresh
- GET /api/health health check
- Request validation: path parameters, JSON body schemas
- Error response format: { error, code, details } — no stack traces
- SSE implementation for /generate endpoint
- Unit tests for validation and error formatting
- Integration tests with mocked Orchestration Service

Out of Scope:
- Business logic (delegated to Orchestration Service)
- UI rendering (UI Layer)

Inputs: TDD §4.6 API route specifications, Orchestration Service (009)

Outputs: Route Handler implementations, request validation, error formatting, SSE implementation, tests

Acceptance Criteria:
- AC1: Given valid GET /api/flow/:kitId, route returns JSON FlowStatus with 200
- AC2: Given GET .../generate for in-progress step, SSE stream returned with GenerationEvent objects
- AC3: Given invalid JSON body, route returns 400 with { error, code, details }
- AC4: Given Orchestration Service throws DependenciesNotMetError, route returns 409
- AC5: Given GET /api/health, route returns 200

Definition of Done:
- [ ] PR merged
- [ ] Unit tests passing
- [ ] All routes tested with mocked Orchestration Service
- [ ] SSE streaming tested
- [ ] Error responses never contain stack traces
- [ ] Health check working

Interface Contract References:
- TDD §4.6 API Routes — **provider**
- TDD §4.5 `IOrchestrationService` — **consumer**

Dependencies: WDD-CONSOLE-009 (Orchestration Service)
Rollback: Stateless transport. Revert PR.

#### TDD Sections

**Technical Context:**

TDD §4.6 Server Layer:

| Route | Method | Purpose | Outputs | Errors |
|-------|--------|---------|---------|--------|
| /api/flow/:kitId | GET | Get flow status for a kit | JSON FlowStatus | 404, 500 |
| /api/flow/:kitId/step/:stepId | GET | Get step context | JSON StepContext | 404, 409, 500 |
| /api/flow/:kitId/step/:stepId/initiate | POST | Initiate step | JSON StepContext | 404, 409, 500 |
| /api/flow/:kitId/step/:stepId/generate | GET | SSE streaming | Content-Type: text/event-stream | 404, 409, 500, SSE error events |
| /api/flow/:kitId/step/:stepId/validate | POST | Validate draft | JSON ValidationResult | 404, 409, 500 |
| /api/flow/:kitId/step/:stepId/freeze | POST | Freeze | Body: { artifactId: string }. Output: { success: true } | 404, 409, 500 |
| /api/flow/:kitId/step/:stepId/content | PUT | Update draft | Body: { content: string }. Output: { success: true } | 404, 409, 500 |
| /api/project | GET | Project state overview | JSON ProjectState | 500 |
| /api/project/initialize | POST | Initialize project | Body: { projectDir, kitConfigs, llmConfigs }. Output: { success: true } | 409, 400, 500 |
| /api/kit/refresh | POST | Invalidate kit cache | Output: { success: true, kits: string[] } | 500 |

Request validation: All routes validate path parameters and request bodies server-side. Invalid requests return 400 with { error: string; details?: string }.

Error response format: `{ "error": "message", "code": "ERROR_CODE", "details": "context" }`

**Testing Strategy:**

TDD §8: Integration tests with mocked Orchestration Service for all routes. SSE streaming tests. Validation and error formatting unit tests.

**Interface Contracts:**

TDD §4.6 API Routes — this work item is the **provider** of the HTTP API surface.

TDD §4.5 `IOrchestrationService` — this work item is a **consumer** of the orchestration service interface, delegating all business logic.

#### ACF Sections

**Security and Compliance:**

ACF §3 Security Guardrails:
- Input validation must be performed server-side for all routes
- Error handling must never expose stack traces to clients
- LLM response handling must treat all LLM output as untrusted

ACF §8 Forbidden Patterns:
- Secrets must never appear in logs

#### DCF Sections

**Testing Expectations:**

DCF §2 Design Principles:
- Explicit error handling — all error paths must be handled and return structured error responses
- Service boundary discipline — routes delegate to Orchestration Service, no business logic in route handlers

DCF §3 Quality Bars:
- Input validation required at all system boundaries (path params, JSON bodies)
- Error response sanitization — no stack traces, no internal details

DCF §6 Testing Expectations:
- Unit tests for request validation and error formatting
- Integration tests with mocked Orchestration Service for all routes
- SSE streaming endpoint tested
