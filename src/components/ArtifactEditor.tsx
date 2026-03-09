'use client';

import { useState } from 'react';

export interface ArtifactEditorProps {
  content: string;
  onSave: (content: string) => void;
  saving?: boolean;
  needsRevalidation?: boolean;
}

export function ArtifactEditor({
  content,
  onSave,
  saving,
  needsRevalidation,
}: ArtifactEditorProps) {
  const [editedContent, setEditedContent] = useState(content);

  const isDirty = editedContent !== content;

  return (
    <div data-testid="artifact-editor">
      {needsRevalidation && (
        <div
          data-testid="revalidation-indicator"
          style={{
            padding: '4px 8px',
            marginBottom: '8px',
            backgroundColor: '#fef3c7',
            color: '#92400e',
            fontSize: '13px',
            borderRadius: '4px',
          }}
        >
          Re-validation needed
        </div>
      )}
      <textarea
        data-testid="editor-textarea"
        value={editedContent}
        onChange={(e) => setEditedContent(e.target.value)}
        style={{
          width: '100%',
          minHeight: '300px',
          fontFamily: 'monospace',
          fontSize: '14px',
          padding: '8px',
          boxSizing: 'border-box',
        }}
      />
      <button
        data-testid="save-button"
        onClick={() => onSave(editedContent)}
        disabled={!isDirty || saving}
        style={{ marginTop: '8px' }}
      >
        {saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  );
}

export default ArtifactEditor;
