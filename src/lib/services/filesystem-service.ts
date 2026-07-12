import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import {
  PathViolationError,
  FileNotFoundError,
  PermissionError,
  ReadError,
  WriteError,
  DirectoryNotFoundError,
} from './errors.js';

export interface FileResult {
  content: string;
  encoding: 'utf-8';
}

export interface DirectoryEntry {
  name: string;
  type: 'file' | 'directory';
}

export type LockDriver = 'console' | 'dark-factory' | 'sherpa';

export const LOCK_VERSION = '1.0';
export const DEFAULT_LEASE_TTL_SECONDS = 300; // 5 min (FR-019 Q4)
export const DEFAULT_HEARTBEAT_SECONDS = 60; // 60 s (FR-019 Q4)

/**
 * The on-disk `.aieos/lock` record. Field names are snake_case because this is
 * the SAME wire format the Python harness (src/lock.py) reads and writes —
 * FR-019's whole point is one lock all drivers honor. See
 * aieos-schema/schema/lock.yaml.
 */
export interface LockInfo {
  lock_version: string;
  initiative: string;
  owner: string;
  driver: LockDriver;
  session_id: string;
  hostname: string;
  pid: number;
  acquired_at: string;
  renewed_at: string;
  lease_ttl_seconds: number;
  heartbeat_interval_seconds: number;
}

export interface LockResult {
  acquired: boolean;
  tookOver: boolean;
  info?: LockInfo;
  previous?: LockInfo;
}

export interface AcquireLockOptions {
  owner: string;
  driver: LockDriver;
  sessionId?: string;
  initiative?: string;
  leaseTtlSeconds?: number;
  heartbeatIntervalSeconds?: number;
  // Dependency-injection seams (also used by tests):
  now?: Date;
  hostname?: string;
  pid?: number;
  pidIsAlive?: (pid: number) => boolean;
}

const VALID_DRIVERS: readonly LockDriver[] = ['console', 'dark-factory', 'sherpa'];

export interface IFilesystemService {
  readFile(filePath: string): Promise<FileResult>;
  writeFileAtomic(filePath: string, content: string): Promise<void>;
  readDirectory(dirPath: string): Promise<DirectoryEntry[]>;
  exists(targetPath: string): Promise<boolean>;
  createDirectory(dirPath: string): Promise<void>;
  readLock(projectDir: string): Promise<LockInfo | null>;
  acquireLock(projectDir: string, options: AcquireLockOptions): Promise<LockResult>;
  renewLock(projectDir: string, sessionId: string, now?: Date): Promise<boolean>;
  releaseLock(projectDir: string, sessionId: string): Promise<boolean>;
}

interface FilesystemServiceConfig {
  projectDir: string;
  kitDirs: string[];
}

export class FilesystemService implements IFilesystemService {
  private readonly boundaries: string[];

  constructor(config: FilesystemServiceConfig) {
    this.boundaries = [
      path.resolve(config.projectDir),
      ...config.kitDirs.map((d) => path.resolve(d)),
    ];
  }

  private async validatePath(targetPath: string): Promise<string> {
    const resolved = path.resolve(targetPath);

    if (!this.isWithinBoundaries(resolved)) {
      throw new PathViolationError(
        'Path is outside configured boundaries',
        targetPath,
      );
    }

    let realPath: string;
    try {
      realPath = await fs.realpath(resolved);
    } catch {
      const parentDir = path.dirname(resolved);
      try {
        const realParent = await fs.realpath(parentDir);
        if (!this.isWithinBoundaries(realParent)) {
          throw new PathViolationError(
            'Resolved path is outside configured boundaries',
            targetPath,
          );
        }
        return resolved;
      } catch (parentErr) {
        if (parentErr instanceof PathViolationError) {
          throw parentErr;
        }
        return resolved;
      }
    }

    if (!this.isWithinBoundaries(realPath)) {
      throw new PathViolationError(
        'Resolved path is outside configured boundaries',
        targetPath,
      );
    }

    return realPath;
  }

  private isWithinBoundaries(absPath: string): boolean {
    return this.boundaries.some(
      (boundary) =>
        absPath === boundary || absPath.startsWith(boundary + path.sep),
    );
  }

