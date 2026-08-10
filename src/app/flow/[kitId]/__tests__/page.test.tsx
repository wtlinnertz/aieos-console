/**
 * G-20 — Phase 1 (Tests). Route-level tests for the flow overview page.
 *
 * WHY THIS FILE EXISTS. The flow page fetched its own HTTP API with a
 * hardcoded `http://localhost:3000` fallback, made sticky across restarts by
 * compile-time NEXT_PUBLIC inlining, and masked by a silent catch that
 * rendered backend failure as a plausible empty flow. The defect was found on
 * 2026-08-07, worked around via NEXT_PUBLIC_API_URL in an unversioned setup
 * script, and left in the tree. This file exists so the real fix cannot
 * regress into either failure mode: self-fetching, or failure dressed as an
 * empty-but-valid-looking result.
 *
 * The page is specified as an async SERVER component that reads the
 * orchestration service DIRECTLY — the pattern the step page (G-21,
 * WDD-CONSOLE-013) established one route below. Failures propagate. There is
 * no fallback render.
 *
 * Run: npx vitest run "src/app/flow/[kitId]/__tests__/page.test.tsx"
 * Expected at Phase 1: the G-20 describe blocks ALL FAIL against the current
 * fetch-based implementation. If they pass before the rewrite, the test is
 * wrong, not the code.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import type { FlowStep } from '@/lib/services/flow-types';
import type { ArtifactState } from '@/lib/services/state-types';

const getFlowStatus = vi.fn();

vi.mock('@/lib/services/service-factory', () => ({
  getServices: () => ({ orchestration: { getFlowStatus } }),
}));

vi.mock('@/lib/api-utils', () => ({
  getProjectDir: () => '/tmp/aieos-freeze-proof',
}));

// Same fixture shape as the step page tests — mirrors the live payload from
// GET /api/flow/EEK on 2026-08-06.
const sadStep: FlowStep = {
  id: 'sad',
  name: 'Solution Architecture Document',
  artifactType: 'sad',
  stepType: 'llm-generated',
  dependencies: ['prd', 'dkr'],
  fourFiles: {
    spec: 'docs/specs/sad-spec.md',
    template: 'docs/artifacts/sad-template.md',
    prompt: 'docs/prompts/sad-prompt.md',
    validator: 'docs/validators/sad-validator.md',
  },
  requiredInputs: [],
  produces: { artifactIdPrefix: 'SAD', outputFilename: 'sad.md' },
  freezeGate: true,
  upstreamPreconditions: [],
} as unknown as FlowStep;

const sadState: ArtifactState = {
  stepId: 'sad',
  kitId: 'EEK',
  artifactId: 'SAD-PROOF-001',
  status: 'validated-pass',
  artifactPath: 'docs/sdlc/sad.md',
  validationResult: null,
  frozenAt: null,
  lastModified: '2026-08-07T02:54:42.465Z',
} as unknown as ArtifactState;

const prdStep: FlowStep = {
  ...sadStep,
  id: 'prd',
  name: 'Product Requirements Document',
  artifactType: 'prd',
  dependencies: ['kit-entry'],
} as unknown as FlowStep;

const prdState: ArtifactState = {
  ...sadState,
  stepId: 'prd',
  artifactId: null,
  status: 'not-started',
  artifactPath: null,
} as unknown as ArtifactState;

function flowStatus() {
  return {
    steps: [
      {
        step: prdStep,
        state: prdState,
        dependenciesMet: false,
        isCurrentStep: false,
        blockedReason: null,
        canonicalStatus: null,
      },
      {
        step: sadStep,
        state: sadState,
        dependenciesMet: false,
        isCurrentStep: false,
        blockedReason: null,
        canonicalStatus: 'FREEZE_PENDING',
      },
    ],
    currentStep: null,
    completedSteps: 0,
    totalSteps: 9,
  };
}

async function renderPage(kitId = 'EEK') {
  const mod = await import('../page');
  const FlowPage = mod.default as (p: {
    params: Promise<{ kitId: string }>;
  }) => Promise<React.ReactElement>;
  const ui = await FlowPage({ params: Promise.resolve({ kitId }) });
  return render(ui);
}

beforeEach(() => {
  vi.clearAllMocks();
  getFlowStatus.mockResolvedValue(flowStatus());
});

afterEach(cleanup);

describe('G-20 — flow page reads the orchestration service directly', () => {
  it('never fetches its own HTTP API', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await renderPage();
    expect(getFlowStatus).toHaveBeenCalledWith('/tmp/aieos-freeze-proof', 'EEK');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('renders the real flow, not the mock fallback', async () => {
    await renderPage();
    expect(screen.getByTestId('step-item-prd')).toBeInTheDocument();
    expect(screen.getByTestId('step-item-sad')).toBeInTheDocument();
    expect(screen.getByTestId('progress-count')).toHaveTextContent(
      '0 of 9 steps complete',
    );
  });

  it('renders the empty state only when the service really returns zero steps', async () => {
    getFlowStatus.mockResolvedValue({
      steps: [],
      currentStep: null,
      completedSteps: 0,
      totalSteps: 0,
    });
    await renderPage();
    // Legitimate empty flow from real data — the ONLY path to this render.
    expect(screen.getByTestId('empty-steps')).toBeInTheDocument();
    expect(getFlowStatus).toHaveBeenCalledTimes(1);
  });
});

describe('Failure surfacing — no silent empty success (the G-20 defect itself)', () => {
  // Assert on the SPECIFIC failure, never a bare toThrow() — the step page
  // tests documented how a bare toThrow goes false-green on an unrelated
  // hook-call TypeError.

  it('propagates the orchestration failure, with its identity intact', async () => {
    class ManifestNotFoundError extends Error {
      override name = 'ManifestNotFoundError';
    }
    getFlowStatus.mockRejectedValue(new ManifestNotFoundError('manifest missing'));

    await expect(renderPage()).rejects.toMatchObject({
      name: 'ManifestNotFoundError',
    });
    // Throwing to error.tsx is acceptable. Rendering a plausible empty flow is
    // not — that render is the defect this file exists to prevent.
  });

  it('rejects with the service failure, not an unrelated TypeError', async () => {
    getFlowStatus.mockRejectedValue(
      Object.assign(new Error('manifest missing'), {
        name: 'ManifestNotFoundError',
      }),
    );
    await expect(renderPage()).rejects.not.toThrow(TypeError);
  });
});
