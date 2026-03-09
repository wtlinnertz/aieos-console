import type { IKitService } from './kit-service.js';
import type { IStateService } from './state-service.js';
import type { ILlmService } from './llm-types.js';
import type { FlowStep } from './flow-types.js';
import type {
  ArtifactState,
  LlmConfig,
  LlmUsageRecord,
  ValidationResult,
} from './state-types.js';
import type { IArtifactStateProvider } from './step-input-assembly.js';
import type {
  FlowStatus,
  StepStatus,
  StepContext,
  GenerationEvent,
  IOrchestrationService,
} from './orchestration-types.js';
import {
  DependenciesNotMetError,
  StepAlreadyFrozenError,
  StepNotInProgressError,
  StepNotDraftError,
  StepNotValidatedPassError,
  StepNotEditableError,
  StepNotFoundError,
} from './errors.js';

function defaultArtifactState(stepId: string, kitId: string): ArtifactState {
  return {
    stepId,
    kitId,
    artifactId: null,
    status: 'not-started',
    artifactPath: null,
    validationResult: null,
    frozenAt: null,
    lastModified: new Date().toISOString(),
  };
}

export class OrchestrationService implements IOrchestrationService {
  private readonly kitService: IKitService;
  private readonly stateService: IStateService;
  private readonly llmService: ILlmService;

  constructor(
    kitService: IKitService,
    stateService: IStateService,
    llmService: ILlmService,
  ) {
    this.kitService = kitService;
    this.stateService = stateService;
    this.llmService = llmService;
  }

  async getFlowStatus(projectDir: string, kitId: string): Promise<FlowStatus> {
    const kitPath = await this.resolveKitPath(projectDir, kitId);
    const kit = await this.kitService.loadKit(kitPath);
    const projectState = await this.stateService.loadState(projectDir);

    const stepStatuses: StepStatus[] = [];

    for (const step of kit.flow.steps) {
      const existingState = projectState.artifacts.find(
        (a) => a.stepId === step.id,
      );
      const state = existingState ?? defaultArtifactState(step.id, kitId);

      const dependenciesMet = this.areDependenciesMet(
        step,
        projectState.artifacts,
      );

      stepStatuses.push({
        step,
        state,
        dependenciesMet,
        isCurrentStep: false,
      });
    }

    // Current step = first non-frozen step with dependencies met
    let currentStep: StepStatus | null = null;
    for (const ss of stepStatuses) {
      if (ss.state.status !== 'frozen' && ss.dependenciesMet) {
        ss.isCurrentStep = true;
        currentStep = ss;
        break;
      }
    }

    const completedSteps = stepStatuses.filter(
      (ss) => ss.state.status === 'frozen',
    ).length;

    return {
      steps: stepStatuses,
      currentStep,
      completedSteps,
      totalSteps: stepStatuses.length,
    };
  }

  async initiateStep(
    projectDir: string,
    kitId: string,
    stepId: string,
  ): Promise<StepContext> {
    const kitPath = await this.resolveKitPath(projectDir, kitId);
    const kit = await this.kitService.loadKit(kitPath);
    const step = this.findStep(kit.flow.steps, stepId);

    const projectState = await this.stateService.loadState(projectDir);
    const existingState = projectState.artifacts.find(
      (a) => a.stepId === stepId,
    );
    const currentState = existingState ?? defaultArtifactState(stepId, kitId);

    if (currentState.status === 'frozen') {
      throw new StepAlreadyFrozenError(
        `Step "${stepId}" is already frozen and cannot be re-initiated`,
      );
    }

    if (!this.areDependenciesMet(step, projectState.artifacts)) {
      throw new DependenciesNotMetError(
        `Dependencies not met for step "${stepId}": all dependency steps must be frozen`,
      );
    }

    // Transition to in-progress
    await this.stateService.updateArtifactState(projectDir, stepId, {
      kitId,
      status: 'in-progress',
    });

    const updatedState = await this.stateService.getArtifactState(
      projectDir,
      stepId,
    );

    // Build artifact state provider from project state
    const artifactStateProvider: IArtifactStateProvider = {
      getArtifactPath(sid: string): string | undefined {
        const art = projectState.artifacts.find((a) => a.stepId === sid);
        return art?.artifactPath ?? undefined;
      },
    };

    const inputs = await this.kitService.getStepInputs(
      kitPath,
      stepId,
      projectDir,
      artifactStateProvider,
    );

    return {
      step,
      inputs,
      state: updatedState,
    };
  }

