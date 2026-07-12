import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import {
  HarnessFreezeService,
  HarnessFreezeError,
  hashArtifact,
  type CommandRunner,
} from '../harness-freeze-service.js';

const CONTENT = '# PRD\n\n| Status | FREEZE_PENDING |\n';

function okRunner(capture: { file?: string; args?: string[]; decision?: unknown }): CommandRunner {
  return async (file, args) => {
    capture.file = file;
    capture.args = args;
    const dPath = args[args.indexOf('--decision') + 1];
    capture.decision = JSON.parse(fs.readFileSync(dPath, 'utf-8'));
    return {
      stdout: JSON.stringify({
        status: 'frozen',
        artifact_id: 'PRD-DEMO-001',
        path: '/i/docs/sdlc/prd.md',
        frozen_count: 3,
        decided_by: 'Todd',
      }),
      stderr: '',
      code: 0,
    };
  };
}

describe('HarnessFreezeService', () => {
  it('freezes through the harness CLI and returns the result', async () => {
    const cap: { file?: string; args?: string[]; decision?: Record<string, unknown> } = {};
    const svc = new HarnessFreezeService(['harness'], { runner: okRunner(cap) });
    const res = await svc.freeze('/i', {
      artifactId: 'PRD-DEMO-001',
      outcome: 'APPROVE',
      shownContent: CONTENT,
      decidedBy: 'Todd',
    });
    expect(res.status).toBe('frozen');
    expect(res.frozenCount).toBe(3);
  });

  it('invokes an argv array (no shell) with the freeze subcommand', async () => {
    const cap: { file?: string; args?: string[]; decision?: Record<string, unknown> } = {};
    const svc = new HarnessFreezeService(['python', '-m', 'src.cli'], { runner: okRunner(cap) });
    await svc.freeze('/i', {
      artifactId: 'PRD-DEMO-001', outcome: 'APPROVE', shownContent: CONTENT, decidedBy: 'Todd',
    });
    expect(cap.file).toBe('python');
    expect(cap.args?.slice(0, 4)).toEqual(['-m', 'src.cli', 'freeze', '--initiative']);
    expect(cap.args).toContain('--decided-by');
  });

  it('hashes the content SHOWN to the human (decision integrity)', async () => {
    const cap: { file?: string; args?: string[]; decision?: Record<string, unknown> } = {};
    const svc = new HarnessFreezeService(['harness'], { runner: okRunner(cap) });
    await svc.freeze('/i', {
      artifactId: 'A', outcome: 'APPROVE', shownContent: CONTENT, decidedBy: 'Todd',
    });
    expect(cap.decision?.content_hash).toBe(hashArtifact(CONTENT));
    expect(cap.decision?.content_hash).toHaveLength(64);
  });

  it('maps a structured harness error to HarnessFreezeError', async () => {
    const runner: CommandRunner = async () => ({
      stdout: '', stderr: JSON.stringify({ error: 'hash_mismatch', message: 'changed' }), code: 1,
    });
    const svc = new HarnessFreezeService(['harness'], { runner });
    await expect(
      svc.freeze('/i', { artifactId: 'A', outcome: 'APPROVE', shownContent: CONTENT, decidedBy: 'Todd' }),
    ).rejects.toMatchObject({ code: 'hash_mismatch' });
  });

  it('falls back to harness_failed on non-JSON stderr', async () => {
    const runner: CommandRunner = async () => ({ stdout: '', stderr: 'boom', code: 2 });
    const svc = new HarnessFreezeService(['harness'], { runner });
    await expect(
      svc.freeze('/i', { artifactId: 'A', outcome: 'APPROVE', shownContent: CONTENT, decidedBy: 'Todd' }),
    ).rejects.toBeInstanceOf(HarnessFreezeError);
  });

  it('cleans up the temp decision file', async () => {
    const seen: string[] = [];
    const runner: CommandRunner = async (_f, args) => {
      seen.push(args[args.indexOf('--decision') + 1]);
      return { stdout: JSON.stringify({ status: 'frozen', artifact_id: 'A', path: 'p', frozen_count: null, decided_by: 'T' }), stderr: '', code: 0 };
    };
    const svc = new HarnessFreezeService(['harness'], { runner });
    await svc.freeze('/i', { artifactId: 'A', outcome: 'APPROVE', shownContent: CONTENT, decidedBy: 'Todd' });
    expect(fs.existsSync(seen[0])).toBe(false);
  });

  it('rejects an empty harness command', () => {
    expect(() => new HarnessFreezeService([])).toThrow();
  });
});
