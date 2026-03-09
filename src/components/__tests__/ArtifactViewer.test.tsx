import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { ArtifactViewer } from '../ArtifactViewer';

vi.mock('../../lib/sanitize', () => ({
  sanitizeContent: vi.fn().mockResolvedValue('<h1>Test</h1><p>Content</p>'),
}));

afterEach(() => {
  cleanup();
});

describe('ArtifactViewer', () => {
  it('shows loading state initially', () => {
    render(<ArtifactViewer content="# Test" />);

    expect(screen.getByTestId('viewer-loading')).toHaveTextContent('Loading...');
  });

  it('renders markdown as sanitized HTML', async () => {
    render(<ArtifactViewer content="# Test\n\nContent" />);

    await waitFor(() => {
      expect(screen.getByTestId('viewer-content')).toBeInTheDocument();
    });

    const contentEl = screen.getByTestId('viewer-content');
    expect(contentEl.innerHTML).toContain('<h1>Test</h1>');
    expect(contentEl.innerHTML).toContain('<p>Content</p>');
  });

  it('shows frozen indicator when isFrozen is true', async () => {
    render(<ArtifactViewer content="# Test" isFrozen />);

    await waitFor(() => {
      expect(screen.getByTestId('viewer-content')).toBeInTheDocument();
    });

    expect(screen.getByTestId('frozen-indicator')).toHaveTextContent('Frozen');
  });

  it('does not show frozen indicator when isFrozen is false', async () => {
    render(<ArtifactViewer content="# Test" />);

    await waitFor(() => {
      expect(screen.getByTestId('viewer-content')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('frozen-indicator')).not.toBeInTheDocument();
  });

  it('does not render script tags (XSS prevention)', async () => {
    const { sanitizeContent } = await import('../../lib/sanitize');
    vi.mocked(sanitizeContent).mockResolvedValueOnce('<p>safe content</p>');

    render(<ArtifactViewer content="<script>alert('xss')</script>" />);

    await waitFor(() => {
      expect(screen.getByTestId('viewer-content')).toBeInTheDocument();
    });

    const contentEl = screen.getByTestId('viewer-content');
    expect(contentEl.innerHTML).not.toContain('<script>');
    expect(contentEl.innerHTML).toContain('<p>safe content</p>');
  });
});
