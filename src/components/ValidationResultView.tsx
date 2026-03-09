'use client';

import type { ValidationResult } from '@/lib/services/state-types';

export interface ValidationResultViewProps {
  result: ValidationResult;
}

export function ValidationResultView({ result }: ValidationResultViewProps) {
  const isPassing = result.status === 'PASS';

  return (
    <div data-testid="validation-result">
      <div
        data-testid="validation-status"
        style={{
          display: 'inline-block',
          padding: '4px 12px',
          borderRadius: '4px',
          fontWeight: 700,
          color: '#fff',
          backgroundColor: isPassing ? '#16a34a' : '#dc2626',
        }}
      >
        {result.status}
      </div>

      <p data-testid="validation-summary" style={{ margin: '12px 0' }}>
        {result.summary}
      </p>

      <div data-testid="completeness-score" style={{ margin: '12px 0' }}>
        <strong>Completeness:</strong> {result.completenessScore}/100
        <div
          style={{
            width: '200px',
            height: '8px',
            backgroundColor: '#e5e7eb',
            borderRadius: '4px',
            marginTop: '4px',
          }}
        >
          <div
            data-testid="completeness-bar"
            style={{
              width: `${result.completenessScore}%`,
              height: '100%',
              backgroundColor: result.completenessScore >= 80 ? '#16a34a' : '#d97706',
              borderRadius: '4px',
            }}
          />
        </div>
      </div>

      {Object.keys(result.hardGates).length > 0 && (
        <div data-testid="hard-gates-section" style={{ margin: '12px 0' }}>
          <h4>Hard Gates</h4>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #d1d5db' }}>Gate</th>
                <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #d1d5db' }}>Result</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(result.hardGates).map(([gate, gateResult]) => (
                <tr key={gate} data-testid={`gate-row-${gate}`}>
                  <td style={{ padding: '4px 8px', borderBottom: '1px solid #e5e7eb' }}>{gate}</td>
                  <td style={{ padding: '4px 8px', borderBottom: '1px solid #e5e7eb' }}>
                    <span
                      style={{
                        color: gateResult === 'PASS' ? '#16a34a' : '#dc2626',
                        fontWeight: 600,
                      }}
                    >
                      {gateResult}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result.blockingIssues.length > 0 && (
        <div data-testid="blocking-issues-section" style={{ margin: '12px 0' }}>
          <h4>Blocking Issues</h4>
          <ul>
            {result.blockingIssues.map((issue, i) => (
              <li key={i} data-testid={`blocking-issue-${i}`}>
                <strong>[{issue.gate}]</strong> {issue.description}
                {issue.location && (
                  <span style={{ color: '#6b7280', marginLeft: '8px' }}>
                    ({issue.location})
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.warnings.length > 0 && (
        <div data-testid="warnings-section" style={{ margin: '12px 0' }}>
          <h4>Warnings</h4>
          <ul>
            {result.warnings.map((warning, i) => (
              <li key={i} data-testid={`warning-${i}`}>
                {warning.description}
                {warning.location && (
                  <span style={{ color: '#6b7280', marginLeft: '8px' }}>
                    ({warning.location})
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
