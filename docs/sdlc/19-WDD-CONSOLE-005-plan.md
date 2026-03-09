# Plan — WDD-CONSOLE-005 (Step Input Assembly)

## Files to Create

1. **`src/lib/services/step-input-assembly.ts`** — `getStepInputs` function, `StepInputs` and `NamedInput` types, minimal `IArtifactStateProvider` interface for upstream artifact lookup
2. **`src/lib/services/__tests__/step-input-assembly.test.ts`** — 9 unit tests with mocked dependencies

## Files to Modify

3. **`src/lib/services/errors.ts`** — Add `StepNotFoundError` and `InputFileNotFoundError`
4. **`src/lib/services/kit-service.ts`** — Add `getStepInputs` to `IKitService` interface, delegate to step-input-assembly module

## Design Decisions

- **Separate module:** `step-input-assembly.ts` keeps the assembly logic isolated from kit loading/caching. `KitService` delegates to it.
- **IArtifactStateProvider:** A minimal consumer interface `{ getArtifactPath(stepId: string): string | undefined }` rather than importing the full State Service (which doesn't exist yet). This avoids circular dependencies and is easy to mock.
- **Four-file content returned as named fields:** `spec`, `template`, `prompt` (nullable), `validator` — not in an array, for type safety.
- **No new npm dependencies**

## Implementation Sequence

1. Add error types to `errors.ts`
2. Create `step-input-assembly.ts` with types and `assembleStepInputs` function
3. Update `IKitService` in `kit-service.ts` and wire `getStepInputs` through `KitService`
4. Create test file

## Constraints
- No `any` types
- Paths derived from flow definition, never hardcoded (ACF §8)
- All paths validated through Filesystem Service (ACF §3)
