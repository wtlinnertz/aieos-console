# Plan — WDD-CONSOLE-007 (State Transitions)

## Files to Modify

1. **`src/lib/services/errors.ts`** — Add `InvalidTransitionError`, `EngagementRecordNotFoundError`
2. **`src/lib/services/state-service.ts`** — Add remaining methods to `IStateService` and `StateService`: `getArtifactState`, `updateArtifactState`, `saveArtifact`, `recordLlmUsage`, `updateEngagementRecord`

## Files to Create

3. **`src/lib/services/__tests__/state-transitions.test.ts`** — 22 unit tests

## Design Decisions

- **Transition validation map:** A static map of `status → Set<allowedNextStatus>` for O(1) lookup
- **Dependency check:** For `not-started → in-progress`, load state, find all dependency step IDs, verify each has status `frozen`
- **State persistence pattern:** Load → mutate → write atomically (single read-modify-write cycle)
- **saveArtifact:** Writes to `docs/sdlc/{filename}` via filesystem service, returns relative path
- **updateEngagementRecord:** Simple string replacement in ER file — find the layer section, append/update artifact line

## Constraints
- Frozen is terminal — no transitions out
- All writes atomic (ACF §5)
- lastModified updated on every transition
