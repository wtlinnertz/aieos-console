import { loadConfig } from '@/lib/config';
import { FilesystemService } from './filesystem-service';
import { KitService, type IKitService } from './kit-service';
import { StateService, type IStateService } from './state-service';
import { LlmService } from './llm-service';
import { AnthropicProvider } from './anthropic-provider';
import { MockLlmProvider } from './mock-provider';
import { OrchestrationService } from './orchestration-service';
import type { IOrchestrationService } from './orchestration-types';
import type { ILlmService } from './llm-types';
import type { IFilesystemService } from './filesystem-service';

interface Services {
  filesystem: IFilesystemService;
  kit: IKitService;
  state: IStateService;
  llm: ILlmService;
  orchestration: IOrchestrationService;
}

let instance: Services | null = null;

export function getServices(): Services {
  if (instance) {
    return instance;
  }

  const config = loadConfig();

  const filesystem = new FilesystemService({
    projectDir: config.projectDir,
    kitDirs: config.kitDirs,
  });

  const kit = new KitService(filesystem);
  const state = new StateService(filesystem);

  const llm = new LlmService();
  if (config.llmProvider === 'anthropic') {
    const provider = new AnthropicProvider(
      config.llmApiKey ? 'LLM_API_KEY' : 'ANTHROPIC_API_KEY',
    );
    llm.registerProvider(provider);
  } else if (config.llmProvider === 'mock') {
    llm.registerProvider(new MockLlmProvider());
  }

  const orchestration = new OrchestrationService(kit, state, llm);

  instance = { filesystem, kit, state, llm, orchestration };
  return instance;
}

/** Reset the singleton — useful for testing */
export function resetServices(): void {
  instance = null;
}
