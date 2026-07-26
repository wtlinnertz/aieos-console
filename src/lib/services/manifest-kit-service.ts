import * as path from 'node:path';
import type { IFilesystemService } from './filesystem-service.js';
import { ConventionResolutionError } from './errors.js';
import { deriveFlow } from './derive-flow.js';
import type { FlowDefinition } from './flow-types.js';
import type { IManifestService } from './manifest-service.js';
import type { IKitService, KitResult } from './kit-service.js';
import {
  assembleStepInputs,
  type StepInputs,
  type IArtifactStateProvider,
} from './step-input-assembly.js';

/**
 * IKitService backed by kit-manifest.yml + the artifact-file convention
 * (FR-023) instead of a per-kit flow.yaml. Accepts either a manifest kit
 * abbreviation ("QAK") or a kit directory path (whose basename must match a
 * manifest repository) so existing state.kitConfigs entries keep working.
 */
export class ManifestKitService implements IKitService {
  private readonly fs: IFilesystemService;
  private readonly manifests: IManifestService;
  private readonly cache = new Map<string, KitResult>();

  constructor(filesystemService: IFilesystemService, manifests: IManifestService) {
    this.fs = filesystemService;
    this.manifests = manifests;
  }

  async loadKit(kitRef: string): Promise<KitResult> {
    const abbr = this.toAbbr(kitRef);
    const cached = this.cache.get(abbr);
    if (cached) {
      return cached;
    }

    const manifest = this.manifests.loadManifest();
    const flow = deriveFlow(abbr, manifest);
    const kitPath = this.manifests.resolveKitPath(abbr);

    await this.validateConvention(abbr, kitPath, flow);

    const result: KitResult = { flow, kitPath };
    this.cache.set(abbr, result);
    return result;
  }

  async getStepInputs(
    kitRef: string,
    stepId: string,
    projectDir: string,
    artifactState: IArtifactStateProvider,
  ): Promise<StepInputs> {
    const kit = await this.loadKit(kitRef);
    return assembleStepInputs(
      this.fs,
      kit.flow,
      kit.kitPath,
      stepId,
      projectDir,
      artifactState,
    );
  }

  invalidateCache(): void {
    this.cache.clear();
    this.manifests.invalidateCache();
  }

  private toAbbr(kitRef: string): string {
    if (/^[A-Z]{2,6}$/.test(kitRef)) {
      return kitRef;
    }
    return this.manifests.abbrForKitPath(kitRef);
  }

  /**
   * R2 failure contract: every convention-derived file for every artifact in
   * artifact_flow must exist at load, or we fail fast naming the kit, the
   * artifact, and the exact expected path. A missing validator is a hard
   * error — never "no validator to run".
   */
  private async validateConvention(
    abbr: string,
    kitPath: string,
    flow: FlowDefinition,
  ): Promise<void> {
    const missing: string[] = [];
    for (const step of flow.steps) {
      const files = step.fourFiles;
      const expected: string[] = [files.spec, files.template, files.validator];
      if (files.prompt !== null) {
        expected.push(files.prompt);
      }
      for (const rel of expected) {
        if (!(await this.fs.exists(path.join(kitPath, rel)))) {
          missing.push(
            `${abbr}/${step.produces.artifactIdPrefix}: expected ${rel}, not found`,
          );
        }
      }
    }
    if (missing.length > 0) {
      throw new ConventionResolutionError(missing.join('; '));
    }
  }
}
