import { test, expect } from '@playwright/test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

const testProjectDir = path.join(os.tmpdir(), 'aieos-e2e-project');
const testKitDir = path.resolve('./e2e/fixtures/test-kit');

test.describe.serial('Content editing', () => {
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

  test('initialize and generate artifact for editing', async ({ request }) => {
    // Initialize project
    const initResponse = await request.post('/api/project/initialize', {
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
    expect(initResponse.status()).toBe(200);

    // Initiate step
    const initiateResponse = await request.post('/api/flow/e2e-test-kit/step/step-prd/initiate');
    expect(initiateResponse.ok()).toBeTruthy();

    // Generate artifact
    const generateResponse = await request.get('/api/flow/e2e-test-kit/step/step-prd/generate');
    expect(generateResponse.ok()).toBeTruthy();
  });

  test('PUT content updates artifact and state remains draft', async ({ request }) => {
    const response = await request.put('/api/flow/e2e-test-kit/step/step-prd/content', {
      data: { content: '# Edited PRD\n\nThis content was manually edited.' },
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.success).toBe(true);

    // Verify state is still draft
    const flowResponse = await request.get('/api/flow/e2e-test-kit');
    const flowBody = await flowResponse.json();
    const prdStep = flowBody.steps.find((s: { step: { id: string } }) => s.step.id === 'step-prd');
    expect(prdStep.state.status).toBe('draft');
  });

  test('edit after validation resets state to draft', async ({ request }) => {
    // Validate first
    const validateResponse = await request.post('/api/flow/e2e-test-kit/step/step-prd/validate');
    expect(validateResponse.ok()).toBeTruthy();
    const valBody = await validateResponse.json();
    expect(valBody.status).toBe('PASS');

    // Verify state is validated-pass
    let flowResponse = await request.get('/api/flow/e2e-test-kit');
    let flowBody = await flowResponse.json();
    let prdStep = flowBody.steps.find((s: { step: { id: string } }) => s.step.id === 'step-prd');
    expect(prdStep.state.status).toBe('validated-pass');

    // Edit content
    const editResponse = await request.put('/api/flow/e2e-test-kit/step/step-prd/content', {
      data: { content: '# Re-edited PRD\n\nEdited after validation.' },
    });
    expect(editResponse.ok()).toBeTruthy();

    // Verify state reset to draft
    flowResponse = await request.get('/api/flow/e2e-test-kit');
    flowBody = await flowResponse.json();
    prdStep = flowBody.steps.find((s: { step: { id: string } }) => s.step.id === 'step-prd');
    expect(prdStep.state.status).toBe('draft');
  });
});
