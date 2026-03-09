# WDD-CONSOLE-010 Implementation Plan — API Routes

## Scope

Implement Next.js App Router API route handlers that expose the Orchestration Service to the UI layer. All routes delegate to services — no business logic in route handlers.

## Components

### 1. Service Factory (`src/lib/services/service-factory.ts`)
- Singleton pattern wiring FilesystemService, KitService, StateService, LlmService, OrchestrationService
- Config-driven initialization from `loadConfig()`
- `resetServices()` for test isolation

### 2. API Utilities (`src/lib/api-utils.ts`)
- `errorResponse(err)` — maps domain errors to HTTP status codes (409, 404, 500)
- `badRequest(message)` — returns 400 with structured error body
- `getProjectDir()` — reads from config
- Error responses never include stack traces

### 3. Route Handlers (10 routes)
| Route | Method | Handler |
|-------|--------|---------|
| `/api/flow/[kitId]` | GET | getFlowStatus |
| `/api/flow/[kitId]/step/[stepId]` | GET | get step context |
| `/api/flow/[kitId]/step/[stepId]/initiate` | POST | initiateStep |
| `/api/flow/[kitId]/step/[stepId]/generate` | GET | SSE stream |
| `/api/flow/[kitId]/step/[stepId]/validate` | POST | validateArtifact |
| `/api/flow/[kitId]/step/[stepId]/freeze` | POST | freezeArtifact |
| `/api/flow/[kitId]/step/[stepId]/content` | PUT | updateArtifactContent |
| `/api/project` | GET | loadState |
| `/api/project/initialize` | POST | initializeProject |
| `/api/kit/refresh` | POST | invalidateCache |

### 4. Error Mapping
- 409: DependenciesNotMet, StepAlreadyFrozen, StepNotInProgress, StepNotDraft, StepNotValidatedPass, StepNotEditable, ProjectAlreadyInitialized
- 404: StateNotFound, StepNotFound, FlowDefinitionNotFound
- 400: Invalid request body
- 500: Everything else (generic message, no stack trace)

### 5. SSE Implementation
- Uses `ReadableStream` with `TextEncoder`
- Wraps `orchestration.generateArtifact()` async iterable
- Sends `data: {json}\n\n` format
- Catches errors within stream and sends error event before closing

## Constraints
- No `any` types
- Next.js v15 async params pattern (`await params`)
- Passes `tsc --noEmit`, `eslint . --max-warnings 0`, `vitest run`