  async readFile(filePath: string): Promise<FileResult> {
    const validated = await this.validatePath(filePath);

    try {
      const content = await fs.readFile(validated, 'utf-8');
      return { content, encoding: 'utf-8' };
    } catch (err: unknown) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code === 'ENOENT') {
        throw new FileNotFoundError(`File not found: ${filePath}`);
      }
      if (nodeErr.code === 'EACCES' || nodeErr.code === 'EPERM') {
        throw new PermissionError(`Permission denied: ${filePath}`);
      }
      throw new ReadError(`Failed to read file: ${filePath}`);
    }
  }

  async writeFileAtomic(filePath: string, content: string): Promise<void> {
    const validated = await this.validatePath(filePath);
    const dir = path.dirname(validated);
    const suffix = crypto.randomBytes(8).toString('hex');
    const tempPath = path.join(dir, `.tmp-${suffix}`);

    try {
      await fs.writeFile(tempPath, content, 'utf-8');
      await fs.rename(tempPath, validated);
    } catch (err: unknown) {
      try {
        await fs.unlink(tempPath);
      } catch {
        // Temp file may not exist if writeFile failed
      }
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code === 'EACCES' || nodeErr.code === 'EPERM') {
        throw new PermissionError(`Permission denied: ${filePath}`);
      }
      throw new WriteError(`Failed to write file: ${filePath}`);
    }
  }

  async createDirectory(dirPath: string): Promise<void> {
    const validated = await this.validatePath(dirPath);
    await fs.mkdir(validated, { recursive: true });
  }

  async readDirectory(dirPath: string): Promise<DirectoryEntry[]> {
    const validated = await this.validatePath(dirPath);

    try {
      const entries = await fs.readdir(validated, { withFileTypes: true });
      return entries.map((entry) => ({
        name: entry.name,
        type: entry.isDirectory() ? 'directory' as const : 'file' as const,
      }));
    } catch (err: unknown) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code === 'ENOENT') {
        throw new DirectoryNotFoundError(`Directory not found: ${dirPath}`);
      }
      if (nodeErr.code === 'EACCES' || nodeErr.code === 'EPERM') {
        throw new PermissionError(`Permission denied: ${dirPath}`);
      }
      throw new ReadError(`Failed to read directory: ${dirPath}`);
    }
  }

  async exists(targetPath: string): Promise<boolean> {
    const validated = await this.validatePath(targetPath);

    try {
      await fs.access(validated);
      return true;
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Cross-driver initiative lock (FR-019)
  //
  // A rewrite of the original .aieos/lock, not an extension (ADR-0002
  // amendment). Hostname-aware liveness + a heartbeat lease, so a crashed
  // unattended run frees itself within lease_ttl_seconds instead of wedging the
  // initiative, and a lock from another host is never judged by a local PID.
  // session_id is the ownership token. Byte-compatible with the Python harness
  // (src/lock.py) and aieos-schema/schema/lock.yaml.
  // ---------------------------------------------------------------------------

  private lockFilePath(projectDir: string): string {
    return path.join(projectDir, '.aieos', 'lock');
  }

  private haltFilePath(projectDir: string): string {
    return path.join(projectDir, '.aieos', 'halt');
  }

  /** ISO 8601 UTC with no fractional seconds — matches the Python writer. */
  private nowIso(now?: Date): string {
    return (now ?? new Date()).toISOString().replace(/\.\d{3}Z$/, 'Z');
  }

  /** Whether a process exists on THIS host. Advisory, hostname-scoped only. */
  private pidAlive(pid: number): boolean {
    if (pid <= 0) return false;
    try {
      process.kill(pid, 0);
      return true;
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      // EPERM: the process exists but is owned by another user — still alive.
      return e.code === 'EPERM';
    }
  }

  async readLock(projectDir: string): Promise<LockInfo | null> {
    const lockPath = this.lockFilePath(projectDir);
    try {
      const content = await fs.readFile(lockPath, 'utf-8');
      return JSON.parse(content) as LockInfo;
    } catch (err: unknown) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code === 'ENOENT') return null;
      throw new WriteError(`Failed to read lock file: ${lockPath}`);
    }
  }

  private isTakeable(
    info: LockInfo,
    now: Date,
    thisHost: string,
    pidAlive: (pid: number) => boolean,
  ): boolean {
    const ageSec = (now.getTime() - Date.parse(info.renewed_at)) / 1000;
    if (ageSec > info.lease_ttl_seconds) return true;
    if (info.hostname === thisHost && !pidAlive(info.pid)) return true;
    return false;
  }

  private async writeHaltSentinel(
    projectDir: string,
    previous: LockInfo,
    taker: LockInfo,
    atIso: string,
  ): Promise<void> {
    const payload = {
      reason: 'stale_lock_takeover',
      at: atIso,
      taken_from: {
        owner: previous.owner,
        driver: previous.driver,
        session_id: previous.session_id,
        hostname: previous.hostname,
        pid: previous.pid,
      },
      taken_by: {
        owner: taker.owner,
        driver: taker.driver,
        session_id: taker.session_id,
        hostname: taker.hostname,
      },
    };
    const haltPath = this.haltFilePath(projectDir);
    await fs.mkdir(path.dirname(haltPath), { recursive: true });
    await fs.writeFile(haltPath, JSON.stringify(payload, null, 2), 'utf-8');
  }

  async acquireLock(
    projectDir: string,
    options: AcquireLockOptions,
  ): Promise<LockResult> {
    if (!VALID_DRIVERS.includes(options.driver)) {
      throw new Error(
        `Unknown driver '${options.driver}'; expected one of ${VALID_DRIVERS.join(', ')}`,
      );
    }

    const aieosDir = path.join(projectDir, '.aieos');
    await fs.mkdir(aieosDir, { recursive: true });

    const now = options.now ?? new Date();
    const thisHost = options.hostname ?? os.hostname();
    const thisPid = options.pid ?? process.pid;
    const sid = options.sessionId ?? crypto.randomUUID();
    const pidAlive = options.pidIsAlive ?? ((p: number) => this.pidAlive(p));
    const lockPath = this.lockFilePath(projectDir);

    const existing = await this.readLock(projectDir);

    if (existing && existing.session_id === sid) {
      existing.renewed_at = this.nowIso(now);
      await fs.writeFile(lockPath, JSON.stringify(existing, null, 2), 'utf-8');
      return { acquired: true, tookOver: false, info: existing };
    }

    if (existing && !this.isTakeable(existing, now, thisHost, pidAlive)) {
      return { acquired: false, tookOver: false, info: existing };
    }

    const ours: LockInfo = {
      lock_version: LOCK_VERSION,
      initiative: options.initiative ?? '',
      owner: options.owner,
      driver: options.driver,
      session_id: sid,
      hostname: thisHost,
      pid: thisPid,
      acquired_at: this.nowIso(now),
      renewed_at: this.nowIso(now),
      lease_ttl_seconds: options.leaseTtlSeconds ?? DEFAULT_LEASE_TTL_SECONDS,
      heartbeat_interval_seconds:
        options.heartbeatIntervalSeconds ?? DEFAULT_HEARTBEAT_SECONDS,
    };

    const tookOver = existing !== null;
    if (tookOver && existing) {
      await this.writeHaltSentinel(projectDir, existing, ours, this.nowIso(now));
    }

    await fs.writeFile(lockPath, JSON.stringify(ours, null, 2), 'utf-8');
    return {
      acquired: true,
      tookOver,
      info: ours,
      previous: tookOver && existing ? existing : undefined,
    };
  }

  async renewLock(
    projectDir: string,
    sessionId: string,
    now?: Date,
  ): Promise<boolean> {
    const existing = await this.readLock(projectDir);
    if (!existing || existing.session_id !== sessionId) return false;
    existing.renewed_at = this.nowIso(now);
    await fs.writeFile(
      this.lockFilePath(projectDir),
      JSON.stringify(existing, null, 2),
      'utf-8',
    );
    return true;
  }

  async releaseLock(projectDir: string, sessionId: string): Promise<boolean> {
    const existing = await this.readLock(projectDir);
    if (!existing || existing.session_id !== sessionId) return false;
    await fs.unlink(this.lockFilePath(projectDir));
    return true;
  }
}
