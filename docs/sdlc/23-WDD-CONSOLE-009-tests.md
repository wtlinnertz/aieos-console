# Tests — WDD-CONSOLE-009 (Orchestration Service)

## Test Plan

### getFlowStatus Tests
- GFS-1 (AC1): All steps not-started, currentStep is first step
- GFS-2 (AC1): Step 2 dependenciesMet when step 1 frozen
- GFS-3: Step 2 dependenciesNotMet when step 1 not frozen
- GFS-4: Correctly counts completedSteps and totalSteps

### initiateStep Tests
- IS-1 (AC2): Succeeds when all dependencies frozen
- IS-2 (AC2): Throws DependenciesNotMetError when dependencies not frozen
- IS-3: Throws StepAlreadyFrozenError when step already frozen

### generateArtifact Tests
- GA-1 (AC3): Yields chunk events and done event with artifact content
- GA-2 (AC3): Persists draft and records LLM usage on completion
- GA-3: Yields error event on LLM failure without corrupting state
- GA-4: Throws StepNotInProgressError when step not in progress

### validateArtifact Tests
- VA-1: PASS result updates state to validated-pass
- VA-2: FAIL result updates state to validated-fail

### freezeArtifact Tests
- FA-1 (AC4): Writes frozen artifact, updates ER, transitions to frozen
- FA-2: Throws StepNotValidatedPassError when not validated-pass

### updateArtifactContent Tests
- UC-1: Overwrites draft content
- UC-2 (AC5): Resets validated-pass state to draft
- UC-3: Throws StepNotEditableError when step is frozen

## Total: 18 tests
