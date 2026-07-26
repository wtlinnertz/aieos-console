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
        status: 'FROZEN',
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

describe('HarnessFreezeService canonical status (G-14)', () => {
  const req = {
    artifactId: 'PRD-DEMO-001',
    outcome: 'APPROVE' as const,
    shownContent: CONTENT,
    decidedBy: 'Todd',
  };

  function statusRunner(status: unknown): CommandRunner {
    return async () => ({
      stdout: JSON.stringify({
        status,
        artifact_id: 'PRD-DEMO-001',
        path: '/i/docs/sdlc/prd.md',
        frozen_count: 3,
        decided_by: 'Todd',
      }),
      stderr: '',
      code: 0,
    });
  }

  it('reports what the harness actually said, not a hardcoded literal', async () => {
    // Both sides used to hardcode 'frozen': the harness printed the literal
    // instead of its enum, and this service parsed that field and threw it
    // away. They agreed only because they invented the same string.
    const svc = new HarnessFreezeService(['harness'], { runner: statusRunner('FROZEN') });
    expect((await svc.freeze('/i', req)).status).toBe('FROZEN');
  });

  it('rejects the OLD lowercase literal rather than silently accepting it', async () => {
    const svc = new HarnessFreezeService(['harness'], { runner: statusRunner('frozen') });
    await expect(svc.freeze('/i', req)).rejects.toThrow(HarnessFreezeError);
  });

  it('rejects an unknown status instead of coercing it to frozen', async () => {
    const svc = new HarnessFreezeService(['harness'], { runner: statusRunner('BANANA') });
    await expect(svc.freeze('/i', req)).rejects.toThrow(/unknown freeze status/);
  });

  it('surfaces a non-FROZEN canonical status instead of claiming FROZEN', async () => {
    // The old code returned 'frozen' unconditionally, so ANY outcome would have
    // been reported to the UI as a successful freeze.
    const svc = new HarnessFreezeService(['harness'], { runner: statusRunner('FREEZE_PENDING') });
    expect((await svc.freeze('/i', req)).status).toBe('FREEZE_PENDING');
  });
});

describe('hashArtifact LF normalization (G-19)', () => {
  // The cross-language hash contract: the same literal digest is pinned in the
  // harness suite (tests/test_freeze.py). If one of these assertions has to
  // change, the console and the harness no longer agree on artifact identity —
  // update both or neither.
  const G19_FIXTURE_LF =
    '# SAD\n\n| Artifact ID | SAD-TEST-001 |\n| Status | FREEZE_PENDING |\n';
  const G19_FIXTURE_CRLF = G19_FIXTURE_LF.replace(/\n/g, '\r\n');
  const G19_FIXTURE_DIGEST =
    'fce70731c15162436e1d5c70294e025229fa74726bac0332e8a9f70e03437b6f';

  it('hashes CRLF and LF spellings of the same text identically', () => {
    // Windows-written artifacts are CRLF on disk; the harness hashes
    // read_text() output where CRLF is already folded to LF. Hashing raw
    // content here made every console freeze of one fail hash_mismatch.
    expect(hashArtifact('a\r\nb\r\n')).toBe(hashArtifact('a\nb\n'));
  });

  it('normalizes a lone CR to LF (matching Python universal newlines)', () => {
    expect(hashArtifact('a\rb')).toBe(hashArtifact('a\nb'));
  });

  it('produces the digest pinned in the harness suite (cross-language contract)', () => {
    expect(hashArtifact(G19_FIXTURE_LF)).toBe(G19_FIXTURE_DIGEST);
    expect(hashArtifact(G19_FIXTURE_CRLF)).toBe(G19_FIXTURE_DIGEST);
  });

  it('sends the harness an LF-normalized hash for CRLF shownContent', async () => {
    const cap: { file?: string; args?: string[]; decision?: Record<string, unknown> } = {};
    const svc = new HarnessFreezeService(['harness'], { runner: okRunner(cap) });
    await svc.freeze('/i', {
      artifactId: 'SAD-TEST-001',
      outcome: 'APPROVE',
      shownContent: G19_FIXTURE_CRLF,
      decidedBy: 'Todd',
    });
    expect(cap.decision?.content_hash).toBe(G19_FIXTURE_DIGEST);
  });
});

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
    expect(res.status).toBe('FROZEN');
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
      return { stdout: JSON.stringify({ status: 'FROZEN', artifact_id: 'A', path: 'p', frozen_count: null, decided_by: 'T' }), stderr: '', code: 0 };
    };
    const svc = new HarnessFreezeService(['harness'], { runner });
    await svc.freeze('/i', { artifactId: 'A', outcome: 'APPROVE', shownContent: CONTENT, decidedBy: 'Todd' });
    expect(fs.existsSync(seen[0])).toBe(false);
  });

  it('rejects an empty harness command', () => {
    expect(() => new HarnessFreezeService([])).toThrow();
  });
});


// Integration: the e2e fake harness fixture must honor the ADR-0003 contract,
// so the console's freeze-through-harness path works in e2e/CI (real subprocess).
import * as path from 'node:path';

describe('HarnessFreezeService <-> e2e fake harness (real subprocess)', () => {
  it('freezes successfully against e2e/fixtures/fake-harness.mjs', async () => {
    const fake = path.resolve('e2e/fixtures/fake-harness.mjs');
    const svc = new HarnessFreezeService(['node', fake]);
    const res = await svc.freeze('/tmp/e2e-init', {
      artifactId: 'PRD-E2E-001',
      outcome: 'APPROVE',
      shownContent: CONTENT,
      decidedBy: 'console-user',
    });
    expect(res.status).toBe('FROZEN');
    expect(res.artifactId).toBe('PRD-E2E-001');
    expect(res.decidedBy).toBe('console-user');
  });
});
