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
