'use client';

import { useEffect, useState } from 'react';
import { sanitizeContent } from '@/lib/sanitize';

export interface ArtifactViewerProps {
  content: string;
  isFrozen?: boolean;
}

export function ArtifactViewer({ content, isFrozen }: ArtifactViewerProps) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    sanitizeContent(content).then((result) => {
      if (!cancelled) {
        setHtml(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [content]);

  if (html === null) {
    return <div data-testid="viewer-loading">Loading...</div>;
  }

  return (
    <div data-testid="artifact-viewer">
      {isFrozen && (
        <span
          data-testid="frozen-indicator"
          style={{
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: 600,
            color: '#fff',
            backgroundColor: '#7c3aed',
            marginBottom: '8px',
          }}
        >
          Frozen
        </span>
      )}
      <div
        data-testid="viewer-content"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

export default ArtifactViewer;
