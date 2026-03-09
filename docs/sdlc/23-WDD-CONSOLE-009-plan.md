# Plan — WDD-CONSOLE-009 (Orchestration Service)

## Files Created
1. `src/lib/services/orchestration-types.ts` — FlowStatus, StepStatus, StepContext, GenerationEvent, IOrchestrationService
2. `src/lib/services/orchestration-service.ts` — OrchestrationService class implementing IOrchestrationService
3. `src/lib/services/__tests__/orchestration-service.test.ts` — 18 unit tests with mocked dependencies

## Files Modified
4. `src/lib/services/errors.ts` — Added DependenciesNotMetError, StepAlreadyFrozenError, StepNotInProgressError, StepNotDraftError, StepNotValidatedPassError, StepNotEditableError

## Design Decisions
- Constructor injection: OrchestrationService takes IKitService, IStateService, ILlmService
- Kit path resolution: Reads kitConfigs from project state to map kitId to kitPath
- LLM config resolution: Matches by artifactType first, falls back to first config
- Dependency checking: All dependency steps must have status "frozen" before a step can be initiated
- Generation error isolation: LLM failures yield an error event; state is not corrupted (no draft saved)
- Content edit reset: Editing a validated artifact resets status to draft and clears validation result
- All sequencing is data-driven from flow definitions, not hardcoded
