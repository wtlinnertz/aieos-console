# Tests — WDD-CONSOLE-008 (LLM Service)

## Test Plan

### Acceptance Tests
- AT-1 (AC1): generateArtifact returns complete LlmResponse
- AT-2 (AC2): generateArtifactStreaming yields chunks, final has usage
- AT-3 (AC3): validateArtifact parses ValidationResult JSON
- AT-4 (AC4): non-JSON validation response throws ValidationResponseParseError
- AT-5 (AC5): API 500 error throws LlmProviderError

### Failure Tests
- FT-1: Unknown providerId throws LlmProviderError
- FT-2: Stream interruption throws LlmStreamError
- FT-3: Validation JSON missing required fields throws ValidationResponseParseError

### Edge Case Tests
- EC-1: API key read from env var in config
- EC-2: API key not leaked in error messages
- EC-3: generateArtifact measures durationMs
- EC-4: Multiple streaming chunks concatenated correctly

## Total: 12 tests
