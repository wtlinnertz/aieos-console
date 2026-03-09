# Test Specifications — WDD-CONSOLE-002 (Filesystem Service)

## 1. Acceptance Tests

### AT-1: readFile returns UTF-8 content for path within boundaries
- **Preconditions:** FilesystemService instantiated with configured boundary directories; a test file exists within the boundary at a known path
- **Input:** Call `readFile(path)` where `path` resolves to the test file within boundaries
- **Expected outcome:** Returns `FileResult { content: <file contents>, encoding: 'utf-8' }` with content matching the file on disk
- **Failure condition:** Content does not match, encoding is not `'utf-8'`, or an error is thrown — readFile implementation is incorrect

### AT-2: readFile throws PathViolationError for path outside boundaries
- **Preconditions:** FilesystemService instantiated with configured boundary directories
- **Input:** Call `readFile(path)` where `path` resolves outside all configured boundaries (e.g., `/etc/passwd`)
- **Expected outcome:** `PathViolationError` is thrown
- **Failure condition:** File content is returned or a different error type is thrown — path boundary validation is missing or incorrect

### AT-3: writeFileAtomic writes complete content on success
- **Preconditions:** FilesystemService instantiated with configured boundary directories; target path is within boundaries
- **Input:** Call `writeFileAtomic(path, content)` with known content string
- **Expected outcome:** Target file exists with content exactly matching the input; no temporary files remain in the directory
- **Failure condition:** File content does not match input, file does not exist, or temporary files remain — atomic write implementation is incorrect

### AT-4: writeFileAtomic leaves target unchanged on failure
- **Preconditions:** FilesystemService instantiated; target file exists at path within boundaries with known original content; write operation is forced to fail mid-write (e.g., by mocking the rename step to throw)
- **Input:** Call `writeFileAtomic(path, newContent)` where the rename operation fails
- **Expected outcome:** Target file still contains original content; no temporary files remain in the directory; `WriteError` is thrown
- **Failure condition:** Target file contains partial content, or a temporary file remains — atomic write rollback is incorrect

### AT-5: acquireLock creates lock when no lock exists
- **Preconditions:** FilesystemService instantiated; `.aieos/lock` file does not exist in projectDir
- **Input:** Call `acquireLock(projectDir)`
- **Expected outcome:** Returns `LockResult { acquired: true }`; `.aieos/lock` file exists containing JSON with `pid` (current process PID), `timestamp` (valid ISO-8601), and `hostname` (current hostname)
- **Failure condition:** `acquired` is false, lock file is missing, or lock file content is malformed — lock acquisition is incorrect

### AT-6: acquireLock removes stale lock and acquires
- **Preconditions:** FilesystemService instantiated; `.aieos/lock` file exists with a PID that is not running (dead process)
- **Input:** Call `acquireLock(projectDir)`
- **Expected outcome:** Returns `LockResult { acquired: true }`; `.aieos/lock` file contains current process PID, not the stale PID
- **Failure condition:** `acquired` is false or stale lock remains — PID liveness check or stale lock removal is incorrect

### AT-7: acquireLock returns false for live PID lock
- **Preconditions:** FilesystemService instantiated; `.aieos/lock` file exists with a PID that is currently running (e.g., current process PID, simulating another holder)
- **Input:** Call `acquireLock(projectDir)`
- **Expected outcome:** Returns `LockResult { acquired: false, existingLock: { pid, timestamp, hostname } }` with the existing lock details
- **Failure condition:** `acquired` is true or existing lock details are missing — live PID detection is incorrect

### AT-8: Symlink resolving outside boundaries throws PathViolationError
- **Preconditions:** FilesystemService instantiated; a symlink exists within boundaries that points to a file outside boundaries
- **Input:** Call `readFile(symlinkPath)`, `writeFileAtomic(symlinkPath, content)`, `readDirectory(symlinkPath)`, or `exists(symlinkPath)`
- **Expected outcome:** `PathViolationError` is thrown for each operation
- **Failure condition:** Any operation succeeds — symlink resolution validation is bypassed

