import type { FlowStep } from './flow-types.js';
import type { ArtifactState, LlmUsageRecord } from './state-types.js';
import type { StepInputs } from './step-input-assembly.js';

export interface FlowStatus {
  steps: StepStatus[];
  currentStep: StepStatus | null;
  completedSteps: number;
  totalSteps: number;
}

export interface StepStatus {
  step: FlowStep;
  state: ArtifactState;
  dependenciesMet: boolean;
  isCurrentStep: boolean;
  /**
   * FR-023 D2/A3: machine-readable reason this step cannot be driven right
   * now (e.g. ENTRY_INPUTS_UNSUPPORTED, PRINCIPLES_INPUTS_UNSUPPORTED), or
   * null when drivable. Never a silent no-op.
   */
  blockedReason: string | null;
  /**
   * N1 (FR-018): the canonical freeze status read from the artifact's
   * on-disk Document Control block, or null when no block exists. The
   * source of truth every driver shares; `state` is reconciled against it.
   */
  canonicalStatus: string | null;
}

export interface StepContext {
  step: FlowStep;
  inputs: StepInputs;
  state: ArtifactState;
}

export interface GenerationEvent {
  type: 'chunk' | 'done' | 'error';
  content?: string;
  artifact?: string;
  usage?: LlmUsageRecord;
  error?: string;
}

export interface IOrchestrationService {
  getFlowStatus(projectDir: string, kitId: string): Promise<FlowStatus>;
  initiateStep(projectDir: string, kitId: string, stepId: string): Promise<StepContext>;
  generateArtifact(projectDir: string, kitId: string, stepId: string): AsyncIterable<GenerationEvent>;
  validateArtifact(projectDir: string, kitId: string, stepId: string): Promise<import('./state-types.js').ValidationResult>;
  freezeArtifact(projectDir: string, kitId: string, stepId: string, artifactId: string): Promise<void>;
  updateArtifactContent(projectDir: string, kitId: string, stepId: string, content: string): Promise<void>;
}
