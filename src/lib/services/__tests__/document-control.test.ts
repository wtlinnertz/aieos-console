/**
 * N1 (FR-023): canonical Document Control reader + orchestration
 * reconciliation — the console must see freeze state any driver wrote.
 */
import { describe, it, expect, vi } from 'vitest';
import { parseDocumentControl } from '../document-control.js';
import { OrchestrationService } from '../orchestration-service.js';
import { StepNotValidatedPassError, InvalidTransitionError } from '../errors.js';
import type { IKitService, KitResult } from '../kit-service.js';
import type { IStateService } from '../state-service.js';
import type { ILlmService } from '../llm-types.js';
import type { FlowStep } from '../flow-types.js';
import type { ArtifactState } from '../state-types.js';
import type { HarnessFreezeService } from '../harness-freeze-service.js';

const CANONICAL_BLOCK = `# SAD

## Document Control

| Field | Value |
|-------|-------|
| Artifact ID | SAD-INIT-001 |
| Owner | {owner} |
| Status | FREEZE_PENDING |
| Last Validation | PASS |

## Body
Architecture.
`;

describe('parseDocumentControl', () => {
  it('parses a canonical block', () => {
    const block = parseDocumentControl(CANONICAL_BLOCK);
    expect(block).toEqual({
      artifactId: 'SAD-INIT-001',
      status: 'FREEZE_PENDING',
      rawStatus: 'FREEZE_PENDING',
      lastValidation: 'PASS',
    });
  });

  it('normalizes human-cased and spaced statuses', () => {
    const block = parseDocumentControl(
      CANONICAL_BLOCK.replace('FREEZE_PENDING', 'Freeze Pending'),
    );
    expect(block?.status).toBe('FREEZE_PENDING');
  });

  it('reports non-canonical statuses as null with the raw value preserved', () => {
    const block = parseDocumentControl(
      CANONICAL_BLOCK.replace('FREEZE_PENDING', 'Approved'),
    );
    expect(block?.status).toBeNull();
    expect(block?.rawStatus).toBe('Approved');
  });

  it('returns null for text without an Artifact ID row', () => {
    expect(parseDocumentControl('# Just prose\n')).toBeNull();
  });
});

function makeStep(partial: Partial<FlowStep> = {}): FlowStep {
  return {
    id: 'sad',
    name: 'SAD',
    artifactType: 'sad',
    stepType: 'llm-generated',
    dependencies: [],
    fourFiles: {
      spec: 'docs/specs/sad-spec.md',
      template: 'docs/artifacts/sad-template.md',
      prompt: 'docs/prompts/sad-prompt.md',
      validator: 'docs/validators/sad-validator.md',
    },
    requiredInputs: [],
    produces: { artifactIdPrefix: 'SAD', outputFilename: 'sad.md' },
    freezeGate: true,
    ...partial,
  };
}

function makeServices(opts: {
  artifactText?: string;
  artifacts?: unknown[];
}) {
  const kit = {
    loadKit: vi.fn(async (): Promise<KitResult> => ({
      flow: {
        kit: { name: 'EEK', id: 'EEK', version: '1.0' },
        steps: [makeStep()],
      },
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
      artifacts: opts.artifacts ?? [],
    })),
    getArtifactState: vi.fn(async () => {
      throw new Error('no cache entry');
    }),
    // G-22 postmortem: this mock was `vi.fn(async () => ({}))` — a no-op that
    // silently accepted `not-started -> frozen`. The N1 freeze test below
    // therefore passed for months while the real StateService threw
    // InvalidTransitionError on that exact call, AFTER the harness had already
    // committed FROZEN to disk. A green test named for the broken case is why
    // G-22 reached a human. Kept faithful to state-service.ts on purpose.
    updateArtifactState: vi.fn(
      async (_dir: string, stepId: string, update: Partial<ArtifactState>) => {
        const seeded = (opts.artifacts ?? []) as ArtifactState[];
        const from = seeded.find((a) => a.stepId === stepId)?.status
          ?? 'not-started';
        const allowed: Record<string, string[]> = {
          'not-started': ['in-progress'],
          'in-progress': ['draft'],
          draft: ['validated-pass', 'validated-fail'],
          'validated-fail': ['draft'],
          'validated-pass': ['frozen', 'draft'],
          frozen: [],
        };
        if (update.status && update.status !== from
            && !allowed[from]?.includes(update.status)) {
          throw new InvalidTransitionError(
            `Invalid transition for step "${stepId}": ${from} → ${update.status}`,
          );
        }
      },
    ),
    // G-22: the N1 path records by adoption, not transition.
    adoptCanonicalState: vi.fn(async () => {}),
    readArtifact: vi.fn(async () => {
      if (opts.artifactText === undefined) {
        throw new Error('not found');
      }
      return opts.artifactText;
    }),
  } as unknown as IStateService;

  return { kit, stateService };
}

