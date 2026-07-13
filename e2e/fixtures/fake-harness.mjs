#!/usr/bin/env node
// Fake AIEOS harness CLI for console e2e — honors the ADR-0003 contract so the
// console's freeze-through-harness path (FR-020) can be exercised without the
// real Python harness installed. Emits the same JSON shape as `harness`.
const args = process.argv.slice(2);
const cmd = args[0];
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};

if (cmd === 'freeze') {
  process.stdout.write(
    JSON.stringify({
      status: 'frozen',
      artifact_id: opt('--artifact') ?? '',
      path: 'docs/sdlc/frozen.md',
      frozen_count: 1,
      decided_by: opt('--decided-by') ?? 'console-user',
    }),
  );
  process.exit(0);
} else if (cmd === 'read-state') {
  process.stdout.write(
    JSON.stringify({ current_layer: '', current_artifact: '', frozen_count: 0 }),
  );
  process.exit(0);
} else if (cmd === 'run-artifact') {
  process.stdout.write(JSON.stringify({ result: 'CONVERGED' }));
  process.exit(0);
}
process.stderr.write(JSON.stringify({ error: 'unknown_command', message: String(cmd) }));
process.exit(2);
