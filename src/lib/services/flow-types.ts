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
  requiredInputs: {
    path: string;
    role: string;
    /**
     * G-3 (manifest 1.1): 'framework' inputs are kit-relative and mandatory
     * (principles); 'human' inputs are initiative-relative and optional (the
     * entry brief). Absent on legacy flow.yaml inputs (kit-relative,
     * mandatory — unchanged behavior).
     */
    source?: 'framework' | 'human';
  }[];
  produces: { artifactIdPrefix: string; outputFilename: string };
  freezeGate: boolean;
  /**
   * Cross-kit `freeze` edges into this step (FR-023 R3), as "KIT:ARTIFACT"
   * refs. Rendered as non-interactive upstream FROZEN preconditions —
   * displayed and checked, never dropped, never a drivable in-flow step.
   * Absent/empty for flow.yaml-sourced definitions.
   */
  upstreamPreconditions?: string[];
}

export interface HandoffDefinition {
  targetKit: string;
  artifactPlacement: {
    sourceStep: string;
    targetPath: string;
    acceptanceCheck: string;
  };
}
