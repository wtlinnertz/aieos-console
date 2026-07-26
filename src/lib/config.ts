import * as path from 'node:path';

export interface AppConfig {
  projectDir: string;
  kitDirs: string[];
  llmApiKey: string;
  llmProvider: string;
  llmModel: string;
  port: string;
  harnessCmd: string;
  harnessCwd: string | null;
  /** FR-023 O1: 'manifest' (default) or the legacy 'flow-yaml' loader. */
  flowSource: 'manifest' | 'flow-yaml';
  /** Directory containing the kit checkouts (incl. governance-foundation). */
  kitRoot: string;
  /** Path to kit-manifest.yml; empty = fail closed at load (D4). */
  manifestPath: string;
}

export function loadConfig(): AppConfig {
  const projectDir = process.env.PROJECT_DIR ?? '';
  const kitDirsRaw = process.env.KIT_DIRS ?? '';
  const kitDirs = kitDirsRaw ? kitDirsRaw.split(',').map((d) => d.trim()) : [];
  const llmApiKey = process.env.LLM_API_KEY ?? '';
  const llmProvider = process.env.LLM_PROVIDER ?? 'anthropic';
  const llmModel = process.env.LLM_MODEL ?? '';
  const port = process.env.PORT ?? '3000';
  const harnessCmd = process.env.HARNESS_CMD ?? 'harness';
  const harnessCwd = process.env.HARNESS_CWD ?? null;

  const flowSource =
    process.env.FLOW_SOURCE === 'flow-yaml' ? 'flow-yaml' : 'manifest';
  const kitRoot = process.env.KIT_ROOT ?? '';
  const manifestPath =
    process.env.MANIFEST_PATH ??
    (kitRoot
      ? path.join(kitRoot, 'aieos-governance-foundation', 'kit-manifest.yml')
      : '');

  return {
    projectDir,
    kitDirs,
    llmApiKey,
    llmProvider,
    llmModel,
    port,
    harnessCmd,
    harnessCwd,
    flowSource,
    kitRoot,
    manifestPath,
  };
}
