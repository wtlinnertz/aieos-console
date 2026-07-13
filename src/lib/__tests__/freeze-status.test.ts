import { describe, it, expect } from 'vitest';
import {
  isFaultState,
  statusLabel,
  statusDescription,
  type FreezeStatus,
} from '../freeze-status';

describe('freeze-status', () => {
  it('flags only HALTED/FAULTED as fault states', () => {
    expect(isFaultState('HALTED')).toBe(true);
    expect(isFaultState('FAULTED')).toBe(true);
    for (const s of ['DRAFT', 'VALIDATED', 'FREEZE_PENDING', 'FROZEN'] as FreezeStatus[]) {
      expect(isFaultState(s)).toBe(false);
    }
  });

  it('has a label and description for every status', () => {
    for (const s of ['DRAFT', 'VALIDATED', 'FREEZE_PENDING', 'FROZEN', 'HALTED', 'FAULTED'] as FreezeStatus[]) {
      expect(statusLabel(s).length).toBeGreaterThan(0);
      expect(statusDescription(s).length).toBeGreaterThan(0);
    }
  });

  it('FAULTED description names the recorded-human-clear requirement', () => {
    expect(statusDescription('FAULTED').toLowerCase()).toContain('clear');
  });
});
