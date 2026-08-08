import { logInfo } from '../logger.js';
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
  PrinciplesInputsUnsupportedError,
  StepAlreadyFrozenError,
  StepNotInProgressError,
  StepNotDraftError,
  StepNotValidatedPassError,
  StepNotEditableError,
  StepNotFoundError,
} from './errors.js';
import type { HarnessFreezeService } from './harness-freeze-service.js';
import {
  parseDocumentControl,
  type DocumentControlBlock,
} from './document-control.js';

/** FR-023 governance-mode options (manifest flow source only). */
export interface OrchestrationOptions {
  /**
   * A3: artifact types whose prompts declare mandatory principles inputs the
   * manifest cannot express until `inputs:` lands — generation refused.
   */
  denyGenerationFor?: string[];
  /** D2: mark human-authored entry steps blocked with a machine-readable reason. */
  entryGatesBlocked?: boolean;
}

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
  private readonly freezeService: HarnessFreezeService | null;
  private readonly denyGenerationFor: Set<string>;
  private readonly entryGatesBlocked: boolean;

  constructor(
    kitService: IKitService,
    stateService: IStateService,
    llmService: ILlmService,
    freezeService: HarnessFreezeService | null = null,
    options: OrchestrationOptions = {},
  ) {
    this.kitService = kitService;
    this.stateService = stateService;
    this.llmService = llmService;
    this.freezeService = freezeService;
    this.denyGenerationFor = new Set(options.denyGenerationFor ?? []);
    this.entryGatesBlocked = options.entryGatesBlocked ?? false;
  }

  /**
   * N1 (FR-023 / FR-018): read the step's on-disk Document Control block —
   * the canonical freeze truth every driver shares. Returns null when the
   * artifact file or its block is absent. state.json is only a workflow
   * cache; without this read, a FREEZE_PENDING artifact produced by the
   * dark factory is invisible to the console.
   */
  private async canonicalBlockFor(
    projectDir: string,
    step: FlowStep,
  ): Promise<{ block: DocumentControlBlock; relativePath: string } | null> {
    const relativePath = `docs/sdlc/${step.produces.outputFilename}`;
    let content: string;
    try {
      content = await this.stateService.readArtifact(projectDir, relativePath);
    } catch {
      return null;
    }
    const block = parseDocumentControl(content);
    return block ? { block, relativePath } : null;
  }

  /** FR-023 D2/A3: why this step cannot be driven right now, or null. */
  private blockedReasonFor(step: FlowStep): string | null {
    if (this.entryGatesBlocked && step.stepType === 'human-intake') {
      return 'ENTRY_INPUTS_UNSUPPORTED';
    }
    if (
      step.stepType === 'llm-generated' &&
      this.denyGenerationFor.has(step.artifactType)
    ) {
      return 'PRINCIPLES_INPUTS_UNSUPPORTED';
    }
    return null;
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

      // N1: the on-disk Document Control block outranks the state.json
      // cache (FR-018 single source of freeze truth). FROZEN and
      // FREEZE_PENDING written by any driver become visible here — a
      // read-side projection; the cache file itself is not rewritten.
      const canonical = await this.canonicalBlockFor(projectDir, step);
      if (canonical?.block.status === 'FROZEN' && state.status !== 'frozen') {
        state.status = 'frozen';
        state.artifactPath = canonical.relativePath;
        state.artifactId = canonical.block.artifactId;
      } else if (
        canonical?.block.status === 'FREEZE_PENDING' &&
        state.status !== 'frozen'
      ) {
        // A converged artifact parked at the freeze gate: reviewable and
        // freezable by the human — the console's validated-pass.
        state.status = 'validated-pass';
        state.artifactPath = canonical.relativePath;
        state.artifactId = canonical.block.artifactId;
      }

      const dependenciesMet = this.areDependenciesMet(
        step,
        projectState.artifacts,
      );

      stepStatuses.push({
        step,
        state,
        dependenciesMet,
        isCurrentStep: false,
        blockedReason: this.blockedReasonFor(step),
        canonicalStatus: canonical?.block.status ?? null,
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

    // A3 (FR-023): never generate an artifact whose mandatory principles
    // inputs the flow source cannot yet express — it would be frozen without
    // its governance inputs.
    if (
      step.stepType === 'llm-generated' &&
      this.denyGenerationFor.has(step.artifactType)
    ) {
      throw new PrinciplesInputsUnsupportedError(
        `Artifact type "${step.artifactType}" requires principles inputs ` +
          'the manifest cannot express yet (lands with manifest inputs:); ' +
          'generation refused',
      );
    }

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
    let cachedState: ArtifactState | null;
    try {
      cachedState = await this.stateService.getArtifactState(projectDir, stepId);
    } catch {
      cachedState = null;
    }

    let artifactPath: string | null = null;
    // G-22: an N1 freeze adopts state the console never drove, so it must be
    // recorded by adoption rather than by a lifecycle transition.
    let canonicalSourced = false;
    if (cachedState?.status === 'validated-pass' && cachedState.artifactPath) {
      artifactPath = cachedState.artifactPath;
    } else {
      // N1 (FR-018): accept the canonical on-disk state. An artifact another
      // driver (the dark factory) parked at the freeze gate carries
      // FREEZE_PENDING in its Document Control block but has no console
      // cache entry — the block is the source of truth, so the human can
      // freeze it here.
      const kitPath = await this.resolveKitPath(projectDir, kitId);
      const kit = await this.kitService.loadKit(kitPath);
      const step = this.findStep(kit.flow.steps, stepId);
      const canonical = await this.canonicalBlockFor(projectDir, step);
      if (
        canonical?.block.status === 'FREEZE_PENDING' ||
        canonical?.block.status === 'VALIDATED'
      ) {
        artifactPath = canonical.relativePath;
        canonicalSourced = true;
      } else {
        throw new StepNotValidatedPassError(
          `Step "${stepId}" is "${cachedState?.status ?? 'not-started'}" and ` +
            `its Document Control block is ` +
            `${canonical ? `"${canonical.block.rawStatus}"` : 'absent'} — ` +
            'expected validated-pass (cache) or FREEZE_PENDING/VALIDATED ' +
            '(canonical block) to freeze',
        );
      }
    }

    // FR-020: the console freezes THROUGH the harness (the single FROZEN writer,
    // ADR-0002/0003), not by writing freeze status in its own shape. It no longer
    // writes the horizontal ER row -- `harness freeze` (apply_freeze_decision)
    // updates the canonical Document Control block + ER state block + journal.
    if (this.freezeService === null) {
      throw new Error('Harness freeze service is not configured');
    }
    // Hash the artifact content shown to the human (decision integrity, ADR-0003).
    // validated-pass artifacts are not editable, so the on-disk content is what
    // was shown.
    const shownContent = await this.stateService.readArtifact(
      projectDir,
      artifactPath,
    );
    const result = await this.freezeService.freeze(projectDir, {
      artifactId,
      outcome: 'APPROVE',
      shownContent,
      decidedBy: 'console-user',
    });

    // G-22 fix (3): the authoritative write has happened by this point. Log it
    // BEFORE recording, so that "the harness froze it and the console failed to
    // record it" is distinguishable from "the freeze never happened" — the two
    // states G-22 made indistinguishable from the terminal.
    logInfo('harness_freeze_returned', {
      stepId,
      artifactId,
      status: result.status,
      frozenCount: result.frozenCount,
      artifactPath,
    });

    // N2 (FR-023): honour the canonical status the harness actually returned
    // (G-14 stopped at the service layer; the caller used to hardcode
    // 'frozen'). Anything other than FROZEN leaves local state untouched.
    if (result.status !== 'FROZEN') {
      throw new Error(
        `Harness returned status ${result.status} for "${artifactId}" — ` +
          'not FROZEN; local state left unchanged',
      );
    }

    // Reflect the harness's canonical FROZEN write in the local cache.
    //
    // G-22: ordering is load-bearing. The harness write above is the
    // authoritative, already-committed one; recording follows it. Never
    // reverse these — a cache claiming FROZEN for an artifact the harness did
    // not freeze is corruption, where the reverse is only a stale cache.
    const record = {
      status: 'frozen' as const,
      artifactId,
      artifactPath,
      frozenAt: new Date().toISOString(),
    };
    if (canonicalSourced) {
      // No console-side history to transition from — FR-018/N1 by design.
      await this.stateService.adoptCanonicalState(projectDir, stepId, record);
    } else {
      await this.stateService.updateArtifactState(projectDir, stepId, record);
    }

    // `recordedVia` is the G-22 distinction itself, and it is invisible from
    // outside the process. Without it, an N1 cross-driver freeze and a
    // console-driven one are indistinguishable after the fact.
    logInfo('freeze_recorded', {
      stepId,
      artifactId,
      artifactPath,
      recordedVia: canonicalSourced ? 'adoption' : 'transition',
    });
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
