import { describe, it, expect, vi } from 'vitest';
import { assembleStepInputs } from '../step-input-assembly.js';
import type { IArtifactStateProvider } from '../step-input-assembly.js';
import type { IFilesystemService } from '../filesystem-service.js';
import type { FlowDefinition } from '../flow-types.js';
import { StepNotFoundError, InputFileNotFoundError } from '../errors.js';

function makeFlow(overrides?: Partial<FlowDefinition>): FlowDefinition {
  return {
    kit: { name: 'Test', id: 'test', version: '1.0' },
    steps: [
      {
        id: 'step-1',
        name: 'Step One',
        artifactType: 'prd',
        stepType: 'llm-generated',
        dependencies: [],
        fourFiles: {
          spec: 'docs/specs/prd-spec.md',
          template: 'docs/artifacts/prd-template.md',
          prompt: 'docs/prompts/prd-prompt.md',
          validator: 'docs/validators/prd-validator.md',
        },
        requiredInputs: [
          { path: 'docs/brief.md', role: 'brief' },
          { path: 'docs/goals.md', role: 'goals' },
        ],
        produces: { artifactIdPrefix: 'PRD', outputFilename: '01-prd.md' },
        freezeGate: true,
      },
    ],
    ...overrides,
  };
}

function makeMockFs(
  fileContents: Record<string, string> = {},
): IFilesystemService {
  return {
    readFile: vi.fn().mockImplementation(async (p: string) => {
      if (p in fileContents) {
        return { content: fileContents[p], encoding: 'utf-8' as const };
      }
      throw new Error(`File not found: ${p}`);
    }),
    writeFileAtomic: vi.fn(),
    readDirectory: vi.fn(),
    exists: vi.fn().mockResolvedValue(true),
    createDirectory: vi.fn(),
    acquireLock: vi.fn(),
    releaseLock: vi.fn(),
  };
}

function makeArtifactState(
  paths: Record<string, string | undefined> = {},
): IArtifactStateProvider {
  return {
    getArtifactPath: (stepId: string) => paths[stepId],
  };
}

