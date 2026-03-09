# Plan — WDD-CONSOLE-006 (State Service Init/Load)

## Files to Create

1. **`src/lib/services/state-types.ts`** — All state types: `ProjectState`, `KitConfig`, `LlmConfig`, `ArtifactState`, `ValidationResult`, `LlmUsageRecord`
2. **`src/lib/services/state-service.ts`** — `IStateService` interface (partial), `StateService` class with `initializeProject`, `loadState`
3. **`src/lib/services/__tests__/state-service.test.ts`** — 11 unit tests with mocked Filesystem Service

## Files to Modify

4. **`src/lib/services/errors.ts`** — Add `ProjectAlreadyInitializedError`, `StateNotFoundError`, `StateCorruptedError`

## Implementation Sequence

1. Add error types to `errors.ts`
2. Create `state-types.ts` with all exported type definitions
3. Create `state-service.ts`:
   - `initializeProject`: check `.aieos/state.json` doesn't exist via `exists`, create directory, write initial state atomically
   - `loadState`: read file, parse JSON, validate required fields, return typed object
   - Generate `projectId` using `crypto.randomUUID()`
4. Create test file with mocked filesystem

## Design Decisions

- **Separate types file:** Consumers can import types without pulling in service logic
- **Schema validation in loadState:** Check required top-level fields (projectId, kitConfigs, llmConfigs, artifacts, llmUsage). Deep validation of array contents not required at this level.
- **Atomic writes via filesystem service:** State changes go through `writeFileAtomic` (ACF §5)
- **No directory creation method on IFilesystemService:** Use `writeFileAtomic` which creates parent dirs, or add mkdir to filesystem service if needed. Actually, the filesystem service doesn't have `createDirectory` — will need to handle `.aieos/` directory creation via writeFileAtomic (which writes to the target path atomically).

## Constraints
- No `any` types
- Atomic state writes (ACF §5)
- All error modes have named error types
