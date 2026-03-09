'use client';

import Link from 'next/link';
import type { FlowStatus } from '@/lib/services/orchestration-types';
import type { ArtifactStatus } from '@/lib/services/state-types';

export interface FlowStepperProps {
  flowStatus: FlowStatus;
  kitId: string;
}

const statusLabels: Record<ArtifactStatus, string> = {
  'not-started': 'Not Started',
  'in-progress': 'In Progress',
  draft: 'Draft',
  'validated-pass': 'Validated (Pass)',
  'validated-fail': 'Validated (Fail)',
  frozen: 'Frozen',
};

const statusColors: Record<ArtifactStatus, string> = {
  'not-started': '#6b7280',
  'in-progress': '#2563eb',
  draft: '#d97706',
  'validated-pass': '#16a34a',
  'validated-fail': '#dc2626',
  frozen: '#7c3aed',
};

function StatusBadge({ status }: { status: ArtifactStatus }) {
  return (
    <span
      data-testid={`status-badge-${status}`}
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: 600,
        color: '#fff',
        backgroundColor: statusColors[status],
      }}
    >
      {statusLabels[status]}
    </span>
  );
}

export function FlowStepper({ flowStatus, kitId }: FlowStepperProps) {
  const { steps, completedSteps, totalSteps } = flowStatus;

  if (steps.length === 0) {
    return <p data-testid="empty-steps">No steps defined for this flow.</p>;
  }

  return (
    <nav aria-label="Flow steps">
      <p data-testid="progress-count">
        {completedSteps} of {totalSteps} steps complete
      </p>
      <ol
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
        }}
      >
        {steps.map((stepStatus) => (
          <li
            key={stepStatus.step.id}
            data-testid={`step-item-${stepStatus.step.id}`}
            style={{
              padding: '12px 16px',
              marginBottom: '4px',
              borderLeft: stepStatus.isCurrentStep
                ? '4px solid #2563eb'
                : '4px solid transparent',
              backgroundColor: stepStatus.isCurrentStep
                ? '#eff6ff'
                : 'transparent',
            }}
          >
            <Link
              href={`/flow/${kitId}/step/${stepStatus.step.id}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontWeight: stepStatus.isCurrentStep ? 700 : 400 }}>
                  {stepStatus.step.name}
                </span>
                <StatusBadge status={stepStatus.state.status} />
                {!stepStatus.dependenciesMet && (
                  <span
                    data-testid={`deps-not-met-${stepStatus.step.id}`}
                    style={{
                      fontSize: '12px',
                      color: '#b91c1c',
                      fontStyle: 'italic',
                    }}
                  >
                    Dependencies not met
                  </span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
