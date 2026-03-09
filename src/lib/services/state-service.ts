import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type { IFilesystemService } from './filesystem-service.js';
import {
  FileNotFoundError,
  ProjectAlreadyInitializedError,
  StateNotFoundError,
  StateCorruptedError,
  StepNotFoundError,
  InvalidTransitionError,
  EngagementRecordNotFoundError,
} from './errors.js';
import type {
  ProjectState,
  KitConfig,
  LlmConfig,
  ArtifactState,
  ArtifactStatus,
  LlmUsageRecord,
} from './state-types.js';

const VALID_TRANSITIONS: Record<string, Set<string>> = {
  'not-started': new Set(['in-progress']),
  'in-progress': new Set(['draft']),
  'draft': new Set(['validated-pass', 'validated-fail']),
  'validated-fail': new Set(['draft']),
  'validated-pass': new Set(['frozen', 'draft']),
  'frozen': new Set(),
};

export interface IStateService {
  initializeProject(
    projectDir: string,
    kitConfigs: KitConfig[],
    llmConfigs: LlmConfig[],
  ): Promise<void>;
  loadState(projectDir: string): Promise<ProjectState>;
  getArtifactState(projectDir: string, stepId: string): Promise<ArtifactState>;
  updateArtifactState(
    projectDir: string,
    stepId: string,
    update: Partial<ArtifactState>,
  ): Promise<void>;
  saveArtifact(
    projectDir: string,
    stepId: string,
    content: string,
    filename: string,
  ): Promise<string>;
  recordLlmUsage(projectDir: string, record: LlmUsageRecord): Promise<void>;
  updateEngagementRecord(
    projectDir: string,
    artifactId: string,
    artifactType: string,
    status: string,
    notes: string,
  ): Promise<void>;
}

export class StateService implements IStateService {
  private readonly fs: IFilesystemService;

  constructor(filesystemService: IFilesystemService) {
    this.fs = filesystemService;
  }

  async initializeProject(
    projectDir: string,
    kitConfigs: KitConfig[],
    llmConfigs: LlmConfig[],
  ): Promise<void> {
    const statePath = this.statePath(projectDir);

    const exists = await this.fs.exists(statePath);
    if (exists) {
      throw new ProjectAlreadyInitializedError(
        `Project already initialized: ${projectDir}`,
      );
    }

    const aieosDir = path.join(projectDir, '.aieos');
    await this.fs.createDirectory(aieosDir);

    const initialState: ProjectState = {
      projectId: crypto.randomUUID(),
      kitConfigs,
      llmConfigs,
      artifacts: [],
      llmUsage: [],
    };

    await this.fs.writeFileAtomic(statePath, JSON.stringify(initialState, null, 2));
  }

  async loadState(projectDir: string): Promise<ProjectState> {
    const statePath = this.statePath(projectDir);

    let content: string;
    try {
      const result = await this.fs.readFile(statePath);
      content = result.content;
    } catch (err) {
      if (err instanceof FileNotFoundError) {
        throw new StateNotFoundError(
          `State file not found: ${statePath}`,
        );
      }
      throw err;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new StateCorruptedError('State file contains invalid JSON');
    }

    return this.validateState(parsed);
  }

  async getArtifactState(
    projectDir: string,
    stepId: string,
  ): Promise<ArtifactState> {
    const state = await this.loadState(projectDir);
    const artifact = state.artifacts.find((a) => a.stepId === stepId);
    if (!artifact) {
      throw new StepNotFoundError(
        `No artifact state for step "${stepId}"`,
      );
    }
    return artifact;
  }

