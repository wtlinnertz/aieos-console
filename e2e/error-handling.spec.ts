import { test, expect } from '@playwright/test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

const testProjectDir = path.join(os.tmpdir(), 'aieos-e2e-project');
const testKitDir = path.resolve('./e2e/fixtures/test-kit');

test.describe.serial('Error handling', () => {
  test.beforeAll(async () => {
    // Clean up any existing state
    await fs.rm(path.join(testProjectDir, '.aieos'), { recursive: true, force: true });

    // Create required directories
    await fs.mkdir(path.join(testProjectDir, '.aieos'), { recursive: true });
    await fs.mkdir(path.join(testProjectDir, 'docs', 'sdlc'), { recursive: true });
    await fs.mkdir(path.join(testProjectDir, 'docs', 'engagement'), { recursive: true });

    // Create engagement record file
    await fs.writeFile(
      path.join(testProjectDir, 'docs', 'engagement', 'er.md'),
      '# Engagement Record\n\n| Artifact ID | Type | Status | Notes |\n|---|---|---|---|\n',
    );
  });

  test('initialize project for error tests', async ({ request }) => {
    const response = await request.post('/api/project/initialize', {
      data: {
        projectDir: testProjectDir,
        kitConfigs: [
          { kitId: 'e2e-test-kit', kitPath: testKitDir },
        ],
        llmConfigs: [
          { providerId: 'mock', model: 'mock-model', apiKeyEnvVar: 'LLM_API_KEY' },
        ],
      },
    });
    expect(response.status()).toBe(200);
  });

  test('GET /api/flow/nonexistent-kit returns 404', async ({ request }) => {
    const response = await request.get('/api/flow/nonexistent-kit');
    expect(response.status()).toBe(404);
  });

  test('POST initiate on step with unmet dependencies returns 409', async ({ request }) => {
    const response = await request.post('/api/flow/e2e-test-kit/step/step-acf/initiate');
    expect(response.status()).toBe(409);
  });

  test('POST freeze on non-validated step returns 409', async ({ request }) => {
    // Initiate step-prd first so it exists in state
    const initiateResponse = await request.post('/api/flow/e2e-test-kit/step/step-prd/initiate');
    expect(initiateResponse.ok()).toBeTruthy();

    // Try to freeze without validating
    const response = await request.post('/api/flow/e2e-test-kit/step/step-prd/freeze', {
      data: { artifactId: 'PRD-E2E-001' },
    });
    expect(response.status()).toBe(409);
  });
});
