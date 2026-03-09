import { render, screen, cleanup, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { GenerationStream } from '../GenerationStream';

class MockEventSource {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  close = vi.fn();
  url: string;

  constructor(url: string) {
    this.url = url;
  }

  simulateMessage(data: string) {
    this.onmessage?.(new MessageEvent('message', { data }));
  }

  simulateError() {
    this.onerror?.(new Event('error'));
  }
}

let mockEventSource: MockEventSource;

beforeEach(() => {
  vi.stubGlobal(
    'EventSource',
    vi.fn((url: string) => {
      mockEventSource = new MockEventSource(url);
      return mockEventSource;
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('GenerationStream', () => {
  it('shows loading state initially', () => {
    render(<GenerationStream kitId="pik" stepId="step-prd" />);

    expect(screen.getByTestId('stream-loading')).toHaveTextContent(
      'Connecting to generation stream...',
    );
  });

  it('renders content chunks progressively', () => {
    render(<GenerationStream kitId="pik" stepId="step-prd" />);

    act(() => {
      mockEventSource.simulateMessage(
        JSON.stringify({ type: 'chunk', content: 'Hello ' }),
      );
    });

    expect(screen.getByTestId('stream-content')).toHaveTextContent('Hello');

    act(() => {
      mockEventSource.simulateMessage(
        JSON.stringify({ type: 'chunk', content: 'World' }),
      );
    });

    expect(screen.getByTestId('stream-content')).toHaveTextContent('Hello World');
  });

  it('shows error message on error event', () => {
    render(<GenerationStream kitId="pik" stepId="step-prd" />);

    act(() => {
      mockEventSource.simulateMessage(
        JSON.stringify({ type: 'error', error: 'LLM rate limited' }),
      );
    });

    expect(screen.getByTestId('stream-error')).toBeInTheDocument();
    expect(screen.getByText('LLM rate limited')).toBeInTheDocument();
    expect(screen.getByTestId('stream-retry')).toBeInTheDocument();
  });

  it('shows completion state when done', () => {
    const onComplete = vi.fn();
    render(
      <GenerationStream kitId="pik" stepId="step-prd" onComplete={onComplete} />,
    );

    act(() => {
      mockEventSource.simulateMessage(
        JSON.stringify({ type: 'chunk', content: 'Content here' }),
      );
    });

    act(() => {
      mockEventSource.simulateMessage(JSON.stringify({ type: 'done' }));
    });

    expect(screen.getByTestId('stream-complete')).toHaveTextContent(
      'Generation complete',
    );
    expect(onComplete).toHaveBeenCalledOnce();
    expect(mockEventSource.close).toHaveBeenCalled();
  });

  it('shows error on EventSource connection error', () => {
    render(<GenerationStream kitId="pik" stepId="step-prd" />);

    act(() => {
      mockEventSource.simulateError();
    });

    expect(screen.getByTestId('stream-error')).toBeInTheDocument();
    expect(screen.getByText('Connection lost')).toBeInTheDocument();
  });
});
