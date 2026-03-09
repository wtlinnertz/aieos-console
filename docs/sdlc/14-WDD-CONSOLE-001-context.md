### WDD-CONSOLE-001 — Project Scaffolding

#### WDD Work Item

- **WDD Item ID:** WDD-CONSOLE-001
- **Parent TDD Section:** §3 Technical Overview, §5 Build and Deployment
- **Assignee Type:** AI Agent
- **Required Capabilities:** infrastructure, frontend, backend
- **Complexity Estimate:** M

**Intent:** Initialize the aieos-console project with Next.js App Router, TypeScript strict mode, ESLint, Vitest, Playwright, and Docker configuration.

**In Scope:**
- Next.js project initialization with App Router and TypeScript strict mode
- ESLint configuration with zero-warning enforcement
- Vitest configuration with React Testing Library
- Playwright configuration
- Dockerfile (multi-stage build, non-root user, health check)
- `.dockerignore`
- Environment variable configuration loading (PROJECT_DIR, KIT_DIRS, LLM_API_KEY, LLM_PROVIDER, LLM_MODEL, PORT)
- `package.json` with all dependencies pinned to exact versions

**Out of Scope / Non-Goals:**
- Application business logic
- Any component implementation beyond project structure

**Inputs:**
- TDD §5 Build and Deployment (Dockerfile structure, configuration inputs)
- TDD §10 Dependencies (exact dependency list)

**Outputs:**
- Initialized Next.js project at `/home/todd/projects/aieos/aieos-console/`
- Working `npm ci && npm run build` pipeline
- Working `docker build` producing a valid image
- Vitest and Playwright configuration verified with placeholder tests
- ESLint and TypeScript configured and passing

**Acceptance Criteria:**
- **AC1:** Given a clean checkout, when `npm ci && npx tsc --noEmit` is run, then it exits 0 with zero type errors. Failure: If `tsc` reports errors, the TypeScript configuration is incorrect
- **AC2:** Given a clean checkout, when `npx eslint . --max-warnings 0` is run, then it exits 0. Failure: If ESLint reports errors or warnings, the configuration is incorrect
- **AC3:** Given a clean checkout, when `docker build -t aieos-console .` is run, then it produces a valid image with a non-root user and health check. Failure: If the build fails or the image runs as root, the Dockerfile is incorrect
- **AC4:** Given the Docker image, when `docker run` is executed with required environment variables, then the application starts and the health check endpoint returns 200. Failure: If the health check fails, the startup configuration is incorrect

**Definition of Done:**
- [ ] PR merged
- [ ] TypeScript strict mode passing (zero errors)
- [ ] ESLint passing (zero errors, zero warnings)
- [ ] Vitest placeholder test passes
- [ ] Playwright placeholder test passes
- [ ] Docker build succeeds
- [ ] Docker container starts and health check passes

**Interface Contract References:** None — project scaffolding, no component contracts implemented

**Dependencies:** None

**Rollback / Failure Behavior:** Project scaffolding is the first item. If it fails, no downstream items are affected. Delete the generated project and retry.

---

#### TDD Sections

**Technical Context:**

##### §3 Component Technology Map

| SAD Component | Technology | Key Libraries/Patterns |
|--------------|-----------|----------------------|
| UI Layer | Next.js App Router, React, TypeScript | Server Components for data fetching; Client Components for interactive wizard state; React Context for wizard navigation state |
| Server Layer | Next.js Route Handlers (App Router) | Request validation middleware; JSON response formatting |
| Orchestration Service | TypeScript module | Flow definition interpreter; state machine for step progression |
| Kit Service | TypeScript module | YAML parser for flow definitions; filesystem directory traversal; file content reader |
| State Service | TypeScript module | JSON file read/write for state metadata; Markdown file read/write for artifacts |
| LLM Service | TypeScript module | Provider abstraction interface; HTTP client for LLM API calls; Server-Sent Events for streaming |
| Filesystem Service | TypeScript module | Node.js `fs/promises`; path validation; atomic write (write-tmp + rename); lock file management |

##### §5 Build and Deployment

