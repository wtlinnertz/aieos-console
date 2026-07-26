'use client';

import { useState } from 'react';
import type { FlowStep } from '@/lib/services/flow-types';
import type { ArtifactState } from '@/lib/services/state-types';
import { GenerationStream } from './GenerationStream';
import { ValidationResultView } from './ValidationResultView';
import { ProcessTransparency } from './ProcessTransparency';

export interface StepViewProps {
  step: FlowStep;
  state: ArtifactState;
  kitId: string;
  /** FR-023 D2/A3: machine-readable reason this step cannot be driven. */
  blockedReason?: string | null;
}

const BLOCKED_REASON_TEXT: Record<string, string> = {
  ENTRY_INPUTS_UNSUPPORTED:
    'Human-authored entry gate — provide the artifact on disk; autonomous ' +
    'drive lands with manifest inputs:.',
  PRINCIPLES_INPUTS_UNSUPPORTED:
    'This artifact requires principles inputs the manifest cannot express ' +
    'yet — generation is disabled until manifest inputs: lands.',
};

export function StepView({ step, state, kitId, blockedReason }: StepViewProps) {
  const [showStream, setShowStream] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isFreezing, setIsFreezing] = useState(false);
  const [artifactIdInput, setArtifactIdInput] = useState('');
  const [localState, setLocalState] = useState(state);
  const [error, setError] = useState('');

  const handleGenerate = () => {
    setShowStream(true);
  };

  const handleGenerationComplete = () => {
    // After generation completes, refresh state would happen via parent
    // For now the stream shows completion state
  };

  const handleValidate = async () => {
    setIsValidating(true);
    setError('');
    try {
      const response = await fetch(`/api/flow/${kitId}/step/${step.id}/validate`, {
        method: 'POST',
      });
      if (!response.ok) {
        const body = await response.json() as { error?: string };
        throw new Error(body.error ?? 'Validation failed');
      }
      const result = await response.json() as ArtifactState;
      setLocalState(result);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Validation failed';
      setError(message);
    } finally {
      setIsValidating(false);
    }
  };

  const handleFreeze = async () => {
    if (!artifactIdInput.trim()) return;
    setIsFreezing(true);
    setError('');
    try {
      const response = await fetch(`/api/flow/${kitId}/step/${step.id}/freeze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artifactId: artifactIdInput.trim() }),
      });
      if (!response.ok) {
        const body = await response.json() as { error?: string };
        throw new Error(body.error ?? 'Freeze failed');
      }
      setLocalState((prev) => ({
        ...prev,
        status: 'frozen',
        artifactId: artifactIdInput.trim(),
        frozenAt: new Date().toISOString(),
      }));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Freeze failed';
      setError(message);
    } finally {
      setIsFreezing(false);
    }
  };

  return (
    <div data-testid="step-view">
      <h2>{step.name}</h2>
      <p data-testid="step-type">Type: {step.stepType}</p>
      <p data-testid="step-status">Status: {localState.status}</p>

      {localState.status === 'frozen' && (
        <div
          data-testid="frozen-badge"
          style={{
            display: 'inline-block',
            padding: '4px 12px',
            borderRadius: '4px',
            fontWeight: 700,
            color: '#fff',
            backgroundColor: '#7c3aed',
            marginBottom: '12px',
          }}
        >
          Frozen
        </div>
      )}

      {error && (
        <p data-testid="step-error" style={{ color: '#dc2626' }}>
          {error}
        </p>
      )}

      {blockedReason && (
        <div
          data-testid="blocked-reason"
          data-reason-code={blockedReason}
          style={{
            padding: '8px 12px',
            borderRadius: '4px',
            backgroundColor: '#fef3c7',
            color: '#92400e',
            marginBottom: '12px',
          }}
        >
          {BLOCKED_REASON_TEXT[blockedReason] ?? blockedReason}
        </div>
      )}

      {(step.upstreamPreconditions?.length ?? 0) > 0 && (
        <div data-testid="upstream-preconditions" style={{ marginBottom: '12px' }}>
          <p style={{ fontWeight: 600, marginBottom: '4px' }}>
            Upstream preconditions (must be FROZEN):
          </p>
          <ul>
            {step.upstreamPreconditions?.map((ref) => (
              <li key={ref} data-testid={`precondition-${ref}`}>
                {ref}
              </li>
            ))}
          </ul>
        </div>
      )}

      {step.stepType === 'llm-generated' && (
        <div data-testid="llm-generated-view">
          {localState.status === 'in-progress' && !showStream && (
            <button data-testid="generate-button" onClick={handleGenerate}>
              Generate
            </button>
          )}

          {showStream && (
            <GenerationStream
              kitId={kitId}
              stepId={step.id}
              onComplete={handleGenerationComplete}
            />
          )}

          {localState.status === 'draft' && (
            <button
              data-testid="validate-button"
              onClick={handleValidate}
              disabled={isValidating}
            >
              {isValidating ? 'Validating...' : 'Validate'}
            </button>
          )}
        </div>
      )}

      {step.stepType === 'human-intake' && (
        <div data-testid="human-intake-view">
          <p>Use Intake Form</p>
        </div>
      )}

      {step.stepType === 'acceptance-check' && (
        <div data-testid="acceptance-check-view">
          <p>Source artifact to review:</p>
          {localState.artifactPath && (
            <p data-testid="source-artifact-path">{localState.artifactPath}</p>
          )}
          {(localState.status === 'draft' || localState.status === 'in-progress') && (
            <button
              data-testid="validate-button"
              onClick={handleValidate}
              disabled={isValidating}
            >
              {isValidating ? 'Validating...' : 'Validate'}
            </button>
          )}
        </div>
      )}

      {step.stepType === 'consistency-check' && (
        <div data-testid="consistency-check-view">
          <p>Comparison view placeholder</p>
        </div>
      )}

      {localState.validationResult && (
        <ValidationResultView result={localState.validationResult} />
      )}

      {localState.status === 'validated-pass' && (
        <div data-testid="freeze-section" style={{ marginTop: '16px' }}>
          <label htmlFor="artifact-id-input" style={{ display: 'block', marginBottom: '4px' }}>
            Artifact ID:
          </label>
          <input
            id="artifact-id-input"
            data-testid="artifact-id-input"
            type="text"
            value={artifactIdInput}
            onChange={(e) => setArtifactIdInput(e.target.value)}
            placeholder="e.g. PRD-TASKFLOW-001"
            style={{ marginRight: '8px', padding: '4px 8px' }}
          />
          <button
            data-testid="freeze-button"
            onClick={handleFreeze}
            disabled={isFreezing || !artifactIdInput.trim()}
          >
            {isFreezing ? 'Freezing...' : 'Freeze'}
          </button>
        </div>
      )}

      <ProcessTransparency step={step} />
    </div>
  );
}
