import { test, expect } from '@playwright/test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

const testProjectDir = path.join(os.tmpdir(), 'aieos-e2e-project');
const testKitDir = path.resolve('./e2e/fixtures/test-kit');

test.describe.serial('Project initialization', () => {
  test.beforeAll(async () => {
    // Clean up any existing state
    await fs.rm(path.join(testProjectDir, '.aieos'), { recursive: true, force: true });
    // Ensure project dir exists
    await fs.mkdir(testProjectDir, { recursive: true });
  });

  test('POST /api/project/initialize creates project state', async ({ request }) => {
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
    const body = await response.json();
    expect(body.success).toBe(true);
  });

  test('GET /api/project returns initialized state', async ({ request }) => {
    const response = await request.get('/api/project');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.projectId).toBeDefined();
    expect(body.kitConfigs).toHaveLength(1);
    expect(body.kitConfigs[0].kitId).toBe('e2e-test-kit');
    expect(body.llmConfigs).toHaveLength(1);
    expect(body.artifacts).toEqual([]);
  });

  test('POST /api/project/initialize again returns 409', async ({ request }) => {
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
    expect(response.status()).toBe(409);
  });
});
