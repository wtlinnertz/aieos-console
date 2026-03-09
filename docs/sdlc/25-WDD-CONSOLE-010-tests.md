# WDD-CONSOLE-010 Test Plan — API Routes

## Test Strategy

Route handlers are thin delegation wrappers over services. Direct unit testing of Next.js App Router handlers is impractical due to framework coupling. Tests focus on the shared error-mapping utility, which contains all the mapping logic.

## Test File

`src/lib/__tests__/api-utils.test.ts` — 14 tests

## Test Cases

### errorResponse mapping (12 tests)
1. Maps DependenciesNotMetError to 409 with correct code
2. Maps StepAlreadyFrozenError to 409
3. Maps StepNotInProgressError to 409
4. Maps StepNotDraftError to 409
5. Maps StepNotValidatedPassError to 409
6. Maps StepNotEditableError to 409
7. Maps ProjectAlreadyInitializedError to 409
8. Maps StateNotFoundError to 404 with correct code
9. Maps StepNotFoundError to 404
10. Maps FlowDefinitionNotFoundError to 404
11. Maps unknown Error instances to 500 without stack traces
12. Maps non-Error values to 500 without stack traces
13. Never includes stack traces in conflict (409) responses

### badRequest (1 test)
14. Returns 400 with provided message and BAD_REQUEST code

## Verification Results

- All 14 tests: PASS
- Total project tests: 176 PASS, 0 FAIL
- TypeScript: clean (`tsc --noEmit`)
- ESLint: clean (0 warnings)
