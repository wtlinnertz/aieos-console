import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { ArtifactToggle } from '../ArtifactToggle';

vi.mock('../../lib/sanitize', () => ({
  sanitizeContent: vi.fn().mockResolvedValue('<h1>Test</h1><p>Content</p>'),
}));

afterEach(() => {
  cleanup();
});

describe('ArtifactToggle', () => {
  it('defaults to viewer mode', async () => {
    render(<ArtifactToggle content="# Test" onSave={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('artifact-viewer')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('artifact-editor')).not.toBeInTheDocument();
  });

  it('can toggle to editor mode', async () => {
    render(<ArtifactToggle content="# Test" onSave={vi.fn()} />);

    const editButton = screen.getByTestId('toggle-edit');
    fireEvent.click(editButton);

    expect(screen.getByTestId('artifact-editor')).toBeInTheDocument();
    expect(screen.queryByTestId('artifact-viewer')).not.toBeInTheDocument();
  });

  it('does not show edit button when frozen', async () => {
    render(<ArtifactToggle content="# Test" isFrozen onSave={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('artifact-viewer')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('toggle-edit')).not.toBeInTheDocument();
  });

  it('can toggle back to viewer from editor', async () => {
    render(<ArtifactToggle content="# Test" onSave={vi.fn()} />);

    fireEvent.click(screen.getByTestId('toggle-edit'));
    expect(screen.getByTestId('artifact-editor')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('toggle-view'));
    await waitFor(() => {
      expect(screen.getByTestId('artifact-viewer')).toBeInTheDocument();
    });
  });
});
