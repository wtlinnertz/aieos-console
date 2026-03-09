# Tests — WDD-CONSOLE-006 (State Service Init/Load)

## Test Plan

### Acceptance Tests

**AT-1 (AC1): initializeProject creates .aieos/state.json with valid initial schema**
- Given: Project directory with no `.aieos/` subdirectory
- When: `initializeProject(projectDir, kitConfigs, llmConfigs)` called
- Then: `.aieos/state.json` is written with `projectId`, `kitConfigs`, `llmConfigs`, empty `artifacts`, empty `llmUsage`

**AT-2 (AC2): loadState returns correctly typed ProjectState**
- Given: Valid `state.json` on disk
- When: `loadState(projectDir)` called
- Then: Returns `ProjectState` with all fields correctly typed

**AT-3 (AC3): loadState throws StateCorruptedError on missing required fields**
- Given: `state.json` with valid JSON but missing `projectId` field
- When: `loadState(projectDir)` called
- Then: Throws `StateCorruptedError`

### Failure Tests

**FT-1: initializeProject throws ProjectAlreadyInitializedError when .aieos exists**
- Given: `.aieos/state.json` already exists
- When: `initializeProject` called
- Then: Throws `ProjectAlreadyInitializedError`

**FT-2: loadState throws StateNotFoundError when state.json doesn't exist**
- Given: No `.aieos/state.json`
- When: `loadState` called
- Then: Throws `StateNotFoundError`

**FT-3: loadState throws StateCorruptedError on invalid JSON**
- Given: `state.json` contains invalid JSON
- When: `loadState` called
- Then: Throws `StateCorruptedError`

### Edge Case Tests

**EC-1: State roundtrip — initializeProject then loadState**
- Given: `initializeProject` completes
- When: `loadState` called
- Then: Returns object matching initial state

**EC-2: initializeProject generates a projectId**
- Given: Fresh project
- When: `initializeProject` called
- Then: State has a non-empty `projectId`

**EC-3: kitConfigs and llmConfigs stored in state**
- Given: Two kit configs and one llm config
- When: `initializeProject` then `loadState`
- Then: Both configs present in loaded state

**EC-4: State with artifacts and llmUsage loads correctly**
- Given: state.json with non-empty artifacts and llmUsage arrays
- When: `loadState` called
- Then: All entries correctly typed

**EC-5: Missing artifacts field in JSON triggers StateCorruptedError**
- Given: JSON with projectId but no artifacts
- When: `loadState` called
- Then: Throws StateCorruptedError

## Test Count Summary
- Acceptance: 3
- Failure: 3
- Edge cases: 5
- **Total: 11 tests**
