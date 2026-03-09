import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import ProjectSetup from '../ProjectSetup';

const originalLocation = window.location;

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { ...originalLocation, href: '' },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Object.defineProperty(window, 'location', {
    writable: true,
    value: originalLocation,
  });
});

describe('ProjectSetup', () => {
  it('renders all form fields', () => {
    render(<ProjectSetup />);

    expect(screen.getByLabelText('Project Directory')).toBeInTheDocument();
    expect(screen.getByLabelText(/Kit Directory Paths/)).toBeInTheDocument();
    expect(screen.getByLabelText('LLM Provider')).toBeInTheDocument();
    expect(screen.getByLabelText('LLM Model')).toBeInTheDocument();
    expect(screen.getByLabelText('API Key Env Var Name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Initialize Project' })).toBeInTheDocument();
  });

  it('has correct default values for provider and apiKeyEnvVar', () => {
    render(<ProjectSetup />);

    expect(screen.getByLabelText('LLM Provider')).toHaveValue('anthropic');
    expect(screen.getByLabelText('API Key Env Var Name')).toHaveValue('LLM_API_KEY');
  });

  it('submits form with correct body', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        projectId: 'proj-123',
        kitConfigs: [{ kitId: 'pik', kitPath: '/kits/pik' }],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    render(<ProjectSetup />);

    fireEvent.change(screen.getByLabelText('Project Directory'), {
      target: { value: '/my/project' },
    });
    fireEvent.change(screen.getByLabelText(/Kit Directory Paths/), {
      target: { value: '/kits/pik, /kits/eek' },
    });
    fireEvent.change(screen.getByLabelText('LLM Model'), {
      target: { value: 'claude-3' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Initialize Project' }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/project/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectDir: '/my/project',
          kitConfigs: [
            { kitId: 'pik', kitPath: '/kits/pik' },
            { kitId: 'eek', kitPath: '/kits/eek' },
          ],
          llmConfigs: [
            { providerId: 'anthropic', model: 'claude-3', apiKeyEnvVar: 'LLM_API_KEY' },
          ],
        }),
      });
    });
  });

  it('redirects to first kit flow on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        projectId: 'proj-123',
        kitConfigs: [{ kitId: 'pik', kitPath: '/kits/pik' }],
      }),
    }));

    render(<ProjectSetup />);

    fireEvent.change(screen.getByLabelText('Project Directory'), {
      target: { value: '/project' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Initialize Project' }));

    await waitFor(() => {
      expect(window.location.href).toBe('/flow/pik');
    });
  });

  it('shows error on failed initialization', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Disk full' }),
    }));

    render(<ProjectSetup />);

    fireEvent.change(screen.getByLabelText('Project Directory'), {
      target: { value: '/project' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Initialize Project' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Disk full');
    });
  });

  it('handles already-initialized project (409 response)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: () => Promise.resolve({ error: 'Already initialized' }),
    }));

    render(<ProjectSetup />);

    fireEvent.change(screen.getByLabelText('Project Directory'), {
      target: { value: '/project' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Initialize Project' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Project is already initialized.');
    });
  });

  it('shows network error on fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    render(<ProjectSetup />);

    fireEvent.change(screen.getByLabelText('Project Directory'), {
      target: { value: '/project' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Initialize Project' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Network error. Could not reach server.');
    });
  });
});
