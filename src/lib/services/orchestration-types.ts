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
