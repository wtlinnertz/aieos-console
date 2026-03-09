### WDD-CONSOLE-002 — Filesystem Service

#### WDD Work Item

- **WDD Item ID:** WDD-CONSOLE-002
- **Parent TDD Section:** §4.1 Filesystem Service
- **Assignee Type:** AI Agent
- **Required Capabilities:** backend, security
- **Complexity Estimate:** M

**Intent:** Implement the Filesystem Service (`IFilesystemService`) providing path-validated file operations, atomic writes, and lock file management.

**In Scope:**
- `IFilesystemService` TypeScript interface
- `readFile`, `writeFileAtomic`, `readDirectory`, `exists`, `acquireLock`, `releaseLock` implementations
- Path boundary validation (resolve path, check against configured boundaries, resolve symlinks, re-validate)
- Atomic write implementation (write to temp file, rename)
- Lock file implementation (`.aieos/lock` with PID, timestamp, hostname; stale detection via PID liveness; cleanup on release)
- Error types: `PathViolationError`, `FileNotFoundError`, `PermissionError`, `ReadError`, `WriteError`, `DirectoryNotFoundError`
- Unit tests for all operations and error paths

**Out of Scope / Non-Goals:**
- Business logic consuming the filesystem
- State metadata format (State Service concern)
- Kit directory interpretation (Kit Service concern)

**Inputs:**
- TDD §4.1 `IFilesystemService` contract
- Configured project directory and kit directory paths (from environment variables)

**Outputs:**
- `IFilesystemService` interface definition (TypeScript)
- `FilesystemService` implementation
- Error type definitions
- Unit tests covering: path validation, atomic write, lock file

**Acceptance Criteria:**
- **AC1:** Given a path within configured boundaries, when `readFile` is called, then file content is returned as UTF-8 string. Failure: Given a path outside configured boundaries, when `readFile` is called, then `PathViolationError` is thrown
- **AC2:** Given valid content and path, when `writeFileAtomic` is called and the write succeeds, then the target file contains the complete content; when the write fails mid-write, then the target file is unchanged and no temporary file remains. Failure: If a partial file exists after a failed write, the atomic write implementation is incorrect
- **AC3:** Given no existing lock file, when `acquireLock` is called, then a lock file is created with current PID and timestamp and `acquired: true` is returned; given an existing lock file with a dead PID, when `acquireLock` is called, then the stale lock is removed and a new lock acquired; given an existing lock file with a live PID, when `acquireLock` is called, then `acquired: false` is returned with existing lock details. Failure: If a stale lock prevents acquisition, the PID liveness check is incorrect
- **AC4:** Given a path containing a symlink that resolves outside configured boundaries, when any file operation is called, then `PathViolationError` is thrown. Failure: If the operation succeeds, symlink resolution validation is bypassed

**Definition of Done:**
- [ ] PR merged
- [ ] Unit tests passing (Vitest)
- [ ] All error paths tested
- [ ] Path validation tests include symlink scenarios
- [ ] Lock file tests include stale detection

**Interface Contract References:** TDD §4.1 `IFilesystemService` — **provider** (this item implements the contract)

**Dependencies:** WDD-CONSOLE-001 (project scaffolding)

**Rollback / Failure Behavior:** Filesystem Service is a foundational component. If implementation is incorrect, downstream items (Kit Service, State Service) cannot proceed. Revert the PR and fix.

**Mock impact note:** `IFilesystemService` is consumed by: Kit Service (WDD-CONSOLE-003/004/005), State Service (WDD-CONSOLE-006/007). All downstream test files will mock this interface. When `IFilesystemService` changes, update mocks in: kit-service tests, state-service tests, and any other consumer tests.

---

#### TDD Sections

**Technical Context:**

##### §4.1 Filesystem Service — Full Interface Contract