  async updateArtifactState(
    projectDir: string,
    stepId: string,
    update: Partial<ArtifactState>,
  ): Promise<void> {
    const state = await this.loadState(projectDir);
    const idx = state.artifacts.findIndex((a) => a.stepId === stepId);

    if (idx === -1) {
      // Create new artifact entry if it doesn't exist
      const newArtifact: ArtifactState = {
        stepId,
        kitId: '',
        artifactId: null,
        status: 'not-started',
        artifactPath: null,
        validationResult: null,
        frozenAt: null,
        lastModified: new Date().toISOString(),
        ...update,
      };

      if (update.status && update.status !== 'not-started') {
        this.validateTransition('not-started', update.status, stepId);
      }

      newArtifact.lastModified = new Date().toISOString();
      state.artifacts.push(newArtifact);
    } else {
      const current = state.artifacts[idx];

      if (update.status && update.status !== current.status) {
        this.validateTransition(current.status, update.status, stepId);
      }

      state.artifacts[idx] = {
        ...current,
        ...update,
        lastModified: new Date().toISOString(),
      };
    }

    await this.persistState(projectDir, state);
  }

  async saveArtifact(
    projectDir: string,
    stepId: string,
    content: string,
    filename: string,
  ): Promise<string> {
    const relativePath = path.join('docs', 'sdlc', filename);
    const fullPath = path.join(projectDir, relativePath);

    await this.fs.writeFileAtomic(fullPath, content);

    const state = await this.loadState(projectDir);
    const idx = state.artifacts.findIndex((a) => a.stepId === stepId);
    if (idx !== -1) {
      state.artifacts[idx].artifactPath = relativePath;
      state.artifacts[idx].lastModified = new Date().toISOString();
      await this.persistState(projectDir, state);
    }

    return relativePath;
  }

  async recordLlmUsage(
    projectDir: string,
    record: LlmUsageRecord,
  ): Promise<void> {
    const state = await this.loadState(projectDir);
    state.llmUsage.push(record);
    await this.persistState(projectDir, state);
  }

  async updateEngagementRecord(
    projectDir: string,
    artifactId: string,
    artifactType: string,
    status: string,
    notes: string,
  ): Promise<void> {
    const erPath = path.join(projectDir, 'docs', 'engagement', 'er.md');

    let content: string;
    try {
      const result = await this.fs.readFile(erPath);
      content = result.content;
    } catch (err) {
      if (err instanceof FileNotFoundError) {
        throw new EngagementRecordNotFoundError(
          `Engagement Record not found: ${erPath}`,
        );
      }
      throw err;
    }

    const entry = `| ${artifactId} | ${artifactType} | ${status} | ${notes} |`;
    const updatedContent = content.trimEnd() + '\n' + entry + '\n';

    await this.fs.writeFileAtomic(erPath, updatedContent);
  }

  private validateTransition(
    from: ArtifactStatus,
    to: ArtifactStatus,
    stepId: string,
  ): void {
    const allowed = VALID_TRANSITIONS[from];
    if (!allowed || !allowed.has(to)) {
      throw new InvalidTransitionError(
        `Invalid transition for step "${stepId}": ${from} → ${to}`,
      );
    }

    // Note: For not-started → in-progress, dependency checking (all deps frozen)
    // is the responsibility of the orchestration layer (WDD-CONSOLE-009),
    // which has access to the flow definition. The state service validates
    // transition legality only.
  }

  private statePath(projectDir: string): string {
    return path.join(projectDir, '.aieos', 'state.json');
  }

  private async persistState(
    projectDir: string,
    state: ProjectState,
  ): Promise<void> {
    const statePath = this.statePath(projectDir);
    await this.fs.writeFileAtomic(statePath, JSON.stringify(state, null, 2));
  }

  private validateState(data: unknown): ProjectState {
    if (data === null || typeof data !== 'object') {
      throw new StateCorruptedError('State must be a JSON object');
    }

    const obj = data as Record<string, unknown>;

    if (typeof obj.projectId !== 'string') {
      throw new StateCorruptedError('Missing required field: projectId');
    }
    if (!Array.isArray(obj.kitConfigs)) {
      throw new StateCorruptedError('Missing required field: kitConfigs');
    }
    if (!Array.isArray(obj.llmConfigs)) {
      throw new StateCorruptedError('Missing required field: llmConfigs');
    }
    if (!Array.isArray(obj.artifacts)) {
      throw new StateCorruptedError('Missing required field: artifacts');
    }
    if (!Array.isArray(obj.llmUsage)) {
      throw new StateCorruptedError('Missing required field: llmUsage');
    }

    return obj as unknown as ProjectState;
  }
}
