export interface ProjectState {
  projectId: string;
  kitConfigs: KitConfig[];
  llmConfigs: LlmConfig[];
  artifacts: ArtifactState[];
  llmUsage: LlmUsageRecord[];
}

export interface KitConfig {
  kitId: string;
  kitPath: string;
}

export interface LlmConfig {
  providerId: string;
  model: string;
  apiKeyEnvVar: string;
  artifactTypes?: string[];
}

export type ArtifactStatus =
  | 'not-started'
  | 'in-progress'
  | 'draft'
  | 'validated-pass'
  | 'validated-fail'
  | 'frozen';

export interface ArtifactState {
  stepId: string;
  kitId: string;
  artifactId: string | null;
  status: ArtifactStatus;
  artifactPath: string | null;
  validationResult: ValidationResult | null;
  frozenAt: string | null;
  lastModified: string;
}

export interface ValidationResult {
  status: 'PASS' | 'FAIL';
  summary: string;
  hardGates: Record<string, 'PASS' | 'FAIL'>;
  blockingIssues: { gate: string; description: string; location: string }[];
  warnings: { description: string; location: string }[];
  completenessScore: number;
}

export interface LlmUsageRecord {
  stepId: string;
  artifactId: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  timestamp: string;
  phase: 'generation' | 'validation';
}