describe('assembleStepInputs', () => {
  const kitPath = '/kits/pik';
  const projectDir = '/projects/myproject';

  describe('acceptance tests', () => {
    it('AT-1: returns four-file content and required_inputs with roles', async () => {
      const files: Record<string, string> = {
        '/kits/pik/docs/specs/prd-spec.md': 'spec content',
        '/kits/pik/docs/artifacts/prd-template.md': 'template content',
        '/kits/pik/docs/prompts/prd-prompt.md': 'prompt content',
        '/kits/pik/docs/validators/prd-validator.md': 'validator content',
        '/kits/pik/docs/brief.md': 'brief content',
        '/kits/pik/docs/goals.md': 'goals content',
      };
      const mockFs = makeMockFs(files);
      const flow = makeFlow();

      const result = await assembleStepInputs(
        mockFs, flow, kitPath, 'step-1', projectDir, makeArtifactState(),
      );

      expect(result.spec).toBe('spec content');
      expect(result.template).toBe('template content');
      expect(result.prompt).toBe('prompt content');
      expect(result.validator).toBe('validator content');
      expect(result.requiredInputs).toHaveLength(2);
      expect(result.requiredInputs[0]).toEqual({
        name: 'brief.md',
        role: 'brief',
        content: 'brief content',
      });
      expect(result.requiredInputs[1]).toEqual({
        name: 'goals.md',
        role: 'goals',
        content: 'goals content',
      });
    });

    it('AT-2: upstream frozen artifacts included', async () => {
      const flow = makeFlow({
        steps: [
          {
            id: 'step-a',
            name: 'A',
            artifactType: 'prd',
            stepType: 'llm-generated',
            dependencies: [],
            fourFiles: { spec: 's.md', template: 't.md', prompt: 'p.md', validator: 'v.md' },
            requiredInputs: [],
            produces: { artifactIdPrefix: 'PRD', outputFilename: '01.md' },
            freezeGate: true,
          },
          {
            id: 'step-b',
            name: 'B',
            artifactType: 'acf',
            stepType: 'acceptance-check',
            dependencies: ['step-a'],
            fourFiles: { spec: 's2.md', template: 't2.md', prompt: null, validator: 'v2.md' },
            requiredInputs: [],
            produces: { artifactIdPrefix: 'ACF', outputFilename: '02.md' },
            freezeGate: false,
          },
        ],
      });

      const files: Record<string, string> = {
        '/kits/pik/s2.md': 'spec2',
        '/kits/pik/t2.md': 'template2',
        '/kits/pik/v2.md': 'validator2',
        '/projects/myproject/artifacts/01-prd.md': 'frozen prd content',
      };
      const mockFs = makeMockFs(files);
      const artifactState = makeArtifactState({
        'step-a': 'artifacts/01-prd.md',
      });

      const result = await assembleStepInputs(
        mockFs, flow, kitPath, 'step-b', projectDir, artifactState,
      );

      expect(result.upstreamArtifacts).toHaveLength(1);
      expect(result.upstreamArtifacts[0]).toEqual({
        name: '01-prd.md',
        role: 'upstream:step-a',
        content: 'frozen prd content',
      });
    });

    it('AT-3: missing required_input throws InputFileNotFoundError', async () => {
      const files: Record<string, string> = {
        '/kits/pik/docs/specs/prd-spec.md': 'spec',
        '/kits/pik/docs/artifacts/prd-template.md': 'template',
        '/kits/pik/docs/prompts/prd-prompt.md': 'prompt',
        '/kits/pik/docs/validators/prd-validator.md': 'validator',
        // brief.md exists but goals.md is missing
        '/kits/pik/docs/brief.md': 'brief',
      };
      const mockFs = makeMockFs(files);

      await expect(
        assembleStepInputs(
          mockFs, makeFlow(), kitPath, 'step-1', projectDir, makeArtifactState(),
        ),
      ).rejects.toThrow(InputFileNotFoundError);
    });
  });

  describe('failure tests', () => {
    it('FT-1: StepNotFoundError for non-existent stepId', async () => {
      const mockFs = makeMockFs();

      await expect(
        assembleStepInputs(
          mockFs, makeFlow(), kitPath, 'missing-step', projectDir, makeArtifactState(),
        ),
      ).rejects.toThrow(StepNotFoundError);
    });

    it('FT-2: upstream artifact not frozen throws InputFileNotFoundError', async () => {
      const flow = makeFlow({
        steps: [
          {
            id: 'step-a',
            name: 'A',
            artifactType: 'prd',
            stepType: 'llm-generated',
            dependencies: [],
            fourFiles: { spec: 's.md', template: 't.md', prompt: 'p.md', validator: 'v.md' },
            requiredInputs: [],
            produces: { artifactIdPrefix: 'PRD', outputFilename: '01.md' },
            freezeGate: true,
          },
          {
            id: 'step-b',
            name: 'B',
            artifactType: 'acf',
            stepType: 'acceptance-check',
            dependencies: ['step-a'],
            fourFiles: { spec: 's2.md', template: 't2.md', prompt: null, validator: 'v2.md' },
            requiredInputs: [],
            produces: { artifactIdPrefix: 'ACF', outputFilename: '02.md' },
            freezeGate: false,
          },
        ],
      });
      const files: Record<string, string> = {
        '/kits/pik/s2.md': 'spec2',
        '/kits/pik/t2.md': 'template2',
        '/kits/pik/v2.md': 'validator2',
      };
      const mockFs = makeMockFs(files);
      // step-a has no artifact path (not frozen)
      const artifactState = makeArtifactState({});

      await expect(
        assembleStepInputs(
          mockFs, flow, kitPath, 'step-b', projectDir, artifactState,
        ),
      ).rejects.toThrow(InputFileNotFoundError);
    });
  });

  describe('edge cases', () => {
    it('EC-1: null prompt returns null', async () => {
      const flow = makeFlow({
        steps: [
          {
            id: 'step-1',
            name: 'Step',
            artifactType: 'prd',
            stepType: 'human-intake',
            dependencies: [],
            fourFiles: { spec: 's.md', template: 't.md', prompt: null, validator: 'v.md' },
            requiredInputs: [],
            produces: { artifactIdPrefix: 'PRD', outputFilename: '01.md' },
            freezeGate: false,
          },
        ],
      });
      const files: Record<string, string> = {
        '/kits/pik/s.md': 'spec',
        '/kits/pik/t.md': 'template',
        '/kits/pik/v.md': 'validator',
      };
      const mockFs = makeMockFs(files);

      const result = await assembleStepInputs(
        mockFs, flow, kitPath, 'step-1', projectDir, makeArtifactState(),
      );

      expect(result.prompt).toBeNull();
    });

    it('EC-2: empty requiredInputs returns empty array', async () => {
      const flow = makeFlow({
        steps: [
          {
            id: 'step-1',
            name: 'Step',
            artifactType: 'prd',
            stepType: 'llm-generated',
            dependencies: [],
            fourFiles: { spec: 's.md', template: 't.md', prompt: 'p.md', validator: 'v.md' },
            requiredInputs: [],
            produces: { artifactIdPrefix: 'PRD', outputFilename: '01.md' },
            freezeGate: false,
          },
        ],
      });
      const files: Record<string, string> = {
        '/kits/pik/s.md': 'spec',
        '/kits/pik/t.md': 'template',
        '/kits/pik/p.md': 'prompt',
        '/kits/pik/v.md': 'validator',
      };
      const mockFs = makeMockFs(files);

      const result = await assembleStepInputs(
        mockFs, flow, kitPath, 'step-1', projectDir, makeArtifactState(),
      );

      expect(result.requiredInputs).toEqual([]);
    });

    it('EC-3: step with no dependencies returns empty upstreamArtifacts', async () => {
      const files: Record<string, string> = {
        '/kits/pik/docs/specs/prd-spec.md': 'spec',
        '/kits/pik/docs/artifacts/prd-template.md': 'template',
        '/kits/pik/docs/prompts/prd-prompt.md': 'prompt',
        '/kits/pik/docs/validators/prd-validator.md': 'validator',
        '/kits/pik/docs/brief.md': 'brief',
        '/kits/pik/docs/goals.md': 'goals',
      };
      const mockFs = makeMockFs(files);

      const result = await assembleStepInputs(
        mockFs, makeFlow(), kitPath, 'step-1', projectDir, makeArtifactState(),
      );

      expect(result.upstreamArtifacts).toEqual([]);
    });

    it('EC-4: four-file paths resolved relative to kit directory', async () => {
      const files: Record<string, string> = {
        '/kits/pik/docs/specs/prd-spec.md': 'spec',
        '/kits/pik/docs/artifacts/prd-template.md': 'template',
        '/kits/pik/docs/prompts/prd-prompt.md': 'prompt',
        '/kits/pik/docs/validators/prd-validator.md': 'validator',
        '/kits/pik/docs/brief.md': 'brief',
        '/kits/pik/docs/goals.md': 'goals',
      };
      const mockFs = makeMockFs(files);

      await assembleStepInputs(
        mockFs, makeFlow(), kitPath, 'step-1', projectDir, makeArtifactState(),
      );

      expect(mockFs.readFile).toHaveBeenCalledWith('/kits/pik/docs/specs/prd-spec.md');
      expect(mockFs.readFile).toHaveBeenCalledWith('/kits/pik/docs/artifacts/prd-template.md');
      expect(mockFs.readFile).toHaveBeenCalledWith('/kits/pik/docs/prompts/prd-prompt.md');
      expect(mockFs.readFile).toHaveBeenCalledWith('/kits/pik/docs/validators/prd-validator.md');
    });
  });
});
