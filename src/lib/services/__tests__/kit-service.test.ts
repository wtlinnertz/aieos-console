import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KitService } from '../kit-service.js';
import type { IFilesystemService } from '../filesystem-service.js';
import {
  FileNotFoundError,
  FlowDefinitionNotFoundError,
  FlowDefinitionParseError,
} from '../errors.js';

const VALID_FLOW_YAML = `
kit:
  name: "Test Kit"
  id: "test-kit"
  version: "1.0.0"
steps:
  - id: "step-1"
    name: "Generate PRD"
    artifact_type: "prd"
    step_type: "llm-generated"
    dependencies: []
    four_files:
      spec: "docs/specs/prd-spec.md"
      template: "docs/artifacts/prd-template.md"
      prompt: "docs/prompts/prd-prompt.md"
      validator: "docs/validators/prd-validator.md"
    required_inputs: []
    produces:
      artifact_id_prefix: "PRD"
      output_filename: "01-prd.md"
    freeze_gate: true
`;

function createMockFs(overrides?: Partial<IFilesystemService>): IFilesystemService {
  return {
    readFile: vi.fn().mockResolvedValue({ content: VALID_FLOW_YAML, encoding: 'utf-8' }),
    writeFileAtomic: vi.fn().mockResolvedValue(undefined),
    readDirectory: vi.fn().mockResolvedValue([]),
    exists: vi.fn().mockResolvedValue(true),
    createDirectory: vi.fn().mockResolvedValue(undefined),
    acquireLock: vi.fn().mockResolvedValue({ acquired: true }),
    releaseLock: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('KitService', () => {
  let mockFs: IFilesystemService;
  let service: KitService;

  beforeEach(() => {
    mockFs = createMockFs();
    service = new KitService(mockFs);
  });

  describe('acceptance tests', () => {
    it('AT-1: loadKit returns KitResult with parsed FlowDefinition', async () => {
      const result = await service.loadKit('/kits/pik');

      expect(result.kitPath).toBe('/kits/pik');
      expect(result.flow.kit.name).toBe('Test Kit');
      expect(result.flow.kit.id).toBe('test-kit');
      expect(result.flow.steps).toHaveLength(1);
      expect(result.flow.steps[0].id).toBe('step-1');
      expect(mockFs.readFile).toHaveBeenCalledWith('/kits/pik/flow.yaml');
    });

    it('AT-2: missing four-file throws error identifying the file', async () => {
      const existsMock = vi.fn().mockImplementation(async (p: string) => {
        return !p.endsWith('prd-spec.md');
      });
      mockFs = createMockFs({ exists: existsMock });
      service = new KitService(mockFs);

      await expect(service.loadKit('/kits/pik')).rejects.toThrow(/prd-spec\.md/);
    });

    it('AT-3: cache invalidation causes re-read from filesystem', async () => {
      await service.loadKit('/kits/pik');
      service.invalidateCache();
      await service.loadKit('/kits/pik');

      expect(mockFs.readFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('failure tests', () => {
    it('FT-1: missing flow.yaml throws FlowDefinitionNotFoundError', async () => {
      mockFs = createMockFs({
        readFile: vi.fn().mockRejectedValue(new FileNotFoundError('Not found')),
      });
      service = new KitService(mockFs);

      await expect(service.loadKit('/kits/pik')).rejects.toThrow(
        FlowDefinitionNotFoundError,
      );
    });

    it('FT-2: malformed YAML propagates FlowDefinitionParseError', async () => {
      mockFs = createMockFs({
        readFile: vi.fn().mockResolvedValue({
          content: 'kit:\n  name: test\n  : broken',
          encoding: 'utf-8',
        }),
      });
      service = new KitService(mockFs);

      await expect(service.loadKit('/kits/pik')).rejects.toThrow(
        FlowDefinitionParseError,
      );
    });

    it('FT-3: multiple missing four-files reports all missing', async () => {
      const existsMock = vi.fn().mockResolvedValue(false);
      mockFs = createMockFs({ exists: existsMock });
      service = new KitService(mockFs);

      try {
        await service.loadKit('/kits/pik');
        expect.fail('Should have thrown');
      } catch (err) {
        const message = (err as Error).message;
        expect(message).toContain('prd-spec.md');
        expect(message).toContain('prd-template.md');
        expect(message).toContain('prd-prompt.md');
        expect(message).toContain('prd-validator.md');
      }
    });
  });

  describe('edge cases', () => {
    it('EC-1: second call uses cache (readFile called once)', async () => {
      await service.loadKit('/kits/pik');
      await service.loadKit('/kits/pik');

      expect(mockFs.readFile).toHaveBeenCalledTimes(1);
    });

    it('EC-2: different kitPaths cached independently', async () => {
      await service.loadKit('/kits/pik');
      await service.loadKit('/kits/eek');

      expect(mockFs.readFile).toHaveBeenCalledTimes(2);
    });

    it('EC-3: null prompt in fourFiles skips exists check', async () => {
      const yamlWithNullPrompt = `
kit:
  name: "Test"
  id: "test"
  version: "1.0"
steps:
  - id: "step-1"
    name: "Step"
    artifact_type: "prd"
    step_type: "human-intake"
    dependencies: []
    four_files:
      spec: "s.md"
      template: "t.md"
      prompt: null
      validator: "v.md"
    required_inputs: []
    produces:
      artifact_id_prefix: "PRD"
      output_filename: "01.md"
    freeze_gate: false
`;
      mockFs = createMockFs({
        readFile: vi.fn().mockResolvedValue({ content: yamlWithNullPrompt, encoding: 'utf-8' }),
      });
      service = new KitService(mockFs);

      await service.loadKit('/kits/test');

      // 3 exists calls (spec, template, validator) — no prompt call
      expect(mockFs.exists).toHaveBeenCalledTimes(3);
    });

    it('EC-4: invalidateCache when empty is no-op', () => {
      expect(() => service.invalidateCache()).not.toThrow();
    });

    it('EC-5: four-file paths resolved relative to kit directory', async () => {
      await service.loadKit('/kits/pik');

      expect(mockFs.exists).toHaveBeenCalledWith('/kits/pik/docs/specs/prd-spec.md');
      expect(mockFs.exists).toHaveBeenCalledWith('/kits/pik/docs/artifacts/prd-template.md');
      expect(mockFs.exists).toHaveBeenCalledWith('/kits/pik/docs/prompts/prd-prompt.md');
      expect(mockFs.exists).toHaveBeenCalledWith('/kits/pik/docs/validators/prd-validator.md');
    });
  });
});