**Build Steps:**
1. Install dependencies: `npm ci`
2. Type check: `npx tsc --noEmit` (must exit 0)
3. Lint: `npx eslint . --max-warnings 0` (must exit 0)
4. Unit and component tests: `npx vitest run` (must exit 0)
5. Build application: `npx next build`
6. Build Docker image: `docker build -t aieos-console .`

**Deployment Steps:**
1. Ensure kit directories accessible
2. Ensure project directory exists
3. Run container: `docker run -v /path/to/kits:/kits:ro -v /path/to/project:/project -e LLM_API_KEY=<key> -p 3000:3000 aieos-console`
4. Verify: Access http://localhost:3000 and confirm; check Docker logs
5. On first use: Initialize project via UI

**Configuration Inputs:**

| Name | Source | Purpose |
|------|--------|---------|
| PROJECT_DIR | Environment variable or container mount | Path to project directory inside container |
| KIT_DIRS | Environment variable (comma-separated) or container mounts | Paths to kit directories inside container |
| LLM_API_KEY | Environment variable | API key for the configured LLM provider |
| LLM_PROVIDER | Environment variable (default: anthropic) | LLM provider identifier |
| LLM_MODEL | Environment variable (default: provider-specific) | Model identifier |
| PORT | Environment variable (default: 3000) | HTTP port |

**Secrets:** LLM_API_KEY — API key for the LLM provider; injected via environment variable; never logged, never written to artifacts or state files.

**Dockerfile Structure:**
- Base: `node:{LTS}-alpine`
- Multi-stage: build stage (install deps, build Next.js) → production stage (copy build output, run)
- Non-root user in production stage
- Health check: `HEALTHCHECK CMD curl -f http://localhost:3000/api/health || exit 1`

##### §10 Dependencies

| Dependency | Purpose | Version Strategy |
|-----------|---------|-----------------|
| Next.js | Application framework | Exact version pinned |
| React | UI component library | Exact version pinned |
| TypeScript | Type system | Exact version pinned |
| @anthropic-ai/sdk | Initial LLM provider | Exact version pinned |
| yaml | YAML parsing for flow definitions | Exact version pinned |
| HTML sanitization library | Content sanitization | Exact version pinned |
| Markdown rendering library | Markdown to HTML conversion | Exact version pinned |
| Vitest | Unit and component testing | Exact version pinned (dev) |
| @testing-library/react | Component testing | Exact version pinned (dev) |
| Playwright | End-to-end testing | Exact version pinned (dev) |
| ESLint | Linting | Exact version pinned (dev) |

**Testing Strategy:** N/A for project scaffolding — placeholder tests only to verify toolchain configuration.

**Interface Contracts:** None — project scaffolding establishes the foundation but does not implement any component contracts.

---

#### ACF Sections

**Security and Compliance:**

##### §2 Platform Assumptions
- Runtime: Node.js (current LTS), TypeScript strict mode, ESM modules
- Deployment: Local via Docker; single container; no cloud hosting
- Networking: Local network only; no public ingress; outbound HTTPS to LLM provider API only
- Identity: No auth; single-user; concurrent access prevented via lock file

##### §9 Standard Interfaces (CI/CD)
Build pipeline must enforce: type check, lint, test, build, Docker image build — all as gating steps.

##### §8 Forbidden Patterns
- **Unpinned dependencies:** All dependencies in `package.json` must be pinned to exact versions (no `^` or `~` prefixes). This applies to both production and dev dependencies.

---

#### DCF Sections

**Testing Expectations:**

##### §6 Testing Expectations

**Required test layers:**
- **Unit tests (Vitest):** All service layer functions, utility functions, validation logic, flow definition parsing. Mock only at service boundaries.
- **Component tests (Vitest + React Testing Library):** All React components with user interaction.
- **End-to-end tests (Playwright):** Critical user flows.

**Evidence requirements:**
- Test results in machine-readable format
- Code coverage report
- Lint and type-check results (zero errors required)

**Promotion gates:**
- All unit and component tests pass
- No TypeScript type errors (strict mode)
- No ESLint errors
- No known high/critical CVEs
- No secrets detected
- SAST scan passes
- Container image scan passes
- E2E tests pass for critical flows