describe('N1: canonical state in getFlowStatus', () => {
  it('surfaces a dark-factory FREEZE_PENDING artifact as freezable', async () => {
    const { kit, stateService } = makeServices({ artifactText: CANONICAL_BLOCK });
    const svc = new OrchestrationService(kit, stateService, {} as ILlmService);
    const status = await svc.getFlowStatus('/project', 'EEK');
    const step = status.steps[0];
    expect(step.canonicalStatus).toBe('FREEZE_PENDING');
    expect(step.state.status).toBe('validated-pass');
    expect(step.state.artifactPath).toBe('docs/sdlc/sad.md');
    expect(step.state.artifactId).toBe('SAD-INIT-001');
  });

  it('surfaces FROZEN from disk even with an empty cache', async () => {
    const { kit, stateService } = makeServices({
      artifactText: CANONICAL_BLOCK.replace(
        '| Status | FREEZE_PENDING |',
        '| Status | FROZEN |\n| Frozen By | Todd |\n| Frozen Date | 2026-07-25 |',
      ),
    });
    const svc = new OrchestrationService(kit, stateService, {} as ILlmService);
    const status = await svc.getFlowStatus('/project', 'EEK');
    expect(status.steps[0].state.status).toBe('frozen');
    expect(status.steps[0].canonicalStatus).toBe('FROZEN');
  });

  it('leaves state untouched when no artifact file exists', async () => {
    const { kit, stateService } = makeServices({});
    const svc = new OrchestrationService(kit, stateService, {} as ILlmService);
    const status = await svc.getFlowStatus('/project', 'EEK');
    expect(status.steps[0].state.status).toBe('not-started');
    expect(status.steps[0].canonicalStatus).toBeNull();
  });
});

describe('N1: freeze from canonical FREEZE_PENDING', () => {
  function freezeService() {
    return {
      freeze: vi.fn(async () => ({
        status: 'FROZEN',
        artifactId: 'SAD-INIT-001',
        path: 'docs/sdlc/sad.md',
        frozenCount: 1,
        decidedBy: 'console-user',
      })),
    } as unknown as HarnessFreezeService;
  }

  it('freezes an artifact with no cache entry when the block says FREEZE_PENDING', async () => {
    const { kit, stateService } = makeServices({ artifactText: CANONICAL_BLOCK });
    const freeze = freezeService();
    const svc = new OrchestrationService(kit, stateService, {} as ILlmService, freeze);
    await svc.freezeArtifact('/project', 'EEK', 'sad', 'SAD-INIT-001');
    expect(freeze.freeze).toHaveBeenCalled();
    // G-22: an artifact with no cache entry has no console history to
    // transition from, so it is recorded by adoption. Asserting
    // updateArtifactState here (as this test used to) asserts the call that
    // throws in production.
    expect(stateService.adoptCanonicalState).toHaveBeenCalledWith(
      '/project',
      'sad',
      expect.objectContaining({
        status: 'frozen',
        artifactPath: 'docs/sdlc/sad.md',
      }),
    );
    expect(stateService.updateArtifactState).not.toHaveBeenCalled();
  });

  it('refuses when neither cache nor canonical block authorizes a freeze', async () => {
    const { kit, stateService } = makeServices({
      artifactText: CANONICAL_BLOCK.replace('FREEZE_PENDING', 'DRAFT'),
    });
    const svc = new OrchestrationService(
      kit,
      stateService,
      {} as ILlmService,
      freezeService(),
    );
    await expect(
      svc.freezeArtifact('/project', 'EEK', 'sad', 'SAD-INIT-001'),
    ).rejects.toThrow(StepNotValidatedPassError);
  });
});
