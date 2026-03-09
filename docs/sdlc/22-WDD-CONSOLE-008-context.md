### WDD-CONSOLE-008 — LLM Service

#### WDD Work Item

- **WDD Item ID:** WDD-CONSOLE-008
- **Parent TDD Section:** §4.4 LLM Service
- **Assignee Type:** AI Agent
- **Required Capabilities:** backend, API-design
- **Complexity Estimate:** L

**Intent:** Implement the LLM Service with provider abstraction, Anthropic Claude provider, streaming support, and validation response parsing.

**In Scope:**
- `ILlmService` TypeScript interface
- `ILlmProvider` interface with `sendRequest` and `sendStreamingRequest`
- `LlmRequest`, `LlmResponse`, `LlmChunk` types
- `AnthropicProvider` implementation using `@anthropic-ai/sdk`
- `generateArtifact`, `generateArtifactStreaming`, `validateArtifact` methods
- Validation response parsing: extract `ValidationResult` JSON from LLM response
- Error types: `LlmProviderError`, `LlmTimeoutError`, `LlmResponseParseError`, `LlmStreamError`, `ValidationResponseParseError`
- Provider resolution from `LlmConfig`
- Unit tests with mocked HTTP responses

**Out of Scope:**
- Prompt construction (Orchestration Service)
- Non-Anthropic provider implementations

**Inputs:** TDD §4.4, `@anthropic-ai/sdk`, LLM API key via env var

**Outputs:** Interfaces, AnthropicProvider, types, error types, unit tests

**Acceptance Criteria:**
- AC1: Given valid config and prompt, `generateArtifact` returns complete LlmResponse with content, tokens, model, duration
- AC2: Given valid config and prompt, `generateArtifactStreaming` yields LlmChunk objects incrementally, final chunk has usage metrics
- AC3: Given valid JSON matching ValidationResult schema, `validateArtifact` returns parsed ValidationResult
- AC4: Given non-JSON validation response, `validateArtifact` throws `ValidationResponseParseError`
- AC5: Given LLM API returns 500, `generateArtifact` throws `LlmProviderError` with error details

**Definition of Done:**
- [ ] PR merged
- [ ] Unit tests passing (Vitest)
- [ ] Provider abstraction interface exported
- [ ] Streaming tested with mock chunks
- [ ] All error types tested
- [ ] API key never appears in test output or logs

**Interface Contract References:**
- TDD §4.4 `ILlmService` — **provider**
- TDD §4.4 `ILlmProvider` — **provider** (AnthropicProvider)

**Dependencies:** WDD-CONSOLE-001 (project scaffolding — `@anthropic-ai/sdk` available)

**Rollback:** Stateless, no state mutation. Revert PR.

**Mock impact note:** `ILlmService` is consumed by: Orchestration Service (WDD-CONSOLE-009). When `ILlmService` changes, update mocks in: orchestration-service tests.

#### TDD Sections

**Technical Context:**

TDD §4.4 LLM Service (full interface):

```
ILlmProvider {
  providerId: string
  sendRequest(request: LlmRequest): Promise<LlmResponse>
  sendStreamingRequest(request: LlmRequest): AsyncIterable<LlmChunk>
}

LlmRequest {
  systemPrompt: string;
  userContent: string;
  model: string;
  maxTokens?: number
}

LlmResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  durationMs: number
}

LlmChunk {
  content: string;
  done: boolean;
  inputTokens?: number;
  outputTokens?: number
}

generateArtifact(config: LlmConfig, prompt: string, inputs: string): Promise<LlmResponse>
- Error modes: LlmProviderError, LlmTimeoutError, LlmResponseParseError
- Behavior: Resolves provider from config. Sends request with prompt as system message
  and inputs as user content. Returns complete response with usage metrics.

generateArtifactStreaming(config: LlmConfig, prompt: string, inputs: string): AsyncIterable<LlmChunk>
- Error modes: Same + LlmStreamError
- Behavior: Returns chunks as they arrive. Final chunk includes usage metrics.

validateArtifact(config: LlmConfig, validatorPrompt: string, artifact: string, spec: string): Promise<LlmResponse>
- Error modes: Same + ValidationResponseParseError
- Behavior: Sends validator prompt as system. Sends artifact + spec as user content.
  Parses response as ValidationResult JSON.
```

Initial provider: Anthropic Claude API via `@anthropic-ai/sdk`.

Provider resolution: The `LlmConfig.providerId` field is matched against registered `ILlmProvider.providerId` values. Initially only `"anthropic"` is registered.

**Testing Strategy:**

TDD §8 LLM Service tests: "Provider resolution, Response parsing, Validation response parsing."

Required test cases:
- `generateArtifact` returns complete `LlmResponse` with all fields populated
- `generateArtifact` throws `LlmProviderError` on API 500 error
- `generateArtifact` throws `LlmTimeoutError` on request timeout
- `generateArtifactStreaming` yields `LlmChunk` objects with incremental content
- `generateArtifactStreaming` final chunk has `done: true` and usage metrics
- `generateArtifactStreaming` throws `LlmStreamError` on mid-stream failure
- `validateArtifact` parses valid `ValidationResult` JSON from response
- `validateArtifact` throws `ValidationResponseParseError` on non-JSON response
- `validateArtifact` throws `ValidationResponseParseError` on JSON missing required fields
- Provider resolution: unknown `providerId` throws `LlmProviderError`
- API key is read from env var specified in `LlmConfig.apiKeyEnvVar`
- API key does not appear in error messages, logs, or test output

**Interface Contracts:**

TDD §4.4 `ILlmService` — this item is the **provider**. Exposes `generateArtifact`, `generateArtifactStreaming`, and `validateArtifact` to the Orchestration Service.

TDD §4.4 `ILlmProvider` — this item is the **provider** (AnthropicProvider). The provider abstraction allows future addition of other LLM providers without changing the service interface.

#### ACF Sections

**Security and Compliance:**

ACF §3 Security Guardrails:
- Secret management: API keys are read from environment variables specified in `LlmConfig.apiKeyEnvVar`. Keys must never appear in logs, error messages, test output, or persisted state. The `AnthropicProvider` must sanitize error messages from the SDK before re-throwing.
- LLM response handling: LLM responses are untrusted input. Validation response parsing must handle malformed JSON, unexpected schemas, and excessively large responses without crashing.
- Cryptography: All API calls use TLS 1.2+ (enforced by the `@anthropic-ai/sdk` defaults).

ACF §5 Reliability — LLM unavailability degrades gracefully: When the LLM API is unreachable or returns errors, the service must throw typed errors that the Orchestration Service can handle without corrupting state. No retries are implemented at this layer (retry policy is an Orchestration Service concern if added later).

#### DCF Sections

**Testing Expectations:**

DCF §2 Design Principles — Dependency injection: the `ILlmProvider` is injected into the LLM Service, enabling mock providers in tests. Explicit error handling: every failure mode has a named error type with structured information.

DCF §3 Quality Bars — Interfaces explicit: `ILlmService` and `ILlmProvider` interfaces are the public contract. Implementations are internal.

DCF §6 Testing Expectations — Unit tests must mock HTTP responses (not call real APIs). Tests must cover:
- Happy path: complete generation response
- Happy path: streaming generation with multiple chunks
- Happy path: validation with valid JSON response
- Error path: API errors (500, 401, 429)
- Error path: timeout
- Error path: stream interruption
- Error path: non-JSON validation response
- Error path: JSON validation response with missing fields
- Security: API key not leaked in any error or log output
- Provider resolution: valid and invalid provider IDs
