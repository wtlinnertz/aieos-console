# Tests — WDD-CONSOLE-019 (Docker Deployment)

## Test Strategy

Docker deployment verification is manual/scripted rather than automated, since it requires a running Docker daemon. A verification script (`scripts/verify-docker.sh`) exercises all acceptance criteria.

## Acceptance Tests

- AT-1: `docker build -t aieos-console .` completes successfully
- AT-2: Container starts with kit mounted read-only and project read-write, health check returns 200
- AT-3: Environment variables (LLM_API_KEY, LLM_PROVIDER, LLM_MODEL) are read correctly — verified by successful project initialization with mock provider
- AT-4: Container restart preserves state from persisted state.json

## Verification Script

`scripts/verify-docker.sh` automates all four acceptance tests:
1. Builds Docker image
2. Runs container with test fixtures (e2e/fixtures/test-kit) and temp project dir
3. Verifies health check, project initialization
4. Restarts container and verifies state persistence
5. Cleans up container and temp directory

## Blocker

Docker daemon permissions not available in current environment. Verification script ready to run once permissions are fixed (`sudo usermod -aG docker $USER`).
