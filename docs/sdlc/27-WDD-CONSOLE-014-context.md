### WDD-CONSOLE-014 — Human Intake Forms

#### WDD Work Item

- WDD Item ID: WDD-CONSOLE-014
- Parent TDD Section: §4.7 UI Layer (StepView for human-intake step type)
- Assignee Type: AI Agent
- Required Capabilities: frontend
- Complexity Estimate: M

Intent: Implement the step detail view for `human-intake` step types, rendering guided forms that map to the AIEOS template structure.

In Scope:
- `IntakeForm` component: renders guided form for human-intake steps
- Form fields derived from template content (headings become sections, bullet points become form fields)
- Client-side form validation (supplementary)
- Save draft and submit actions (via PUT .../content API)
- Component tests

Out of Scope:
- LLM-generated step views (013)
- Template parsing logic beyond rendering form fields
- Kit authoring (NG-1)

Inputs: TDD §4.7 StepView spec for human-intake, Template content from Kit Service, API route (010)

Outputs: IntakeForm component, component tests

Acceptance Criteria:
- AC1: Given a human-intake step with template content, form renders with sections/fields from template
- AC2: Given form with content, clicking "Save Draft" sends content to API
- AC3: Given previously saved form, page loads pre-populated with saved content

Definition of Done:
- [ ] PR merged
- [ ] Component tests passing
- [ ] Form renders from template content
- [ ] Save and reload tested

Interface Contract References: TDD §4.6 `PUT .../content`, `GET .../step/:stepId` — **consumer**
Dependencies: WDD-CONSOLE-010 (API Routes)
Rollback: UI component. Revert PR.

#### TDD Sections

**Technical Context:**

TDD §4.7 StepView:

StepView — Renders current step based on stepType:
- human-intake: Renders a guided form mapped to the template structure
- llm-generated: Shows "Generate" button, streams output
- acceptance-check: Shows source artifact and PASS/FAIL
- consistency-check: Shows comparison view and PASS/FAIL

For human-intake steps, the form structure is derived from the template content: headings become form sections, bullet points become form fields.

**Testing Strategy:**

TDD §8: "StepView: Renders correct view for each step type (human-intake form, llm-generated with generate button, acceptance-check)"

**Interface Contracts:**

TDD §4.6 `PUT /api/flow/:kitId/step/:stepId/content` — this work item is a **consumer**, sending draft content to the server via this endpoint.

TDD §4.6 `GET /api/flow/:kitId/step/:stepId` — this work item is a **consumer**, loading step context (including previously saved content) from this endpoint.

#### ACF Sections

**Security and Compliance:**

ACF §3 Security Guardrails:
- Input validation — server-side validation is authoritative; client-side form validation is supplementary only and must not be relied upon for security

#### DCF Sections

**Testing Expectations:**

DCF §6 Testing Expectations:
- Component tests with React Testing Library
- Form rendering from template content tested
- Save draft action tested (API call verification)
- Pre-population from saved content tested
