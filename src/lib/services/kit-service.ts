import * as path from 'node:path';
import type { IFilesystemService } from './filesystem-service.js';
import { FileNotFoundError, FlowDefinitionNotFoundError } from './errors.js';
import { parseFlowDefinition } from './flow-parser.js';
import type { FlowDefinition } from './flow-types.js';
import {
  assembleStepInputs,
  type StepInputs,
  type IArtifactStateProvider,
} from './step-input-assembly.js';

export interface KitResult {
  flow: FlowDefinition;
  kitPath: string;
}

export interface IKitService {
  loadKit(kitPath: string): Promise<KitResult>;
  getStepInputs(
    kitPath: string,
    stepId: string,
    projectDir: string,
    artifactState: IArtifactStateProvider,
  ): Promise<StepInputs>;
  invalidateCache(): void;
}

export class KitService implements IKitService {
  private readonly fs: IFilesystemService;
  private readonly cache = new Map<string, KitResult>();

  constructor(filesystemService: IFilesystemService) {
    this.fs = filesystemService;
  }

  async loadKit(kitPath: string): Promise<KitResult> {
    const cached = this.cache.get(kitPath);
    if (cached) {
      return cached;
    }

    const flowYamlPath = path.join(kitPath, 'flow.yaml');

    let content: string;
    try {
      const result = await this.fs.readFile(flowYamlPath);
      content = result.content;
    } catch (err) {
      if (err instanceof FileNotFoundError) {
        throw new FlowDefinitionNotFoundError(
          `flow.yaml not found in kit directory: ${kitPath}`,
        );
      }
      throw err;
    }

    const flow = parseFlowDefinition(content);

    await this.validateFourFiles(kitPath, flow);

    const kitResult: KitResult = { flow, kitPath };
    this.cache.set(kitPath, kitResult);

    return kitResult;
  }

  async getStepInputs(
    kitPath: string,
    stepId: string,
    projectDir: string,
    artifactState: IArtifactStateProvider,
  ): Promise<StepInputs> {
    const kit = await this.loadKit(kitPath);
    return assembleStepInputs(
      this.fs,
      kit.flow,
      kitPath,
      stepId,
      projectDir,
      artifactState,
    );
  }

  invalidateCache(): void {
    this.cache.clear();
  }

  private async validateFourFiles(
    kitPath: string,
    flow: FlowDefinition,
  ): Promise<void> {
    const missing: string[] = [];

    for (const step of flow.steps) {
      const files = step.fourFiles;
      const paths: string[] = [files.spec, files.template, files.validator];

      if (files.prompt !== null) {
        paths.push(files.prompt);
      }

      for (const filePath of paths) {
        const fullPath = path.join(kitPath, filePath);
        const exists = await this.fs.exists(fullPath);
        if (!exists) {
          missing.push(fullPath);
        }
      }
    }

    if (missing.length > 0) {
      throw new Error(
        `Missing four-file(s) in kit "${kitPath}": ${missing.join(', ')}`,
      );
    }
  }
}
