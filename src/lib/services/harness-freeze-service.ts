import { execFile } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { isFreezeStatus, type FreezeStatus } from '@/lib/freeze-status';
import { logError } from '@/lib/logger';

/**
 * HarnessFreezeService — the console's freeze seam (ADR-0003).
 *
 * FR-020 makes the console a thin front-end that FREEZES THROUGH THE HARNESS
 * rather than writing freeze status in its own shape. This service assembles a
 * FreezeGateDecision and shells out to the harness `freeze` subcommand — the
 * single authority that writes FROZEN (ADR-0002). The console never writes
 * FROZEN itself, which is what closes the FR-018 freeze-format divergence.
 *
 * Two ADR-0003 hazards handled here:
 *  - Argument injection: the harness is invoked with an explicit argv array via
 *    execFile (never a shell string), so user-influenced values are never
 *    interpreted by a shell.
 *  - Decision integrity: the content hash is computed over the artifact the
 *    human was SHOWN (passed in), not re-read at call time, so a freeze against
 *    an artifact that changed under the human is rejected by the harness.
 */

export type FreezeOutcome =
  | 'APPROVE'
  | 'APPROVE_WITH_CONDITIONS'
  | 'BLOCK'
  | 'REMEDIATE_AND_RETRY'
  | 'REQUIRE_REDESIGN';

export interface FreezeRequest {
  artifactId: string;
  outcome: FreezeOutcome;
  /** The exact artifact content shown to the human (hashed for integrity). */
  shownContent: string;
  decidedBy: string;
  conditions?: string[];
  rationale?: string;
}

export interface FreezeSuccess {
  /**
   * The canonical FR-018 status the harness actually reported (G-14). This was
   * the literal type 'frozen' -- lowercase, hardcoded, and never derived from
   * the harness's answer.
   */
  status: FreezeStatus;
  artifactId: string;
  path: string;
  frozenCount: number | null;
  decidedBy: string;
}

export class HarnessFreezeError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'HarnessFreezeError';
    this.code = code;
  }
}

export interface RunnerResult {
  stdout: string;
  stderr: string;
  code: number;
}
export type CommandRunner = (
  file: string,
  args: string[],
  cwd?: string,
) => Promise<RunnerResult>;

const defaultRunner: CommandRunner = (file, args, cwd) =>
  new Promise((resolve) => {
    execFile(file, args, { cwd }, (err, stdout, stderr) => {
      const code = err && typeof err.code === 'number' ? err.code : err ? 1 : 0;
      resolve({ stdout: stdout ?? '', stderr: stderr ?? '', code });
    });
  });

/**
 * SHA-256 over UTF-8, LF-normalized text — the artifact identity a freeze
 * decision pins. Line endings are folded to LF (\r\n and lone \r become \n)
 * before hashing so the digest names the text the human saw, not the platform's
 * byte encoding of it (G-19): the harness hashes `read_text()` output, where
 * Python's universal newlines have already folded CRLF, so hashing raw content
 * here made every freeze of a CRLF-stored artifact fail `hash_mismatch`. Must
 * stay in lockstep with the harness's `hash_artifact_content` (src/freeze.py);
 * the convention is recorded in aieos-schema document-control.yaml `maps_to`.
 */
export function hashArtifact(content: string): string {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return crypto.createHash('sha256').update(normalized, 'utf-8').digest('hex');
}

export class HarnessFreezeService {
  private readonly file: string;
  private readonly baseArgs: string[];
  private readonly cwd?: string;
  private readonly runner: CommandRunner;

  /** harnessCmd e.g. ["harness"] or ["python", "-m", "src.cli"]. */
  constructor(
    harnessCmd: string[],
    opts?: { cwd?: string; runner?: CommandRunner },
  ) {
    if (harnessCmd.length === 0) {
      throw new Error('harnessCmd must not be empty');
    }
    this.file = harnessCmd[0];
    this.baseArgs = harnessCmd.slice(1);
    this.cwd = opts?.cwd;
    this.runner = opts?.runner ?? defaultRunner;
  }

  async freeze(
    initiativeDir: string,
    request: FreezeRequest,
  ): Promise<FreezeSuccess> {
    const decision = {
      artifact_id: request.artifactId,
      outcome: request.outcome,
      content_hash: hashArtifact(request.shownContent),
      decided_by: request.decidedBy,
      conditions: request.conditions ?? [],
      rationale: request.rationale ?? '',
    };

    const decisionPath = path.join(
      os.tmpdir(),
      `aieos-freeze-${crypto.randomBytes(8).toString('hex')}.json`,
    );
    await fs.writeFile(decisionPath, JSON.stringify(decision), 'utf-8');

    try {
      const args = [
        ...this.baseArgs,
        'freeze',
        '--initiative', initiativeDir,
        '--artifact', request.artifactId,
        '--decision', decisionPath,
        '--decided-by', request.decidedBy,
      ];
      const { stdout, stderr, code } = await this.runner(this.file, args, this.cwd);

      if (code !== 0) {
        let err: { error?: string; message?: string } = {};
        try {
          err = JSON.parse(stderr || '{}');
        } catch {
          err = { error: 'harness_failed', message: (stderr || '').trim() };
        }
        const harnessCode = err.error ?? 'harness_failed';
        const harnessMessage = err.message ?? `harness freeze exited ${code}`;
        // G-22 fix (3): this seam used to fail in total silence — the console
        // returned a generic 500 and the terminal printed nothing, so the
        // structured code the harness had gone to the trouble of emitting was
        // lost at exactly the moment it was needed.
        logError('harness_freeze_failed', {
          code: harnessCode,
          exitCode: code,
          message: harnessMessage,
          artifactId: request.artifactId,
          initiativeDir,
        });
        throw new HarnessFreezeError(harnessCode, harnessMessage);
      }

      let parsed: {
        status: string;
        artifact_id: string;
        path: string;
        frozen_count: number | null;
        decided_by: string;
      };
      try {
        parsed = JSON.parse(stdout) as typeof parsed;
      } catch {
        // Unguarded JSON.parse used to throw a bare SyntaxError with no trace
        // and no harness context — indistinguishable, from the outside, from
        // any other internal fault. Any stray line on stdout lands here.
        logError('harness_freeze_unparseable', {
          artifactId: request.artifactId,
          exitCode: code,
          stdoutPreview: stdout.slice(0, 200),
          stderrPreview: stderr.slice(0, 200),
        });
        throw new HarnessFreezeError(
          'unparseable_output',
          `harness freeze returned unparseable stdout for "${request.artifactId}"`,
        );
      }
      // G-14: consume what the harness reported, in the canonical vocabulary.
      // Reject anything outside it rather than coercing -- a status we don't
      // recognise means the seam has drifted, and silently rewriting it to
      // 'frozen' is precisely how this went unnoticed.
      if (!isFreezeStatus(parsed.status)) {
        throw new HarnessFreezeError(
          'bad_status',
          `harness returned unknown freeze status ${JSON.stringify(parsed.status)}`,
        );
      }
      return {
        status: parsed.status,
        artifactId: parsed.artifact_id,
        path: parsed.path,
        frozenCount: parsed.frozen_count,
        decidedBy: parsed.decided_by,
      };
    } finally {
      await fs.rm(decisionPath, { force: true });
    }
  }
}
