import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ArtifactEditor } from '../ArtifactEditor';

afterEach(() => {
  cleanup();
});

describe('ArtifactEditor', () => {
  it('renders textarea with content', () => {
    render(<ArtifactEditor content="# Hello" onSave={vi.fn()} />);

    const textarea = screen.getByTestId('editor-textarea') as HTMLTextAreaElement;
    expect(textarea.value).toBe('# Hello');
  });

  it('save button is disabled when content is not dirty', () => {
    render(<ArtifactEditor content="# Hello" onSave={vi.fn()} />);

    const button = screen.getByTestId('save-button');
    expect(button).toBeDisabled();
  });

  it('save button is enabled when content changes', () => {
    render(<ArtifactEditor content="# Hello" onSave={vi.fn()} />);

    const textarea = screen.getByTestId('editor-textarea');
    fireEvent.change(textarea, { target: { value: '# Changed' } });

    const button = screen.getByTestId('save-button');
    expect(button).not.toBeDisabled();
  });

  it('calls onSave with edited content when save is clicked', () => {
    const onSave = vi.fn();
    render(<ArtifactEditor content="# Hello" onSave={onSave} />);

    const textarea = screen.getByTestId('editor-textarea');
    fireEvent.change(textarea, { target: { value: '# Updated' } });

    const button = screen.getByTestId('save-button');
    fireEvent.click(button);

    expect(onSave).toHaveBeenCalledWith('# Updated');
  });

  it('shows saving state', () => {
    render(<ArtifactEditor content="# Hello" onSave={vi.fn()} saving />);

    const button = screen.getByTestId('save-button');
    expect(button).toHaveTextContent('Saving...');
    expect(button).toBeDisabled();
  });

  it('shows re-validation indicator when needsRevalidation is true', () => {
    render(
      <ArtifactEditor content="# Hello" onSave={vi.fn()} needsRevalidation />,
    );

    expect(screen.getByTestId('revalidation-indicator')).toHaveTextContent(
      'Re-validation needed',
    );
  });
});
