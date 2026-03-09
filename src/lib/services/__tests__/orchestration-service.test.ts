import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrchestrationService } from '../orchestration-service.js';
import type { IKitService, KitResult } from '../kit-service.js';
import type { IStateService } from '../state-service.js';
import type { ILlmService, LlmResponse } from '../llm-types.js';
import type { FlowDefinition, FlowStep } from '../flow-types.js';
import type {
  ProjectState,
  ArtifactState,
  ValidationResult,
} from '../state-types.js';
import type { StepInputs } from '../step-input-assembly.js';
import type { GenerationEvent } from '../orchestration-types.js';
import {
  DependenciesNotMetError,
  StepAlreadyFrozenError,
  StepNotInProgressError,
  StepNotValidatedPassError,
  StepNotEditableError,
} from '../errors.js';

// --- Helpers ---

function makeStep(overrides: Partial<FlowStep> = {}): FlowStep {
  return {
    id: 'step-1',
    name: 'Step 1',
    artifactType: 'prd',
    stepType: 'llm-generated',
    dependencies: [],
    fourFiles: {
      spec: 'docs/specs/prd-spec.md',
      template: 'docs/artifacts/prd-template.md',
      prompt: 'docs/prompts/prd-prompt.md',
      validator: 'docs/validators/prd-validator.md',
    },
    requiredInputs: [],
    produces: { artifactIdPrefix: 'PRD', outputFilename: '01-prd.md' },
    freezeGate: true,
    ...overrides,
  };
}

function makeFlow(steps: FlowStep[]): FlowDefinition {
  return {
    kit: { name: 'Test Kit', id: 'test-kit', version: '1.0.0' },
    steps,
  };
}

function makeArtifactState(
  stepId: string,
  overrides: Partial<ArtifactState> = {},
): ArtifactState {
  return {
    stepId,
    kitId: 'test-kit',
    artifactId: null,
    status: 'not-started',
    artifactPath: null,
    validationResult: null,
    frozenAt: null,
    lastModified: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeProjectState(
  artifacts: ArtifactState[] = [],
): ProjectState {
  return {
    projectId: 'proj-1',
    kitConfigs: [{ kitId: 'test-kit', kitPath: '/kits/test-kit' }],
    llmConfigs: [
      {
        providerId: 'mock',
        model: 'mock-model',
        apiKeyEnvVar: 'MOCK_KEY',
      },
    ],
    artifacts,
    llmUsage: [],
  };
}

function makeStepInputs(): StepInputs {
  return {
    spec: 'spec content',
    template: 'template content',
    prompt: 'prompt content',
    validator: 'validator content',
    requiredInputs: [],
    upstreamArtifacts: [],
  };
}

function makeKitResult(steps: FlowStep[]): KitResult {
  return {
    flow: makeFlow(steps),
    kitPath: '/kits/test-kit',
  };
}

// --- Mock factories ---

function makeMockKitService(kitResult: KitResult): IKitService {
  return {
    loadKit: vi.fn().mockResolvedValue(kitResult),
    getStepInputs: vi.fn().mockResolvedValue(makeStepInputs()),
    invalidateCache: vi.fn(),
  };
}

function makeMockStateService(
  projectState: ProjectState,
): IStateService {
  const artifactStates = new Map<string, ArtifactState>();
  for (const a of projectState.artifacts) {
    artifactStates.set(a.stepId, { ...a });
  }

  return {
    initializeProject: vi.fn(),
    loadState: vi.fn().mockResolvedValue(projectState),
    getArtifactState: vi.fn().mockImplementation(
      (_dir: string, stepId: string) => {
        const state = artifactStates.get(stepId);
        if (!state) {
          throw new Error(`No artifact state for step "${stepId}"`);
        }
        return Promise.resolve(state);
      },
    ),
    updateArtifactState: vi.fn().mockImplementation(
      (_dir: string, stepId: string, update: Partial<ArtifactState>) => {
        const existing = artifactStates.get(stepId);
        if (existing) {
          const updated = { ...existing, ...update };
          artifactStates.set(stepId, updated);
        } else {
          artifactStates.set(stepId, {
            stepId,
            kitId: 'test-kit',
            artifactId: null,
            status: 'not-started',
            artifactPath: null,
            validationResult: null,
            frozenAt: null,
            lastModified: new Date().toISOString(),
            ...update,
          });
        }
        return Promise.resolve();
      },
    ),
    saveArtifact: vi.fn().mockResolvedValue('docs/sdlc/01-prd.md'),
    recordLlmUsage: vi.fn().mockResolvedValue(undefined),
    updateEngagementRecord: vi.fn().mockResolvedValue(undefined),
  };
}

function makeMockLlmService(): ILlmService {
  return {
    generateArtifact: vi.fn().mockResolvedValue({
      content: 'Generated content',
      inputTokens: 100,
      outputTokens: 200,
      model: 'mock-model',
      durationMs: 500,
    } satisfies LlmResponse),
    generateArtifactStreaming: vi.fn().mockImplementation(
      async function* () {
        yield { content: 'chunk1', done: false };
        yield { content: 'chunk2', done: false };
        yield {
          content: '',
          done: true,
          inputTokens: 100,
          outputTokens: 200,
        };
      },
    ),
    validateArtifact: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        status: 'PASS',
        summary: 'All checks passed',
        hardGates: { completeness: 'PASS' },
        blockingIssues: [],
        warnings: [],
        completenessScore: 95,
      }),
      inputTokens: 50,
      outputTokens: 100,
      model: 'mock-model',
      durationMs: 300,
    } satisfies LlmResponse),
  };
}

