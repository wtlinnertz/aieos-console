'use client';

import {
  type FreezeStatus,
  isFaultState,
  statusDescription,
  statusLabel,
} from '@/lib/freeze-status';

export interface AndonStatusBannerProps {
  status: FreezeStatus;
  /** Human stand-up after a HALTED run (positive human signal, ADR-0004). */
  onResume?: () => void;
  /** Recorded human clear after a FAULTED run (governance breach). */
  onClearFault?: () => void;
}

/**
 * The console's andon surface (Track C slice 3, ADR-0004). Renders only for the
 * fault states HALTED/FAULTED — otherwise nothing. A resume/clear is a positive
 * human signal that routes through the Decision Register; it is NOT a freeze and
 * never writes FROZEN.
 */
export function AndonStatusBanner({
  status,
  onResume,
  onClearFault,
}: AndonStatusBannerProps) {
  if (!isFaultState(status)) {
    return null;
  }

  const isHalted = status === 'HALTED';
  const color = isHalted ? '#b45309' : '#b91c1c'; // amber-700 / red-700
  const bg = isHalted ? '#fffbeb' : '#fef2f2';

  return (
    <div
      data-testid="andon-banner"
      role="alert"
      style={{
        border: `1px solid ${color}`,
        backgroundColor: bg,
        borderRadius: '6px',
        padding: '12px 16px',
        margin: '12px 0',
      }}
    >
      <strong data-testid="andon-title" style={{ color }}>
        {statusLabel(status)}
      </strong>
      <p data-testid="andon-description" style={{ margin: '8px 0' }}>
        {statusDescription(status)}
      </p>
      {isHalted ? (
        <button data-testid="andon-resume" onClick={onResume}>
          Resume run
        </button>
      ) : (
        <button data-testid="andon-clear" onClick={onClearFault}>
          Record human clear
        </button>
      )}
      <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
        A resume/clear is recorded in the Decision Register — it is not a freeze.
      </p>
    </div>
  );
}
