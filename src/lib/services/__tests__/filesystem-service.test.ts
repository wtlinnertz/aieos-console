import { describe, it, expect, beforeEach, afterEach, type TestContext } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { FilesystemService, DEFAULT_LEASE_TTL_SECONDS } from '../filesystem-service.js';
import {
  PathViolationError,
  FileNotFoundError,
  DirectoryNotFoundError,
} from '../errors.js';

describe('FilesystemService', () => {
  let tmpDir: string;
  let service: FilesystemService;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fs-test-'));
    service = new FilesystemService({
      projectDir: tmpDir,
      kitDirs: [],
    });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('readFile', () => {
    it('AT-1: returns file content as UTF-8 for path within boundaries', async () => {
      const filePath = path.join(tmpDir, 'test.txt');
      await fs.writeFile(filePath, 'hello world', 'utf-8');

      const result = await service.readFile(filePath);

      expect(result.content).toBe('hello world');
      expect(result.encoding).toBe('utf-8');
    });

    it('AT-1 failure: throws PathViolationError for path outside boundaries', async () => {
      const outsidePath = path.join(os.tmpdir(), 'outside.txt');

      await expect(service.readFile(outsidePath)).rejects.toThrow(
        PathViolationError,
      );
    });

    it('throws FileNotFoundError for non-existent file', async () => {
      const missingPath = path.join(tmpDir, 'missing.txt');

      await expect(service.readFile(missingPath)).rejects.toThrow(
        FileNotFoundError,
      );
    });

    it('reads UTF-8 encoded content with special characters', async () => {
      const filePath = path.join(tmpDir, 'unicode.txt');
      await fs.writeFile(filePath, '日本語テスト ✓', 'utf-8');

      const result = await service.readFile(filePath);
      expect(result.content).toBe('日本語テスト ✓');
    });
  });

  describe('writeFileAtomic', () => {
    it('AT-2: writes complete content to target file', async () => {
      const filePath = path.join(tmpDir, 'output.txt');

      await service.writeFileAtomic(filePath, 'complete content');

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe('complete content');
    });

    it('AT-2: overwrites existing file atomically', async () => {
      const filePath = path.join(tmpDir, 'existing.txt');
      await fs.writeFile(filePath, 'original', 'utf-8');

      await service.writeFileAtomic(filePath, 'updated');

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe('updated');
    });

    it('AT-2 failure: throws PathViolationError for path outside boundaries', async () => {
      const outsidePath = path.join(os.tmpdir(), 'outside-write.txt');

      await expect(
        service.writeFileAtomic(outsidePath, 'content'),
      ).rejects.toThrow(PathViolationError);
    });

    it('no temp files remain after successful write', async () => {
      const filePath = path.join(tmpDir, 'clean.txt');
      await service.writeFileAtomic(filePath, 'content');

      const entries = await fs.readdir(tmpDir);
      const tmpFiles = entries.filter((e) => e.startsWith('.tmp-'));
      expect(tmpFiles).toHaveLength(0);
    });
  });

  describe('readDirectory', () => {
    it('returns directory entries with correct types', async () => {
      await fs.writeFile(path.join(tmpDir, 'file.txt'), 'content');
      await fs.mkdir(path.join(tmpDir, 'subdir'));

      const entries = await service.readDirectory(tmpDir);

      const fileEntry = entries.find((e) => e.name === 'file.txt');
      const dirEntry = entries.find((e) => e.name === 'subdir');

      expect(fileEntry).toEqual({ name: 'file.txt', type: 'file' });
      expect(dirEntry).toEqual({ name: 'subdir', type: 'directory' });
    });

    it('throws PathViolationError for path outside boundaries', async () => {
      await expect(service.readDirectory(os.tmpdir())).rejects.toThrow(
        PathViolationError,
      );
    });

    it('throws DirectoryNotFoundError for non-existent directory', async () => {
      const missingDir = path.join(tmpDir, 'missing-dir');

      await expect(service.readDirectory(missingDir)).rejects.toThrow(
        DirectoryNotFoundError,
      );
    });

    it('returns empty array for empty directory', async () => {
      const emptyDir = path.join(tmpDir, 'empty');
      await fs.mkdir(emptyDir);

      const entries = await service.readDirectory(emptyDir);
      expect(entries).toEqual([]);
    });
  });

  describe('exists', () => {
    it('returns true for existing file', async () => {
      const filePath = path.join(tmpDir, 'exists.txt');
      await fs.writeFile(filePath, 'content');

      expect(await service.exists(filePath)).toBe(true);
    });

    it('returns false for non-existing file', async () => {
      const filePath = path.join(tmpDir, 'missing.txt');

      expect(await service.exists(filePath)).toBe(false);
    });

    it('returns true for existing directory', async () => {
      const dirPath = path.join(tmpDir, 'subdir');
      await fs.mkdir(dirPath);

      expect(await service.exists(dirPath)).toBe(true);
    });

    it('throws PathViolationError for path outside boundaries', async () => {
      await expect(service.exists('/etc/passwd')).rejects.toThrow(
        PathViolationError,
      );
    });
  });

  describe('symlink path validation', () => {
    // Creates a symlink, or skips the test when the platform forbids it
    // (Windows without Developer Mode/admin reports EPERM or EACCES).
    // GitHub windows-latest runners CAN create symlinks, so these tests
    // still run there — this is a capability check, not a platform skip.
    async function symlinkOrSkip(
      ctx: TestContext,
      target: string,
      linkPath: string,
    ): Promise<void> {
      try {
        await fs.symlink(target, linkPath);
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === 'EPERM' || code === 'EACCES') {
          ctx.skip();
        }
        throw err;
      }
    }

    it('AT-4: throws PathViolationError for symlink resolving outside boundaries', async (ctx) => {
      const outsideTarget = await fs.mkdtemp(
        path.join(os.tmpdir(), 'outside-'),
      );

      try {
        const outsideFile = path.join(outsideTarget, 'secret.txt');
        await fs.writeFile(outsideFile, 'secret data');

        const symlinkPath = path.join(tmpDir, 'escape-link');
        await symlinkOrSkip(ctx, outsideFile, symlinkPath);

        await expect(service.readFile(symlinkPath)).rejects.toThrow(
          PathViolationError,
        );
      } finally {
        await fs.rm(outsideTarget, { recursive: true, force: true });
      }
    });

    it('allows symlink that resolves within boundaries', async (ctx) => {
      const realFile = path.join(tmpDir, 'real.txt');
      await fs.writeFile(realFile, 'real content');
      const linkPath = path.join(tmpDir, 'link.txt');
      await symlinkOrSkip(ctx, realFile, linkPath);

      const result = await service.readFile(linkPath);
      expect(result.content).toBe('real content');
    });
  });

  const LOCK_HOST = 'host-A';
  const T0 = new Date('2026-07-12T10:00:00Z');
  const deadPid = () => false;
  const alivePid = () => true;
  const later = (seconds: number) => new Date(T0.getTime() + seconds * 1000);
  const lockBase = {
    owner: 'todd',
    driver: 'dark-factory' as const,
    now: T0,
    hostname: LOCK_HOST,
    pid: 4242,
    pidIsAlive: alivePid,
  };

  describe('cross-driver lock (FR-019): acquire fresh', () => {
    it('acquires on an unlocked initiative and writes the canonical record', async () => {
      const r = await service.acquireLock(tmpDir, { ...lockBase, sessionId: 's1' });
      expect(r.acquired).toBe(true);
      expect(r.tookOver).toBe(false);
      expect(r.info?.session_id).toBe('s1');

      const onDisk = JSON.parse(
        await fs.readFile(path.join(tmpDir, '.aieos', 'lock'), 'utf-8'),
      );
      expect(onDisk.owner).toBe('todd');
      expect(onDisk.hostname).toBe(LOCK_HOST);
      expect(onDisk.lease_ttl_seconds).toBe(DEFAULT_LEASE_TTL_SECONDS);
      expect(onDisk.acquired_at).toBe('2026-07-12T10:00:00Z');
      expect(onDisk.lock_version).toBe('1.0');
    });

    it('generates a session_id when none is supplied', async () => {
      const r = await service.acquireLock(tmpDir, lockBase);
      expect(r.info?.session_id).toBeTruthy();
    });

    it('rejects an unknown driver', async () => {
      await expect(
        // @ts-expect-error intentional bad driver
        service.acquireLock(tmpDir, { ...lockBase, driver: 'wizard' }),
      ).rejects.toThrow(/Unknown driver/);
    });

    it('creates the .aieos directory if it does not exist', async () => {
      await service.acquireLock(tmpDir, lockBase);
      const stat = await fs.stat(path.join(tmpDir, '.aieos'));
      expect(stat.isDirectory()).toBe(true);
    });
  });

  describe('cross-driver lock (FR-019): contended', () => {
    it('is blocked by a live, unexpired lock from another session', async () => {
      await service.acquireLock(tmpDir, { ...lockBase, sessionId: 's1' });
      const r = await service.acquireLock(tmpDir, {
        ...lockBase,
        sessionId: 's2',
        now: later(10),
      });
      expect(r.acquired).toBe(false);
      expect(r.info?.session_id).toBe('s1');
      await expect(
        fs.access(path.join(tmpDir, '.aieos', 'halt')),
      ).rejects.toThrow();
    });

    it('re-acquiring our own session refreshes the heartbeat', async () => {
      await service.acquireLock(tmpDir, { ...lockBase, sessionId: 's1' });
      const r = await service.acquireLock(tmpDir, {
        ...lockBase,
        sessionId: 's1',
        now: later(30),
      });
      expect(r.acquired).toBe(true);
      expect(r.tookOver).toBe(false);
      expect((await service.readLock(tmpDir))?.renewed_at).toBe(
        '2026-07-12T10:00:30Z',
      );
    });
  });

  describe('cross-driver lock (FR-019): takeover', () => {
    it('takes over an expired lease and writes the halt sentinel', async () => {
      await service.acquireLock(tmpDir, { ...lockBase, sessionId: 's1' });
      const r = await service.acquireLock(tmpDir, {
        ...lockBase,
        sessionId: 's2',
        now: later(DEFAULT_LEASE_TTL_SECONDS + 1),
      });
      expect(r.acquired).toBe(true);
      expect(r.tookOver).toBe(true);
      expect(r.previous?.session_id).toBe('s1');

      const halt = JSON.parse(
        await fs.readFile(path.join(tmpDir, '.aieos', 'halt'), 'utf-8'),
      );
      expect(halt.reason).toBe('stale_lock_takeover');
      expect(halt.taken_from.session_id).toBe('s1');
      expect(halt.taken_by.session_id).toBe('s2');
    });

    it('takes over a same-host dead-PID lock before the lease expires', async () => {
      await service.acquireLock(tmpDir, { ...lockBase, sessionId: 's1', pid: 4242 });
      const r = await service.acquireLock(tmpDir, {
        ...lockBase,
        sessionId: 's2',
        now: later(10),
        pidIsAlive: deadPid,
      });
      expect(r.acquired).toBe(true);
      expect(r.tookOver).toBe(true);
    });

    it('does not take over a cross-host lock within its lease', async () => {
      await service.acquireLock(tmpDir, {
        ...lockBase,
        sessionId: 's1',
        hostname: 'host-A',
        pid: 4242,
      });
      const r = await service.acquireLock(tmpDir, {
        owner: 'ci',
        driver: 'console',
        sessionId: 's2',
        now: later(10),
        hostname: 'host-B',
        pid: 99,
        pidIsAlive: deadPid,
      });
      expect(r.acquired).toBe(false);
      expect(r.info?.session_id).toBe('s1');
    });
  });

  describe('cross-driver lock (FR-019): renew', () => {
    it('renews our own lock', async () => {
      await service.acquireLock(tmpDir, { ...lockBase, sessionId: 's1' });
      expect(await service.renewLock(tmpDir, 's1', later(60))).toBe(true);
      expect((await service.readLock(tmpDir))?.renewed_at).toBe(
        '2026-07-12T10:01:00Z',
      );
    });

    it('fails to renew a foreign session', async () => {
      await service.acquireLock(tmpDir, { ...lockBase, sessionId: 's1' });
      expect(await service.renewLock(tmpDir, 'other')).toBe(false);
    });

    it('fails to renew when there is no lock', async () => {
      expect(await service.renewLock(tmpDir, 's1')).toBe(false);
    });
  });

  describe('cross-driver lock (FR-019): release', () => {
    it('releases a lock we own', async () => {
      await service.acquireLock(tmpDir, { ...lockBase, sessionId: 's1' });
      expect(await service.releaseLock(tmpDir, 's1')).toBe(true);
      expect(await service.readLock(tmpDir)).toBeNull();
    });

    it('does not release a lock owned by another session', async () => {
      await service.acquireLock(tmpDir, { ...lockBase, sessionId: 's1' });
      expect(await service.releaseLock(tmpDir, 'other')).toBe(false);
      expect((await service.readLock(tmpDir))?.session_id).toBe('s1');
    });

    it('is a no-op when there is no lock', async () => {
      expect(await service.releaseLock(tmpDir, 's1')).toBe(false);
    });
  });

  describe('cross-driver lock (FR-019): wire compatibility', () => {
    it('reads a Python-written (snake_case, no-millis) lock record', async () => {
      const aieosDir = path.join(tmpDir, '.aieos');
      await fs.mkdir(aieosDir, { recursive: true });
      const pythonRecord = {
        owner: 'todd',
        driver: 'dark-factory',
        session_id: 'py-1',
        hostname: LOCK_HOST,
        pid: 1,
        acquired_at: '2026-07-12T10:00:00Z',
        renewed_at: '2026-07-12T10:00:00Z',
        initiative: 'INIT-S-005',
        lease_ttl_seconds: 300,
        heartbeat_interval_seconds: 60,
        lock_version: '1.0',
      };
      await fs.writeFile(
        path.join(aieosDir, 'lock'),
        JSON.stringify(pythonRecord, null, 2),
      );
      const info = await service.readLock(tmpDir);
      expect(info?.session_id).toBe('py-1');
      expect(info?.lease_ttl_seconds).toBe(300);
    });
  });

  describe('multiple kit directories', () => {
    it('accepts paths within any configured kit directory', async () => {
      const kitDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-'));
      const kitFile = path.join(kitDir, 'flow.yaml');
      await fs.writeFile(kitFile, 'kit: test');

      const multiService = new FilesystemService({
        projectDir: tmpDir,
        kitDirs: [kitDir],
      });

      try {
        const result = await multiService.readFile(kitFile);
        expect(result.content).toBe('kit: test');
      } finally {
        await fs.rm(kitDir, { recursive: true, force: true });
      }
    });
  });
});
