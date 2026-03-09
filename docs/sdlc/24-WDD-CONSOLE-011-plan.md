# Plan — WDD-CONSOLE-011 (Content Sanitization)

## Files to Create
1. `src/lib/sanitize.ts` — `sanitizeContent` function using remark + remark-gfm + remark-html for Markdown-to-HTML, then sanitize-html for allowlist enforcement
2. `src/lib/__tests__/sanitize.test.ts` — 13 tests covering acceptance criteria, XSS attack vectors, and positive rendering

## Dependencies Added
- `remark-gfm` 4.0.0 — GFM table support for remark pipeline

## Design Decisions
- Async function: remark and remark-html are ESM-only; dynamic imports used for compatibility, making the function async
- remark-gfm added for GFM table rendering (pipe-delimited tables)
- remark-html configured with `sanitize: false` so all HTML passes through to sanitize-html for unified allowlist enforcement
- sanitize-html handles all security filtering: element allowlist, attribute allowlist, URL scheme restriction
