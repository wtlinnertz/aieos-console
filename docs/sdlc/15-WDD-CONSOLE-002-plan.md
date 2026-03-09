# Implementation Plan — WDD-CONSOLE-002 (Filesystem Service)

## Plan Summary

Implement the Filesystem Service providing path-validated file operations, atomic writes, and lock file management. All file operations enforce boundary validation with symlink resolution. The service uses dependency injection for boundary configuration.

## Files to Create

### 1. `src/lib/services/errors.ts`
- Custom Error subclasses: `PathViolationError`, `FileNotFoundError`, `PermissionError`, `ReadError`, `WriteError`, `DirectoryNotFoundError`
- Each extends `Error` with `name` set to the class name for reliable `instanceof` checks
- Each accepts a descriptive message; `PathViolationError` additionally carries the offending path (sanitized — no leaking of resolved absolute paths to callers outside the service)

### 2. `src/lib/services/filesystem-service.ts`
- **`IFilesystemService` interface** — exported TypeScript interface with all six methods matching TDD §4.1 contract
- **`FilesystemService` class** — implements `IFilesystemService`
  - **Constructor** accepts `{ projectDir: string; kitDirs: string[] }` — the boundary configuration. Resolves and stores absolute paths at construction time.
  - **`validatePath(path)`** (private) — resolves the given path to absolute, checks it starts with one of the configured boundaries, then resolves symlinks via `fs.realpath` and re-validates the resolved path. Throws `PathViolationError` on failure.
  - **`readFile(path)`** — calls `validatePath`, then `fs.readFile` with `'utf-8'` encoding. Maps `ENOENT` to `FileNotFoundError`, `EACCES`/`EPERM` to `PermissionError`, other errors to `ReadError`.
  - **`writeFileAtomic(path, content)`** — calls `validatePath`, writes content to a temp file (same directory, random suffix), then renames temp to target via `fs.rename`. On any failure after temp file creation, removes the temp file in a `finally` block. Maps errors to `WriteError` or `PermissionError`.
  - **`readDirectory(path)`** — calls `validatePath`, then `fs.readdir` with `{ withFileTypes: true }`. Maps each `Dirent` to `DirectoryEntry { name, type }`. Maps `ENOENT` to `DirectoryNotFoundError`, `EACCES`/`EPERM` to `PermissionError`.
  - **`exists(path)`** — calls `validatePath`, then `fs.access`. Returns `true` if accessible, `false` if `ENOENT`. Re-throws `PathViolationError` from `validatePath`.
  - **`acquireLock(projectDir)`** — ensures `.aieos` directory exists (`fs.mkdir` with `recursive: true`). Checks for `.aieos/lock`. If lock file exists, reads it, parses JSON, checks PID liveness (send signal 0 via `process.kill(pid, 0)` in try/catch). Dead PID: remove stale lock and proceed. Live PID: return `{ acquired: false, existingLock }`. No lock: write lock file with `{ pid: process.pid, timestamp: new Date().toISOString(), hostname: os.hostname() }` and return `{ acquired: true }`.
  - **`releaseLock(projectDir)`** — removes `.aieos/lock` if it exists. No error if file is already absent (`ENOENT` is swallowed).
- Exported types: `FileResult`, `DirectoryEntry`, `LockResult`, `LockInfo`

### 3. `src/lib/services/__tests__/filesystem-service.test.ts`
- Unit tests using Vitest covering all test specifications from the test document
- Uses a temporary directory (created via `fs.mkdtemp` in `beforeEach`, cleaned up in `afterEach`) as the boundary directory
- Symlink tests: create symlinks within the temp directory pointing both inside and outside boundaries
- Atomic write failure tests: mock `fs.rename` to simulate mid-write failure
- Lock stale detection tests: write a lock file with a PID known to be dead (e.g., `999999` or a PID obtained by spawning and killing a child process)
- Lock live PID tests: write a lock file with `process.pid` (current process, guaranteed alive)

## Interfaces Locked

### IFilesystemService
```
IFilesystemService {
  readFile(path: string): Promise<FileResult>
  writeFileAtomic(path: string, content: string): Promise<void>
  readDirectory(path: string): Promise<DirectoryEntry[]>
  exists(path: string): Promise<boolean>
  acquireLock(projectDir: string): Promise<LockResult>
  releaseLock(projectDir: string): Promise<void>
}
```

### Supporting Types
```
FileResult { content: string; encoding: 'utf-8' }
DirectoryEntry { name: string; type: 'file' | 'directory' }
LockResult { acquired: boolean; existingLock?: LockInfo }
LockInfo { pid: number; timestamp: string; hostname: string }
```

### Error Types
```
PathViolationError extends Error
FileNotFoundError extends Error
PermissionError extends Error
ReadError extends Error
WriteError extends Error
DirectoryNotFoundError extends Error
```

## Dependencies

No new npm packages required. All functionality uses Node.js built-in modules:

- `node:fs/promises` — file operations (`readFile`, `writeFile`, `rename`, `unlink`, `readdir`, `access`, `realpath`, `mkdtemp`, `mkdir`, `rm`)
- `node:path` — path resolution (`resolve`, `join`, `dirname`)
- `node:os` — `hostname()` for lock file
- `node:crypto` — `randomBytes()` for temp file suffix (or `randomUUID`)

Dev dependencies already present from WDD-CONSOLE-001:
- `vitest` — test runner

## Risks and Assumptions

- **PID liveness check is platform-dependent:** `process.kill(pid, 0)` works on Linux and macOS but may behave differently on Windows. Assumption: the application runs on Linux (Docker container). If Windows support is needed later, an alternative PID check will be required.
- **Race conditions on lock acquisition:** Two processes could check for a lock simultaneously, both find none, and both create a lock. This is a known limitation of file-based locking. For the single-user console use case, this is acceptable. If multi-process safety is required later, use `O_EXCL` flag or a proper advisory lock.
- **Symlink resolution timing:** A symlink could be modified between validation and use (TOCTOU). This is inherent to filesystem-based validation. Mitigation: resolve symlinks at the point of use (in `validatePath`), not as a separate step.
- **Atomic write requires same filesystem:** `fs.rename` is only atomic when source and target are on the same filesystem. Writing the temp file in the same directory as the target ensures this.
- **Lock file directory creation:** `acquireLock` creates `.aieos` directory if missing. This is a side effect but necessary for first-run scenarios.
- **No recursive directory creation on write:** `writeFileAtomic` does not create parent directories. The caller is responsible for ensuring the parent directory exists. This keeps the service simple and predictable.

## Sequencing

1. **Create error types** (`src/lib/services/errors.ts`) — no dependencies, needed by everything else
2. **Create interface and types** (top of `src/lib/services/filesystem-service.ts`) — defines `IFilesystemService`, `FileResult`, `DirectoryEntry`, `LockResult`, `LockInfo` as exported types
3. **Implement `validatePath`** (private method) — foundational; all other methods depend on it
4. **Implement `readFile`** and **`exists`** — simplest operations; validates the path resolution pipeline works
5. **Implement `readDirectory`** — similar pattern to readFile
6. **Implement `writeFileAtomic`** — more complex; requires temp file and rename logic
7. **Implement `acquireLock`** and **`releaseLock`** — independent of file read/write; depends only on `fs` operations and error types
8. **Write unit tests** (`src/lib/services/__tests__/filesystem-service.test.ts`) — covers all acceptance, failure, and edge case tests from test specifications
9. **Verify:** `npx tsc --noEmit && npx vitest run src/lib/services/__tests__/filesystem-service.test.ts`
