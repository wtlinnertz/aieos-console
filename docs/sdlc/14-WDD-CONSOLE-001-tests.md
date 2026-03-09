# Test Specifications — WDD-CONSOLE-001 (Project Scaffolding)

## 1. Acceptance Tests

### AT-1: TypeScript strict mode compiles without errors
- **Preconditions:** Clean checkout of the project; `npm ci` completed successfully
- **Input:** Run `npx tsc --noEmit`
- **Expected outcome:** Command exits with code 0; zero type errors reported
- **Failure condition:** `tsc` reports any type errors — TypeScript configuration is incorrect

### AT-2: ESLint passes with zero warnings
- **Preconditions:** Clean checkout of the project; `npm ci` completed successfully
- **Input:** Run `npx eslint . --max-warnings 0`
- **Expected outcome:** Command exits with code 0; zero errors and zero warnings
- **Failure condition:** ESLint reports any errors or warnings — ESLint configuration is incorrect

### AT-3: Docker image builds with non-root user and health check
- **Preconditions:** Clean checkout of the project; Docker daemon running
- **Input:** Run `docker build -t aieos-console .`
- **Expected outcome:** Build completes successfully; image is tagged `aieos-console`; inspecting the image shows a non-root USER directive; inspecting the image shows a HEALTHCHECK instruction
- **Failure condition:** Build fails, or the image runs as root (no USER directive), or no HEALTHCHECK is configured — Dockerfile is incorrect

### AT-4: Docker container starts and health check passes
- **Preconditions:** Docker image `aieos-console` built successfully; required environment variables available (PROJECT_DIR, KIT_DIRS, LLM_API_KEY)
- **Input:** Run `docker run` with required environment variables and port mapping; wait for startup; query health check endpoint
- **Expected outcome:** Container starts without error; `GET /api/health` returns HTTP 200
- **Failure condition:** Container fails to start, or health check endpoint does not return 200 — startup configuration is incorrect

## 2. Failure Tests

### FT-1: TypeScript compilation fails on type error
- **Preconditions:** Project with an intentionally introduced type error (e.g., assigning `string` to `number` variable)
- **Input:** Run `npx tsc --noEmit`
- **Expected outcome:** Command exits with non-zero code; error output identifies the type violation
- **Failure condition:** `tsc` exits 0 despite a type error — strict mode is not properly configured

### FT-2: ESLint fails on lint violation
- **Preconditions:** Project with an intentionally introduced lint violation (e.g., unused variable)
- **Input:** Run `npx eslint . --max-warnings 0`
- **Expected outcome:** Command exits with non-zero code; error output identifies the violation
- **Failure condition:** ESLint exits 0 despite a violation — ESLint rules are not properly configured

### FT-3: Docker build fails on invalid Dockerfile
- **Preconditions:** Dockerfile with a syntax error or missing base image
- **Input:** Run `docker build -t aieos-console .`
- **Expected outcome:** Build fails with a clear error message
- **Failure condition:** Build succeeds despite errors — Dockerfile validation is not working

### FT-4: Docker container fails to start without required environment variables
- **Preconditions:** Docker image `aieos-console` built; no environment variables set
- **Input:** Run `docker run` without required environment variables
- **Expected outcome:** Container exits with error or health check fails; application does not serve requests
- **Failure condition:** Application starts and serves requests without configuration — environment variable validation is missing

## 3. Edge Case Tests

### EC-1: Vitest placeholder test passes
- **Preconditions:** Clean checkout; `npm ci` completed
- **Input:** Run `npx vitest run`
- **Expected outcome:** At least one placeholder test executes and passes; exit code 0
- **Failure condition:** No tests found or test fails — Vitest configuration is incorrect

### EC-2: Playwright placeholder test passes
- **Preconditions:** Clean checkout; `npm ci` completed; Playwright browsers installed
- **Input:** Run `npx playwright test`
- **Expected outcome:** At least one placeholder test executes and passes; exit code 0
- **Failure condition:** No tests found or test fails — Playwright configuration is incorrect

### EC-3: All dependencies pinned to exact versions
- **Preconditions:** `package.json` exists
- **Input:** Inspect all dependency versions in `package.json` (dependencies and devDependencies)
- **Expected outcome:** Every version string is an exact version (no `^`, `~`, `*`, or `latest` prefixes)
- **Failure condition:** Any dependency uses a floating version range — violates ACF §8 Forbidden Patterns

### EC-4: Environment variables have sensible defaults
- **Preconditions:** Docker image built; minimal environment variables set (only required ones without defaults)
- **Input:** Run container with only `LLM_API_KEY` set; inspect application configuration
- **Expected outcome:** `LLM_PROVIDER` defaults to `anthropic`; `PORT` defaults to `3000`; application starts
- **Failure condition:** Application crashes due to missing optional environment variables — default handling is missing

### EC-5: Next.js build produces output
- **Preconditions:** Clean checkout; `npm ci` completed
- **Input:** Run `npx next build`
- **Expected outcome:** Build completes; `.next/` directory is produced with build output
- **Failure condition:** Build fails or `.next/` directory is empty — Next.js configuration is incorrect

## 4. Regression Tests

None — this is the first work item; no prior implementation exists.
