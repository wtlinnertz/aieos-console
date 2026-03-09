# Test Specifications — WDD-CONSOLE-017 (Structured Logging)

## 1. Acceptance Tests

### AT-1: Log call produces valid JSON with all required fields
- **Preconditions:** Logger module imported; stdout capture mechanism in place
- **Input:** Call `log('INFO', 'app.startup', { port: 3000, kitIds: ['pik'], projectDir: '/tmp' })`
- **Expected outcome:** Stdout receives exactly one line that parses as valid JSON containing `timestamp`, `level` (value `"INFO"`), `event` (value `"app.startup"`), `port`, `kitIds`, and `projectDir` with their provided values
- **Failure condition:** Output is not valid JSON, or any of `timestamp`, `level`, `event`, or context fields are missing — the logger is broken

### AT-2: Secret-named fields are redacted from output
- **Preconditions:** Logger module imported; stdout capture mechanism in place
- **Input:** Call `log('INFO', 'test.event', { apiKey: 'sk-12345', secret: 'hunter2', userId: 'u-1' })`
- **Expected outcome:** Parsed JSON output contains `apiKey` with value `"[REDACTED]"` and `secret` with value `"[REDACTED]"`; `userId` retains its original value `"u-1"`
- **Failure condition:** The values `"sk-12345"` or `"hunter2"` appear anywhere in the output — secret redaction is broken

### AT-3: All secret-like field patterns are redacted (case-insensitive)
- **Preconditions:** Logger module imported; stdout capture mechanism in place
- **Input:** Call `log('INFO', 'test.event', { apiKey: 'a', secret: 'b', key: 'c', token: 'd', password: 'e', credential: 'f', LLM_API_KEY: 'g', API_KEY: 'h', accessToken: 'i', myPassword: 'j' })`
- **Expected outcome:** Every field value in the output is `"[REDACTED]"`
- **Failure condition:** Any original secret value appears in the output — pattern matching is incomplete

## 2. Failure Tests

### FT-1: Invalid log level is rejected or handled
- **Preconditions:** Logger module imported; TypeScript compilation
- **Input:** Attempt to call `log('DEBUG' as any, 'test.event', {})`
- **Expected outcome:** TypeScript compiler rejects `'DEBUG'` at compile time due to the `'INFO' | 'ERROR'` union type constraint. If called at runtime via `any` cast, the logger either throws or still produces valid JSON with the provided level string
- **Failure condition:** Logger silently drops the log entry without writing anything to stdout

### FT-2: Redaction does not interfere with non-secret fields
- **Preconditions:** Logger module imported; stdout capture mechanism in place
- **Input:** Call `log('INFO', 'kit.loaded', { kitId: 'pik', stepCount: 5, kitPath: '/kits/pik' })`
- **Expected outcome:** All fields retain their original values; no fields are redacted
- **Failure condition:** Any non-secret field value is replaced with `"[REDACTED]"` — redaction pattern is too aggressive

### FT-3: Error-level log call with error field produces valid output
- **Preconditions:** Logger module imported; stdout capture mechanism in place
- **Input:** Call `log('ERROR', 'kit.load_error', { kitId: 'pik', kitPath: '/kits/pik', error: 'ENOENT: file not found' })`
- **Expected outcome:** Output is valid JSON with `level` of `"ERROR"`, `event` of `"kit.load_error"`, and all context fields present
- **Failure condition:** Output is not valid JSON or error-level entries are dropped

## 3. Edge Case Tests

### EC-1: Timestamp is valid ISO-8601
- **Preconditions:** Logger module imported; stdout capture mechanism in place
- **Input:** Call `log('INFO', 'app.startup', { port: 3000 })`
- **Expected outcome:** The `timestamp` field in the parsed JSON output is a valid ISO-8601 string; parsing it with `new Date(timestamp)` produces a valid date, and `date.toISOString()` round-trips without error
- **Failure condition:** `timestamp` is missing, empty, or not parseable as ISO-8601

### EC-2: Empty context produces valid JSON with only base fields
- **Preconditions:** Logger module imported; stdout capture mechanism in place
- **Input:** Call `log('INFO', 'app.shutdown')` (no context argument) and `log('INFO', 'app.shutdown', {})` (empty context)
- **Expected outcome:** Both calls produce valid JSON lines containing exactly `timestamp`, `level`, and `event` — no additional keys
- **Failure condition:** Output is not valid JSON, or unexpected keys appear