// --- Tests ---

describe('OrchestrationService', () => {
  const projectDir = '/projects/test';
  const kitId = 'test-kit';

  let step1: FlowStep;
  let step2: FlowStep;
  let step3: FlowStep;

  beforeEach(() => {
    step1 = makeStep({ id: 'step-1', name: 'Step 1', dependencies: [] });
    step2 = makeStep({
      id: 'step-2',
      name: 'Step 2',
      dependencies: ['step-1'],
      produces: { artifactIdPrefix: 'ACF', outputFilename: '02-acf.md' },
    });
    step3 = makeStep({
      id: 'step-3',
      name: 'Step 3',
      dependencies: ['step-2'],
      produces: { artifactIdPrefix: 'SAD', outputFilename: '03-sad.md' },
    });
  });

  describe('getFlowStatus', () => {
    it('returns all steps as not-started with currentStep as first step', async () => {
      const kitResult = makeKitResult([step1, step2, step3]);
      const stateService = makeMockStateService(makeProjectState());
      const service = new OrchestrationService(
        makeMockKitService(kitResult),
        stateService,
        makeMockLlmService(),
      );

      const status = await service.getFlowStatus(projectDir, kitId);

      expect(status.totalSteps).toBe(3);
      expect(status.completedSteps).toBe(0);
      expect(status.steps).toHaveLength(3);
      expect(status.steps.every((s) => s.state.status === 'not-started')).toBe(
        true,
      );
      expect(status.currentStep).not.toBeNull();
      expect(status.currentStep?.step.id).toBe('step-1');
      expect(status.currentStep?.isCurrentStep).toBe(true);
    });

    it('marks step 2 as dependenciesMet when step 1 is frozen', async () => {
      const kitResult = makeKitResult([step1, step2]);
      const stateService = makeMockStateService(
        makeProjectState([
          makeArtifactState('step-1', { status: 'frozen' }),
        ]),
      );
      const service = new OrchestrationService(
        makeMockKitService(kitResult),
        stateService,
        makeMockLlmService(),
      );

      const status = await service.getFlowStatus(projectDir, kitId);

      const s2 = status.steps.find((s) => s.step.id === 'step-2');
      expect(s2?.dependenciesMet).toBe(true);
      expect(status.currentStep?.step.id).toBe('step-2');
    });

    it('marks step 2 as dependenciesNotMet when step 1 is not frozen', async () => {
      const kitResult = makeKitResult([step1, step2]);
      const stateService = makeMockStateService(
        makeProjectState([
          makeArtifactState('step-1', { status: 'draft' }),
        ]),
      );
      const service = new OrchestrationService(
        makeMockKitService(kitResult),
        stateService,
        makeMockLlmService(),
      );

      const status = await service.getFlowStatus(projectDir, kitId);

      const s2 = status.steps.find((s) => s.step.id === 'step-2');
      expect(s2?.dependenciesMet).toBe(false);
    });

    it('correctly counts completedSteps and totalSteps', async () => {
      const kitResult = makeKitResult([step1, step2, step3]);
      const stateService = makeMockStateService(
        makeProjectState([
          makeArtifactState('step-1', { status: 'frozen' }),
          makeArtifactState('step-2', { status: 'frozen' }),
        ]),
      );
      const service = new OrchestrationService(
        makeMockKitService(kitResult),
        stateService,
        makeMockLlmService(),
      );

      const status = await service.getFlowStatus(projectDir, kitId);

      expect(status.completedSteps).toBe(2);
      expect(status.totalSteps).toBe(3);
    });
  });

  describe('initiateStep', () => {
    it('succeeds when all dependencies are frozen', async () => {
      const kitResult = makeKitResult([step1, step2]);
      const stateService = makeMockStateService(
        makeProjectState([
          makeArtifactState('step-1', { status: 'frozen' }),
        ]),
      );
      const service = new OrchestrationService(
        makeMockKitService(kitResult),
        stateService,
        makeMockLlmService(),
      );

      const context = await service.initiateStep(projectDir, kitId, 'step-2');

      expect(context.step.id).toBe('step-2');
      expect(context.inputs).toBeDefined();
      expect(stateService.updateArtifactState).toHaveBeenCalledWith(
        projectDir,
        'step-2',
        expect.objectContaining({ status: 'in-progress' }),
      );
    });

    it('throws DependenciesNotMetError when dependencies not frozen', async () => {
      const kitResult = makeKitResult([step1, step2]);
      const stateService = makeMockStateService(
        makeProjectState([
          makeArtifactState('step-1', { status: 'draft' }),
        ]),
      );
      const service = new OrchestrationService(
        makeMockKitService(kitResult),
        stateService,
        makeMockLlmService(),
      );

      await expect(
        service.initiateStep(projectDir, kitId, 'step-2'),
      ).rejects.toThrow(DependenciesNotMetError);
    });

    it('throws StepAlreadyFrozenError when step is already frozen', async () => {
      const kitResult = makeKitResult([step1]);
      const stateService = makeMockStateService(
        makeProjectState([
          makeArtifactState('step-1', { status: 'frozen' }),
        ]),
      );
      const service = new OrchestrationService(
        makeMockKitService(kitResult),
        stateService,
        makeMockLlmService(),
      );

      await expect(
        service.initiateStep(projectDir, kitId, 'step-1'),
      ).rejects.toThrow(StepAlreadyFrozenError);
    });
  });

  describe('generateArtifact', () => {
    it('yields chunks and a done event', async () => {
      const kitResult = makeKitResult([step1]);
      const stateService = makeMockStateService(
        makeProjectState([
          makeArtifactState('step-1', { status: 'in-progress' }),
        ]),
      );
      const service = new OrchestrationService(
        makeMockKitService(kitResult),
        stateService,
        makeMockLlmService(),
      );

      const events: GenerationEvent[] = [];
      for await (const event of service.generateArtifact(
        projectDir,
        kitId,
        'step-1',
      )) {
        events.push(event);
      }

      const chunks = events.filter((e) => e.type === 'chunk');
      const done = events.find((e) => e.type === 'done');

      expect(chunks).toHaveLength(2);
      expect(chunks[0].content).toBe('chunk1');
      expect(chunks[1].content).toBe('chunk2');
      expect(done).toBeDefined();
      expect(done?.artifact).toBe('chunk1chunk2');
      expect(done?.usage).toBeDefined();
    });

    it('persists draft and records LLM usage on completion', async () => {
      const kitResult = makeKitResult([step1]);
      const stateService = makeMockStateService(
        makeProjectState([
          makeArtifactState('step-1', { status: 'in-progress' }),
        ]),
      );
      const service = new OrchestrationService(
        makeMockKitService(kitResult),
        stateService,
        makeMockLlmService(),
      );

      const events: GenerationEvent[] = [];
      for await (const event of service.generateArtifact(
        projectDir,
        kitId,
        'step-1',
      )) {
        events.push(event);
      }

      expect(stateService.saveArtifact).toHaveBeenCalledWith(
        projectDir,
        'step-1',
        'chunk1chunk2',
        '01-prd.md',
      );
      expect(stateService.updateArtifactState).toHaveBeenCalledWith(
        projectDir,
        'step-1',
        expect.objectContaining({ status: 'draft' }),
      );
      expect(stateService.recordLlmUsage).toHaveBeenCalledWith(
        projectDir,
        expect.objectContaining({
          stepId: 'step-1',
          phase: 'generation',
        }),
      );
    });

    it('yields error event on LLM failure', async () => {
      const kitResult = makeKitResult([step1]);
      const stateService = makeMockStateService(
        makeProjectState([
          makeArtifactState('step-1', { status: 'in-progress' }),
        ]),
      );
      const llmService = makeMockLlmService();
      llmService.generateArtifactStreaming = vi
        .fn()
        .mockImplementation(async function* () {
          yield { content: 'partial', done: false };
          throw new Error('LLM connection lost');
        });

      const service = new OrchestrationService(
        makeMockKitService(kitResult),
        stateService,
        llmService,
      );

      const events: GenerationEvent[] = [];
      for await (const event of service.generateArtifact(
        projectDir,
        kitId,
        'step-1',
      )) {
        events.push(event);
      }

      const errorEvent = events.find((e) => e.type === 'error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent?.error).toContain('LLM connection lost');
      // State should NOT have been corrupted — no draft saved
      expect(stateService.saveArtifact).not.toHaveBeenCalled();
    });

    it('throws StepNotInProgressError when step not in progress', async () => {
      const kitResult = makeKitResult([step1]);
      const stateService = makeMockStateService(
        makeProjectState([
          makeArtifactState('step-1', { status: 'frozen' }),
        ]),
      );
      const service = new OrchestrationService(
        makeMockKitService(kitResult),
        stateService,
        makeMockLlmService(),
      );

      const events: GenerationEvent[] = [];
      await expect(async () => {
        for await (const event of service.generateArtifact(
          projectDir,
          kitId,
          'step-1',
        )) {
          events.push(event);
        }
      }).rejects.toThrow(StepNotInProgressError);
    });
  });

  describe('validateArtifact', () => {
    it('returns PASS result and updates state to validated-pass', async () => {
      const kitResult = makeKitResult([step1]);
      const stateService = makeMockStateService(
        makeProjectState([
          makeArtifactState('step-1', {
            status: 'draft',
            artifactPath: 'docs/sdlc/01-prd.md',
          }),
        ]),
      );
      const service = new OrchestrationService(
        makeMockKitService(kitResult),
        stateService,
        makeMockLlmService(),
      );

      const result = await service.validateArtifact(
        projectDir,
        kitId,
        'step-1',
      );

      expect(result.status).toBe('PASS');
      expect(stateService.updateArtifactState).toHaveBeenCalledWith(
        projectDir,
        'step-1',
        expect.objectContaining({ status: 'validated-pass' }),
      );
      expect(stateService.recordLlmUsage).toHaveBeenCalledWith(
        projectDir,
        expect.objectContaining({ phase: 'validation' }),
      );
    });

    it('returns FAIL result and updates state to validated-fail', async () => {
      const kitResult = makeKitResult([step1]);
      const stateService = makeMockStateService(
        makeProjectState([
          makeArtifactState('step-1', {
            status: 'draft',
            artifactPath: 'docs/sdlc/01-prd.md',
          }),
        ]),
      );
      const llmService = makeMockLlmService();
      llmService.validateArtifact = vi.fn().mockResolvedValue({
        content: JSON.stringify({
          status: 'FAIL',
          summary: 'Issues found',
          hardGates: { completeness: 'FAIL' },
          blockingIssues: [
            { gate: 'completeness', description: 'Missing section', location: 'line 5' },
          ],
          warnings: [],
          completenessScore: 40,
        }),
        inputTokens: 50,
        outputTokens: 100,
        model: 'mock-model',
        durationMs: 300,
      } satisfies LlmResponse);

      const service = new OrchestrationService(
        makeMockKitService(kitResult),
        stateService,
        llmService,
      );

      const result = await service.validateArtifact(
        projectDir,
        kitId,
        'step-1',
      );

      expect(result.status).toBe('FAIL');
      expect(stateService.updateArtifactState).toHaveBeenCalledWith(
        projectDir,
        'step-1',
        expect.objectContaining({ status: 'validated-fail' }),
      );
    });
  });

  describe('freezeArtifact', () => {
    it('writes frozen artifact, updates ER, and transitions to frozen', async () => {
      const kitResult = makeKitResult([step1]);
      const stateService = makeMockStateService(
        makeProjectState([
          makeArtifactState('step-1', {
            status: 'validated-pass',
            artifactPath: 'docs/sdlc/01-prd.md',
          }),
        ]),
      );
      const service = new OrchestrationService(
        makeMockKitService(kitResult),
        stateService,
        makeMockLlmService(),
      );

      await service.freezeArtifact(
        projectDir,
        kitId,
        'step-1',
        'PRD-TEST-001',
      );

      expect(stateService.updateArtifactState).toHaveBeenCalledWith(
        projectDir,
        'step-1',
        expect.objectContaining({
          status: 'frozen',
          artifactId: 'PRD-TEST-001',
        }),
      );
      expect(stateService.updateEngagementRecord).toHaveBeenCalledWith(
        projectDir,
        'PRD-TEST-001',
        'prd',
        'frozen',
        expect.any(String),
      );
    });

    it('throws StepNotValidatedPassError when step is not validated-pass', async () => {
      const kitResult = makeKitResult([step1]);
      const stateService = makeMockStateService(
        makeProjectState([
          makeArtifactState('step-1', { status: 'draft' }),
        ]),
      );
      const service = new OrchestrationService(
        makeMockKitService(kitResult),
        stateService,
        makeMockLlmService(),
      );

      await expect(
        service.freezeArtifact(projectDir, kitId, 'step-1', 'PRD-TEST-001'),
      ).rejects.toThrow(StepNotValidatedPassError);
    });
  });

  describe('updateArtifactContent', () => {
    it('overwrites draft content', async () => {
      const kitResult = makeKitResult([step1]);
      const stateService = makeMockStateService(
        makeProjectState([
          makeArtifactState('step-1', {
            status: 'draft',
            artifactPath: 'docs/sdlc/01-prd.md',
          }),
        ]),
      );
      const service = new OrchestrationService(
        makeMockKitService(kitResult),
        stateService,
        makeMockLlmService(),
      );

      await service.updateArtifactContent(
        projectDir,
        kitId,
        'step-1',
        'Updated content',
      );

      expect(stateService.saveArtifact).toHaveBeenCalledWith(
        projectDir,
        'step-1',
        'Updated content',
        '01-prd.md',
      );
    });

    it('resets validated-pass state to draft', async () => {
      const kitResult = makeKitResult([step1]);
      const validationResult: ValidationResult = {
        status: 'PASS',
        summary: 'All passed',
        hardGates: {},
        blockingIssues: [],
        warnings: [],
        completenessScore: 95,
      };
      const stateService = makeMockStateService(
        makeProjectState([
          makeArtifactState('step-1', {
            status: 'validated-pass',
            artifactPath: 'docs/sdlc/01-prd.md',
            validationResult,
          }),
        ]),
      );
      const service = new OrchestrationService(
        makeMockKitService(kitResult),
        stateService,
        makeMockLlmService(),
      );

      await service.updateArtifactContent(
        projectDir,
        kitId,
        'step-1',
        'Edited content',
      );

      expect(stateService.updateArtifactState).toHaveBeenCalledWith(
        projectDir,
        'step-1',
        expect.objectContaining({
          status: 'draft',
          validationResult: null,
        }),
      );
    });

    it('throws StepNotEditableError when step is frozen', async () => {
      const kitResult = makeKitResult([step1]);
      const stateService = makeMockStateService(
        makeProjectState([
          makeArtifactState('step-1', { status: 'frozen' }),
        ]),
      );
      const service = new OrchestrationService(
        makeMockKitService(kitResult),
        stateService,
        makeMockLlmService(),
      );

      await expect(
        service.updateArtifactContent(
          projectDir,
          kitId,
          'step-1',
          'New content',
        ),
      ).rejects.toThrow(StepNotEditableError);
    });
  });
});
