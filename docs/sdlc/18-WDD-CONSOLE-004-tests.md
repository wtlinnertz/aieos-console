# Tests — WDD-CONSOLE-004 (Kit Loader and Cache)

## Test Plan

### Acceptance Tests

**AT-1 (AC1): Successful loadKit returns KitResult with parsed FlowDefinition**
- Given: Filesystem Service mock returns valid `flow.yaml` content and `exists` returns `true` for all four-file paths
- When: `loadKit(kitPath)` is called
- Then: Returns `KitResult` with `flow` (valid FlowDefinition) and `kitPath`

**AT-2 (AC2): Missing four-file reports error with file path**
- Given: Filesystem Service mock returns valid `flow.yaml` but `exists` returns `false` for one spec path
- When: `loadKit(kitPath)` is called
- Then: Throws error identifying the missing file path

**AT-3 (AC3): Cache invalidation causes re-read**
- Given: `loadKit` called once (cached), then `invalidateCache()` called
- When: `loadKit` called again with same kitPath
- Then: Filesystem Service `readFile` called twice (not served from cache)

### Failure Tests

**FT-1: Missing flow.yaml throws FlowDefinitionNotFoundError**
- Given: Filesystem Service `readFile` throws `FileNotFoundError` for `flow.yaml`
- When: `loadKit(kitPath)` is called
- Then: Throws `FlowDefinitionNotFoundError`

**FT-2: Malformed flow.yaml propagates FlowDefinitionParseError**
- Given: Filesystem Service returns malformed YAML content
- When: `loadKit(kitPath)` is called
- Then: Throws `FlowDefinitionParseError`

**FT-3: Missing multiple four-files reports all missing**
- Given: Multiple four-file paths don't exist
- When: `loadKit(kitPath)` is called
- Then: Error message identifies all missing files

### Edge Case Tests

**EC-1: Cache hit — second call uses cache**
- Given: `loadKit` called once
- When: `loadKit` called again with same kitPath
- Then: Filesystem Service `readFile` called only once

**EC-2: Different kitPaths are cached independently**
- Given: `loadKit("kit-a")` then `loadKit("kit-b")`
- When: Both calls complete
- Then: `readFile` called once per kit (2 total)

**EC-3: Null prompt in four_files skips exists check**
- Given: A step has `fourFiles.prompt = null`
- When: `loadKit` validates four-files
- Then: No `exists` check for the null prompt path

**EC-4: invalidateCache when cache is empty is no-op**
- Given: No kits have been loaded
- When: `invalidateCache()` is called
- Then: No error thrown

**EC-5: Four-file paths resolved relative to kit directory**
- Given: `fourFiles.spec` is `"docs/specs/prd-spec.md"` and kitPath is `"/kits/pik"`
- When: `loadKit` validates
- Then: `exists` called with `"/kits/pik/docs/specs/prd-spec.md"`

## Test Count Summary
- Acceptance: 3
- Failure: 3
- Edge cases: 5
- **Total: 11 tests**