## 2. Failure Tests

### FT-1: readFile throws FileNotFoundError for non-existent file
- **Preconditions:** FilesystemService instantiated; no file exists at the given path (path is within boundaries)
- **Input:** Call `readFile(nonExistentPath)`
- **Expected outcome:** `FileNotFoundError` is thrown
- **Failure condition:** A different error type is thrown or no error is thrown — error type mapping is incorrect

### FT-2: readFile throws ReadError for unreadable file
- **Preconditions:** FilesystemService instantiated; file exists at path within boundaries but process lacks read permissions (mocked or set via chmod)
- **Input:** Call `readFile(path)`
- **Expected outcome:** `PermissionError` or `ReadError` is thrown
- **Failure condition:** No error or wrong error type — permission handling is incorrect

### FT-3: writeFileAtomic throws PathViolationError for path outside boundaries
- **Preconditions:** FilesystemService instantiated with configured boundaries
- **Input:** Call `writeFileAtomic(outsidePath, content)` where path is outside boundaries
- **Expected outcome:** `PathViolationError` is thrown; no file is created at the target path
- **Failure condition:** File is written outside boundaries — path validation is missing on write operations

### FT-4: writeFileAtomic throws WriteError on permission failure
- **Preconditions:** FilesystemService instantiated; target directory within boundaries is not writable (mocked or set via chmod)
- **Input:** Call `writeFileAtomic(path, content)`
- **Expected outcome:** `WriteError` or `PermissionError` is thrown; no partial file remains
- **Failure condition:** Wrong error type or partial file left behind — error handling or cleanup is incorrect

### FT-5: readDirectory throws DirectoryNotFoundError for non-existent directory
- **Preconditions:** FilesystemService instantiated; no directory exists at the given path (path is within boundaries)
- **Input:** Call `readDirectory(nonExistentDirPath)`
- **Expected outcome:** `DirectoryNotFoundError` is thrown
- **Failure condition:** A different error type is thrown or empty array is returned — error type mapping is incorrect

### FT-6: readDirectory throws PathViolationError for path outside boundaries
- **Preconditions:** FilesystemService instantiated with configured boundaries
- **Input:** Call `readDirectory(outsidePath)` where path is outside boundaries
- **Expected outcome:** `PathViolationError` is thrown
- **Failure condition:** Directory entries are returned — path validation is missing on directory reads

### FT-7: exists throws PathViolationError for path outside boundaries
- **Preconditions:** FilesystemService instantiated with configured boundaries
- **Input:** Call `exists(outsidePath)` where path is outside boundaries
- **Expected outcome:** `PathViolationError` is thrown
- **Failure condition:** `true` or `false` is returned without error — path validation is missing on exists check

## 3. Edge Case Tests

### EC-1: readFile handles path with `..` segments that stay within boundaries
- **Preconditions:** FilesystemService instantiated; file exists at `<boundary>/subdir/../file.txt` which resolves to `<boundary>/file.txt`
- **Input:** Call `readFile('<boundary>/subdir/../file.txt')`
- **Expected outcome:** File content is returned (path resolves within boundaries)
- **Failure condition:** `PathViolationError` is thrown for a path that legitimately resolves within boundaries — path resolution is overly strict

### EC-2: readFile handles path with `..` segments that escape boundaries
- **Preconditions:** FilesystemService instantiated with boundary `/project`
- **Input:** Call `readFile('/project/../../../etc/passwd')`
- **Expected outcome:** `PathViolationError` is thrown
- **Failure condition:** File content is returned — path traversal prevention is broken

