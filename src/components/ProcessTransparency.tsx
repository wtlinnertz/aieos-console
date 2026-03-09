'use client';

import { useState } from 'react';
import type { FlowStep } from '@/lib/services/flow-types';

export interface ProcessTransparencyProps {
  step: FlowStep;
}

export function ProcessTransparency({ step }: ProcessTransparencyProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div data-testid="process-transparency" style={{ margin: '12px 0' }}>
      <button
        data-testid="transparency-toggle"
        onClick={() => setExpanded(!expanded)}
        style={{
          background: 'none',
          border: '1px solid #d1d5db',
          padding: '4px 12px',
          cursor: 'pointer',
          borderRadius: '4px',
        }}
      >
        {expanded ? 'Hide' : 'Show'} Process Details
      </button>

      {expanded && (
        <div data-testid="transparency-details" style={{ marginTop: '8px', padding: '8px', border: '1px solid #e5e7eb', borderRadius: '4px' }}>
          <h4 style={{ margin: '0 0 8px 0' }}>Four-File System</h4>
          <dl style={{ margin: 0 }}>
            <dt style={{ fontWeight: 600 }}>Spec</dt>
            <dd data-testid="path-spec" style={{ margin: '0 0 4px 16px' }}>{step.fourFiles.spec}</dd>

            <dt style={{ fontWeight: 600 }}>Template</dt>
            <dd data-testid="path-template" style={{ margin: '0 0 4px 16px' }}>{step.fourFiles.template}</dd>

            <dt style={{ fontWeight: 600 }}>Prompt</dt>
            <dd data-testid="path-prompt" style={{ margin: '0 0 4px 16px' }}>
              {step.fourFiles.prompt ?? 'N/A'}
            </dd>

            <dt style={{ fontWeight: 600 }}>Validator</dt>
            <dd data-testid="path-validator" style={{ margin: '0 0 4px 16px' }}>{step.fourFiles.validator}</dd>
          </dl>

          {step.requiredInputs.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <h4 style={{ margin: '0 0 8px 0' }}>Required Inputs</h4>
              <ul data-testid="required-inputs-list" style={{ margin: 0, paddingLeft: '20px' }}>
                {step.requiredInputs.map((input, i) => (
                  <li key={i} data-testid={`required-input-${i}`}>
                    <span>{input.path}</span>
                    <span style={{ color: '#6b7280', marginLeft: '8px' }}>({input.role})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
