export interface AppConfig {
  projectDir: string;
  kitDirs: string[];
  llmApiKey: string;
  llmProvider: string;
  llmModel: string;
  port: string;
}

export function loadConfig(): AppConfig {
  const projectDir = process.env.PROJECT_DIR ?? '';
  const kitDirsRaw = process.env.KIT_DIRS ?? '';
  const kitDirs = kitDirsRaw ? kitDirsRaw.split(',').map((d) => d.trim()) : [];
  const llmApiKey = process.env.LLM_API_KEY ?? '';
  const llmProvider = process.env.LLM_PROVIDER ?? 'anthropic';
  const llmModel = process.env.LLM_MODEL ?? '';
  const port = process.env.PORT ?? '3000';

  return {
    projectDir,
    kitDirs,
    llmApiKey,
    llmProvider,
    llmModel,
    port,
  };
}