```
IFilesystemService:
  readFile(path: string): Promise<FileResult>
  - Inputs: path — absolute or relative path (resolved against configured base directories)
  - Outputs: FileResult { content: string; encoding: 'utf-8' }
  - Error modes: PathViolationError, FileNotFoundError, PermissionError, ReadError
  - Behavior: Validates resolved path is within configured project directory or kit directory
    boundaries. Resolves symlinks and re-validates. Returns file content as UTF-8 string.

  writeFileAtomic(path: string, content: string): Promise<void>
  - Inputs: path — target file path; content — file content as string
  - Outputs: void on success
  - Error modes: PathViolationError; WriteError; PermissionError
  - Behavior: Writes content to a temporary file in the same directory, then renames to target
    path. If rename fails, temporary file is cleaned up. Target file is either fully written
    or unchanged.

  readDirectory(path: string): Promise<DirectoryEntry[]>
  - Inputs: path — directory path
  - Outputs: DirectoryEntry { name: string; type: 'file' | 'directory' }
  - Error modes: PathViolationError; DirectoryNotFoundError; PermissionError

  exists(path: string): Promise<boolean>
  - Error modes: PathViolationError

  acquireLock(projectDir: string): Promise<LockResult>
  - Outputs: LockResult { acquired: boolean; existingLock?: LockInfo }
  - Behavior: Checks for .aieos/lock file. If present, reads PID and checks liveness. If PID
    is dead, removes stale lock and acquires. If PID is alive, returns acquired: false. If no
    lock exists, creates lock file.

  releaseLock(projectDir: string): Promise<void>
  - Behavior: Removes .aieos/lock file if it exists and was created by current process.

Lock file format: { "pid": number, "timestamp": "ISO-8601", "hostname": "string" }
```

**Testing Strategy:**

##### §8 Testing Strategy — Filesystem Service

- **Path validation tests:** Verify that paths within configured boundaries are accepted; paths outside boundaries throw `PathViolationError`; symlinks resolving outside boundaries throw `PathViolationError`.
- **Atomic write tests:** Verify that successful writes produce complete files; interrupted writes leave original file unchanged; no temporary files remain after failure.
- **Lock file tests:** Verify lock acquisition when no lock exists; stale lock detection via dead PID; live PID prevents acquisition; lock release removes lock file.

**Interface Contracts:**

##### §4.1 IFilesystemService — Types

```typescript
interface FileResult {
  content: string;
  encoding: 'utf-8';
}

interface DirectoryEntry {
  name: string;
  type: 'file' | 'directory';
}

interface LockResult {
  acquired: boolean;
  existingLock?: LockInfo;
}

interface LockInfo {
  pid: number;
  timestamp: string; // ISO-8601
  hostname: string;
}
```

**Error types:**
- `PathViolationError` — resolved path is outside configured boundaries
- `FileNotFoundError` — target file does not exist
- `PermissionError` — insufficient filesystem permissions
- `ReadError` — general read failure
- `WriteError` — general write failure
- `DirectoryNotFoundError` — target directory does not exist

---

#### ACF Sections

**Security and Compliance:**

##### §3 Security Guardrails
- **Path traversal prevention:** All filesystem operations must validate resolved paths remain within configured boundaries. Path resolution must follow symlinks and re-validate the resolved path against boundaries.
- **Error handling:** Stack traces and infrastructure details not exposed to browser. Error responses sanitized. No silent failures — all errors must be explicit and typed.
- **Secret management:** LLM API keys not hardcoded. Via env vars or secrets file excluded from VCS. Never in logs, artifacts, or browser.

##### §5 Reliability & Resilience
- **Atomic writes:** Filesystem write failures must not leave inconsistent state. Write to temporary file, then rename. If rename fails, clean up temporary file.
- **Failure isolation:** LLM API failures must not corrupt local state. Rollback via filesystem operations (git, file restore). No application-maintained state that can't be reconstructed from project directory.

---

#### DCF Sections

**Testing Expectations:**

##### §2 Design Principles (applicable to this item)
- **Explicit error handling:** No silent failures, no empty catch blocks. Every error path must produce a typed error.
- **Dependency injection:** Filesystem Service receives its configuration (boundary paths) via injection, not implicit globals.
- **Service boundary discipline:** Filesystem Service handles raw file operations only. It does not interpret file contents (that is the Kit Service or State Service concern).

##### §3 Quality Bars (applicable to this item)
- Interfaces and contracts must be explicit (typed inputs, outputs, error types)
- Failure and rollback behavior must be defined
- Cyclomatic complexity <=10 per function, max nesting 3
- No magic strings or hardcoded configuration

##### §6 Testing Expectations

**Required test layers:**
- **Unit tests (Vitest):** All service layer functions, utility functions, validation logic. Mock only at service boundaries.
- **Component tests (Vitest + React Testing Library):** All React components with user interaction.
- **End-to-end tests (Playwright):** Critical user flows.

**Evidence requirements:**
- Test results in machine-readable format
- Code coverage report
- Lint and type-check results (zero errors required)

**Promotion gates:**
- All unit and component tests pass
- No TypeScript type errors (strict mode)
- No ESLint errors
- No known high/critical CVEs
- No secrets detected
- SAST scan passes
- Container image scan passes
- E2E tests pass for critical flows
