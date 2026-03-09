'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface GenerationStreamProps {
  kitId: string;
  stepId: string;
  onComplete?: () => void;
}

type StreamState = 'connecting' | 'streaming' | 'done' | 'error';

export function GenerationStream({ kitId, stepId, onComplete }: GenerationStreamProps) {
  const [content, setContent] = useState('');
  const [streamState, setStreamState] = useState<StreamState>('connecting');
  const [errorMessage, setErrorMessage] = useState('');
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    setContent('');
    setStreamState('connecting');
    setErrorMessage('');

    const url = `/api/flow/${kitId}/step/${stepId}/generate`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data as string) as {
        type: 'chunk' | 'done' | 'error';
        content?: string;
        error?: string;
      };

      if (data.type === 'chunk') {
        setStreamState('streaming');
        setContent((prev) => prev + (data.content ?? ''));
      } else if (data.type === 'done') {
        setStreamState('done');
        es.close();
        onComplete?.();
      } else if (data.type === 'error') {
        setStreamState('error');
        setErrorMessage(data.error ?? 'An unknown error occurred');
        es.close();
      }
    };

    es.onerror = () => {
      setStreamState('error');
      setErrorMessage('Connection lost');
      es.close();
    };
  }, [kitId, stepId, onComplete]);

  useEffect(() => {
    connect();

    return () => {
      eventSourceRef.current?.close();
    };
  }, [connect]);

  return (
    <div data-testid="generation-stream">
      {streamState === 'connecting' && (
        <p data-testid="stream-loading">Connecting to generation stream...</p>
      )}

      {(streamState === 'streaming' || streamState === 'done') && content && (
        <pre
          data-testid="stream-content"
          style={{
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            padding: '12px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            backgroundColor: '#f9fafb',
            maxHeight: '600px',
            overflow: 'auto',
          }}
        >
          {content}
        </pre>
      )}

      {streamState === 'done' && (
        <p data-testid="stream-complete" style={{ color: '#16a34a', fontWeight: 600 }}>
          Generation complete
        </p>
      )}

      {streamState === 'error' && (
        <div data-testid="stream-error">
          <p style={{ color: '#dc2626' }}>{errorMessage}</p>
          <button
            data-testid="stream-retry"
            onClick={connect}
            style={{
              padding: '4px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