  async *generateArtifact(
    projectDir: string,
    kitId: string,
    stepId: string,
  ): AsyncIterable<GenerationEvent> {
    const kitPath = await this.resolveKitPath(projectDir, kitId);
    const kit = await this.kitService.loadKit(kitPath);
    const step = this.findStep(kit.flow.steps, stepId);

    // Verify step is in-progress or draft (allow re-generation)
    let currentState: ArtifactState;
    try {
      currentState = await this.stateService.getArtifactState(projectDir, stepId);
    } catch {
      throw new StepNotInProgressError(
        `Step "${stepId}" must be in-progress before generating`,
      );
    }

    if (currentState.status !== 'in-progress' && currentState.status !== 'draft') {
      throw new StepNotInProgressError(
        `Step "${stepId}" is "${currentState.status}", expected "in-progress" or "draft"`,
      );
    }

    const projectState = await this.stateService.loadState(projectDir);
    const llmConfig = this.resolveLlmConfig(
      projectState.llmConfigs,
      step.artifactType,
    );

    // Build artifact state provider
    const artifactStateProvider: IArtifactStateProvider = {
      getArtifactPath(sid: string): string | undefined {
        const art = projectState.artifacts.find((a) => a.stepId === sid);
        return art?.artifactPath ?? undefined;
      },
    };

    const inputs = await this.kitService.getStepInputs(
      kitPath,
      stepId,
      projectDir,
      artifactStateProvider,
    );

    const prompt = inputs.prompt ?? inputs.spec;
    const userContent = this.assembleUserContent(inputs);

    let fullContent = '';
    const startTime = Date.now();

    try {
      let finalInputTokens = 0;
      let finalOutputTokens = 0;

      for await (const chunk of this.llmService.generateArtifactStreaming(
        llmConfig,
        prompt,
        userContent,
      )) {
        if (!chunk.done) {
          fullContent += chunk.content;
          yield {
            type: 'chunk',
            content: chunk.content,
          };
        } else {
          finalInputTokens = chunk.inputTokens ?? 0;
          finalOutputTokens = chunk.outputTokens ?? 0;
        }
      }

      const durationMs = Date.now() - startTime;

      // Persist draft
      const artifactPath = await this.stateService.saveArtifact(
        projectDir,
        stepId,
        fullContent,
        step.produces.outputFilename,
      );

      // Transition to draft
      await this.stateService.updateArtifactState(projectDir, stepId, {
        status: 'draft',
        artifactPath,
      });

      // Record LLM usage
      const usageRecord: LlmUsageRecord = {
        stepId,
        artifactId: step.produces.artifactIdPrefix,
        provider: llmConfig.providerId,
        model: llmConfig.model,
        inputTokens: finalInputTokens,
        outputTokens: finalOutputTokens,
        durationMs,
        timestamp: new Date().toISOString(),
        phase: 'generation',
      };

      await this.stateService.recordLlmUsage(projectDir, usageRecord);

      yield {
        type: 'done',
        artifact: fullContent,
        usage: usageRecord,
      };
    } catch (err) {
      yield {
        type: 'error',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async validateArtifact(
    projectDir: string,
    kitId: string,
    stepId: string,
  ): Promise<ValidationResult> {
    const kitPath = await this.resolveKitPath(projectDir, kitId);
    const kit = await this.kitService.loadKit(kitPath);
    const step = this.findStep(kit.flow.steps, stepId);

    const currentState = await this.stateService.getArtifactState(
      projectDir,
      stepId,
    );

    if (currentState.status !== 'draft') {
      throw new StepNotDraftError(
        `Step "${stepId}" is "${currentState.status}", expected "draft"`,
      );
    }

    const projectState = await this.stateService.loadState(projectDir);
    const llmConfig = this.resolveLlmConfig(
      projectState.llmConfigs,
      step.artifactType,
    );

    // Build artifact state provider
    const artifactStateProvider: IArtifactStateProvider = {
      getArtifactPath(sid: string): string | undefined {
        const art = projectState.artifacts.find((a) => a.stepId === sid);
        return art?.artifactPath ?? undefined;
      },
    };

    const inputs = await this.kitService.getStepInputs(
      kitPath,
      stepId,
      projectDir,
      artifactStateProvider,
    );

    // Read current draft artifact content — use the artifact path from state
    if (!currentState.artifactPath) {
      throw new StepNotDraftError(
        `Step "${stepId}" has no artifact path — draft may not have been saved`,
      );
    }

    const startTime = Date.now();

    const llmResponse = await this.llmService.validateArtifact(
      llmConfig,
      inputs.validator,
      inputs.template, // The draft content is assembled in the inputs
      inputs.spec,
    );

    const durationMs = Date.now() - startTime;

    // Parse the validation result from the LLM response
    const validationResult = this.parseValidationResult(llmResponse.content);

    // Update state based on result
    const newStatus =
      validationResult.status === 'PASS' ? 'validated-pass' : 'validated-fail';

    await this.stateService.updateArtifactState(projectDir, stepId, {
      status: newStatus as 'validated-pass' | 'validated-fail',
      validationResult,
    });

    // Record LLM usage
    const usageRecord: LlmUsageRecord = {
      stepId,
      artifactId: step.produces.artifactIdPrefix,
      provider: llmConfig.providerId,
      model: llmConfig.model,
      inputTokens: llmResponse.inputTokens,
      outputTokens: llmResponse.outputTokens,
      durationMs,
      timestamp: new Date().toISOString(),
      phase: 'validation',
    };

    await this.stateService.recordLlmUsage(projectDir, usageRecord);

    return validationResult;
  }

  async freezeArtifact(
    projectDir: string,
    kitId: string,
    stepId: string,
    artifactId: string,
  ): Promise<void> {
    const kitPath = await this.resolveKitPath(projectDir, kitId);
    const kit = await this.kitService.loadKit(kitPath);
    const step = this.findStep(kit.flow.steps, stepId);

    const currentState = await this.stateService.getArtifactState(
      projectDir,
      stepId,
    );

    if (currentState.status !== 'validated-pass') {
      throw new StepNotValidatedPassError(
        `Step "${stepId}" is "${currentState.status}", expected "validated-pass" to freeze`,
      );
    }

    // Transition to frozen
    await this.stateService.updateArtifactState(projectDir, stepId, {
      status: 'frozen',
      artifactId,
      frozenAt: new Date().toISOString(),
    });

    // Update engagement record
    await this.stateService.updateEngagementRecord(
      projectDir,
      artifactId,
      step.artifactType,
      'frozen',
      `Frozen at ${new Date().toISOString()}`,
    );
  }

  async updateArtifactContent(
    projectDir: string,
    kitId: string,
    stepId: string,
    content: string,
  ): Promise<void> {
    const kitPath = await this.resolveKitPath(projectDir, kitId);
    const kit = await this.kitService.loadKit(kitPath);
    const step = this.findStep(kit.flow.steps, stepId);

    const currentState = await this.stateService.getArtifactState(
      projectDir,
      stepId,
    );

    const editableStatuses = new Set([
      'draft',
      'validated-pass',
      'validated-fail',
    ]);
    if (!editableStatuses.has(currentState.status)) {
      throw new StepNotEditableError(
        `Step "${stepId}" is "${currentState.status}", which is not editable`,
      );
    }

    // Save the updated content
    await this.stateService.saveArtifact(
      projectDir,
      stepId,
      content,
      step.produces.outputFilename,
    );

    // If validated, reset to draft
    if (
      currentState.status === 'validated-pass' ||
      currentState.status === 'validated-fail'
    ) {
      await this.stateService.updateArtifactState(projectDir, stepId, {
        status: 'draft',
        validationResult: null,
      });
    }
  }

  private async resolveKitPath(
    projectDir: string,
    kitId: string,
  ): Promise<string> {
    const state = await this.stateService.loadState(projectDir);
    const kitConfig = state.kitConfigs.find((k) => k.kitId === kitId);
    if (!kitConfig) {
      throw new StepNotFoundError(
        `Kit "${kitId}" not found in project configuration`,
      );
    }
    return kitConfig.kitPath;
  }

  private findStep(steps: FlowStep[], stepId: string): FlowStep {
    const step = steps.find((s) => s.id === stepId);
    if (!step) {
      throw new StepNotFoundError(
        `Step "${stepId}" not found in flow definition`,
      );
    }
    return step;
  }

  private areDependenciesMet(
    step: FlowStep,
    artifacts: ArtifactState[],
  ): boolean {
    if (step.dependencies.length === 0) {
      return true;
    }
    return step.dependencies.every((depId) => {
      const depState = artifacts.find((a) => a.stepId === depId);
      return depState?.status === 'frozen';
    });
  }

  private resolveLlmConfig(
    llmConfigs: LlmConfig[],
    artifactType: string,
  ): LlmConfig {
    // Try to find a config matching the artifact type
    const typeMatch = llmConfigs.find(
      (c) => c.artifactTypes && c.artifactTypes.includes(artifactType),
    );
    if (typeMatch) {
      return typeMatch;
    }
    // Fall back to first config
    if (llmConfigs.length === 0) {
      throw new Error('No LLM configurations available');
    }
    return llmConfigs[0];
  }

  private assembleUserContent(
    inputs: import('./step-input-assembly.js').StepInputs,
  ): string {
    const parts: string[] = [];

    parts.push('## Template\n\n' + inputs.template);

    if (inputs.requiredInputs.length > 0) {
      for (const input of inputs.requiredInputs) {
        parts.push(`## ${input.role}: ${input.name}\n\n${input.content}`);
      }
    }

    if (inputs.upstreamArtifacts.length > 0) {
      for (const upstream of inputs.upstreamArtifacts) {
        parts.push(
          `## Upstream (${upstream.role}): ${upstream.name}\n\n${upstream.content}`,
        );
      }
    }

    return parts.join('\n\n');
  }

  private parseValidationResult(content: string): ValidationResult {
    const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();

    const parsed = JSON.parse(jsonStr) as ValidationResult;
    return parsed;
  }
}