### EC-3: writeFileAtomic creates parent directories if needed
- **Preconditions:** FilesystemService instantiated; target path is within boundaries but parent directory does not exist
- **Input:** Call `writeFileAtomic('<boundary>/new/nested/dir/file.txt', content)`
- **Expected outcome:** Either the file is created with parent directories, or a clear error is thrown indicating the directory does not exist (behavior depends on design decision — document whichever is chosen)
- **Failure condition:** Untyped error or crash — error handling for missing parent directory is absent

### EC-4: readDirectory returns correct types for files and subdirectories
- **Preconditions:** FilesystemService instantiated; directory within boundaries contains at least one file and one subdirectory
- **Input:** Call `readDirectory(path)`
- **Expected outcome:** Returns array of `DirectoryEntry` objects; files have `type: 'file'`; subdirectories have `type: 'directory'`
- **Failure condition:** Types are incorrect or entries are missing — directory entry classification is wrong

### EC-5: readDirectory returns empty array for empty directory
- **Preconditions:** FilesystemService instantiated; an empty directory exists within boundaries
- **Input:** Call `readDirectory(emptyDirPath)`
- **Expected outcome:** Returns an empty array `[]`
- **Failure condition:** Error is thrown or non-empty array returned — empty directory handling is incorrect

### EC-6: exists returns true for existing file and false for non-existing
- **Preconditions:** FilesystemService instantiated; one file exists at known path within boundaries; another path within boundaries has no file
- **Input:** Call `exists(existingPath)` and `exists(nonExistingPath)`
- **Expected outcome:** `true` for existing file; `false` for non-existing file
- **Failure condition:** Wrong boolean value returned — exists implementation is incorrect

### EC-7: releaseLock removes lock file
- **Preconditions:** FilesystemService instantiated; `.aieos/lock` file exists and was created by current process
- **Input:** Call `releaseLock(projectDir)`
- **Expected outcome:** `.aieos/lock` file no longer exists
- **Failure condition:** Lock file still exists after release — releaseLock implementation is incorrect

### EC-8: releaseLock is no-op when no lock exists
- **Preconditions:** FilesystemService instantiated; `.aieos/lock` file does not exist
- **Input:** Call `releaseLock(projectDir)`
- **Expected outcome:** No error is thrown; operation completes successfully
- **Failure condition:** Error is thrown — releaseLock does not handle missing lock gracefully

### EC-9: acquireLock creates `.aieos` directory if it does not exist
- **Preconditions:** FilesystemService instantiated; `.aieos` directory does not exist in projectDir
- **Input:** Call `acquireLock(projectDir)`
- **Expected outcome:** `.aieos` directory is created; lock file is created within it; returns `acquired: true`
- **Failure condition:** Error thrown because directory is missing — acquireLock does not create prerequisite directory

### EC-10: Lock file contains valid JSON with required fields
- **Preconditions:** FilesystemService instantiated; no existing lock
- **Input:** Call `acquireLock(projectDir)`; read the lock file contents
- **Expected outcome:** Lock file is valid JSON containing `pid` (number matching current PID), `timestamp` (valid ISO-8601 string), `hostname` (non-empty string)
- **Failure condition:** JSON is invalid or fields are missing/wrong type — lock file format does not match specification

### EC-11: Symlink within boundaries pointing to file within boundaries succeeds
- **Preconditions:** FilesystemService instantiated; a symlink exists within boundaries pointing to another file also within boundaries
- **Input:** Call `readFile(symlinkPath)`
- **Expected outcome:** File content is returned successfully
- **Failure condition:** `PathViolationError` is thrown — symlink validation is overly restrictive

### EC-12: exists handles symlink outside boundaries
- **Preconditions:** FilesystemService instantiated; a symlink exists within boundaries pointing outside boundaries
- **Input:** Call `exists(symlinkPath)`
- **Expected outcome:** `PathViolationError` is thrown
- **Failure condition:** `true` or `false` returned — symlink resolution not applied to exists check

## 4. Regression Tests

None — this is the first implementation of the Filesystem Service; no prior implementation exists.
