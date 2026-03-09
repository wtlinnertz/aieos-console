'use client';

import { useState } from 'react';
import { ArtifactViewer } from './ArtifactViewer';
import { ArtifactEditor } from './ArtifactEditor';

export interface ArtifactToggleProps {
  content: string;
  isFrozen?: boolean;
  onSave: (content: string) => void;
  saving?: boolean;
  needsRevalidation?: boolean;
}

export function ArtifactToggle({
  content,
  isFrozen,
  onSave,
  saving,
  needsRevalidation,
}: ArtifactToggleProps) {
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  return (
    <div data-testid="artifact-toggle">
      <div style={{ marginBottom: '8px' }}>
        <button
          data-testid="toggle-view"
          onClick={() => setMode('view')}
          disabled={mode === 'view'}
          style={{ marginRight: '4px' }}
        >
          View
        </button>
        {!isFrozen && (
          <button
            data-testid="toggle-edit"
            onClick={() => setMode('edit')}
            disabled={mode === 'edit'}
          >
            Edit
          </button>
        )}
      </div>
      {mode === 'view' || isFrozen ? (
        <ArtifactViewer content={content} isFrozen={isFrozen} />
      ) : (
        <ArtifactEditor
          content={content}
          onSave={onSave}
          saving={saving}
          needsRevalidation={needsRevalidation}
        />
      )}
    </div>
  );
}

export default ArtifactToggle;
