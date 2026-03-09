### WDD-CONSOLE-014 — Human Intake Forms: Implementation Plan

#### WDD Work Item

- **WDD Item ID:** WDD-CONSOLE-014
- **Assignee Type:** AI Agent
- **Complexity Estimate:** S

#### Intent

Create a React component that renders guided intake forms from AIEOS template markdown, enabling human-authored artifact steps in the orchestration flow.

#### Files Created

| File | Purpose |
|------|---------|
| `src/components/IntakeForm.tsx` | Client component rendering intake form from template markdown |
| `src/components/__tests__/IntakeForm.test.tsx` | 8 component tests using React Testing Library |

#### Design Decisions

1. **Template parsing:** Split on `^## ` (line-start heading markers). Text before the first heading is treated as preamble and ignored. Each heading becomes a labeled textarea section.

2. **Round-trip fidelity:** `initialContent` is parsed by the same heading-split logic to pre-populate textareas. Save reassembles with `## Heading\ncontent` format.

3. **No-heading fallback:** Templates without `## ` headings render a single textarea labeled "Content", supporting freeform entry.

4. **Minimal dependencies:** Pure React with no CSS framework. Uses `useState` and `useCallback` for state management.

#### Acceptance Criteria

- AC1: Component renders a textarea per `## ` section in template markdown.
- AC2: `initialContent` pre-populates matching sections.
- AC3: Save button calls `onSave` with reassembled markdown.
- AC4: Templates without headings fall back to a single textarea.
- AC5: `saving` prop disables button and shows "Saving..." label.
- AC6: All 8 tests pass. TypeScript and ESLint checks pass with zero warnings.
