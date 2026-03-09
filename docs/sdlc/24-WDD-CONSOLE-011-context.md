### WDD-CONSOLE-011 — Content Sanitization

#### WDD Work Item

- WDD Item ID: WDD-CONSOLE-011
- Parent TDD Section: §4.8 Content Sanitization
- Assignee Type: AI Agent
- Required Capabilities: security, frontend
- Complexity Estimate: S

Intent: Implement the content sanitization layer that converts Markdown to HTML and sanitizes the output using an allowlist before it reaches the browser.

In Scope:
- Markdown to HTML rendering (using `remark` + `rehype` or equivalent)
- HTML sanitization with the allowlist defined in TDD §4.8
- `sanitizeContent(markdown: string): string` function returning safe HTML
- Unit tests including XSS attack vectors (script tags, event handlers, javascript: URLs, iframe, object, embed)

Out of Scope:
- UI rendering of sanitized HTML (UI Layer)
- LLM response handling (LLM Service)

Inputs: TDD §4.8 allowlist specification, Markdown content

Outputs: `sanitizeContent` function, unit tests with XSS attack vectors

Acceptance Criteria:
- AC1: Given Markdown with standard formatting (headings, lists, tables, code blocks), `sanitizeContent` returns correctly rendered HTML with only allowed elements
- AC2: Given Markdown containing `<script>alert('xss')</script>` or `<img onerror="alert('xss')">` or `<a href="javascript:alert('xss')">`, all malicious elements and attributes are stripped

Definition of Done:
- [ ] PR merged
- [ ] Unit tests passing
- [ ] XSS attack vector tests included and passing
- [ ] Allowed elements render correctly

Interface Contract References: None — internal utility
Dependencies: WDD-CONSOLE-001 (project scaffolding)
Rollback: Stateless. Security-critical — revert PR immediately if incorrect.

#### TDD Sections

**Technical Context:**

TDD §4.8 Content Sanitization:

Purpose: All LLM-generated content is treated as untrusted (ACF §3). Content must be sanitized before rendering in the browser.

Approach: Server-side sanitization. The Server Layer renders Markdown to HTML, then sanitizes the HTML using an allowlist.

Allowlist (permitted HTML elements):
- Block: h1–h6, p, blockquote, pre, code, ul, ol, li, table, thead, tbody, tr, th, td, hr, br, div
- Inline: strong, em, a (href allowlisted to http/https only), code, span
- Attributes: class (for syntax highlighting), href (on a only, http/https only), id (for heading anchors)
- All other elements and attributes stripped
- All javascript: URLs stripped
- All event handler attributes (onclick, etc.) stripped
- All `<script>`, `<iframe>`, `<object>`, `<embed>`, `<form>` elements stripped

Implementation: Use a well-maintained HTML sanitization library (e.g., sanitize-html or DOMPurify with server-side adapter).

**Testing Strategy:**

TDD §8: Component tests for ArtifactViewer include "does not render script tags or event handlers"

**Interface Contracts:**

None — internal utility function. No cross-boundary interface contracts apply.

#### ACF Sections

**Security and Compliance:**

ACF §3 Security Guardrails:
- LLM response handling — all LLM-generated content is untrusted input and must be sanitized for XSS before rendering

ACF §8 Forbidden Patterns:
- LLM response treated as trusted input is a forbidden pattern; all output must pass through sanitization

#### DCF Sections

**Testing Expectations:**

DCF §3 Quality Bars:
- Content sanitization is required for all rendered output

DCF §6 Testing Expectations:
- Unit tests must cover XSS attack vectors (script tags, event handlers, javascript: URLs, iframe, object, embed)
- Positive tests confirming allowed elements render correctly
