import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { FlowStepper } from '../FlowStepper';
import type { FlowStatus, StepStatus } from '@/lib/services/orchestration-types';
import type { ArtifactStatus } from '@/lib/services/state-types';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

function makeStepStatus(
  overrides: Partial<StepStatus> & { id?: string; name?: string; status?: ArtifactStatus } = {},
): StepStatus {
  const {
    id = 'step-1',
    name = 'Step One',
    status = 'not-started',
    ...rest
  } = overrides;
  return {
    step: {
      id,
      name,
      artifactType: 'prd',
      stepType: 'llm-generated',
      dependencies: [],
      fourFiles: {
        spec: 'spec.md',
        template: 'template.md',
        prompt: 'prompt.md',
        validator: 'validator.md',
      },
      requiredInputs: [],
      produces: { artifactIdPrefix: 'PRD', outputFilename: 'prd.md' },
      freezeGate: true,
    },
    state: {
      stepId: id,
      kitId: 'pik',
      artifactId: null,
      status,
      artifactPath: null,
      validationResult: null,
      frozenAt: null,
      lastModified: '2026-01-01T00:00:00Z',
    },
    dependenciesMet: true,
    isCurrentStep: false,
    ...rest,
  };
}

function makeFlowStatus(
  steps: StepStatus[],
  overrides: Partial<FlowStatus> = {},
): FlowStatus {
  const completedSteps = steps.filter((s) => s.state.status === 'frozen').length;
  return {
    steps,
    currentStep: steps.find((s) => s.isCurrentStep) ?? null,
    completedSteps,
    totalSteps: steps.length,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe('FlowStepper', () => {
  it('renders correct number of steps', () => {
    const steps = [
      makeStepStatus({ id: 'step-1', name: 'Step One' }),
      makeStepStatus({ id: 'step-2', name: 'Step Two' }),
      makeStepStatus({ id: 'step-3', name: 'Step Three' }),
    ];
    const flowStatus = makeFlowStatus(steps);

    render(<FlowStepper flowStatus={flowStatus} kitId="pik" />);

    expect(screen.getByText('Step One')).toBeInTheDocument();
    expect(screen.getByText('Step Two')).toBeInTheDocument();
    expect(screen.getByText('Step Three')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('shows frozen steps as completed in progress count', () => {
    const steps = [
      makeStepStatus({ id: 'step-1', name: 'Step One', status: 'frozen' }),
      makeStepStatus({ id: 'step-2', name: 'Step Two', status: 'frozen' }),
      makeStepStatus({ id: 'step-3', name: 'Step Three', status: 'not-started' }),
    ];
    const flowStatus = makeFlowStatus(steps);

    render(<FlowStepper flowStatus={flowStatus} kitId="pik" />);

    expect(screen.getByTestId('progress-count')).toHaveTextContent(
      '2 of 3 steps complete',
    );
  });

  it('highlights the current step', () => {
    const steps = [
      makeStepStatus({ id: 'step-1', name: 'Step One', status: 'frozen' }),
      makeStepStatus({
        id: 'step-2',
        name: 'Step Two',
        status: 'in-progress',
        isCurrentStep: true,
      }),
    ];
    const flowStatus = makeFlowStatus(steps);

    render(<FlowStepper flowStatus={flowStatus} kitId="pik" />);

    const currentItem = screen.getByTestId('step-item-step-2');
    expect(currentItem).toHaveStyle({ borderLeft: '4px solid #2563eb' });
  });

  it('shows "dependencies not met" indicator when dependenciesMet is false', () => {
    const steps = [
      makeStepStatus({ id: 'step-1', name: 'Step One' }),
      makeStepStatus({
        id: 'step-2',
        name: 'Step Two',
        dependenciesMet: false,
      }),
    ];
    const flowStatus = makeFlowStatus(steps);

    render(<FlowStepper flowStatus={flowStatus} kitId="pik" />);

    expect(screen.getByTestId('deps-not-met-step-2')).toHaveTextContent(
      'Dependencies not met',
    );
    expect(screen.queryByTestId('deps-not-met-step-1')).not.toBeInTheDocument();
  });

  it('shows progress count (e.g. "2 of 5 complete")', () => {
    const steps = Array.from({ length: 5 }, (_, i) =>
      makeStepStatus({
        id: `step-${i + 1}`,
        name: `Step ${i + 1}`,
        status: i < 2 ? 'frozen' : 'not-started',
      }),
    );
    const flowStatus = makeFlowStatus(steps);

    render(<FlowStepper flowStatus={flowStatus} kitId="pik" />);

    expect(screen.getByTestId('progress-count')).toHaveTextContent(
      '2 of 5 steps complete',
    );
  });

  it('renders step links pointing to correct URLs', () => {
    const steps = [
      makeStepStatus({ id: 'prd', name: 'PRD' }),
      makeStepStatus({ id: 'acf', name: 'ACF' }),
    ];
    const flowStatus = makeFlowStatus(steps);

    render(<FlowStepper flowStatus={flowStatus} kitId="my-kit" />);

    const links = screen.getAllByRole('link');
    expect(links[0]).toHaveAttribute('href', '/flow/my-kit/step/prd');
    expect(links[1]).toHaveAttribute('href', '/flow/my-kit/step/acf');
  });

  it('handles empty steps array', () => {
    const flowStatus = makeFlowStatus([]);

    render(<FlowStepper flowStatus={flowStatus} kitId="pik" />);

    expect(screen.getByTestId('empty-steps')).toHaveTextContent(
      'No steps defined for this flow.',
    );
  });

  it('renders all status badges correctly', () => {
    const statuses: ArtifactStatus[] = [
      'not-started',
      'in-progress',
      'draft',
      'validated-pass',
      'validated-fail',
      'frozen',
    ];
    const steps = statuses.map((status, i) =>
      makeStepStatus({
        id: `step-${i}`,
        name: `Step ${i}`,
        status,
      }),
    );
    const flowStatus = makeFlowStatus(steps);

    render(<FlowStepper flowStatus={flowStatus} kitId="pik" />);

    expect(screen.getByTestId('status-badge-not-started')).toHaveTextContent('Not Started');
    expect(screen.getByTestId('status-badge-in-progress')).toHaveTextContent('In Progress');
    expect(screen.getByTestId('status-badge-draft')).toHaveTextContent('Draft');
    expect(screen.getByTestId('status-badge-validated-pass')).toHaveTextContent('Validated (Pass)');
    expect(screen.getByTestId('status-badge-validated-fail')).toHaveTextContent('Validated (Fail)');
    expect(screen.getByTestId('status-badge-frozen')).toHaveTextContent('Frozen');
  });

  it('does not highlight non-current steps', () => {
    const steps = [
      makeStepStatus({ id: 'step-1', name: 'Step One', isCurrentStep: false }),
      makeStepStatus({
        id: 'step-2',
        name: 'Step Two',
        isCurrentStep: true,
        status: 'in-progress',
      }),
    ];
    const flowStatus = makeFlowStatus(steps);

    render(<FlowStepper flowStatus={flowStatus} kitId="pik" />);

    // Non-current step should not have the highlight background
    const item1 = screen.getByTestId('step-item-step-1');
    expect(item1).not.toHaveStyle({ backgroundColor: '#eff6ff' });
    // Current step should have the highlight background
    const item2 = screen.getByTestId('step-item-step-2');
    expect(item2).toHaveStyle({ backgroundColor: '#eff6ff' });
  });

  it('renders frozen badge with correct label for completed steps', () => {
    const steps = [
      makeStepStatus({ id: 'step-1', name: 'Frozen Step', status: 'frozen' }),
    ];
    const flowStatus = makeFlowStatus(steps);

    render(<FlowStepper flowStatus={flowStatus} kitId="pik" />);

    expect(screen.getByTestId('status-badge-frozen')).toHaveTextContent('Frozen');
    expect(screen.getByTestId('progress-count')).toHaveTextContent(
      '1 of 1 steps complete',
    );
  });
});
