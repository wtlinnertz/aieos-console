### WDD-CONSOLE-014 — Human Intake Forms: Test Summary

#### Test File

`src/components/__tests__/IntakeForm.test.tsx`

#### Test Coverage (8 tests)

| # | Test Name | Status |
|---|-----------|--------|
| 1 | Renders sections from template headings | PASS |
| 2 | Renders a textarea for each section | PASS |
| 3 | Pre-populates from initialContent | PASS |
| 4 | Calls onSave with assembled markdown content | PASS |
| 5 | Handles template with no headings (single textarea) | PASS |
| 6 | Shows "Saving..." when saving prop is true | PASS |
| 7 | Shows "Save Draft" when saving prop is false | PASS |
| 8 | Allows saving an empty form | PASS |

#### What Is Tested

- **Template parsing:** Markdown `## ` headings are split into sections with heading and description.
- **Pre-population:** `initialContent` markdown is parsed back into section values by matching headings.
- **Save assembly:** User input is reassembled into markdown with `## ` headings and passed to `onSave`.
- **Edge cases:** No-heading templates render a single textarea. Empty forms are saveable. Preamble text before first heading is ignored.
- **UI state:** `saving` prop disables the button and changes label to "Saving...".

#### How to Run

```bash
npx vitest run src/components/__tests__/IntakeForm.test.tsx
```
