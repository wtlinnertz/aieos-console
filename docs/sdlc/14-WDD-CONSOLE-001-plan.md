# Implementation Plan — WDD-CONSOLE-001 (Project Scaffolding)

## Plan Summary

Initialize a Next.js App Router project with TypeScript strict mode, ESLint, Vitest, Playwright, Docker, and environment variable configuration — all dependencies pinned to exact versions.

## Files to Create

### 1. `package.json`
- Initialize with `name: "aieos-console"`, `private: true`, `type: "module"`
- All dependencies pinned to exact versions (no `^`, `~`, `*`):
  - **Production:** `next`, `react`, `react-dom`, `@anthropic-ai/sdk`, `yaml`, `sanitize-html`, `remark`, `remark-html`, `rehype-sanitize`
  - **Dev:** `typescript`, `@types/react`, `@types/node`, `@types/sanitize-html`, `vitest`, `@vitejs/plugin-react`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `@playwright/test`, `eslint`, `eslint-config-next`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`
- Scripts: `dev`, `build`, `start`, `lint`, `type-check`, `test`, `test:e2e`

### 2. `tsconfig.json`
- `strict: true`, `target: "ES2022"`, `module: "ESNext"`, `moduleResolution: "bundler"`
- Next.js App Router paths and includes
- `noEmit: true` for type-checking (Next.js handles compilation)

### 3. `next.config.ts`
- Minimal Next.js configuration
- ESM module format

### 4. `.eslintrc.json`
- Extends `next/core-web-vitals` and `next/typescript`
- TypeScript-aware parsing

### 5. `vitest.config.ts`
- Environment: `jsdom` for component testing
- React plugin via `@vitejs/plugin-react`
- Setup file for `@testing-library/jest-dom` matchers
- Include pattern: `src/**/*.test.ts`, `src/**/*.test.tsx`

### 6. `playwright.config.ts`
- Base URL: `http://localhost:3000`
- Web server command: `npm run dev`
- Single Chromium project for initial setup

### 7. `src/app/layout.tsx`
- Root layout with minimal HTML structure
- Required by Next.js App Router

### 8. `src/app/page.tsx`
- Minimal root page (placeholder)

### 9. `src/app/api/health/route.ts`
- `GET` handler returning `{ status: 'ok' }` with 200
- Required for Docker health check and AT-4

### 10. `src/lib/config.ts`
- Environment variable loading for PROJECT_DIR, KIT_DIRS, LLM_API_KEY, LLM_PROVIDER, LLM_MODEL, PORT
- Defaults: `LLM_PROVIDER` → `'anthropic'`, `PORT` → `'3000'`
- Validates required variables are present at startup (LLM_API_KEY can be deferred until LLM use)

### 11. `src/__tests__/placeholder.test.ts`
- Single test: `it('placeholder test passes', () => expect(true).toBe(true))`
- Verifies Vitest configuration works (EC-1)

### 12. `e2e/placeholder.spec.ts`
- Single test: navigate to `/api/health`, expect 200
- Verifies Playwright configuration works (EC-2)

### 13. `Dockerfile`
- **Stage 1 (build):** `FROM node:{LTS}-alpine`, `WORKDIR /app`, copy `package*.json`, `npm ci`, copy source, `npm run build`
- **Stage 2 (production):** `FROM node:{LTS}-alpine`, create non-root user (`nextjs`), copy build output from stage 1, `USER nextjs`, `EXPOSE 3000`, `HEALTHCHECK CMD curl -f http://localhost:3000/api/health || exit 1`, `CMD ["node", "server.js"]` (or `npm start`)
- Install `curl` in production stage for health check

### 14. `.dockerignore`
- `node_modules`, `.next`, `.git`, `*.md`, `e2e`, `coverage`, `.env*`

### 15. `.gitignore`
- `node_modules/`, `.next/`, `coverage/`, `playwright-report/`, `.env.local`

### 16. `src/vitest.setup.ts`
- Import `@testing-library/jest-dom/vitest`

## Interfaces Locked

### Health Check Endpoint
- `GET /api/health` → `200 { status: 'ok' }`
- This is the only interface in WDD-CONSOLE-001

### Configuration Shape (internal, may evolve)
```
AppConfig {
  projectDir: string
  kitDirs: string[]
  llmApiKey: string
  llmProvider: string  // default: 'anthropic'
  llmModel: string     // default: provider-specific
  port: string         // default: '3000'
}
```

## Dependencies

All pinned to exact versions. Versions to be resolved at implementation time using latest stable releases:

**Production:**
- `next` (latest stable 14.x or 15.x)
- `react`, `react-dom` (paired with Next.js)
- `@anthropic-ai/sdk`
- `yaml`
- `sanitize-html`
- `remark`, `remark-html`, `rehype-sanitize` (or equivalent Markdown pipeline)

**Dev:**
- `typescript`
- `@types/react`, `@types/node`, `@types/sanitize-html`
- `vitest`, `@vitejs/plugin-react`, `jsdom`
- `@testing-library/react`, `@testing-library/jest-dom`
- `@playwright/test`
- `eslint`, `eslint-config-next`

## Risks and Assumptions

- **Next.js version:** Using the latest stable release. App Router API is stable as of Next.js 14+.
- **Markdown pipeline:** `remark` + `rehype-sanitize` is one option; `sanitize-html` with a separate Markdown renderer is another. The specific library choice will be made at implementation time per TDD §4.8 guidance. Both are installed now so they're available for WDD-CONSOLE-011.
- **Docker health check with curl:** Alpine images don't include `curl` by default. Must install it in the production stage or use `wget` instead.
- **Playwright browsers:** `npx playwright install` needed before Playwright tests can run. This is a developer setup step, not a CI concern yet.

## Sequencing

1. Create `package.json` with all dependencies
2. Run `npm install` to generate `package-lock.json`
3. Create TypeScript, ESLint, Vitest, Playwright configs
4. Create Next.js config and App Router files (layout, page, health route)
5. Create `src/lib/config.ts` for environment variable loading
6. Create placeholder tests
7. Create Dockerfile and `.dockerignore`
8. Verify: `npm ci && npx tsc --noEmit && npx eslint . --max-warnings 0 && npx vitest run && npx next build && docker build -t aieos-console .`
