/**
 * FR-023 step-3 gates: A3 generation deny-list, D2 blocked reasons,
 * N2 seam-status honoring, G-18 HARNESS_CMD parsing.
 */
import { describe, it, expect, vi } from 'vitest';
import { OrchestrationService } from '../orchestration-service.js';
import { parseHarnessCmd } from '../service-factory.js';
import { PrinciplesInputsUnsupportedError } from '../errors.js';
import type { IKitService, KitResult } from '../kit-service.js';
import type { IStateService } from '../state-service.js';
import type { ILlmService } from '../llm-types.js';
import type { FlowStep } from '../flow-types.js';
import type { ArtifactState } from '../state-types.js';
import type { HarnessFreezeService } from '../harness-freeze-service.js';

function makeStep(partial: Partial<FlowStep>): FlowStep {
  return {
    id: 'prd',
    name: 'PRD',
    artifactType: 'prd',
    stepType: 'llm-generated',
    dependencies: [],
    fourFiles: {
      spec: 'docs/specs/prd-spec.md',
      template: 'docs/artifacts/prd-template.md',
      prompt: 'docs/prompts/prd-prompt.md',
      validator: 'docs/validators/prd-validator.md',
    },
    requiredInputs: [],
    produces: { artifactIdPrefix: 'PRD', outputFilename: 'prd.md' },
    freezeGate: true,
    ...partial,
  };
}

function makeArtifactState(partial: Partial<ArtifactState>): ArtifactState {
  return {
    stepId: 'prd',
    kitId: 'EEK',
    artifactId: null,
    status: 'validated-pass',
    artifactPath: 'docs/sdlc/prd.md',
    validationResult: null,
    frozenAt: null,
    lastModified: new Date().toISOString(),
    ...partial,
  };
}

function makeServices(steps: FlowStep[], state: ArtifactState) {
  const kit = {
    loadKit: vi.fn(async (): Promise<KitResult> => ({
      flow: { kit: { name: 'EEK', id: 'EEK', version: '1.0' }, steps },
      kitPath: '/kits/eek',
    })),
    getStepInputs: vi.fn(),
    invalidateCache: vi.fn(),
  } as unknown as IKitService;

  const stateService = {
    loadState: vi.fn(async () => ({
      projectId: 'p',
      kitConfigs: [{ kitId: 'EEK', kitPath: '/kits/eek' }],
      llmConfigs: [],
      artifacts: [state],
    })),
    getArtifactState: vi.fn(async () => state),
    updateArtifactState: vi.fn(async () => state),
    readArtifact: vi.fn(async () => '# PRD content'),
    saveArtifact: vi.fn(),
  } as unknown as IStateService;

  return { kit, stateService };
}

describe('A3: generation deny-list', () => {
  it('refuses to generate a denied artifact type with a machine-readable error', async () => {
    const step = makeStep({});
    const { kit, stateService } = makeServices(
      [step],
      makeArtifactState({ status: 'in-progress' }),
    );
    const svc = new OrchestrationService(
      kit,
      stateService,
      {} as ILlmService,
      null,
      { denyGenerationFor: ['prd', 'acf', 'dcf', 'dkr', 'tdd'] },
    );

    const gen = svc.generateArtifact('/project', 'EEK', 'prd');
    await expect(gen[Symbol.asyncIterator]().next()).rejects.toThrow(
      PrinciplesInputsUnsupportedError,
    );
  });

  it('does not block artifact types outside the deny-list at the gate', async () => {
    const step = makeStep({ id: 'sad', artifactType: 'sad' });
    const { kit, stateService } = makeServices(
      [step],
      makeArtifactState({ stepId: 'sad', status: 'validated-pass' }),
    );
    const svc = new OrchestrationService(
      kit,
      stateService,
      {} as ILlmService,
      null,
      { denyGenerationFor: ['prd'] },
    );
    // Fails later on state (not in-progress), proving the A3 gate let it pass.
    const gen = svc.generateArtifact('/project', 'EEK', 'sad');
    await expect(gen[Symbol.asyncIterator]().next()).rejects.toThrow(
      /in-progress/,
    );
  });
});

