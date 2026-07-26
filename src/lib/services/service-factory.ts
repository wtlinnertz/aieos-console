import { loadConfig } from '@/lib/config';
import { FilesystemService } from './filesystem-service';
import { KitService, type IKitService } from './kit-service';
import { ManifestService, type IManifestService } from './manifest-service';
import { ManifestKitService } from './manifest-kit-service';
import { StateService, type IStateService } from './state-service';
import { LlmService } from './llm-service';
import { AnthropicProvider } from './anthropic-provider';
import { MockLlmProvider } from './mock-provider';
import { OrchestrationService } from './orchestration-service';
import { HarnessFreezeService } from './harness-freeze-service';
import type { IOrchestrationService } from './orchestration-types';
import type { ILlmService } from './llm-types';
import type { IFilesystemService } from './filesystem-service';

interface Services {
  filesystem: IFilesystemService;
  kit: IKitService;
  state: IStateService;
  llm: ILlmService;
  orchestration: IOrchestrationService;
  /** Present only when flowSource === 'manifest' (FR-023). */
  manifest: IManifestService | null;
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

  // FR-023 (O1): kit-manifest.yml is the flow source of truth; the legacy
  // flow.yaml loader stays behind FLOW_SOURCE=flow-yaml for >=1 release.
  let manifest: IManifestService | null = null;
  let kit: IKitService;
  if (config.flowSource === 'flow-yaml') {
    kit = new KitService(filesystem);
  } else {
    manifest = new ManifestService({
      manifestPath: config.manifestPath,
      kitRoot: config.kitRoot,
    });
    kit = new ManifestKitService(filesystem, manifest);
  }
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

  const freeze = new HarnessFreezeService(
    config.harnessCmd.split(' ').filter(Boolean),
    { cwd: config.harnessCwd ?? undefined },
  );
  const orchestration = new OrchestrationService(kit, state, llm, freeze);

  instance = { filesystem, kit, state, llm, orchestration, manifest };
  return instance;
}

/** Reset the singleton — useful for testing */
export function resetServices(): void {
  instance = null;
}
