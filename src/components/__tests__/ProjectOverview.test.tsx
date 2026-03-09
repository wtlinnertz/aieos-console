import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import ProjectOverview from '../ProjectOverview';
import type { ProjectState } from '@/lib/services/state-types';

afterEach(() => {
  cleanup();
});

function makeState(overrides?: Partial<ProjectState>): ProjectState {
  return {
    projectId: 'proj-abc-123',
    kitConfigs: [
      { kitId: 'pik', kitPath: '/kits/pik' },
      { kitId: 'eek', kitPath: '/kits/eek' },
    ],
    llmConfigs: [
      { providerId: 'anthropic', model: 'claude-3', apiKeyEnvVar: 'API_KEY' },
    ],
    artifacts: [],
    llmUsage: [],
    ...overrides,
  };
}

describe('ProjectOverview', () => {
  it('renders the project ID', () => {
    render(<ProjectOverview state={makeState()} />);

    expect(screen.getByText(/proj-abc-123/)).toBeInTheDocument();
  });

  it('shows kit configs with links to flow pages', () => {
    render(<ProjectOverview state={makeState()} />);

    const pikLink = screen.getByRole('link', { name: 'pik' });
    expect(pikLink).toHaveAttribute('href', '/flow/pik');

    const eekLink = screen.getByRole('link', { name: 'eek' });
    expect(eekLink).toHaveAttribute('href', '/flow/eek');
  });

  it('shows LLM configurations', () => {
    render(<ProjectOverview state={makeState()} />);

    expect(screen.getByText(/anthropic/)).toBeInTheDocument();
    expect(screen.getByText(/claude-3/)).toBeInTheDocument();
    expect(screen.getByText(/API_KEY/)).toBeInTheDocument();
  });

  it('shows message when no kits are configured', () => {
    render(<ProjectOverview state={makeState({ kitConfigs: [] })} />);

    expect(screen.getByText('No kits configured.')).toBeInTheDocument();
  });
});
