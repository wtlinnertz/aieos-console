import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, it, expect } from 'vitest';
import { ProcessTransparency } from '../ProcessTransparency';
import type { FlowStep } from '@/lib/services/flow-types';

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

afterEach(() => {
  cleanup();
});

describe('ProcessTransparency', () => {
  it('shows file paths when expanded', () => {
    const step = makeStep();

    render(<ProcessTransparency step={step} />);

    fireEvent.click(screen.getByTestId('transparency-toggle'));

    expect(screen.getByTestId('path-spec')).toHaveTextContent('docs/specs/prd-spec.md');
    expect(screen.getByTestId('path-template')).toHaveTextContent(
      'docs/artifacts/prd-template.md',
    );
    expect(screen.getByTestId('path-prompt')).toHaveTextContent(
      'docs/prompts/prd-prompt.md',
    );
    expect(screen.getByTestId('path-validator')).toHaveTextContent(
      'docs/validators/prd-validator.md',
    );
  });

  it('shows N/A for null prompt', () => {
    const step = makeStep({
      fourFiles: {
        spec: 'docs/specs/acf-spec.md',
        template: 'docs/artifacts/acf-template.md',
        prompt: null,
        validator: 'docs/validators/acf-validator.md',
      },
    });

    render(<ProcessTransparency step={step} />);

    fireEvent.click(screen.getByTestId('transparency-toggle'));

    expect(screen.getByTestId('path-prompt')).toHaveTextContent('N/A');
  });

  it('shows required inputs when present', () => {
    const step = makeStep({
      requiredInputs: [
        { path: 'docs/engagement/er-taskflow.md', role: 'engagement-record' },
        { path: '01-prd.md', role: 'source-artifact' },
      ],
    });

    render(<ProcessTransparency step={step} />);

    fireEvent.click(screen.getByTestId('transparency-toggle'));

    expect(screen.getByTestId('required-inputs-list')).toBeInTheDocument();
    expect(screen.getByTestId('required-input-0')).toHaveTextContent(
      'docs/engagement/er-taskflow.md',
    );
    expect(screen.getByTestId('required-input-0')).toHaveTextContent(
      'engagement-record',
    );
    expect(screen.getByTestId('required-input-1')).toHaveTextContent('01-prd.md');
  });

  it('is collapsed by default', () => {
    const step = makeStep();

    render(<ProcessTransparency step={step} />);

    expect(screen.queryByTestId('transparency-details')).not.toBeInTheDocument();
    expect(screen.getByTestId('transparency-toggle')).toHaveTextContent(
      'Show Process Details',
    );
  });
});
