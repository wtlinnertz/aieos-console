import { test, expect } from '@playwright/test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

const testProjectDir = path.join(os.tmpdir(), 'aieos-e2e-project');
const testKitDir = path.resolve('./e2e/fixtures/test-kit');

test.describe.serial('Flow lifecycle', () => {
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

  test('initialize project for flow tests', async ({ request }) => {
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

  test('GET /api/flow/e2e-test-kit returns flow status with 2 steps', async ({ request }) => {
    const response = await request.get('/api/flow/e2e-test-kit');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.totalSteps).toBe(2);
    expect(body.steps).toHaveLength(2);
    expect(body.steps[0].step.id).toBe('step-prd');
    expect(body.steps[1].step.id).toBe('step-acf');
    expect(body.completedSteps).toBe(0);
  });

  test('POST initiate step-prd transitions to in-progress', async ({ request }) => {
    const response = await request.post('/api/flow/e2e-test-kit/step/step-prd/initiate');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.step.id).toBe('step-prd');
    expect(body.state.status).toBe('in-progress');
  });

  test('GET generate step-prd returns SSE stream with chunks', async ({ request }) => {
    const response = await request.get('/api/flow/e2e-test-kit/step/step-prd/generate');
    expect(response.ok()).toBeTruthy();

    const text = await response.text();
    const events = text
      .split('\n\n')
      .filter((e) => e.startsWith('data: '))
      .map((e) => JSON.parse(e.replace('data: ', '')));

    // Should have chunk events and a done event
    const chunkEvents = events.filter((e: { type: string }) => e.type === 'chunk');
    const doneEvents = events.filter((e: { type: string }) => e.type === 'done');

    expect(chunkEvents.length).toBeGreaterThan(0);
    expect(doneEvents).toHaveLength(1);
    expect(doneEvents[0].artifact).toContain('Generated Artifact');
  });

  test('POST validate step-prd returns PASS', async ({ request }) => {
    const response = await request.post('/api/flow/e2e-test-kit/step/step-prd/validate');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.status).toBe('PASS');
    expect(body.summary).toBe('All checks passed');
  });

  test('POST freeze step-prd with artifactId succeeds', async ({ request }) => {
    const response = await request.post('/api/flow/e2e-test-kit/step/step-prd/freeze', {
      data: { artifactId: 'PRD-E2E-001' },
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.success).toBe(true);
  });

  test('GET flow status shows step-prd frozen and step-acf available', async ({ request }) => {
    const response = await request.get('/api/flow/e2e-test-kit');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();

    const prdStep = body.steps.find((s: { step: { id: string } }) => s.step.id === 'step-prd');
    const acfStep = body.steps.find((s: { step: { id: string } }) => s.step.id === 'step-acf');

    expect(prdStep.state.status).toBe('frozen');
    expect(acfStep.dependenciesMet).toBe(true);
    expect(body.completedSteps).toBe(1);
  });
});
