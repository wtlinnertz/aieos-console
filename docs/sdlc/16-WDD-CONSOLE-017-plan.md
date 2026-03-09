# Implementation Plan — WDD-CONSOLE-017 (Structured Logging)

## Plan Summary

Implement a structured logging utility that writes JSON-formatted log lines to stdout, with field-level secret redaction and convenience wrappers for INFO and ERROR levels.

## Files to Create

### 1. `src/lib/logger.ts`
- Export `log(level: 'INFO' | 'ERROR', event: string, context?: Record<string, unknown>): void`
- Export `logInfo(event: string, context?: Record<string, unknown>): void` — calls `log('INFO', ...)`
- Export `logError(event: string, context?: Record<string, unknown>): void` — calls `log('ERROR', ...)`
- Build output object: `{ timestamp: new Date().toISOString(), level, event, ...redactedContext }`
- Serialize with `JSON.stringify` and write via `process.stdout.write(json + '\n')`
- Redaction: before serialization, recursively walk context and replace values whose key matches secret-like patterns with `"[REDACTED]"`
- Secret patterns (case-insensitive match): `apikey`, `secret`, `key`, `token`, `password`, `credential`
- Recursive redaction handles nested objects

### 2. `src/lib/__tests__/logger.test.ts`
- Unit tests using Vitest
- Capture stdout by replacing `process.stdout.write` with a spy in `beforeEach`, restore in `afterEach`
- Test cases covering all items from `16-WDD-CONSOLE-017-tests.md` (AT-1 through RT-1)
- Parse captured output as JSON and assert field presence and values

## Files to Modify

None. This is a new, self-contained utility with no existing files to change.

## Interfaces Locked

### Logger API (internal utility)
```
log(level: 'INFO' | 'ERROR', event: string, context?: Record<string, unknown>): void
logInfo(event: string, context?: Record<string, unknown>): void
logError(event: string, context?: Record<string, unknown>): void
```

### Output Format
One JSON line per call, written to stdout:
```
{ "timestamp": "<ISO-8601>", "level": "INFO|ERROR", "event": "<string>", ...<context fields> }
```

### Redaction Sentinel
Secret field values are replaced with the string literal `[REDACTED]`.

### Secret Field Patterns
Case-insensitive substring match against field names: `apikey`, `secret`, `key`, `token`, `password`, `credential`.

## Dependencies

None. The implementation uses only Node.js built-ins:
- `JSON.stringify` for serialization
- `process.stdout.write` for output
- `Date.prototype.toISOString` for timestamps

No external logging libraries are introduced.

## Risks and Assumptions

- **Redaction pattern breadth:** The pattern `key` will match fields like `kitKey` or `primaryKey` that are not secrets. This is a conservative (safe) default — it is better to over-redact than to leak secrets. If specific non-secret fields containing `key` are needed in logs, they can be renamed (e.g., `kitIdentifier`) or an allowlist can be added later.
- **Nested redaction depth:** Deeply nested objects could cause performance issues in a recursive walk. In practice, log context objects are shallow (1-2 levels). No depth limit is imposed initially.
- **stdout contention:** Multiple concurrent log calls could interleave if `process.stdout.write` does not complete synchronously. Node.js `process.stdout.write` to a TTY or pipe is synchronous on most platforms, so this is low risk.
- **No log rotation or aggregation:** Out of scope per WDD-CONSOLE-017. Log output goes to stdout and is handled by the container runtime or deployment environment.

## Sequencing

1. Create `src/lib/logger.ts` with the `log`, `logInfo`, and `logError` functions and redaction logic
2. Create `src/lib/__tests__/logger.test.ts` with all test cases
3. Run `npx vitest run src/lib/__tests__/logger.test.ts` to verify all tests pass
4. Run `npx tsc --noEmit` to verify type correctness
5. Run `npx eslint src/lib/logger.ts src/lib/__tests__/logger.test.ts --max-warnings 0` to verify lint compliance
