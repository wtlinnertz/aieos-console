import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StateService } from '../state-service.js';
import type { IFilesystemService } from '../filesystem-service.js';
import type { ProjectState } from '../state-types.js';
import {
  FileNotFoundError,
  ProjectAlreadyInitializedError,
  StateNotFoundError,
  StateCorruptedError,
} from '../errors.js';

function createMockFs(overrides?: Partial<IFilesystemService>): IFilesystemService {
  return {
    readFile: vi.fn().mockRejectedValue(new FileNotFoundError('Not found')),
    writeFileAtomic: vi.fn().mockResolvedValue(undefined),
    readDirectory: vi.fn().mockResolvedValue([]),
    exists: vi.fn().mockResolvedValue(false),
    createDirectory: vi.fn().mockResolvedValue(undefined),
    acquireLock: vi.fn().mockResolvedValue({ acquired: true }),
    releaseLock: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeValidState(overrides?: Partial<ProjectState>): ProjectState {
  return {
    projectId: 'test-uuid',
    kitConfigs: [{ kitId: 'pik', kitPath: '/kits/pik' }],
    llmConfigs: [{ providerId: 'anthropic', model: 'claude', apiKeyEnvVar: 'API_KEY' }],
    artifacts: [],
    llmUsage: [],
    ...overrides,
  };
}

describe('StateService', () => {
  let mockFs: IFilesystemService;
  let service: StateService;

  beforeEach(() => {
    mockFs = createMockFs();
    service = new StateService(mockFs);
  });

  describe('acceptance tests', () => {
    it('AT-1: initializeProject creates .aieos/state.json with valid schema', async () => {
      const kitConfigs = [{ kitId: 'pik', kitPath: '/kits/pik' }];
      const llmConfigs = [{ providerId: 'anthropic', model: 'claude', apiKeyEnvVar: 'KEY' }];

      await service.initializeProject('/project', kitConfigs, llmConfigs);

      expect(mockFs.createDirectory).toHaveBeenCalledWith('/project/.aieos');
      expect(mockFs.writeFileAtomic).toHaveBeenCalledWith(
        '/project/.aieos/state.json',
        expect.any(String),
      );

      const writtenJson = (mockFs.writeFileAtomic as ReturnType<typeof vi.fn>).mock.calls[0][1];
      const state = JSON.parse(writtenJson) as ProjectState;
      expect(state.projectId).toBeTruthy();
      expect(state.kitConfigs).toEqual(kitConfigs);
      expect(state.llmConfigs).toEqual(llmConfigs);
      expect(state.artifacts).toEqual([]);
      expect(state.llmUsage).toEqual([]);
    });

    it('AT-2: loadState returns correctly typed ProjectState', async () => {
      const validState = makeValidState();
      mockFs = createMockFs({
        readFile: vi.fn().mockResolvedValue({
          content: JSON.stringify(validState),
          encoding: 'utf-8',
        }),
      });
      service = new StateService(mockFs);

      const result = await service.loadState('/project');

      expect(result.projectId).toBe('test-uuid');
      expect(result.kitConfigs).toEqual(validState.kitConfigs);
      expect(result.artifacts).toEqual([]);
    });

    it('AT-3: loadState throws StateCorruptedError on missing required fields', async () => {
      mockFs = createMockFs({
        readFile: vi.fn().mockResolvedValue({
          content: JSON.stringify({ kitConfigs: [] }),
          encoding: 'utf-8',
        }),
      });
      service = new StateService(mockFs);

      await expect(service.loadState('/project')).rejects.toThrow(
        StateCorruptedError,
      );
    });
  });

  describe('failure tests', () => {
    it('FT-1: initializeProject throws ProjectAlreadyInitializedError', async () => {
      mockFs = createMockFs({
        exists: vi.fn().mockResolvedValue(true),
      });
      service = new StateService(mockFs);

      await expect(
        service.initializeProject('/project', [], []),
      ).rejects.toThrow(ProjectAlreadyInitializedError);
    });

    it('FT-2: loadState throws StateNotFoundError when state.json missing', async () => {
      await expect(service.loadState('/project')).rejects.toThrow(
        StateNotFoundError,
      );
    });

    it('FT-3: loadState throws StateCorruptedError on invalid JSON', async () => {
      mockFs = createMockFs({
        readFile: vi.fn().mockResolvedValue({
          content: '{invalid json',
          encoding: 'utf-8',
        }),
      });
      service = new StateService(mockFs);

      await expect(service.loadState('/project')).rejects.toThrow(
        StateCorruptedError,
      );
    });
  });

  describe('edge cases', () => {
    it('EC-1: roundtrip — initializeProject then loadState', async () => {
      let stored = '';
      mockFs = createMockFs({
        exists: vi.fn().mockResolvedValue(false),
        writeFileAtomic: vi.fn().mockImplementation(async (_p: string, content: string) => {
          stored = content;
        }),
        readFile: vi.fn().mockImplementation(async () => ({
          content: stored,
          encoding: 'utf-8' as const,
        })),
      });
      service = new StateService(mockFs);

      await service.initializeProject('/project', [{ kitId: 'pik', kitPath: '/kits/pik' }], []);
      const state = await service.loadState('/project');

      expect(state.projectId).toBeTruthy();
      expect(state.kitConfigs).toEqual([{ kitId: 'pik', kitPath: '/kits/pik' }]);
      expect(state.artifacts).toEqual([]);
    });

    it('EC-2: initializeProject generates a non-empty projectId', async () => {
      await service.initializeProject('/project', [], []);

      const writtenJson = (mockFs.writeFileAtomic as ReturnType<typeof vi.fn>).mock.calls[0][1];
      const state = JSON.parse(writtenJson) as ProjectState;
      expect(state.projectId).toBeTruthy();
      expect(typeof state.projectId).toBe('string');
      expect(state.projectId.length).toBeGreaterThan(0);
    });

    it('EC-3: kitConfigs and llmConfigs stored in state', async () => {
      const kitConfigs = [
        { kitId: 'pik', kitPath: '/kits/pik' },
        { kitId: 'eek', kitPath: '/kits/eek' },
      ];
      const llmConfigs = [
        { providerId: 'anthropic', model: 'claude', apiKeyEnvVar: 'KEY' },
      ];

      let stored = '';
      mockFs = createMockFs({
        writeFileAtomic: vi.fn().mockImplementation(async (_p: string, content: string) => {
          stored = content;
        }),
        readFile: vi.fn().mockImplementation(async () => ({
          content: stored,
          encoding: 'utf-8' as const,
        })),
      });
      service = new StateService(mockFs);

      await service.initializeProject('/project', kitConfigs, llmConfigs);
      const state = await service.loadState('/project');

      expect(state.kitConfigs).toEqual(kitConfigs);
      expect(state.llmConfigs).toEqual(llmConfigs);
    });

    it('EC-4: state with artifacts and llmUsage loads correctly', async () => {
      const stateWithData = makeValidState({
        artifacts: [
          {
            stepId: 'step-1',
            kitId: 'pik',
            artifactId: 'PRD-TEST-001',
            status: 'frozen',
            artifactPath: 'artifacts/01-prd.md',
            validationResult: {
              status: 'PASS',
              summary: 'All good',
              hardGates: { completeness: 'PASS' },
              blockingIssues: [],
              warnings: [],
              completenessScore: 95,
            },
            frozenAt: '2026-03-08T00:00:00Z',
            lastModified: '2026-03-08T00:00:00Z',
          },
        ],
        llmUsage: [
          {
            stepId: 'step-1',
            artifactId: 'PRD-TEST-001',
            provider: 'anthropic',
            model: 'claude',
            inputTokens: 1000,
            outputTokens: 500,
            durationMs: 2000,
            timestamp: '2026-03-08T00:00:00Z',
            phase: 'generation',
          },
        ],
      });
      mockFs = createMockFs({
        readFile: vi.fn().mockResolvedValue({
          content: JSON.stringify(stateWithData),
          encoding: 'utf-8',
        }),
      });
      service = new StateService(mockFs);

      const result = await service.loadState('/project');

      expect(result.artifacts).toHaveLength(1);
      expect(result.artifacts[0].status).toBe('frozen');
      expect(result.llmUsage).toHaveLength(1);
      expect(result.llmUsage[0].inputTokens).toBe(1000);
    });

    it('EC-5: missing artifacts field triggers StateCorruptedError', async () => {
      mockFs = createMockFs({
        readFile: vi.fn().mockResolvedValue({
          content: JSON.stringify({
            projectId: 'test',
            kitConfigs: [],
            llmConfigs: [],
            llmUsage: [],
          }),
          encoding: 'utf-8',
        }),
      });
      service = new StateService(mockFs);

      await expect(service.loadState('/project')).rejects.toThrow(
        StateCorruptedError,
      );
    });
  });
});
