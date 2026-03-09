import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { FilesystemService } from '../filesystem-service.js';
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
    it('AT-4: throws PathViolationError for symlink resolving outside boundaries', async () => {
      const outsideTarget = await fs.mkdtemp(
        path.join(os.tmpdir(), 'outside-'),
      );
      const outsideFile = path.join(outsideTarget, 'secret.txt');
      await fs.writeFile(outsideFile, 'secret data');

      const symlinkPath = path.join(tmpDir, 'escape-link');
      await fs.symlink(outsideFile, symlinkPath);

      try {
        await expect(service.readFile(symlinkPath)).rejects.toThrow(
          PathViolationError,
        );
      } finally {
        await fs.rm(outsideTarget, { recursive: true, force: true });
      }
    });

    it('allows symlink that resolves within boundaries', async () => {
      const realFile = path.join(tmpDir, 'real.txt');
      await fs.writeFile(realFile, 'real content');
      const linkPath = path.join(tmpDir, 'link.txt');
      await fs.symlink(realFile, linkPath);

      const result = await service.readFile(linkPath);
      expect(result.content).toBe('real content');
    });
  });

  describe('acquireLock', () => {
    it('AT-3: acquires lock when no lock file exists', async () => {
      const result = await service.acquireLock(tmpDir);

      expect(result.acquired).toBe(true);
      expect(result.existingLock).toBeUndefined();

      // Verify lock file was created
      const lockPath = path.join(tmpDir, '.aieos', 'lock');
      const lockContent = JSON.parse(await fs.readFile(lockPath, 'utf-8'));
      expect(lockContent.pid).toBe(process.pid);
      expect(lockContent.hostname).toBe(os.hostname());
      expect(new Date(lockContent.timestamp).toISOString()).toBe(
        lockContent.timestamp,
      );
    });

    it('AT-3: removes stale lock (dead PID) and acquires', async () => {
      const aieosDir = path.join(tmpDir, '.aieos');
      await fs.mkdir(aieosDir, { recursive: true });

      const staleLock = {
        pid: 999999, // Very unlikely to be a live process
        timestamp: new Date().toISOString(),
        hostname: os.hostname(),
      };
      await fs.writeFile(
        path.join(aieosDir, 'lock'),
        JSON.stringify(staleLock),
      );

      const result = await service.acquireLock(tmpDir);

      expect(result.acquired).toBe(true);
      const lockContent = JSON.parse(
        await fs.readFile(path.join(aieosDir, 'lock'), 'utf-8'),
      );
      expect(lockContent.pid).toBe(process.pid);
    });

    it('AT-3: returns acquired:false for live PID lock', async () => {
      const aieosDir = path.join(tmpDir, '.aieos');
      await fs.mkdir(aieosDir, { recursive: true });

      const liveLock = {
        pid: process.pid, // Current process is alive
        timestamp: new Date().toISOString(),
        hostname: os.hostname(),
      };
      await fs.writeFile(
        path.join(aieosDir, 'lock'),
        JSON.stringify(liveLock),
      );

      const result = await service.acquireLock(tmpDir);

      expect(result.acquired).toBe(false);
      expect(result.existingLock).toBeDefined();
      expect(result.existingLock!.pid).toBe(process.pid);
    });

    it('creates .aieos directory if it does not exist', async () => {
      await service.acquireLock(tmpDir);

      const aieosDir = path.join(tmpDir, '.aieos');
      const stat = await fs.stat(aieosDir);
      expect(stat.isDirectory()).toBe(true);
    });
  });

  describe('releaseLock', () => {
    it('removes lock file owned by current process', async () => {
      await service.acquireLock(tmpDir);

      await service.releaseLock(tmpDir);

      const lockPath = path.join(tmpDir, '.aieos', 'lock');
      await expect(fs.access(lockPath)).rejects.toThrow();
    });

    it('does not remove lock file owned by another process', async () => {
      const aieosDir = path.join(tmpDir, '.aieos');
      await fs.mkdir(aieosDir, { recursive: true });

      const otherLock = {
        pid: 999998,
        timestamp: new Date().toISOString(),
        hostname: os.hostname(),
      };
      const lockPath = path.join(aieosDir, 'lock');
      await fs.writeFile(lockPath, JSON.stringify(otherLock));

      await service.releaseLock(tmpDir);

      // Lock file should still exist
      const content = await fs.readFile(lockPath, 'utf-8');
      expect(JSON.parse(content).pid).toBe(999998);
    });

    it('no-op when no lock file exists', async () => {
      await fs.mkdir(path.join(tmpDir, '.aieos'), { recursive: true });

      // Should not throw
      await service.releaseLock(tmpDir);
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
