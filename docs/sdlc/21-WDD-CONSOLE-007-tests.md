# Tests — WDD-CONSOLE-007 (State Transitions)

## Test Plan

### Acceptance Tests

**AT-1 (AC1): not-started → in-progress succeeds when dependencies frozen**
**AT-2 (AC2): frozen → any throws InvalidTransitionError**
**AT-3 (AC3): saveArtifact writes file atomically and updates state**
**AT-4 (AC4): recordLlmUsage appends record and persists**
**AT-5 (AC5): updateEngagementRecord updates ER file**

### Valid Transitions (6 tests)
- not-started → in-progress (deps frozen)
- in-progress → draft
- draft → validated-pass
- draft → validated-fail
- validated-fail → draft
- validated-pass → frozen

### Invalid Transitions (4 tests)
- frozen → in-progress throws InvalidTransitionError
- not-started → draft (skip) throws InvalidTransitionError
- in-progress → frozen (skip) throws InvalidTransitionError
- not-started → in-progress when dependency NOT frozen throws InvalidTransitionError

### Other Tests
- getArtifactState returns correct state
- getArtifactState throws StepNotFoundError for missing step
- lastModified updated on every transition
- saveArtifact updates artifactPath in state
- recordLlmUsage appends and persists
- updateEngagementRecord reads/modifies/writes
- updateEngagementRecord throws EngagementRecordNotFoundError when ER missing

## Test Count Summary
- Acceptance: 5
- Valid transitions: 6
- Invalid transitions: 4
- Other: 7
- **Total: 22 tests**
