import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, it, expect } from 'vitest';
import { ValidationResultView } from '../ValidationResultView';
import type { ValidationResult } from '@/lib/services/state-types';

function makeResult(overrides: Partial<ValidationResult> = {}): ValidationResult {
  return {
    status: 'PASS',
    summary: 'All gates passed.',
    hardGates: {},
    blockingIssues: [],
    warnings: [],
    completenessScore: 95,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe('ValidationResultView', () => {
  it('renders PASS status', () => {
    const result = makeResult({ status: 'PASS', summary: 'Looks good.' });

    render(<ValidationResultView result={result} />);

    expect(screen.getByTestId('validation-status')).toHaveTextContent('PASS');
    expect(screen.getByTestId('validation-summary')).toHaveTextContent('Looks good.');
  });

  it('renders FAIL with blocking issues', () => {
    const result = makeResult({
      status: 'FAIL',
      summary: 'Critical issues found.',
      blockingIssues: [
        {
          gate: 'completeness',
          description: 'Missing required section',
          location: 'Section 3',
        },
        {
          gate: 'consistency',
          description: 'Conflicting requirements',
          location: 'Section 5',
        },
      ],
    });

    render(<ValidationResultView result={result} />);

    expect(screen.getByTestId('validation-status')).toHaveTextContent('FAIL');
    expect(screen.getByTestId('blocking-issues-section')).toBeInTheDocument();
    expect(screen.getByTestId('blocking-issue-0')).toHaveTextContent(
      'Missing required section',
    );
    expect(screen.getByTestId('blocking-issue-1')).toHaveTextContent(
      'Conflicting requirements',
    );
  });

  it('shows completeness score', () => {
    const result = makeResult({ completenessScore: 72 });

    render(<ValidationResultView result={result} />);

    expect(screen.getByTestId('completeness-score')).toHaveTextContent('72/100');
  });

  it('displays hard gates table', () => {
    const result = makeResult({
      hardGates: {
        structure: 'PASS',
        content: 'FAIL',
        references: 'PASS',
      },
    });

    render(<ValidationResultView result={result} />);

    expect(screen.getByTestId('hard-gates-section')).toBeInTheDocument();
    expect(screen.getByTestId('gate-row-structure')).toHaveTextContent('PASS');
    expect(screen.getByTestId('gate-row-content')).toHaveTextContent('FAIL');
    expect(screen.getByTestId('gate-row-references')).toHaveTextContent('PASS');
  });

  it('displays warnings when present', () => {
    const result = makeResult({
      warnings: [
        { description: 'Consider adding examples', location: 'Section 2' },
      ],
    });

    render(<ValidationResultView result={result} />);

    expect(screen.getByTestId('warnings-section')).toBeInTheDocument();
    expect(screen.getByTestId('warning-0')).toHaveTextContent(
      'Consider adding examples',
    );
  });
});
