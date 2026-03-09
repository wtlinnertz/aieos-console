# WDD-CONSOLE-015 — Test Specification

## Component: Artifact Viewer and Editor

### ArtifactViewer.test.tsx (5 tests)

| # | Test | Type | Description |
|---|------|------|-------------|
| 1 | shows loading state initially | Unit | Displays "Loading..." before async sanitization completes |
| 2 | renders markdown as sanitized HTML | Unit | After sanitization, rendered HTML contains heading and paragraph elements |
| 3 | shows frozen indicator when isFrozen is true | Unit | Displays "Frozen" badge when isFrozen prop is set |
| 4 | does not show frozen indicator when isFrozen is false | Unit | No frozen badge when isFrozen is not set |
| 5 | does not render script tags (XSS prevention) | Security | Sanitized output contains no script elements |

### ArtifactEditor.test.tsx (6 tests)

| # | Test | Type | Description |
|---|------|------|-------------|
| 1 | renders textarea with content | Unit | Textarea displays the provided content prop |
| 2 | save button is disabled when content is not dirty | Unit | Save button disabled when content matches original |
| 3 | save button is enabled when content changes | Unit | Save button enabled after textarea content is modified |
| 4 | calls onSave with edited content when save is clicked | Unit | onSave callback receives the edited text |
| 5 | shows saving state | Unit | Button shows "Saving..." text and is disabled when saving prop is true |
| 6 | shows re-validation indicator | Unit | Displays "Re-validation needed" when needsRevalidation is true |

### ArtifactToggle.test.tsx (4 tests)

| # | Test | Type | Description |
|---|------|------|-------------|
| 1 | defaults to viewer mode | Unit | Shows ArtifactViewer on initial render |
| 2 | can toggle to editor mode | Unit | Clicking Edit button switches to ArtifactEditor |
| 3 | does not show edit button when frozen | Unit | No Edit toggle rendered when isFrozen is true |
| 4 | can toggle back to viewer from editor | Unit | Clicking View button returns to ArtifactViewer |

### Test Infrastructure

- Framework: Vitest + React Testing Library + jsdom
- Mocking: `vi.mock('../../lib/sanitize')` for async sanitizeContent
- Cleanup: Explicit `cleanup()` in `afterEach` to prevent DOM leakage between tests
