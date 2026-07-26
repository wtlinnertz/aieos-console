# aieos-console

A browser-based wizard for running AIEOS governance processes.

## How to use it

**aieos-console** is a locally deployed web app that guides you through the [AIEOS](https://github.com/wtlinnertz/aieos-governance-foundation) governance framework: from product discovery (PIK) through engineering execution (EEK).

It provides:
- Step-by-step wizard UI that renders from kit-provided flow definitions.
- LLM integration for artifact generation and validation.
- State management with freeze-before-promote enforcement.
- Spec-driven architecture where any AIEOS kit can define its own wizard flow.

This is the first application built using the AIEOS framework and validates the framework itself as both a product and a governance tool.

## Kit coverage

| Kit | Layer | Console support |
|-----|-------|----------------|
| PIK | 2 | Complete |
| EEK | 4 | Complete |
| REK | 5 | Complete |
| RRK | 6 | In progress |
| QAK | 9 | Not yet — planned post-M3 |
| SCK | 10 | Not yet — planned post-M3 |
| DCK | 11 | Not yet — planned post-M3 |
| PINFK | 12 | Not yet — planned post-M3 |
| DKK | 13 | Not yet — planned post-M3 |
| PRK | 14 | Not yet — planned post-M3 |
| BPK | 15 | Not yet — planned post-M3 |

For kits without console support, run kit playbooks manually using `docs/how-to-use-with-ai.md` in the respective kit.

## What it solves

Running AIEOS manually means tracking artifact sequences by hand, providing the right inputs to each generation prompt, managing freeze states, and keeping artifacts consistent. That's error-prone. The console automates it:
- Sequences artifacts automatically from kit definitions.
- Enforces dependency gates (upstream artifacts must be frozen before downstream generation).
- Integrates LLM generation and validation into the workflow.
- Persists state across sessions.

You don't need deep AIEOS expertise: the wizard guides you through each step.

## Architecture

- **Next.js 15** (App Router, TypeScript strict mode)
- **7 core services:** Kit, Flow Definition, State, Filesystem, LLM, Orchestration, Logging.
- **Spec-driven flow engine** - kit directories provide YAML flow definitions that declare artifact sequences, step types, dependencies, and freeze gates.
- **Docker deployment** - multi-stage build, non-root user, health check endpoint.
- **Single-user local tool** - no authentication, no shared infrastructure.

## Getting started

### Prerequisites

- Docker
- An LLM API key (Anthropic recommended)
- One or more AIEOS kit directories on your filesystem

### Run with Docker

```bash
# Build the image
docker build -t aieos-console .

# Run the container
docker run -d \
  --name aieos-console \
  -p 3000:3000 \
  -v /path/to/kit:/kits/kit-name:ro \
  -v /path/to/project:/project \
  -e PROJECT_DIR=/project \
  -e KIT_DIRS=/kits/kit-name \
  -e LLM_PROVIDER=anthropic \
  -e LLM_API_KEY=your-api-key \
  -e LLM_MODEL=claude-sonnet-4-20250514 \
  aieos-console
```

Then open [http://localhost:3000](http://localhost:3000).

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PROJECT_DIR` | Yes | Container path to the project directory (mount with `-v`) |
| `KIT_DIRS` | Yes | Comma-separated container paths to kit directories (mount with `-v :ro`) |
| `LLM_PROVIDER` | Yes | LLM provider (`anthropic`) |
| `LLM_API_KEY` | Yes | API key for the LLM provider |
| `LLM_MODEL` | Yes | Model identifier (e.g., `claude-sonnet-4-20250514`) |
| `PORT` | No | Server port (default: `3000`) |
| `FLOW_SOURCE` | No | `manifest` (default): flows derive from `kit-manifest.yml` (FR-023). `flow-yaml`: legacy per-kit `flow.yaml` loader (kept ≥1 release as the rollback path) |
| `KIT_ROOT` | manifest mode | Directory containing the kit checkouts, including `aieos-governance-foundation` |
| `MANIFEST_PATH` | No | Explicit path to `kit-manifest.yml` (default: `<KIT_ROOT>/aieos-governance-foundation/kit-manifest.yml`). Missing/unparseable/version-skewed manifests fail closed — see `/api/health` |
| `HARNESS_CMD` | for freeze | Harness invocation. Preferred: a JSON string array, e.g. `["python","-m","src.cli"]` — safe for paths with spaces. A plain string is split on spaces. On Windows the default `harness` is not invokable by `execFile` (no console script; a `.cmd` shim needs a shell) — use the JSON form with `python` |
| `HARNESS_CWD` | for freeze | Working directory for the harness invocation (the `aieos-agent-harness` checkout when using `python -m src.cli`) |

The derived flow for any kit is inspectable at `GET /api/flow/{ABBR}/derived`
(e.g. `/api/flow/QAK/derived`) when `FLOW_SOURCE=manifest`.

## Development

```bash
npm ci                              # Install dependencies
npm run dev                         # Start development server
npx vitest run                      # Run unit tests (241 tests)
npx playwright test                 # Run E2E tests (18 tests)
npx tsc --noEmit                    # Type check
npx eslint . --max-warnings 0      # Lint
```

### Docker verification

```bash
scripts/verify-docker.sh            # Build, start, health check, init, persistence
```

## Tests

- 241 unit and component tests covering all 7 services and 11 UI components
- 18 E2E tests covering health check, project initialization, flow lifecycle, content editing, and error handling
- TypeScript strict mode with zero errors
- ESLint with zero warnings

## SDLC governance

This project was built using the full AIEOS process. All governance artifacts are in `docs/sdlc/`:

| Layer | Artifacts |
|-------|-----------|
| Layer 2 (Product Intelligence) | WCR, PFD, VH, AR, EL, DPRD |
| Layer 4 (Engineering Execution) | KER, PRD, ACF, SAD, DCF, TDD, WDD, ORD |
| Layer 5 (Release & Exposure) | RER, RCF, RP, RR |

The engagement record tracking all artifacts across layers is at `docs/engagement/er-CONSOLE-001.md`.

## Related repositories

- [aieos-governance-foundation](https://github.com/wtlinnertz/aieos-governance-foundation): Canonical authority for all structural rules and the layer model
- [aieos-product-intelligence-kit](https://github.com/wtlinnertz/aieos-product-intelligence-kit): Layer 2: Product discovery through engineered PRD
- [aieos-engineering-execution](https://github.com/wtlinnertz/aieos-engineering-execution): Layer 4: Design through deployable code
- [aieos-release-exposure-kit](https://github.com/wtlinnertz/aieos-release-exposure-kit): Layer 5: Safe deployment to production

## Contributing

Contributions are welcome. Please read `CONTRIBUTING.md` before submitting a PR.

## License

This project is licensed under the MIT License.
