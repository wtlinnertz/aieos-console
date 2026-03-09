# WDD-CONSOLE-012 Implementation Plan

## Feature: Flow Stepper & Navigation

### Objective
Implement the wizard step sequence UI: a FlowStepper component that renders flow steps with status badges, progress tracking, and navigation links, plus the App Router page structure for flow and step views.

### Files Created

| File | Type | Purpose |
|------|------|---------|
| `src/components/FlowStepper.tsx` | Client component | Vertical step list with status badges, progress count, dependency indicators, and step links |
| `src/app/flow/[kitId]/page.tsx` | Server component | Flow overview page; fetches FlowStatus and renders FlowStepper |
| `src/app/flow/[kitId]/step/[stepId]/page.tsx` | Client component | Step detail shell with back-link; placeholder for WDD-CONSOLE-013/014 |
| `src/components/__tests__/FlowStepper.test.tsx` | Test | 10 component tests using React Testing Library |

### Design Decisions

1. **FlowStepper is a client component** (`'use client'`) because it renders interactive links and will be extended with state in future work items.
2. **Flow page is a server component** that fetches data and passes it as props, following the Next.js App Router pattern.
3. **Step page uses `use()` hook** to unwrap the params Promise (Next.js 15 async params pattern).
4. **Inline styles** used per constraint (no Tailwind, no CSS modules).
5. **Status badges** use a color-coded map keyed by `ArtifactStatus` for visual differentiation.
6. **Mock fallback** in the flow page allows development without a running API backend.

### Dependencies
- Types from `src/lib/services/orchestration-types.ts` (FlowStatus, StepStatus)
- Types from `src/lib/services/state-types.ts` (ArtifactStatus)
- Types from `src/lib/services/flow-types.ts` (FlowStep, used transitively)

### Future Work
- WDD-CONSOLE-013: Step detail generation view
- WDD-CONSOLE-014: Step detail validation view
