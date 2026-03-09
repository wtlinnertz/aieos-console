### WDD-CONSOLE-016 — Project Setup Page

#### WDD Work Item

- WDD Item ID: WDD-CONSOLE-016
- Parent TDD Section: §4.7 UI Layer (root page `/`), §4.6 (`POST /api/project/initialize`)
- Assignee Type: AI Agent
- Required Capabilities: frontend
- Complexity Estimate: S

Intent: Implement the project setup page at `/` that allows users to configure kit directories, LLM settings, and initialize a new project.

In Scope:
- Project configuration form: project directory, kit directory paths, LLM provider, model, API key env var name
- Initialize button calling `POST /api/project/initialize`
- Display existing project state if already initialized
- Component tests

Out of Scope:
- Flow navigation (012)
- Kit configuration editing after initialization

Inputs: TDD §4.6 `POST /api/project/initialize`, `GET /api/project` specs, API routes (010)

Outputs: Project setup page component, component tests

Acceptance Criteria:
- AC1: Given no existing project, user fills form and clicks Initialize → project initialized via API, navigated to flow overview
- AC2: Given existing initialized project, root page shows existing config and navigation to flows

Definition of Done:
- [ ] PR merged
- [ ] Component tests passing
- [ ] Initialize flow tested
- [ ] Existing project detection tested

Interface Contract References: TDD §4.6 `POST /api/project/initialize`, `GET /api/project` — **consumer**
Dependencies: WDD-CONSOLE-010 (API Routes)
Rollback: UI component. Revert PR.

#### TDD Sections

**Technical Context:**

TDD §4.7 UI Layer:

Route: `/` — Project setup / overview — Server Component (loads project state)

The root page serves dual purpose: project initialization for new projects, and project overview with navigation to flows for existing projects.

TDD §4.6 Server Layer:

`POST /api/project/initialize` — Initialize project. Body: `{ projectDir, kitConfigs, llmConfigs }`. Outputs: `{ success: true }`. Errors: 409 (already initialized), 400 (invalid config), 500.

`GET /api/project` — Project state overview. Outputs: JSON ProjectState. Errors: 500.

**Testing Strategy:**

TDD §8: No specific test section for project setup, but general component testing expectations apply.

**Interface Contracts:**

TDD §4.6 `POST /api/project/initialize` — this work item is a **consumer**, sending project configuration to initialize a new project.

TDD §4.6 `GET /api/project` — this work item is a **consumer**, loading existing project state to determine whether to show the setup form or the project overview.

#### ACF Sections

**Security and Compliance:**

ACF §3 Security Guardrails:
- Input validation — server-side validation is authoritative for all project configuration inputs; client-side validation is supplementary

#### DCF Sections

**Testing Expectations:**

DCF §6 Testing Expectations:
- Component tests with React Testing Library
- Initialize flow tested (form submission, API call, navigation)
- Existing project detection tested (shows overview instead of setup form)
