import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StateService } from '../state-service.js';
import type { IFilesystemService } from '../filesystem-service.js';
import type { ProjectState, ArtifactState, LlmUsageRecord } from '../state-types.js';
import {
  StepNotFoundError,
  InvalidTransitionError,
  FileNotFoundError,
  EngagementRecordNotFoundError,
} from '../errors.js';

function makeState(overrides?: Partial<ProjectState>): ProjectState {
  return {
    projectId: 'test-uuid',
    kitConfigs: [],
    llmConfigs: [],
    artifacts: [],
    llmUsage: [],
    ...overrides,
  };
}

function makeArtifact(overrides?: Partial<ArtifactState>): ArtifactState {
  return {
    stepId: 'step-1',
    kitId: 'pik',
    artifactId: null,
    status: 'not-started',
    artifactPath: null,
    validationResult: null,
    frozenAt: null,
    lastModified: '2026-03-08T00:00:00Z',
    ...overrides,
  };
}

function createStatefulMockFs(initialState: ProjectState): IFilesystemService {
  let stored = JSON.stringify(initialState);
  return {
    readFile: vi.fn().mockImplementation(async (p: string) => {
      if (p.endsWith('state.json')) {
        return { content: stored, encoding: 'utf-8' as const };
      }
      if (p.endsWith('er.md')) {
        return { content: '# Engagement Record\n\n| ID | Type | Status | Notes |\n', encoding: 'utf-8' as const };
      }
      throw new FileNotFoundError(`Not found: ${p}`);
    }),
    writeFileAtomic: vi.fn().mockImplementation(async (p: string, content: string) => {
      if (p.endsWith('state.json')) {
        stored = content;
      }
    }),
    readDirectory: vi.fn().mockResolvedValue([]),
    exists: vi.fn().mockResolvedValue(false),
    createDirectory: vi.fn().mockResolvedValue(undefined),
    acquireLock: vi.fn().mockResolvedValue({ acquired: true }),
    releaseLock: vi.fn().mockResolvedValue(undefined),
  };
}

