/**
 * G-22 — Phase 1 (Tests). The console freezes correctly and then cannot record it.
 *
 * REPRODUCTION (live, 2026-08-07, first freeze click in the product's history):
 * a human clicked Freeze on /flow/EEK/step/sad. The harness wrote the canonical
 * block — sad.md reads `Status FROZEN`, `Owner console-user`, `Frozen By
 * console-user`, `Frozen Date 2026-08-07`, validator `OK: 1 Document Control
 * block(s) conformant`. The browser showed "Internal server error" and left the
 * step displaying `validated-pass` with a live Freeze button.
 *
 * CAUSE. `.aieos/state.json` read `"artifacts": []`. In freezeArtifact:
 *   1. getArtifactState throws  -> cachedState = null
 *   2. N1 canonical path resolves artifactPath from the FREEZE_PENDING block
 *      (FR-018 working as designed)
 *   3. harness freezes          -> DISK IS CORRECT, seam succeeded
 *   4. updateArtifactState finds idx === -1, seeds `not-started`, calls
 *      validateTransition('not-started','frozen')
 *   5. VALID_TRANSITIONS['not-started'] is Set(['in-progress'])  -> throws
 *      InvalidTransitionError (state-service.ts:253)
 *   6. InvalidTransitionError is in NONE of api-utils' error sets -> bare 500
 *
 * This is the PRIMARY N1 path, not an edge case. FR-018/N1 exists so a human can
 * freeze an artifact another driver parked at the gate; such an artifact never
 * has a console cache entry. The state machine forbids the exact transition the
 * cross-driver feature requires.
 *
 * DESIGN NOTE — and a correction. The first-draft fix ("seed the cache at
 * validated-pass before updating") does not work: `not-started -> validated-pass`
 * is not in the table either (`not-started` goes only to `in-progress`). Seeding
 * through updateArtifactState hits the same wall one step earlier.
 *
 * The fix these tests specify instead: a distinct `adoptCanonicalState` on
 * IStateService. A transition table governs transitions the CONSOLE makes.
 * An N1 freeze is not a transition — it is the console ADOPTING state that
 * another driver produced and the harness authoritatively wrote. Naming it
 * adoption keeps the lifecycle intact for console-driven artifacts rather than
 * widening VALID_TRANSITIONS with `not-started -> frozen`, which would let a
 * console-driven artifact skip generate and validate entirely — weakening the
 * invariant the table exists to protect.
 *
 * Run: npx vitest run src/lib/services/__tests__/g22-canonical-freeze.test.ts
 * Expected at Phase 1: ALL FAIL.
 */

import { describe, it, expect, vi } from 'vitest';
import { OrchestrationService } from '../orchestration-service.js';
import { HarnessFreezeError } from '../harness-freeze-service.js';
import { InvalidTransitionError, StateNotFoundError } from '../errors.js';
import { errorResponse } from '@/lib/api-utils';
import type { IKitService, KitResult } from '../kit-service.js';
import type { IStateService } from '../state-service.js';
import type { ILlmService } from '../llm-types.js';
import type { FlowStep } from '../flow-types.js';
import type { ArtifactState } from '../state-types.js';
import type { HarnessFreezeService } from '../harness-freeze-service.js';

