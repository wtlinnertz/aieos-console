# Pull Request

## Summary

**What does this change do?**
(1–3 sentences. Be concrete.)

---

## Type of Change
_Select all that apply._

- [ ] Bug fix
- [ ] New feature
- [ ] Refactoring
- [ ] Test improvement
- [ ] Documentation
- [ ] Docker / deployment
- [ ] Other (explain below)

---

## Why This Change Is Needed

**What problem does this solve?**
(Bug description, feature gap, usability improvement, etc.)

---

## Scope & Impact

- **Components affected:**
  (e.g., Kit Service, LLM Service, UI components, API routes)

- **Is this a breaking change?**
  - [ ] Yes
  - [ ] No

If yes, explain the impact and mitigation.

---

## Validation Checklist

Confirm all that apply:

### Tests
- [ ] All existing tests pass (`npx vitest run`)
- [ ] New tests added for changed behavior
- [ ] E2E tests pass (`npx playwright test`)

### Code Quality
- [ ] TypeScript strict mode — zero errors (`npx tsc --noEmit`)
- [ ] ESLint — zero errors, zero warnings (`npx eslint . --max-warnings 0`)
- [ ] No secrets or credentials committed

### Architecture
- [ ] Changes align with spec-driven flow architecture
- [ ] No kit-specific logic hardcoded in application code
- [ ] Input validation is server-side (client-side is supplementary only)

---

## AI Usage Disclosure (Required)

- [ ] I used AI assistance for drafting this change
- [ ] I did not use AI assistance

If AI was used:
- Tool(s) used:
- I reviewed and verified all AI-generated content

---

## Additional Notes (Optional)

Anything reviewers should know before reviewing this PR.
