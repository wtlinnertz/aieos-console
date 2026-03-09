export interface FlowDefinition {
  kit: { name: string; id: string; version: string };
  steps: FlowStep[];
  handoff?: HandoffDefinition;
}

export interface FlowStep {
  id: string;
  name: string;
  artifactType: string;
  stepType:
    | 'llm-generated'
    | 'human-intake'
    | 'acceptance-check'
    | 'consistency-check';
  dependencies: string[];
  fourFiles: {
    spec: string;
    template: string;
    prompt: string | null;
    validator: string;
  };
  requiredInputs: { path: string; role: string }[];
  produces: { artifactIdPrefix: string; outputFilename: string };
  freezeGate: boolean;
}

export interface HandoffDefinition {
  targetKit: string;
  artifactPlacement: {
    sourceStep: string;
    targetPath: string;
    acceptanceCheck: string;
  };
}
