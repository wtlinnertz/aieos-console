# CONTRIBUTING

This repository is a browser-based guided wizard for running AIEOS governance processes. It's built with Next.js and deployed as a local Docker container.

## Guiding principles

All contributions must uphold these principles:

- **Spec-driven architecture** — the UI renders from kit-provided flow definitions. Don't embed kit-specific logic in application code.
- **Validators judge, they do not help** — validation produces PASS/FAIL only
- **Freeze-before-promote** — upstream artifacts must be frozen before downstream generation
- **Anonymization is mandatory** — no real names, internal URLs, or proprietary content

If a contribution weakens these principles, it will not be accepted.

## What you can contribute

### Bug Fixes
- Application errors, rendering issues, state management bugs
- Docker deployment or configuration problems

### Features
- UI/UX improvements to the wizard flow
- New kit integration capabilities
- Observability and monitoring enhancements

### Tests
- Unit tests, component tests, or E2E tests
- Test coverage for untested code paths

### Documentation
- Clarifications to deployment or usage documentation
- New examples or guides

## What you should NOT contribute

The following will be rejected:

- Kit-specific logic hardcoded in application code (use flow definitions)
- Changes that bypass the spec-driven architecture
- Employer-specific or proprietary content
- Large architectural rewrites without prior discussion

---

## Development Setup

```bash
npm ci                    # Install dependencies
npm run dev               # Start development server
npx vitest run            # Run unit tests (241 tests)
npx playwright test       # Run E2E tests (18 tests)
npx tsc --noEmit          # Type check
npx eslint . --max-warnings 0  # Lint
```

### Docker Verification

```bash
docker build -t aieos-console .
scripts/verify-docker.sh   # Full deployment verification
```

## Contribution workflow

### 1. Fork and branch
- Fork the repository
- Create a branch from `main`
- Use a descriptive branch name: `fix/…`, `feat/…`, `docs/…`, `test/…`

### 2. Make your changes
- Keep changes **small and focused**
- One logical improvement per PR
- Ensure all tests pass before submitting

### 3. Validate your contribution
Before opening a PR, ensure:
- `npx vitest run` — all unit tests pass
- `npx tsc --noEmit` — zero TypeScript errors
- `npx eslint . --max-warnings 0` — zero lint errors
- No secrets or credentials committed (check `.env` files, API keys)

### 4. Open a pull request
Your PR description should include:
- What problem this change solves
- Which components are affected
- Any intentional trade-offs
- AI Usage Disclosure

PRs without a clear purpose may be closed.

## Review expectations

Maintainers will review contributions for:

- Correctness and test coverage
- Alignment with spec-driven architecture
- Security (no credential leaks, proper input validation, XSS prevention)
- Code quality (TypeScript strict mode, no lint warnings)

## AI usage in contributions

You may use AI tools to assist in drafting code or content, provided that:

- You review all AI-generated output
- You ensure no secrets or proprietary content is included
- You take responsibility for the final content

## Code of conduct

This project follows the **Code of Conduct** defined in `CODE_OF_CONDUCT.md`.
