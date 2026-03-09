# Plan — WDD-CONSOLE-004 (Kit Loader and Cache)

## Files to Create

1. **`src/lib/services/kit-service.ts`** — `IKitService` interface, `KitResult` type, `KitService` class with `loadKit`, `invalidateCache`
2. **`src/lib/services/__tests__/kit-service.test.ts`** — 11 unit tests with mocked dependencies

## Files to Modify

None — new files only. Error types already exist in `errors.ts`. Flow types in `flow-types.ts`.

## Implementation Sequence

1. Create `kit-service.ts`:
   - Define `IKitService` interface and `KitResult` type
   - Implement `KitService` class with constructor accepting `IFilesystemService`
   - `loadKit`: check cache → read flow.yaml → parse → validate four-files exist → cache → return
   - `invalidateCache`: clear the Map
2. Create test file with mocked `IFilesystemService`

## Design Decisions

- **Constructor injection:** `KitService` receives `IFilesystemService` via constructor (DCF §2 dependency injection)
- **Map-based cache:** `Map<string, KitResult>` keyed by kitPath
- **Four-file validation:** Iterate all steps' fourFiles, resolve paths relative to kitPath, check `exists`. Skip null prompt paths. Collect all missing files before throwing (FT-3).
- **FlowDefinitionNotFoundError wrapping:** Catch `FileNotFoundError` from readFile and wrap as `FlowDefinitionNotFoundError` for semantic clarity
- **No new npm dependencies**

## Constraints
- No `any` types
- Mock only at service boundaries (IFilesystemService)
- No hardcoded kit structure (ACF §8)
