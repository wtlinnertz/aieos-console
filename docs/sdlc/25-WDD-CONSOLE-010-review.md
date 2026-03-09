# WDD-CONSOLE-010 Review — API Routes

## Status: PASS

## Summary

All 10 API route handlers implemented as Next.js App Router file-based routes. Routes are thin wrappers that delegate to the orchestration and state services via a singleton service factory. Error mapping, request validation, and response formatting handled by shared utility.

## Artifacts Produced

| File | Purpose |
|------|---------|
| `src/lib/api-utils.ts` | Error response mapping, request helpers |
| `src/lib/services/service-factory.ts` | Singleton service wiring |
| `src/app/api/flow/[kitId]/route.ts` | GET flow status |
| `src/app/api/flow/[kitId]/step/[stepId]/route.ts` | GET step context |
| `src/app/api/flow/[kitId]/step/[stepId]/initiate/route.ts` | POST initiate step |
| `src/app/api/flow/[kitId]/step/[stepId]/generate/route.ts` | GET SSE generation stream |
| `src/app/api/flow/[kitId]/step/[stepId]/validate/route.ts` | POST validate artifact |
| `src/app/api/flow/[kitId]/step/[stepId]/freeze/route.ts` | POST freeze artifact |
| `src/app/api/flow/[kitId]/step/[stepId]/content/route.ts` | PUT update artifact content |
| `src/app/api/project/route.ts` | GET project state |
| `src/app/api/project/initialize/route.ts` | POST initialize project |
| `src/app/api/kit/refresh/route.ts` | POST invalidate kit cache |
| `src/lib/__tests__/api-utils.test.ts` | Error mapping tests |

## Verification

| Check | Result |
|-------|--------|
| `npx vitest run` | 176 tests, 176 passed, 0 failed |
| `npx tsc --noEmit` | Clean, no errors |
| `npx eslint . --max-warnings 0` | Clean, 0 warnings |
| New tests added | 14 |
| No `any` types | Confirmed |
| No stack traces in error responses | Confirmed |
| Next.js v15 async params | Confirmed (`await params`) |

## Design Decisions

1. **Error mapping by name string**: Error classes are matched by `err.name` against sets of known names, avoiding unused imports of error classes in the utility module.
2. **SSE error handling**: Errors during streaming are caught inside the stream and emitted as error events before closing, rather than returning an HTTP error (which would be impossible mid-stream).
3. **Service factory singleton**: Services are created once on first access and reused. `resetServices()` provided for test isolation.
4. **Request body validation**: POST/PUT routes validate JSON body structure and return 400 with descriptive messages for invalid payloads.
