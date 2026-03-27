# CLAUDE.md — aieos-console

## What This Project Is

**aieos-console** is a browser-based guided wizard for running AIEOS governance processes. It is a locally deployed Next.js web application that sequences artifact generation and validation, enforces freeze-before-promote gates, and integrates LLM calls — so users do not need to manage the AIEOS process manually.

This is the first initiative built using the full AIEOS framework and serves as both a product and a framework validation exercise.

## Repository Structure

```
src/
  app/                 # Next.js App Router pages
  components/          # React UI components
  lib/                 # Core services (Kit, Flow, State, Filesystem, LLM, Orchestration, Logging)
  __tests__/           # Unit and component tests
docs/
  sdlc/                # All AIEOS governance artifacts (numbered 00-37)
  engagement/          # Engagement Record tracking all layers
scripts/
  verify-docker.sh     # Docker build + health check + persistence verification
```

## Current Status

- **Layer 2 (PIK):** Complete. All artifacts frozen through DPRD-CONSOLE-001.
- **Layer 4 (EEK):** Complete. All artifacts frozen through ORD-CONSOLE-001.
- **Layer 5 (REK):** Complete. RER, RCF, RP, RR all frozen. Release disposition: successful-full-exposure.
- **Layer 6 (RRK):** Not started. RR-CONSOLE-001 §7 provides handoff.
- **Tests:** 241 unit + 18 E2E = 259 total, all passing.

## Engagement Record

The engagement record tracking all artifacts across layers is at `docs/engagement/er-CONSOLE-001.md` (ER-CONSOLE-001).

## SDLC Artifact Numbering Convention

SDLC files in `docs/sdlc/` use `{nn}-{type}.md` numbering. The `{nn}` prefix is a sequence number, not a layer number:

- **00-07:** Layer 2 (PIK) artifacts (WCR, discovery intake, PFD, VH, AR, EL, DPRD)
- **01, 08-12:** Layer 4 (EEK) artifacts (01-prd is the placed DPRD; KER, ACF, SAD, DCF, TDD, WDD)
- **13:** Execution plan
- **14-32:** Work item phases (context, tests, plan, review per WDD item)
- **33:** ORD
- **34:** RER + ORD acceptance check
- **35:** RCF
- **36:** RP
- **37:** RR

## Development

```bash
npm ci                              # Install dependencies
npm run dev                         # Start development server
npx vitest run                      # Run unit tests (241 tests)
npx playwright test                 # Run E2E tests (18 tests)
npx tsc --noEmit                    # Type check
npx eslint . --max-warnings 0      # Lint
scripts/verify-docker.sh            # Docker verification
```

## Commit Message Style

Follow conventional commits: `docs: <description>`

## Related Framework Repositories

- [aieos-governance-foundation](https://github.com/wtlinnertz/aieos-governance-foundation) — Canonical authority for all structural rules
- [aieos-product-intelligence-kit](https://github.com/wtlinnertz/aieos-product-intelligence-kit) — Layer 2
- [aieos-engineering-execution-kit](https://github.com/wtlinnertz/aieos-engineering-execution-kit) — Layer 4
- [aieos-release-exposure-kit](https://github.com/wtlinnertz/aieos-release-exposure-kit) — Layer 5