const sadStep: FlowStep = {
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

// Byte-shape of the artifact the setup script parks at the gate.
const FREEZE_PENDING_DOC = [
  '# SAD',
  '',
  '## Document Control',
  '',
  '| Field | Value |',
  '|-------|-------|',
  '| Artifact ID | SAD-PROOF-001 |',
  '| Owner | {owner} |',
  '| Status | FREEZE_PENDING |',
  '| Last Validation | PASS |',
  '',
  '## Body',
  'Proof artifact for the console freeze leg.',
  '',
].join('\n');

function makeState(partial: Partial<ArtifactState> = {}): ArtifactState {
  return {
    stepId: 'sad',
    kitId: 'EEK',
    artifactId: 'SAD-PROOF-001',
    status: 'validated-pass',
    artifactPath: 'docs/sdlc/sad.md',
    validationResult: null,
    frozenAt: null,
    lastModified: new Date().toISOString(),
    ...partial,
  } as ArtifactState;
}

/**
 * @param cached  null reproduces the live G-22 conditions: no cache entry, so
 *                getArtifactState rejects exactly as it did on 2026-08-07.
 */
function makeServices(cached: ArtifactState | null, freezeStatus = 'FROZEN') {
  const kit = {
    loadKit: vi.fn(async (): Promise<KitResult> => ({
      flow: {
        kit: { name: 'EEK', id: 'EEK', version: '1.1' },
        steps: [sadStep],
      },
      kitPath: '/kits/eek',
    })),
    getStepInputs: vi.fn(),
    invalidateCache: vi.fn(),
  } as unknown as IKitService;

  const adoptCanonicalState = vi.fn(async () => {});

  // FAITHFUL to state-service.ts. A no-op mock here made the headline test
  // ("completes without throwing") pass against the unfixed code, because the
  // transition table that CAUSED G-22 never ran. A mock that cannot reproduce
  // the defect cannot witness the fix. Mirrors updateArtifactState: absent
  // entry -> seeded at 'not-started' -> validateTransition, where
  // VALID_TRANSITIONS['not-started'] is Set(['in-progress']).
  const updateArtifactState = vi.fn(
    async (_dir: string, stepId: string, update: Partial<ArtifactState>) => {
      const from = cached?.status ?? 'not-started';
      const allowed: Record<string, string[]> = {
        'not-started': ['in-progress'],
        'in-progress': ['draft'],
        draft: ['validated-pass', 'validated-fail'],
        'validated-fail': ['draft'],
        'validated-pass': ['frozen', 'draft'],
        frozen: [],
      };
      if (update.status && update.status !== from) {
        if (!allowed[from]?.includes(update.status)) {
          throw new InvalidTransitionError(
            `Invalid transition for step "${stepId}": ${from} → ${update.status}`,
          );
        }
      }
    },
  );

  const stateService = {
    loadState: vi.fn(async () => ({
      projectId: 'p',
      kitConfigs: [{ kitId: 'EEK', kitPath: '/kits/eek' }],
      llmConfigs: [],
      artifacts: cached ? [cached] : [],
    })),
    getArtifactState: vi.fn(async () => {
      if (!cached) throw new StateNotFoundError('no state for step "sad"');
      return cached;
    }),
    updateArtifactState,
    adoptCanonicalState,
    readArtifact: vi.fn(async () => FREEZE_PENDING_DOC),
    saveArtifact: vi.fn(),
  } as unknown as IStateService;

  const freeze = vi.fn(async () => ({
    status: freezeStatus,
    artifactId: 'SAD-PROOF-001',
    path: 'docs/sdlc/sad.md',
    frozenCount: 3,
    decidedBy: 'console-user',
  }));

  const freezeService = { freeze } as unknown as HarnessFreezeService;

  const svc = new OrchestrationService(
    kit,
    stateService,
    {} as ILlmService,
    freezeService,
    {},
  );

  return { svc, freeze, updateArtifactState, adoptCanonicalState };
}

describe('G-22 — an N1 cross-driver freeze must be recordable', () => {
  it('completes without throwing when there is no local cache entry', async () => {
    const { svc } = makeServices(null);
    // The headline reproduction. Live behaviour before the fix: rejects with
    // InvalidTransitionError AFTER the harness has already committed FROZEN to
    // disk. Requires the faithful updateArtifactState mock above — with a
    // no-op mock this passes against the broken code and proves nothing.
    await expect(
      svc.freezeArtifact('/project', 'EEK', 'sad', 'SAD-PROOF-001'),
    ).resolves.toBeUndefined();
  });

  it('reproduces G-22 exactly when the freeze is routed through the transition path', async () => {
    // Pins the defect itself, so the mock can never silently stop modelling it.
    // If this ever stops throwing, the mock has drifted from state-service.ts
    // and every other test in this file has quietly lost its teeth.
    const { updateArtifactState } = makeServices(null);
    await expect(
      updateArtifactState('/project', 'sad', { status: 'frozen' }),
    ).rejects.toThrow(InvalidTransitionError);
  });

  it('records the freeze via adoption, not via a lifecycle transition', async () => {
    const { svc, updateArtifactState, adoptCanonicalState } = makeServices(null);
    await svc.freezeArtifact('/project', 'EEK', 'sad', 'SAD-PROOF-001');

    expect(adoptCanonicalState).toHaveBeenCalledWith(
      '/project',
      'sad',
      expect.objectContaining({
        status: 'frozen',
        artifactId: 'SAD-PROOF-001',
        artifactPath: 'docs/sdlc/sad.md',
      }),
    );
    // The transition-validating path is what threw. It must not be on this route.
    expect(updateArtifactState).not.toHaveBeenCalled();
  });

  it('still records a console-driven freeze through the normal transition', async () => {
    // Regression guard: the fix must not reroute artifacts the console DID drive.
    const { svc, updateArtifactState, adoptCanonicalState } = makeServices(
      makeState({ status: 'validated-pass' }),
    );
    await svc.freezeArtifact('/project', 'EEK', 'sad', 'SAD-PROOF-001');

    expect(updateArtifactState).toHaveBeenCalledWith(
      '/project',
      'sad',
      expect.objectContaining({ status: 'frozen' }),
    );
    expect(adoptCanonicalState).not.toHaveBeenCalled();
  });

  it('records nothing when the harness reports a status other than FROZEN', async () => {
    const { svc, updateArtifactState, adoptCanonicalState } = makeServices(
      null,
      'FREEZE_PENDING',
    );
    await expect(
      svc.freezeArtifact('/project', 'EEK', 'sad', 'SAD-PROOF-001'),
    ).rejects.toThrow(/not FROZEN/);

    expect(adoptCanonicalState).not.toHaveBeenCalled();
    expect(updateArtifactState).not.toHaveBeenCalled();
  });

  it('records only after the harness has committed the write', async () => {
    // Ordering matters and must stay pinned. G-22 is survivable precisely
    // because the authoritative disk write lands FIRST and the bookkeeping
    // fails after it — the artifact is correct and only the cache is behind.
    // Recording first would invert that into a cache claiming FROZEN for an
    // artifact the harness never froze, which is data corruption rather than
    // a reporting bug. This is the G-13 hazard from the other side.
    const { svc, freeze, adoptCanonicalState } = makeServices(null);
    await svc.freezeArtifact('/project', 'EEK', 'sad', 'SAD-PROOF-001');

    expect(freeze).toHaveBeenCalledTimes(1);
    expect(adoptCanonicalState).toHaveBeenCalledTimes(1);
    expect(freeze.mock.invocationCallOrder[0]).toBeLessThan(
      adoptCanonicalState.mock.invocationCallOrder[0],
    );
  });
});

describe('G-22 — the seam must be able to say what went wrong', () => {
  it('maps InvalidTransitionError to 409, not a bare 500', () => {
    const res = errorResponse(
      new InvalidTransitionError('Invalid transition for step "sad": not-started → frozen'),
    );
    expect(res.status).toBe(409);
  });

  it('preserves the InvalidTransitionError message instead of discarding it', async () => {
    const res = errorResponse(new InvalidTransitionError('not-started → frozen'));
    const body = (await res.json()) as { error: string; code: string };
    expect(body.code).toBe('INVALID_TRANSITION');
    expect(body.error).toMatch(/not-started/);
  });

  it('surfaces the harness freeze code rather than collapsing it to INTERNAL_ERROR', async () => {
    // Every structured error from the ADR-0003 seam — the seam G-18 and G-19
    // both lived in — currently returns 500 INTERNAL_ERROR with `code` thrown
    // away. That is why diagnosing this took reading four files.
    const res = errorResponse(
      new HarnessFreezeError('hash_mismatch', 'content hash did not match disk'),
    );
    const body = (await res.json()) as { error: string; code: string };
    expect(body.code).not.toBe('INTERNAL_ERROR');
    expect(body.error).toMatch(/hash/i);
  });
});
