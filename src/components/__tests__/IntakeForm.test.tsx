import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import IntakeForm from '../IntakeForm';

afterEach(cleanup);

const twoSectionTemplate = `## Section One
Description of what to fill in

## Section Two
Another section`;

describe('IntakeForm', () => {
  it('renders sections from template headings', () => {
    render(<IntakeForm template={twoSectionTemplate} onSave={vi.fn()} />);

    expect(screen.getByText('Section One')).toBeInTheDocument();
    expect(screen.getByText('Section Two')).toBeInTheDocument();
    expect(
      screen.getByText('Description of what to fill in'),
    ).toBeInTheDocument();
    expect(screen.getByText('Another section')).toBeInTheDocument();
  });

  it('renders a textarea for each section', () => {
    render(<IntakeForm template={twoSectionTemplate} onSave={vi.fn()} />);

    expect(screen.getByLabelText('Section One')).toBeInTheDocument();
    expect(screen.getByLabelText('Section Two')).toBeInTheDocument();
  });

  it('pre-populates from initialContent', () => {
    const initialContent = `## Section One
My first answer

## Section Two
My second answer`;

    render(
      <IntakeForm
        template={twoSectionTemplate}
        initialContent={initialContent}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Section One')).toHaveValue(
      'My first answer',
    );
    expect(screen.getByLabelText('Section Two')).toHaveValue(
      'My second answer',
    );
  });

  it('calls onSave with assembled markdown content', () => {
    const onSave = vi.fn();
    render(<IntakeForm template={twoSectionTemplate} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText('Section One'), {
      target: { value: 'Answer one' },
    });
    fireEvent.change(screen.getByLabelText('Section Two'), {
      target: { value: 'Answer two' },
    });

    fireEvent.click(screen.getByText('Save Draft'));

    expect(onSave).toHaveBeenCalledTimes(1);
    const result = onSave.mock.calls[0][0] as string;
    expect(result).toContain('## Section One');
    expect(result).toContain('Answer one');
    expect(result).toContain('## Section Two');
    expect(result).toContain('Answer two');
  });

  it('handles template with no headings as a single textarea', () => {
    render(
      <IntakeForm template="Just plain text content" onSave={vi.fn()} />,
    );

    expect(screen.getByLabelText('Content')).toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('shows "Saving..." when saving prop is true', () => {
    render(
      <IntakeForm template={twoSectionTemplate} onSave={vi.fn()} saving />,
    );

    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('Saving...');
    expect(button).toBeDisabled();
  });

  it('shows "Save Draft" when saving prop is false', () => {
    render(<IntakeForm template={twoSectionTemplate} onSave={vi.fn()} />);

    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('Save Draft');
    expect(button).not.toBeDisabled();
  });

  it('allows saving an empty form', () => {
    const onSave = vi.fn();
    render(<IntakeForm template={twoSectionTemplate} onSave={onSave} />);

    fireEvent.click(screen.getByText('Save Draft'));

    expect(onSave).toHaveBeenCalledTimes(1);
    const result = onSave.mock.calls[0][0] as string;
    expect(result).toContain('## Section One');
    expect(result).toContain('## Section Two');
  });
});
