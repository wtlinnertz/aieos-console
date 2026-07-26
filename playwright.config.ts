import { defineConfig } from '@playwright/test';
import * as path from 'node:path';
import * as os from 'node:os';

const testProjectDir = path.join(os.tmpdir(), 'aieos-e2e-project');
const testKitDir = path.resolve('./e2e/fixtures/test-kit');
const fakeHarness = path.resolve('./e2e/fixtures/fake-harness.mjs');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    env: {
      PROJECT_DIR: testProjectDir,
      KIT_DIRS: testKitDir,
      LLM_PROVIDER: 'mock',
      LLM_API_KEY: 'test-key',
      LLM_MODEL: 'mock-model',
      HARNESS_CMD: `node ${fakeHarness}`,
      // TEMPORARY (FR-023 O1): the e2e fixture still ships a flow.yaml;
      // removed when the fixture migrates to a kit-manifest.yml (step 5).
      FLOW_SOURCE: 'flow-yaml',
    },
  },
});
