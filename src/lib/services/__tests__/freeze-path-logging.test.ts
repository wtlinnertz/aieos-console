/**
 * G-22 fix (3) — the freeze path must say what it did.
 *
 * WHY. Diagnosing G-22 required reading four source files, because nothing in
 * the freeze path logged anything: the console terminal was completely silent
 * while a freeze succeeded on disk and returned "Internal server error" to the
 * browser. The operator saw a generic 500, the terminal showed nothing, and the
 * only usable evidence was `.aieos/state.json` read by hand after the fact.
 * G-20 and G-21 cost the same tax for the same reason.
 *
 * WHAT IS ASSERTED. Not log prose — the FACTS a future diagnosis needs:
 *   - which recording path a freeze took (canonical adoption vs transition),
 *     since that distinction IS G-22 and is invisible from the outside
 *   - the harness's structured code when the seam fails (hash_mismatch,
 *     bad_status, harness_failed), because that is what api-utils used to throw
 *     away before returning 500
 *   - that every mapped error is logged before its response is built
 *
 * Secrets: logger.ts redacts on field name. Nothing here logs artifact CONTENT
 * — only ids, paths and status — so there is no redaction burden to test.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock factories are hoisted above module scope, so the spies must be
// created inside vi.hoisted or the factory closes over a temporal-dead-zone
// binding ("Cannot access 'logInfo' before initialization").
const { logInfo, logError } = vi.hoisted(() => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

// Sources reach the logger by two specifiers — orchestration-service uses
// '../logger.js', api-utils and harness-freeze-service use '@/lib/logger'.
// Both resolve to src/lib/logger.ts; mocking both keeps this robust if either
// import style changes.
vi.mock('@/lib/logger', () => ({ logInfo, logError, log: vi.fn() }));
vi.mock('../../logger.js', () => ({ logInfo, logError, log: vi.fn() }));

import { OrchestrationService } from '../orchestration-service.js';
import { HarnessFreezeService } from '../harness-freeze-service.js';
import { errorResponse } from '@/lib/api-utils';
import { InvalidTransitionError, StateNotFoundError } from '../errors.js';
import type { IKitService, KitResult } from '../kit-service.js';
import type { IStateService } from '../state-service.js';
import type { ILlmService } from '../llm-types.js';
import type { FlowStep } from '../flow-types.js';
import type { ArtifactState } from '../state-types.js';
import type { HarnessFreezeService as HFS } from '../harness-freeze-service.js';

const sadStep = {
  id: 'sad',
  name: 'Solution Architecture Document',
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
} as unknown as FlowStep;

const FREEZE_PENDING_DOC = [
  '# SAD',
  '',
  '## Document Control',
  '',
  '| Field | Value |',
  '|-------|-------|',
  '| Artifact ID | SAD-PROOF-001 |',
  '| Status | FREEZE_PENDING |',
  '| Last Validation | PASS |',
  '',
].join('\n');

function makeSvc(cached: ArtifactState | null) {
  const kit = {
    loadKit: vi.fn(async (): Promise<KitResult> => ({
      flow: { kit: { name: 'EEK', id: 'EEK', version: '1.1' }, steps: [sadStep] },
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
      artifacts: cached ? [cached] : [],
    })),
    getArtifactState: vi.fn(async () => {
      if (!cached) throw new StateNotFoundError('no state');
      return cached;
    }),
    updateArtifactState: vi.fn(async () => {}),
    adoptCanonicalState: vi.fn(async () => {}),
    readArtifact: vi.fn(async () => FREEZE_PENDING_DOC),
    saveArtifact: vi.fn(),
  } as unknown as IStateService;

  const freezeService = {
    freeze: vi.fn(async () => ({
      status: 'FROZEN',
      artifactId: 'SAD-PROOF-001',
      path: 'docs/sdlc/sad.md',
      frozenCount: 3,
      decidedBy: 'console-user',
    })),
  } as unknown as HFS;

  return new OrchestrationService(
    kit,
    stateService,
    {} as ILlmService,
    freezeService,
    {},
  );
}

beforeEach(() => {
  logInfo.mockClear();
  logError.mockClear();
});

function events(mock: typeof logInfo): string[] {
  return mock.mock.calls.map((c) => c[0] as string);
}

describe('freeze path logging — which route did the freeze take?', () => {
  it('records that an N1 freeze was adopted, not transitioned', async () => {
    const svc = makeSvc(null);
    await svc.freezeArtifact('/project', 'EEK', 'sad', 'SAD-PROOF-001');

    const call = logInfo.mock.calls.find((c) => c[0] === 'freeze_recorded');
    expect(call, `expected freeze_recorded; got ${events(logInfo).join(', ')}`)
      .toBeDefined();
    expect(call?.[1]).toMatchObject({
      stepId: 'sad',
      artifactId: 'SAD-PROOF-001',
      recordedVia: 'adoption',
    });
  });

  it('records that a console-driven freeze was transitioned', async () => {
    const svc = makeSvc({
      stepId: 'sad',
      kitId: 'EEK',
      artifactId: 'SAD-PROOF-001',
      status: 'validated-pass',
      artifactPath: 'docs/sdlc/sad.md',
      validationResult: null,
      frozenAt: null,
      lastModified: new Date().toISOString(),
    } as ArtifactState);
    await svc.freezeArtifact('/project', 'EEK', 'sad', 'SAD-PROOF-001');

    const call = logInfo.mock.calls.find((c) => c[0] === 'freeze_recorded');
    expect(call?.[1]).toMatchObject({ recordedVia: 'transition' });
  });

  it('logs the harness outcome before recording, so a failure to record is attributable', async () => {
    const svc = makeSvc(null);
    await svc.freezeArtifact('/project', 'EEK', 'sad', 'SAD-PROOF-001');

    const all = events(logInfo);
    expect(all).toContain('harness_freeze_returned');
    // Ordering is the whole point: G-22 sat between these two events. Without
    // both, "the harness froze it but the console did not record it" is
    // indistinguishable from "the freeze never happened".
    expect(all.indexOf('harness_freeze_returned'))
      .toBeLessThan(all.indexOf('freeze_recorded'));
  });
});

describe('freeze path logging — the harness seam must not fail silently', () => {
  it('logs the structured harness code when the seam fails', async () => {
    const runner = vi.fn(async () => ({
      stdout: '',
      stderr: JSON.stringify({ error: 'hash_mismatch', message: 'digest differs from disk' }),
      code: 1,
    }));
    const svc = new HarnessFreezeService(['python', '-m', 'src.cli'], { runner });

    await expect(
      svc.freeze('/project', {
        artifactId: 'SAD-PROOF-001',
        outcome: 'APPROVE',
        shownContent: '# SAD\n',
        decidedBy: 'console-user',
      }),
    ).rejects.toThrow();

    const call = logError.mock.calls.find((c) => c[0] === 'harness_freeze_failed');
    expect(call, `expected harness_freeze_failed; got ${events(logError).join(', ')}`)
      .toBeDefined();
    expect(call?.[1]).toMatchObject({ code: 'hash_mismatch', exitCode: 1 });
  });

  it('logs unparseable harness stdout rather than throwing a bare SyntaxError', async () => {
    const runner = vi.fn(async () => ({
      stdout: 'WARNING: something\n{not json',
      stderr: '',
      code: 0,
    }));
    const svc = new HarnessFreezeService(['python', '-m', 'src.cli'], { runner });

    await expect(
      svc.freeze('/project', {
        artifactId: 'SAD-PROOF-001',
        outcome: 'APPROVE',
        shownContent: '# SAD\n',
        decidedBy: 'console-user',
      }),
    ).rejects.toThrow();

    expect(events(logError)).toContain('harness_freeze_unparseable');
  });
});

describe('api error logging — nothing is mapped without being recorded', () => {
  it('logs the error identity before returning a mapped response', () => {
    errorResponse(new InvalidTransitionError('not-started → frozen'));

    const call = logError.mock.calls.find((c) => c[0] === 'api_error');
    expect(call?.[1]).toMatchObject({
      name: 'InvalidTransitionError',
      code: 'INVALID_TRANSITION',
      status: 409,
    });
  });

  it('logs the generic 500 case, which is the one with no other trace', () => {
    // The G-22 symptom exactly: an unmapped error whose message the response
    // discards. If it is not logged here it is not recorded anywhere.
    errorResponse(Object.assign(new Error('something unmapped'), { name: 'WeirdError' }));

    const call = logError.mock.calls.find((c) => c[0] === 'api_error');
    expect(call?.[1]).toMatchObject({ name: 'WeirdError', status: 500 });
    expect(call?.[1]).toHaveProperty('message', 'something unmapped');
  });
});
