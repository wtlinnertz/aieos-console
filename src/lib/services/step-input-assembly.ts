import * as path from 'node:path';
import type { IFilesystemService } from './filesystem-service.js';
import type { FlowDefinition } from './flow-types.js';
import { StepNotFoundError, InputFileNotFoundError } from './errors.js';

export interface NamedInput {
  name: string;
  role: string;
  content: string;
}

export interface StepInputs {
  spec: string;
  template: string;
  prompt: string | null;
  validator: string;
  requiredInputs: NamedInput[];
  upstreamArtifacts: NamedInput[];
}

export interface IArtifactStateProvider {
  getArtifactPath(stepId: string): string | undefined;
}

export async function assembleStepInputs(
  fs: IFilesystemService,
  flow: FlowDefinition,
  kitPath: string,
  stepId: string,
  projectDir: string,
  artifactState: IArtifactStateProvider,
): Promise<StepInputs> {
  const step = flow.steps.find((s) => s.id === stepId);
  if (!step) {
    throw new StepNotFoundError(
      `Step "${stepId}" not found in flow definition`,
    );
  }

  const specContent = await readKitFile(fs, kitPath, step.fourFiles.spec);
  const templateContent = await readKitFile(fs, kitPath, step.fourFiles.template);
  const validatorContent = await readKitFile(fs, kitPath, step.fourFiles.validator);

  let promptContent: string | null = null;
  if (step.fourFiles.prompt !== null) {
    promptContent = await readKitFile(fs, kitPath, step.fourFiles.prompt);
  }

  const requiredInputs: NamedInput[] = [];
  for (const input of step.requiredInputs) {
    const fullPath = path.join(kitPath, input.path);
    try {
      const result = await fs.readFile(fullPath);
      requiredInputs.push({
        name: path.basename(input.path),
        role: input.role,
        content: result.content,
      });
    } catch {
      throw new InputFileNotFoundError(
        `Required input file not found: ${fullPath}`,
      );
    }
  }

  const upstreamArtifacts: NamedInput[] = [];
  for (const depId of step.dependencies) {
    const artifactPath = artifactState.getArtifactPath(depId);
    if (!artifactPath) {
      throw new InputFileNotFoundError(
        `Upstream artifact not available for step "${depId}"`,
      );
    }
    const fullPath = path.join(projectDir, artifactPath);
    const result = await fs.readFile(fullPath);
    upstreamArtifacts.push({
      name: path.basename(artifactPath),
      role: `upstream:${depId}`,
      content: result.content,
    });
  }

  return {
    spec: specContent,
    template: templateContent,
    prompt: promptContent,
    validator: validatorContent,
    requiredInputs,
    upstreamArtifacts,
  };
}

async function readKitFile(
  fs: IFilesystemService,
  kitPath: string,
  filePath: string,
): Promise<string> {
  const fullPath = path.join(kitPath, filePath);
  const result = await fs.readFile(fullPath);
  return result.content;
}
