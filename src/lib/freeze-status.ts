/**
 * Canonical freeze-status vocabulary (FR-018), shared with
 * aieos-schema/schema/document-control.yaml and the harness ArtifactStatus enum.
 * Introduced here (Track C slice 3) where the console renders freeze + andon
 * state; the console's internal workflow enum is a separate, private concern.
 */
export type FreezeStatus =
  | 'DRAFT'
  | 'VALIDATED'
  | 'FREEZE_PENDING'
  | 'FROZEN'
  | 'HALTED'
  | 'FAULTED';

const ALL_FREEZE_STATUSES: readonly FreezeStatus[] = [
  'DRAFT',
  'VALIDATED',
  'FREEZE_PENDING',
  'FROZEN',
  'HALTED',
  'FAULTED',
];

/**
 * Narrow an unknown value (e.g. parsed from the harness CLI's stdout) to the
 * canonical vocabulary (G-14).
 *
 * The freeze seam used to carry a hardcoded lowercase 'frozen' on BOTH sides:
 * the harness printed the literal instead of its enum, and this service parsed
 * that field and discarded it, hardcoding its own copy. They agreed only
 * because both invented the same string -- so any status other than FROZEN
 * would still have been reported as FROZEN. Parse it; don't assume it.
 */
export function isFreezeStatus(value: unknown): value is FreezeStatus {
  return (
    typeof value === 'string' &&
    (ALL_FREEZE_STATUSES as readonly string[]).includes(value)
  );
}

/** Andon fault states (ADR-0004): the run stood down and needs a human. */
export function isFaultState(status: FreezeStatus): boolean {
  return status === 'HALTED' || status === 'FAULTED';
}

export function statusLabel(status: FreezeStatus): string {
  switch (status) {
    case 'DRAFT': return 'Draft';
    case 'VALIDATED': return 'Validated';
    case 'FREEZE_PENDING': return 'Awaiting freeze';
    case 'FROZEN': return 'Frozen';
    case 'HALTED': return 'Halted';
    case 'FAULTED': return 'Faulted';
  }
}

export function statusDescription(status: FreezeStatus): string {
  switch (status) {
    case 'DRAFT': return 'Generated but not yet validated.';
    case 'VALIDATED': return 'Passed validation; ready for a human freeze decision.';
    case 'FREEZE_PENDING': return 'Driven to the freeze gate by an autonomous run; awaiting a human decision.';
    case 'FROZEN': return 'Frozen. Locked unless a formal impact analysis reopens it.';
    case 'HALTED': return 'The run was halted (andon cord). Clean stop — resumable once the triggering condition clears.';
    case 'FAULTED': return 'The run faulted on a governance breach. It needs investigation and a recorded human clear before any resume.';
  }
}