### EC-3: requestId is included when provided in context
- **Preconditions:** Logger module imported; stdout capture mechanism in place
- **Input:** Call `log('ERROR', 'error', { requestId: 'req-abc-123', error: 'something failed', stack: 'Error: ...' })`
- **Expected outcome:** Parsed JSON includes `requestId` with value `"req-abc-123"`
- **Failure condition:** `requestId` is missing from the output

### EC-4: Multiple log calls produce one line each (newline-delimited)
- **Preconditions:** Logger module imported; stdout capture mechanism in place
- **Input:** Call `log('INFO', 'app.startup', { port: 3000 })` followed by `log('INFO', 'app.shutdown')`
- **Expected outcome:** Stdout contains exactly two lines (split by `\n`); each line independently parses as valid JSON
- **Failure condition:** Output is a single line, or lines are not individually parseable as JSON — newline delimiting is broken

### EC-5: Context field with undefined or null value
- **Preconditions:** Logger module imported; stdout capture mechanism in place
- **Input:** Call `log('INFO', 'test.event', { kitId: 'pik', extra: undefined, other: null })`
- **Expected outcome:** Output is valid JSON; `kitId` is present; `undefined` fields are omitted or serialized per JSON.stringify behavior; `null` fields are serialized as `null`
- **Failure condition:** Logger throws an exception or produces invalid JSON

### EC-6: Context field with nested object
- **Preconditions:** Logger module imported; stdout capture mechanism in place
- **Input:** Call `log('INFO', 'test.event', { meta: { nested: 'value' } })`
- **Expected outcome:** Output is valid JSON with `meta` containing the nested object
- **Failure condition:** Logger throws or flattens/drops nested fields unexpectedly

### EC-7: Secret-like field name matching is case-insensitive
- **Preconditions:** Logger module imported; stdout capture mechanism in place
- **Input:** Call `log('INFO', 'test.event', { APIKEY: 'x', Password: 'y', TOKEN: 'z' })`
- **Expected outcome:** All three field values are `"[REDACTED]"`
- **Failure condition:** Any original value appears — case-insensitive matching is not implemented

### EC-8: Nested secret-like fields are redacted
- **Preconditions:** Logger module imported; stdout capture mechanism in place
- **Input:** Call `log('INFO', 'test.event', { config: { apiKey: 'sk-secret' } })`
- **Expected outcome:** The nested `apiKey` value is `"[REDACTED]"` in the serialized output
- **Failure condition:** The secret value `"sk-secret"` appears in the output — nested redaction is not implemented

### EC-9: logInfo and logError convenience wrappers
- **Preconditions:** Logger module imported; stdout capture mechanism in place
- **Input:** Call `logInfo('app.startup', { port: 3000 })` and `logError('error', { error: 'fail' })`
- **Expected outcome:** `logInfo` produces JSON with `level: "INFO"`; `logError` produces JSON with `level: "ERROR"`; both include `timestamp` and `event`
- **Failure condition:** Convenience wrappers do not produce the same output format as direct `log` calls

## 4. Regression Tests

### RT-1: All TDD §7 log events produce valid structured output
- **Preconditions:** Logger module imported; stdout capture mechanism in place
- **Input:** For each event in the table below, call `log` with the specified level and all required fields:

| Event | Level | Fields |
|-------|-------|--------|
| app.startup | INFO | port, kitIds, projectDir |
| app.shutdown | INFO | (none) |
| kit.loaded | INFO | kitId, stepCount, kitPath |
| kit.load_error | ERROR | kitId, kitPath, error |
| step.initiated | INFO | kitId, stepId, artifactType |
| llm.generation_started | INFO | kitId, stepId, provider, model |
| llm.generation_completed | INFO | kitId, stepId, inputTokens, outputTokens, durationMs |
| llm.generation_failed | ERROR | kitId, stepId, error |
| validation.completed | INFO | kitId, stepId, status, completenessScore |
| artifact.frozen | INFO | kitId, stepId, artifactId |
| state.transition | INFO | kitId, stepId, from, to |
| error | ERROR | requestId, error, stack |

- **Expected outcome:** Each call produces exactly one valid JSON line with all specified fields present and correct `level` and `event` values
- **Failure condition:** Any event produces invalid JSON or is missing required fields — TDD §7 coverage is incomplete
