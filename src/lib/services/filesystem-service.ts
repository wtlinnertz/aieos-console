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

export interface LockInfo {
  pid: number;
  timestamp: string;
  hostname: string;
}

export interface LockResult {
  acquired: boolean;
  existingLock?: LockInfo;
}

export interface IFilesystemService {
  readFile(filePath: string): Promise<FileResult>;
  writeFileAtomic(filePath: string, content: string): Promise<void>;
  readDirectory(dirPath: string): Promise<DirectoryEntry[]>;
  exists(targetPath: string): Promise<boolean>;
  createDirectory(dirPath: string): Promise<void>;
  acquireLock(projectDir: string): Promise<LockResult>;
  releaseLock(projectDir: string): Promise<void>;
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
      // If the file doesn't exist yet, realpath fails.
      // In that case, check the parent directory's realpath.
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
        // Parent doesn't exist either — return the resolved path
        // and let the caller handle ENOENT
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
      // Clean up temp file on any failure
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

  async acquireLock(projectDir: string): Promise<LockResult> {
    const aieosDir = path.join(projectDir, '.aieos');
    const lockPath = path.join(aieosDir, 'lock');

    await fs.mkdir(aieosDir, { recursive: true });

    try {
      const lockContent = await fs.readFile(lockPath, 'utf-8');
      const lockInfo: LockInfo = JSON.parse(lockContent);

      if (this.isPidAlive(lockInfo.pid)) {
        return { acquired: false, existingLock: lockInfo };
      }

      // Stale lock — remove and acquire
      await fs.unlink(lockPath);
    } catch (err: unknown) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code !== 'ENOENT') {
        throw new WriteError(`Failed to check lock file: ${lockPath}`);
      }
      // No lock file exists — proceed to acquire
    }

    const newLock: LockInfo = {
      pid: process.pid,
      timestamp: new Date().toISOString(),
      hostname: os.hostname(),
    };

    await fs.writeFile(lockPath, JSON.stringify(newLock), 'utf-8');
    return { acquired: true };
  }

  async releaseLock(projectDir: string): Promise<void> {
    const lockPath = path.join(projectDir, '.aieos', 'lock');

    try {
      const lockContent = await fs.readFile(lockPath, 'utf-8');
      const lockInfo: LockInfo = JSON.parse(lockContent);

      // Only release if we own the lock
      if (lockInfo.pid === process.pid) {
        await fs.unlink(lockPath);
      }
    } catch (err: unknown) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code === 'ENOENT') {
        return; // No lock file — nothing to release
      }
      throw new WriteError(`Failed to release lock: ${lockPath}`);
    }
  }

  private isPidAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }
}
