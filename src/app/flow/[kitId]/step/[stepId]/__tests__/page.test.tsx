/**
 * WDD-CONSOLE-013 — Phase 1 (Tests). Route-level tests for the step detail page.
 *
 * WHY THIS FILE EXISTS (G-21). Every component this page needs was already
 * built and unit-tested — StepView, GenerationStream, ValidationResultView,
 * ProcessTransparency — and the page rendered a hardcoded placeholder anyway.
 * StepView was imported by nothing but its own test. The console's 307 tests
 * were green throughout. The freeze leg of the three-way switch could not be
 * executed by anyone, on any machine, and no test failed to say so.
 *
 * Nothing under src/app/ had a single test before this file. Every assertion
 * below is at the ROUTE level on purpose: the gap was never "does StepView
 * work", it was "does anything render StepView". A component test cannot
 * detect an unrendered component. Do not relocate these into
 * components/__tests__ — that move is precisely what created G-21.
 *
 * The page is specified as an async SERVER component that reads the
 * orchestration service DIRECTLY. It must not fetch its own HTTP API: the
 * sibling flow page did exactly that and produced G-20 (hardcoded :3000
 * fallback, made sticky by compile-time NEXT_PUBLIC inlining, masked by a
 * silent catch that rendered backend failure as a plausible empty flow).
 *
 * Run: npx vitest run "src/app/flow/[kitId]/step/[stepId]/__tests__/page.test.tsx"
 * Expected at Phase 1: ALL FAIL. The page is a placeholder. If any test here
 * passes before implementation, the test is wrong, not the code.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

import type { FlowStep } from '@/lib/services/flow-types';
import type { ArtifactState } from '@/lib/services/state-types';

const getFlowStatus = vi.fn();

vi.mock('@/lib/services/service-factory', () => ({
  getServices: () => ({ orchestration: { getFlowStatus } }),
}));

vi.mock('@/lib/api-utils', () => ({
  getProjectDir: () => '/tmp/aieos-freeze-proof',
}));

// Mirrors the live payload from GET /api/flow/EEK on 2026-08-06, the run that
// found G-21. SAD is validated-pass with canonicalStatus FREEZE_PENDING —
// the exact state the freeze proof depends on.
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
  fourFiles: {
    spec: 'docs/specs/prd-spec.md',
    template: 'docs/artifacts/prd-template.md',
    prompt: 'docs/prompts/prd-prompt.md',
    validator: 'docs/validators/prd-validator.md',
  },
  requiredInputs: [
    { path: 'docs/brief.md', role: 'brief', source: 'human' },
    {
      path: 'docs/principles/product-craftsmanship.md',
      role: 'principles',
      source: 'framework',
    },
  ],
  produces: { artifactIdPrefix: 'PRD', outputFilename: 'prd.md' },
  upstreamPreconditions: ['PIK:DPRD', 'SSK:SDR'],
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
        blockedReason: 'PRINCIPLES_INPUTS_UNSUPPORTED',
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

async function renderPage(kitId = 'EEK', stepId = 'sad') {
  const mod = await import('../page');
  const StepPage = mod.default as (p: {
    params: Promise<{ kitId: string; stepId: string }>;
  }) => Promise<React.ReactElement>;
  const ui = await StepPage({ params: Promise.resolve({ kitId, stepId }) });
  return render(ui);
}

beforeEach(() => {
  vi.clearAllMocks();
  getFlowStatus.mockResolvedValue(flowStatus());
});

afterEach(cleanup);

describe('WDD-CONSOLE-013 — step page renders StepView (G-21 regression guard)', () => {
  it('renders StepView on the step route', async () => {
    await renderPage();
    expect(screen.getByTestId('step-view')).toBeInTheDocument();
  });

  it('does not render the placeholder that shipped as G-21', async () => {
    await renderPage();
    expect(
      screen.queryByText(/step detail content will be rendered here/i),
    ).not.toBeInTheDocument();
  });

  it('passes the resolved step through, not a stub', async () => {
    await renderPage();
    expect(screen.getByRole('heading', { name: 'Solution Architecture Document' }))
      .toBeInTheDocument();
    expect(screen.getByTestId('step-status')).toHaveTextContent('validated-pass');
  });

  it('reads the orchestration service directly and never fetches its own API (G-20)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await renderPage();
    expect(getFlowStatus).toHaveBeenCalledWith('/tmp/aieos-freeze-proof', 'EEK');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('AC3 — freeze control is reachable for a validated-pass step', () => {
  // This is the freeze leg of the three-way switch. StepView gates the freeze
  // section on status === 'validated-pass' and does NOT consult dependenciesMet,
  // so SAD's unmet deps must not suppress it.
  it('renders the artifact ID input and an enabled Freeze button', async () => {
    await renderPage();

    expect(screen.getByTestId('freeze-section')).toBeInTheDocument();
    const input = screen.getByTestId('artifact-id-input');
    const button = screen.getByTestId('freeze-button');

    expect(button).toBeDisabled(); // empty input
    fireEvent.change(input, { target: { value: 'SAD-PROOF-001' } });
    expect(button).toBeEnabled();
  });

  it('does not suppress the freeze control when dependenciesMet is false', async () => {
    await renderPage();
    expect(screen.getByTestId('freeze-section')).toBeInTheDocument();
  });

  it('hides the freeze control for a step that is not validated-pass', async () => {
    await renderPage('EEK', 'prd');
    expect(screen.queryByTestId('freeze-section')).not.toBeInTheDocument();
  });
});

describe('AC4 — process transparency on page load (PRD constraint C-1)', () => {
  it('displays spec, template, prompt and validator paths', async () => {
    await renderPage();

    expect(screen.getByTestId('process-transparency')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('transparency-toggle'));

    expect(screen.getByTestId('path-spec')).toHaveTextContent('docs/specs/sad-spec.md');
    expect(screen.getByTestId('path-template')).toHaveTextContent('docs/artifacts/sad-template.md');
    expect(screen.getByTestId('path-prompt')).toHaveTextContent('docs/prompts/sad-prompt.md');
    expect(screen.getByTestId('path-validator')).toHaveTextContent('docs/validators/sad-validator.md');
  });

  it('displays required_inputs paths when the step declares them (G-3)', async () => {
    await renderPage('EEK', 'prd');

    fireEvent.click(screen.getByTestId('transparency-toggle'));
    const list = screen.getByTestId('required-inputs-list');
    expect(list).toHaveTextContent('docs/brief.md');
    expect(list).toHaveTextContent('docs/principles/product-craftsmanship.md');
  });
});

describe('FR-023 D2/A3 — blocked reasons reach the page', () => {
  it('forwards blockedReason to StepView', async () => {
    await renderPage('EEK', 'prd');
    const el = screen.getByTestId('blocked-reason');
    expect(el).toHaveAttribute('data-reason-code', 'PRINCIPLES_INPUTS_UNSUPPORTED');
  });

  it('renders upstream preconditions that must be FROZEN', async () => {
    await renderPage('EEK', 'prd');
    expect(screen.getByTestId('precondition-PIK:DPRD')).toBeInTheDocument();
    expect(screen.getByTestId('precondition-SSK:SDR')).toBeInTheDocument();
  });
});

describe('Failure surfacing — no silent empty success (the G-20 lesson)', () => {
  // These two assert on the SPECIFIC failure, never on a bare toThrow().
  // First draft used `.rejects.toThrow()` and both passed against the
  // placeholder page — not because errors were handled, but because calling a
  // client component outside React's renderer threw
  // `TypeError: Cannot read properties of null (reading 'use')`. A green that
  // any crash satisfies is not a test. Same species as G-21 itself.

  it('propagates the orchestration failure, with its identity intact', async () => {
    class ManifestNotFoundError extends Error {
      override name = 'ManifestNotFoundError';
    }
    getFlowStatus.mockRejectedValue(new ManifestNotFoundError('manifest missing'));

    await expect(renderPage()).rejects.toMatchObject({
      name: 'ManifestNotFoundError',
    });
    // Throwing to error.tsx is acceptable. Rendering a plausible empty view is
    // not — that is the defect this asserts against.
  });

  it('rejects with StepNotFoundError when the step is absent from the flow', async () => {
    await expect(renderPage('EEK', 'no-such-step')).rejects.toMatchObject({
      name: 'StepNotFoundError',
    });
    // A missing step is a 404 condition (api-utils NOT_FOUND_ERRORS), not an
    // empty page. G-20 shipped because a failure was dressed as a legitimate
    // empty result.
  });

  it('does not fail merely because the page crashed for an unrelated reason', async () => {
    // Guard on the guards: pin that the two tests above cannot be satisfied by
    // the hook-call TypeError that made them false-green in the first draft.
    getFlowStatus.mockRejectedValue(
      Object.assign(new Error('manifest missing'), { name: 'ManifestNotFoundError' }),
    );
    await expect(renderPage()).rejects.not.toThrow(TypeError);
  });
});
