### WDD-CONSOLE-019 — Docker Deployment

#### WDD Work Item

- **WDD Item ID:** WDD-CONSOLE-019
- **Parent TDD Section:** §5 Build and Deployment, §9 Operational Notes
- **Assignee Type:** AI Agent
- **Required Capabilities:** infrastructure
- **Complexity Estimate:** S

**Intent:** Verify the Docker deployment works end-to-end with real kit directories and project directory, and document the deployment and rollback procedures.

**In Scope:**
- Verify Docker image builds and runs with real AIEOS kit directories mounted
- Verify environment variable configuration works correctly
- Verify health check endpoint works in Docker
- Verify volume mount permissions (read-only for kits, read-write for project)
- Document deploy, verify, and rollback procedures per TDD §9

**Out of Scope:**
- Cloud deployment (NG-5)
- CI/CD pipeline setup

**Inputs:** TDD §5 Build and Deployment, §9 Operational Notes, Docker image from 001, real AIEOS kit directories

**Outputs:** Verified Docker deployment, deployment documentation

**Acceptance Criteria:**
- AC1: Given project source, `docker build -t aieos-console .` builds successfully with non-root user and health check
- AC2: Given Docker image and real kit directories, container starts with kits mounted read-only and project read-write, health check returns 200, startup log confirms kits loaded
- AC3: Given running container, environment variables (LLM_API_KEY, LLM_PROVIDER, LLM_MODEL) are read correctly
- AC4: Given running container with project state, container restart preserves state from persisted state.json

**Definition of Done:**
- [ ] PR merged
- [ ] Docker build succeeds
- [ ] Container starts with real kit directories
- [ ] Health check passes
- [ ] Deployment documentation written (deploy, verify, rollback)
- [ ] Evidence logs generated

**Interface Contract References:** None

**Dependencies:** All prior work items

**Rollback:** Non-destructive verification. Fix and retry.

#### TDD Sections

**Technical Context:**

TDD §5 Build and Deployment:

```
Build Steps:
1. npm ci
2. npx tsc --noEmit (exit 0)
3. npx eslint . --max-warnings 0 (exit 0)
4. npx vitest run (exit 0)
5. npx next build
6. docker build -t aieos-console .

Deployment Steps:
1. Ensure kit directories accessible
2. Ensure project directory exists
3. docker run -v /path/to/kits:/kits:ro -v /path/to/project:/project -e LLM_API_KEY=<key> -p 3000:3000 aieos-console
4. Verify: Access localhost:3000, check Docker logs for startup log
5. On first use: Initialize project via UI

Configuration Inputs:
- PROJECT_DIR, KIT_DIRS, LLM_API_KEY, LLM_PROVIDER, LLM_MODEL, PORT

Dockerfile Structure:
- Base: node:{LTS}-alpine
- Multi-stage: build → production
- Non-root user in production stage
- Health check: HEALTHCHECK CMD curl -f http://localhost:3000/api/health || exit 1
```

TDD §9 Operational Notes:

```
Deploy Procedure:
1. Build Docker image
2. Run container with volume mounts and env vars
3. Verify startup log

Verify Procedure:
1. Access localhost:3000
2. Check Docker logs for app.startup event
3. Navigate to flow overview
4. Verify artifact states if project exists

Rollback Procedure:
1. Stop current container
2. Run previous image version
3. Verify project state loads correctly
4. State is forward-compatible within major version
```

**Testing Strategy:**

TDD §8 — Pass/fail criteria applicable to Docker deployment verification:
- Docker build must complete successfully
- Health check must return 200
- Startup log must confirm kit directories loaded
- State persistence must survive container restart

**Interface Contracts:**

No specific interface contracts — Docker deployment wraps the full application. The health check endpoint (`GET /api/health`) is the primary verification interface.

#### ACF Sections

**Security and Compliance:**

ACF §2 Platform Assumptions:
- Docker-based deployment, local only. No cloud deployment in scope.

ACF §5 Reliability:
- Application must be available when the container is running. No external dependency required for startup — the application must start and serve requests using only local kit directories and project directory.

ACF §9 Standard Interfaces:
- CI/CD — Docker build and deployment steps must be compatible with standard CI/CD pipeline integration.

#### DCF Sections

**Testing Expectations:**

DCF §5 Operational Expectations:
- Deployment verification must include startup log confirmation, health check response, and flow definition parse results
- Evidence logs must be generated to confirm successful deployment

DCF §6 Testing Expectations:
- Docker build and run verification serves as the deployment integration test
- Health check endpoint validation confirms application readiness
- Volume mount permission verification confirms correct read-only (kits) and read-write (project) access