describe('D2: blocked reasons in flow status', () => {
  it('marks human-intake steps ENTRY_INPUTS_UNSUPPORTED when entry gates are blocked', async () => {
    const entry = makeStep({
      id: 'kit-entry',
      artifactType: 'kit-entry',
      stepType: 'human-intake',
    });
    const prd = makeStep({});
    const { kit, stateService } = makeServices(
      [entry, prd],
      makeArtifactState({ status: 'not-started' }),
    );
    const svc = new OrchestrationService(
      kit,
      stateService,
      {} as ILlmService,
      null,
      { denyGenerationFor: ['prd'], entryGatesBlocked: true },
    );

    const status = await svc.getFlowStatus('/project', 'EEK');
    expect(status.steps[0].blockedReason).toBe('ENTRY_INPUTS_UNSUPPORTED');
    expect(status.steps[1].blockedReason).toBe('PRINCIPLES_INPUTS_UNSUPPORTED');
  });

  it('reports null reasons in legacy flow-yaml mode (no options)', async () => {
    const { kit, stateService } = makeServices(
      [makeStep({ stepType: 'human-intake' })],
      makeArtifactState({ status: 'not-started' }),
    );
    const svc = new OrchestrationService(kit, stateService, {} as ILlmService);
    const status = await svc.getFlowStatus('/project', 'EEK');
    expect(status.steps[0].blockedReason).toBeNull();
  });
});

describe('N2: freeze honours the seam status', () => {
  function freezeServiceReturning(status: string) {
    return {
      freeze: vi.fn(async () => ({
        status,
        artifactId: 'PRD-X-001',
        path: 'docs/sdlc/prd.md',
        frozenCount: 1,
        decidedBy: 'console-user',
      })),
    } as unknown as HarnessFreezeService;
  }

  it('records frozen only when the harness returns FROZEN', async () => {
    const { kit, stateService } = makeServices([makeStep({})], makeArtifactState({}));
    const svc = new OrchestrationService(
      kit,
      stateService,
      {} as ILlmService,
      freezeServiceReturning('FROZEN'),
    );
    await svc.freezeArtifact('/project', 'EEK', 'prd', 'PRD-X-001');
    expect(stateService.updateArtifactState).toHaveBeenCalledWith(
      '/project',
      'prd',
      expect.objectContaining({ status: 'frozen' }),
    );
  });

  it('throws and leaves local state untouched on a non-FROZEN status', async () => {
    const { kit, stateService } = makeServices([makeStep({})], makeArtifactState({}));
    const svc = new OrchestrationService(
      kit,
      stateService,
      {} as ILlmService,
      freezeServiceReturning('FREEZE_PENDING'),
    );
    await expect(
      svc.freezeArtifact('/project', 'EEK', 'prd', 'PRD-X-001'),
    ).rejects.toThrow(/FREEZE_PENDING/);
    expect(stateService.updateArtifactState).not.toHaveBeenCalled();
  });
});

describe('G-18: HARNESS_CMD parsing', () => {
  it('parses the JSON-array form (safe for paths with spaces)', () => {
    expect(
      parseHarnessCmd('["C:\\\\Program Files\\\\Python\\\\python.exe","-m","src.cli"]'),
    ).toEqual(['C:\\Program Files\\Python\\python.exe', '-m', 'src.cli']);
  });

  it('splits the legacy space form', () => {
    expect(parseHarnessCmd('python -m src.cli')).toEqual([
      'python',
      '-m',
      'src.cli',
    ]);
  });

  it('rejects a malformed JSON array', () => {
    expect(() => parseHarnessCmd('["python",')).toThrow(/does not parse/);
    expect(() => parseHarnessCmd('[1,2]')).toThrow(/string array/);
  });
});
