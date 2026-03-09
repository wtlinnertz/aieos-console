### WDD-CONSOLE-012 — Flow Stepper & Navigation

#### WDD Work Item

- WDD Item ID: WDD-CONSOLE-012
- Parent TDD Section: §4.7 UI Layer (FlowStepper, page structure)
- Assignee Type: AI Agent
- Required Capabilities: frontend
- Complexity Estimate: M

Intent: Implement the Next.js App Router page structure and the FlowStepper component that renders the wizard step sequence from flow status data.

In Scope:
- App Router pages: `/` (project overview), `/flow/[kitId]` (flow overview), `/flow/[kitId]/step/[stepId]` (step detail shell)
- `FlowStepper` component: renders step sequence from `FlowStatus`; shows completed/current/remaining; navigation
- Server Components for data fetching
- Client Component wrapper for interactive navigation state
- Component tests (React Testing Library)

Out of Scope:
- Step detail views (013, 014)
- Artifact viewer/editor (015)
- Project initialization UI (016)

Inputs: TDD §4.7 page structure and FlowStepper spec, API routes (010)

Outputs: Page components, FlowStepper component, component tests

Acceptance Criteria:
- AC1: Given FlowStatus with 5 steps where 2 frozen and 1 current, FlowStepper shows correct states
- AC2: Given flow overview page, clicking a step navigates to step detail page
- AC3: Given flow overview page, page loads with flow status fetched from API and renders without client-side loading spinner (SSR)

Definition of Done:
- [ ] PR merged
- [ ] Component tests passing
- [ ] All three page routes render
- [ ] FlowStepper renders from FlowStatus data

Interface Contract References: TDD §4.6 `GET /api/flow/:kitId` — **consumer**
Dependencies: WDD-CONSOLE-010 (API Routes)
Rollback: UI components are stateless. Revert PR.

#### TDD Sections

**Technical Context:**

TDD §4.7 UI Layer:

Page structure (Next.js App Router):

| Route | Purpose | Component Type |
|-------|---------|---------------|
| / | Project setup / overview | Server Component |
| /flow/[kitId] | Flow overview — shows all steps with status | Server Component |
| /flow/[kitId]/step/[stepId] | Step detail — intake, generation, review, validation, freeze | Client Component |

FlowStepper — Renders step sequence from parsed flow definition. Shows completed/current/remaining. Driven by FlowStatus data from API.

**Testing Strategy:**

TDD §8: "FlowStepper: Renders correct number of steps from flow definition; highlights current step; shows completed/remaining status"

**Interface Contracts:**

TDD §4.6 `GET /api/flow/:kitId` — this work item is a **consumer** of the flow status API endpoint, using the returned FlowStatus to drive FlowStepper rendering.

#### ACF Sections

**Security and Compliance:**

N/A for UI components — no direct security concerns beyond what the Server Layer handles. All data fetching and validation occurs server-side.

#### DCF Sections

**Testing Expectations:**

DCF §6 Testing Expectations:
- Component tests with React Testing Library
- FlowStepper tested for correct rendering of step states (completed, current, remaining)
- Navigation behavior tested (step click navigates to detail page)
- Server-side rendering verified (no client-side loading spinner on initial load)