describe('State Transitions', () => {
  let mockFs: IFilesystemService;
  let service: StateService;

  describe('getArtifactState', () => {
    it('returns correct artifact state', async () => {
      const artifact = makeArtifact({ stepId: 'step-1', status: 'draft' });
      mockFs = createStatefulMockFs(makeState({ artifacts: [artifact] }));
      service = new StateService(mockFs);

      const result = await service.getArtifactState('/project', 'step-1');
      expect(result.status).toBe('draft');
      expect(result.stepId).toBe('step-1');
    });

    it('throws StepNotFoundError for missing step', async () => {
      mockFs = createStatefulMockFs(makeState());
      service = new StateService(mockFs);

      await expect(
        service.getArtifactState('/project', 'missing'),
      ).rejects.toThrow(StepNotFoundError);
    });
  });

  describe('valid transitions', () => {
    beforeEach(() => {
      mockFs = createStatefulMockFs(makeState({
        artifacts: [makeArtifact({ stepId: 'step-1', status: 'not-started' })],
      }));
      service = new StateService(mockFs);
    });

    it('not-started → in-progress', async () => {
      await service.updateArtifactState('/project', 'step-1', { status: 'in-progress' });
      const result = await service.getArtifactState('/project', 'step-1');
      expect(result.status).toBe('in-progress');
    });

    it('in-progress → draft', async () => {
      mockFs = createStatefulMockFs(makeState({
        artifacts: [makeArtifact({ stepId: 'step-1', status: 'in-progress' })],
      }));
      service = new StateService(mockFs);

      await service.updateArtifactState('/project', 'step-1', { status: 'draft' });
      const result = await service.getArtifactState('/project', 'step-1');
      expect(result.status).toBe('draft');
    });

    it('draft → validated-pass', async () => {
      mockFs = createStatefulMockFs(makeState({
        artifacts: [makeArtifact({ stepId: 'step-1', status: 'draft' })],
      }));
      service = new StateService(mockFs);

      await service.updateArtifactState('/project', 'step-1', { status: 'validated-pass' });
      const result = await service.getArtifactState('/project', 'step-1');
      expect(result.status).toBe('validated-pass');
    });

    it('draft → validated-fail', async () => {
      mockFs = createStatefulMockFs(makeState({
        artifacts: [makeArtifact({ stepId: 'step-1', status: 'draft' })],
      }));
      service = new StateService(mockFs);

      await service.updateArtifactState('/project', 'step-1', { status: 'validated-fail' });
      const result = await service.getArtifactState('/project', 'step-1');
      expect(result.status).toBe('validated-fail');
    });

    it('validated-fail → draft', async () => {
      mockFs = createStatefulMockFs(makeState({
        artifacts: [makeArtifact({ stepId: 'step-1', status: 'validated-fail' })],
      }));
      service = new StateService(mockFs);

      await service.updateArtifactState('/project', 'step-1', { status: 'draft' });
      const result = await service.getArtifactState('/project', 'step-1');
      expect(result.status).toBe('draft');
    });

    it('validated-pass → frozen', async () => {
      mockFs = createStatefulMockFs(makeState({
        artifacts: [makeArtifact({ stepId: 'step-1', status: 'validated-pass' })],
      }));
      service = new StateService(mockFs);

      await service.updateArtifactState('/project', 'step-1', { status: 'frozen' });
      const result = await service.getArtifactState('/project', 'step-1');
      expect(result.status).toBe('frozen');
    });
  });

  describe('invalid transitions', () => {
    it('frozen → in-progress throws InvalidTransitionError', async () => {
      mockFs = createStatefulMockFs(makeState({
        artifacts: [makeArtifact({ stepId: 'step-1', status: 'frozen' })],
      }));
      service = new StateService(mockFs);

      await expect(
        service.updateArtifactState('/project', 'step-1', { status: 'in-progress' }),
      ).rejects.toThrow(InvalidTransitionError);
    });

    it('not-started → draft throws InvalidTransitionError', async () => {
      mockFs = createStatefulMockFs(makeState({
        artifacts: [makeArtifact({ stepId: 'step-1', status: 'not-started' })],
      }));
      service = new StateService(mockFs);

      await expect(
        service.updateArtifactState('/project', 'step-1', { status: 'draft' }),
      ).rejects.toThrow(InvalidTransitionError);
    });

    it('in-progress → frozen throws InvalidTransitionError', async () => {
      mockFs = createStatefulMockFs(makeState({
        artifacts: [makeArtifact({ stepId: 'step-1', status: 'in-progress' })],
      }));
      service = new StateService(mockFs);

      await expect(
        service.updateArtifactState('/project', 'step-1', { status: 'frozen' }),
      ).rejects.toThrow(InvalidTransitionError);
    });

    it('frozen → any other status throws InvalidTransitionError', async () => {
      mockFs = createStatefulMockFs(makeState({
        artifacts: [makeArtifact({ stepId: 'step-1', status: 'frozen' })],
      }));
      service = new StateService(mockFs);

      for (const status of ['not-started', 'in-progress', 'draft', 'validated-pass', 'validated-fail'] as const) {
        await expect(
          service.updateArtifactState('/project', 'step-1', { status }),
        ).rejects.toThrow(InvalidTransitionError);
      }
    });
  });

  describe('lastModified', () => {
    it('updated on every transition', async () => {
      mockFs = createStatefulMockFs(makeState({
        artifacts: [makeArtifact({ stepId: 'step-1', status: 'not-started', lastModified: '2026-01-01T00:00:00Z' })],
      }));
      service = new StateService(mockFs);

      await service.updateArtifactState('/project', 'step-1', { status: 'in-progress' });
      const result = await service.getArtifactState('/project', 'step-1');
      expect(result.lastModified).not.toBe('2026-01-01T00:00:00Z');
      expect(new Date(result.lastModified).toISOString()).toBe(result.lastModified);
    });
  });

  describe('saveArtifact', () => {
    it('writes file and updates artifactPath in state', async () => {
      mockFs = createStatefulMockFs(makeState({
        artifacts: [makeArtifact({ stepId: 'step-1', status: 'draft' })],
      }));
      service = new StateService(mockFs);

      const resultPath = await service.saveArtifact('/project', 'step-1', '# PRD Content', '01-prd.md');

      expect(resultPath).toBe('docs/sdlc/01-prd.md');
      expect(mockFs.writeFileAtomic).toHaveBeenCalledWith(
        '/project/docs/sdlc/01-prd.md',
        '# PRD Content',
      );

      const artifact = await service.getArtifactState('/project', 'step-1');
      expect(artifact.artifactPath).toBe('docs/sdlc/01-prd.md');
    });
  });

  describe('recordLlmUsage', () => {
    it('appends record and persists', async () => {
      mockFs = createStatefulMockFs(makeState());
      service = new StateService(mockFs);

      const record: LlmUsageRecord = {
        stepId: 'step-1',
        artifactId: 'PRD-TEST-001',
        provider: 'anthropic',
        model: 'claude',
        inputTokens: 1000,
        outputTokens: 500,
        durationMs: 2000,
        timestamp: '2026-03-08T00:00:00Z',
        phase: 'generation',
      };

      await service.recordLlmUsage('/project', record);

      const state = await service.loadState('/project');
      expect(state.llmUsage).toHaveLength(1);
      expect(state.llmUsage[0].inputTokens).toBe(1000);
    });
  });

  describe('updateEngagementRecord', () => {
    it('reads, updates, and writes ER file', async () => {
      mockFs = createStatefulMockFs(makeState());
      service = new StateService(mockFs);

      await service.updateEngagementRecord(
        '/project', 'PRD-TEST-001', 'PRD', 'frozen', 'Generated by LLM',
      );

      expect(mockFs.writeFileAtomic).toHaveBeenCalledWith(
        '/project/docs/engagement/er.md',
        expect.stringContaining('PRD-TEST-001'),
      );
    });

    it('throws EngagementRecordNotFoundError when ER missing', async () => {
      mockFs = createStatefulMockFs(makeState());
      (mockFs.readFile as ReturnType<typeof vi.fn>).mockImplementation(async (p: string) => {
        if (p.endsWith('state.json')) {
          return { content: JSON.stringify(makeState()), encoding: 'utf-8' };
        }
        throw new FileNotFoundError(`Not found: ${p}`);
      });
      service = new StateService(mockFs);

      await expect(
        service.updateEngagementRecord('/project', 'PRD-TEST-001', 'PRD', 'frozen', 'Notes'),
      ).rejects.toThrow(EngagementRecordNotFoundError);
    });
  });
});
