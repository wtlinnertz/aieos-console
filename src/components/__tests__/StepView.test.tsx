import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { StepView } from '../StepView';
import type { FlowStep } from '@/lib/services/flow-types';
import type { ArtifactState, ArtifactStatus } from '@/lib/services/state-types';

// Mock GenerationStream to avoid EventSource dependency
vi.mock('../GenerationStream', () => ({
  GenerationStream: ({ kitId, stepId }: { kitId: string; stepId: string }) => (
    <div data-testid="generation-stream">
      Mock stream for {kitId}/{stepId}
    </div>
  ),
}));

function makeStep(overrides: Partial<FlowStep> = {}): FlowStep {
  return {
    id: 'step-prd',
    name: 'Generate PRD',
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
    ...overrides,
  };
}

function makeState(overrides: Partial<ArtifactState> = {}): ArtifactState {
  return {
    stepId: 'step-prd',
    kitId: 'pik',
    artifactId: null,
    status: 'not-started',
    artifactPath: null,
    validationResult: null,
    frozenAt: null,
    lastModified: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('StepView', () => {
  it('renders generate button for llm-generated in-progress step', () => {
    const step = makeStep({ stepType: 'llm-generated' });
    const state = makeState({ status: 'in-progress' });

    render(<StepView step={step} state={state} kitId="pik" />);

    expect(screen.getByTestId('generate-button')).toBeInTheDocument();
    expect(screen.getByTestId('generate-button')).toHaveTextContent('Generate');
  });

  it('renders validate button for draft step', () => {
    const step = makeStep({ stepType: 'llm-generated' });
    const state = makeState({ status: 'draft' });

    render(<StepView step={step} state={state} kitId="pik" />);

    expect(screen.getByTestId('validate-button')).toBeInTheDocument();
    expect(screen.getByTestId('validate-button')).toHaveTextContent('Validate');
  });

  it('shows freeze UI for validated-pass step', () => {
    const step = makeStep({ stepType: 'llm-generated' });
    const state = makeState({ status: 'validated-pass' as ArtifactStatus });

    render(<StepView step={step} state={state} kitId="pik" />);

    expect(screen.getByTestId('freeze-section')).toBeInTheDocument();
    expect(screen.getByTestId('artifact-id-input')).toBeInTheDocument();
    expect(screen.getByTestId('freeze-button')).toBeInTheDocument();
  });

  it('shows frozen badge for frozen step', () => {
    const step = makeStep({ stepType: 'llm-generated' });
    const state = makeState({ status: 'frozen' });

    render(<StepView step={step} state={state} kitId="pik" />);

    expect(screen.getByTestId('frozen-badge')).toHaveTextContent('Frozen');
    // Should not show generate or validate buttons
    expect(screen.queryByTestId('generate-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('validate-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('freeze-section')).not.toBeInTheDocument();
  });

  it('shows GenerationStream when generate button is clicked', () => {
    const step = makeStep({ stepType: 'llm-generated' });
    const state = makeState({ status: 'in-progress' });

    render(<StepView step={step} state={state} kitId="pik" />);

    fireEvent.click(screen.getByTestId('generate-button'));

    expect(screen.getByTestId('generation-stream')).toBeInTheDocument();
  });

  it('shows "Use Intake Form" for human-intake step type', () => {
    const step = makeStep({ stepType: 'human-intake' });
    const state = makeState({ status: 'in-progress' });

    render(<StepView step={step} state={state} kitId="pik" />);

    expect(screen.getByTestId('human-intake-view')).toBeInTheDocument();
    expect(screen.getByText('Use Intake Form')).toBeInTheDocument();
  });

  it('shows acceptance-check view with validate button', () => {
    const step = makeStep({ stepType: 'acceptance-check' });
    const state = makeState({ status: 'draft' });

    render(<StepView step={step} state={state} kitId="pik" />);

    expect(screen.getByTestId('acceptance-check-view')).toBeInTheDocument();
    expect(screen.getByTestId('validate-button')).toBeInTheDocument();
  });
});
