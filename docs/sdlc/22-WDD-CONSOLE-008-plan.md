# Plan — WDD-CONSOLE-008 (LLM Service)

## Files to Create
1. `src/lib/services/llm-types.ts` — LlmRequest, LlmResponse, LlmChunk, ILlmProvider, ILlmService
2. `src/lib/services/llm-service.ts` — LlmService implementation with provider registry
3. `src/lib/services/anthropic-provider.ts` — AnthropicProvider using @anthropic-ai/sdk
4. `src/lib/services/__tests__/llm-service.test.ts` — 12 tests with mock provider

## Files to Modify
5. `src/lib/services/errors.ts` — Add LlmProviderError, LlmTimeoutError, LlmResponseParseError, LlmStreamError, ValidationResponseParseError

## Design Decisions
- Mock at provider level: Tests inject a mock ILlmProvider, never call real APIs
- AnthropicProvider is a thin wrapper around @anthropic-ai/sdk
- Validation response parsing extracts JSON from LLM text (may contain markdown fences)
- Provider registry: Map<string, ILlmProvider> keyed by providerId
