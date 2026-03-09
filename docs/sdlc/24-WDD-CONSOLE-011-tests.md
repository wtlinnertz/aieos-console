# Tests — WDD-CONSOLE-011 (Content Sanitization)

## Test Plan

### Acceptance Tests
- AT-1 (AC1): Standard markdown (headings, lists, tables, code blocks) renders correctly with allowed elements
- AT-2 (AC2): Script tags stripped
- AT-3 (AC2): img onerror stripped
- AT-4 (AC2): javascript: URLs stripped

### XSS Attack Vector Tests
- XSS-1: `<script>alert('xss')</script>` stripped
- XSS-2: `<img onerror="alert('xss')">` stripped
- XSS-3: `<a href="javascript:alert('xss')">` href stripped, link text preserved
- XSS-4: `<iframe src="evil.com">` stripped
- XSS-5: `<div onclick="alert('xss')">` onclick stripped, div preserved
- XSS-6: `<object>`, `<embed>`, `<form>` stripped

### Positive Tests
- PT-1: Headings, bold, italic, links (http/https) preserved
- PT-2: Code blocks preserved
- PT-3: Tables preserved

## Total: 13 tests
