### WDD-CONSOLE-015 — Artifact Viewer and Editor

#### WDD Work Item

- **WDD Item ID:** WDD-CONSOLE-015
- **Parent TDD Section:** §4.7 UI Layer (ArtifactViewer, ArtifactEditor)
- **Assignee Type:** AI Agent
- **Required Capabilities:** frontend
- **Complexity Estimate:** M

**Intent:** Implement the ArtifactViewer (sanitized Markdown rendering) and ArtifactEditor (text editing with save and re-validation tracking) components.

**In Scope:**
- `ArtifactViewer` component: renders sanitized HTML from Markdown; displays formatted artifacts
- `ArtifactEditor` component: Markdown text editor; tracks dirty state; saves via API; indicates editing resets validation state
- Toggle between viewer and editor modes for draft artifacts
- Component tests

**Out of Scope:**
- Sanitization logic (011 — consumed as dependency)
- Rich text editing (plain text/Markdown editing sufficient)

**Inputs:** TDD §4.7 specs, Content sanitization (011), API route (010)

**Outputs:** ArtifactViewer and ArtifactEditor components, component tests

**Acceptance Criteria:**
- AC1: Given Markdown content, ArtifactViewer renders formatted HTML (headings, lists, tables, code blocks), no raw Markdown visible
- AC2: Given draft artifact, user edits in ArtifactEditor and saves → content sent to API, UI indicates re-validation needed
- AC3: Given frozen artifact, ArtifactViewer renders with no edit button available

**Definition of Done:**
- [ ] PR merged
- [ ] Component tests passing
- [ ] Markdown rendering tested
- [ ] Edit → save → re-validation indicator tested
- [ ] Frozen artifact read-only mode tested

**Interface Contract References:** TDD §4.6 `PUT .../content` — **consumer**

**Dependencies:** WDD-CONSOLE-011 (Content Sanitization), WDD-CONSOLE-010 (API Routes)

**Rollback:** UI components stateless. Revert PR.

#### TDD Sections

**Technical Context:**

TDD §4.7 UI Layer — ArtifactViewer, ArtifactEditor:

```
ArtifactViewer — Renders Markdown artifact content as formatted HTML. Uses sanitized HTML output (§4.8). Shows process transparency.
ArtifactEditor — Markdown text editor for user edits to draft artifacts. Edits trigger PUT /api/flow/:kitId/step/:stepId/content.
```

**Testing Strategy:**

TDD §8 — Component test expectations:

- "ArtifactViewer: Renders sanitized HTML from Markdown; does not render script tags or event handlers"
- "ArtifactEditor: User edits trigger content update; tracks dirty state"

**Interface Contracts:**

TDD §4.6 — API route consumed by ArtifactEditor:

- `PUT /api/flow/:kitId/step/:stepId/content` — saves edited artifact content, resets step state to draft

#### ACF Sections

**Security and Compliance:**

ACF §3 Security Guardrails:
- LLM response handling — all content must be sanitized before rendering. ArtifactViewer must use the sanitized HTML pipeline from WDD-CONSOLE-011 to prevent XSS. Script tags and event handlers must not be rendered.

#### DCF Sections

**Testing Expectations:**

DCF §6 Testing Expectations:
- Component tests with React Testing Library for ArtifactViewer and ArtifactEditor
- Markdown rendering tested across content types (headings, lists, tables, code blocks)
- Edit-save-re-validation indicator flow tested
- Frozen artifact read-only enforcement tested
