import { isFreezeStatus, type FreezeStatus } from '../freeze-status.js';

/**
 * N1 (FR-023): the canonical Document Control reader. FR-018 rules that the
 * artifact's `## Document Control` block is the single on-disk source of
 * freeze truth for every driver, and that any sidecar (the console's
 * `.aieos/state.json`) is a derived cache rebuilt by scanning these blocks.
 * This parser is the console's scan side — the same first-match label
 * regexes as the harness's `read_frozen_artifacts`, so a write by any driver
 * round-trips into what the console sees.
 */
export interface DocumentControlBlock {
  artifactId: string;
  /** Canonical FR-018 token (normalized), or null if the value is not canonical. */
  status: FreezeStatus | null;
  /** The raw on-disk Status cell, for surfacing non-canonical values. */
  rawStatus: string;
  lastValidation: 'PASS' | 'FAIL' | null;
}

const ARTIFACT_ID_RE = /\|\s*Artifact\s+ID\s*\|\s*(.*?)\s*\|/i;
const STATUS_RE = /\|\s*Status\s*\|\s*(.*?)\s*\|/i;
const LAST_VALIDATION_RE = /\|\s*Last\s+Validation\s*\|\s*(.*?)\s*\|/i;

/**
 * Parse the Document Control block from artifact text. Returns null when the
 * text carries no `| Artifact ID |` row (the same in-scope test the
 * validator and the harness readers use).
 */
export function parseDocumentControl(text: string): DocumentControlBlock | null {
  const idMatch = ARTIFACT_ID_RE.exec(text);
  if (!idMatch) {
    return null;
  }
  const statusMatch = STATUS_RE.exec(text);
  const rawStatus = statusMatch?.[1]?.trim() ?? '';
  const normalized = rawStatus.toUpperCase().replace(/\s+/g, '_');
  const status: FreezeStatus | null = isFreezeStatus(normalized)
    ? normalized
    : null;

  const lvMatch = LAST_VALIDATION_RE.exec(text);
  const lvRaw = lvMatch?.[1]?.trim().toUpperCase() ?? '';
  const lastValidation = lvRaw === 'PASS' || lvRaw === 'FAIL' ? lvRaw : null;

  return {
    artifactId: idMatch[1].trim(),
    status,
    rawStatus,
    lastValidation,
  };
}
