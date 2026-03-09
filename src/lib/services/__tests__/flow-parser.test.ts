import { describe, it, expect } from 'vitest';
import { parseFlowDefinition } from '../flow-parser.js';
import { FlowDefinitionParseError } from '../errors.js';

const VALID_YAML = `
kit:
  name: "Test Kit"
  id: "test-kit"
  version: "1.0.0"
steps:
  - id: "step-1"
    name: "First Step"
    artifact_type: "prd"
    step_type: "llm-generated"
    dependencies: []
    four_files:
      spec: "docs/specs/prd-spec.md"
      template: "docs/artifacts/prd-template.md"
      prompt: "docs/prompts/prd-prompt.md"
      validator: "docs/validators/prd-validator.md"
    required_inputs:
      - path: "docs/brief.md"
        role: "brief"
    produces:
      artifact_id_prefix: "PRD"
      output_filename: "01-prd.md"
    freeze_gate: true
handoff:
  target_kit: "eek"
  artifact_placement:
    source_step: "step-1"
    target_path: "docs/entry-from-pik.md"
    acceptance_check: "docs/validators/entry-validator.md"
`;

describe('parseFlowDefinition', () => {
  describe('acceptance tests', () => {
    it('AT-1: valid flow.yaml produces correctly typed FlowDefinition', () => {
      const result = parseFlowDefinition(VALID_YAML);

      expect(result.kit).toEqual({
        name: 'Test Kit',
        id: 'test-kit',
        version: '1.0.0',
      });

      expect(result.steps).toHaveLength(1);
      const step = result.steps[0];
      expect(step.id).toBe('step-1');
      expect(step.name).toBe('First Step');
      expect(step.artifactType).toBe('prd');
      expect(step.stepType).toBe('llm-generated');
      expect(step.dependencies).toEqual([]);
      expect(step.fourFiles).toEqual({
        spec: 'docs/specs/prd-spec.md',
        template: 'docs/artifacts/prd-template.md',
        prompt: 'docs/prompts/prd-prompt.md',
        validator: 'docs/validators/prd-validator.md',
      });
      expect(step.requiredInputs).toEqual([
        { path: 'docs/brief.md', role: 'brief' },
      ]);
      expect(step.produces).toEqual({
        artifactIdPrefix: 'PRD',
        outputFilename: '01-prd.md',
      });
      expect(step.freezeGate).toBe(true);

      expect(result.handoff).toEqual({
        targetKit: 'eek',
        artifactPlacement: {
          sourceStep: 'step-1',
          targetPath: 'docs/entry-from-pik.md',
          acceptanceCheck: 'docs/validators/entry-validator.md',
        },
      });
    });

    it('AT-2: missing steps field throws FlowDefinitionParseError', () => {
      const yaml = `
kit:
  name: "Test"
  id: "test"
  version: "1.0"
`;
      expect(() => parseFlowDefinition(yaml)).toThrow(
        FlowDefinitionParseError,
      );
      expect(() => parseFlowDefinition(yaml)).toThrow(/steps/);
    });

    it('AT-3: invalid dependency reference throws FlowDefinitionParseError', () => {
      const yaml = `
kit:
  name: "Test"
  id: "test"
  version: "1.0"
steps:
  - id: "step-1"
    name: "Step One"
    artifact_type: "prd"
    step_type: "llm-generated"
    dependencies:
      - "nonexistent-step"
    four_files:
      spec: "s.md"
      template: "t.md"
      prompt: "p.md"
      validator: "v.md"
    required_inputs: []
    produces:
      artifact_id_prefix: "PRD"
      output_filename: "01-prd.md"
    freeze_gate: false
`;
      expect(() => parseFlowDefinition(yaml)).toThrow(
        FlowDefinitionParseError,
      );
      expect(() => parseFlowDefinition(yaml)).toThrow(/nonexistent-step/);
    });
  });

  describe('failure tests', () => {
    it('FT-1: missing kit section throws FlowDefinitionParseError', () => {
      const yaml = `
steps:
  - id: "step-1"
    name: "Step"
    artifact_type: "prd"
    step_type: "llm-generated"
    dependencies: []
    four_files:
      spec: "s.md"
      template: "t.md"
      prompt: "p.md"
      validator: "v.md"
    required_inputs: []
    produces:
      artifact_id_prefix: "PRD"
      output_filename: "01.md"
    freeze_gate: false
`;
      expect(() => parseFlowDefinition(yaml)).toThrow(
        FlowDefinitionParseError,
      );
      expect(() => parseFlowDefinition(yaml)).toThrow(/kit/);
    });

    it('FT-2: missing step id throws FlowDefinitionParseError', () => {
      const yaml = `
kit:
  name: "Test"
  id: "test"
  version: "1.0"
steps:
  - name: "No ID Step"
    artifact_type: "prd"
    step_type: "llm-generated"
    dependencies: []
    four_files:
      spec: "s.md"
      template: "t.md"
      prompt: "p.md"
      validator: "v.md"
    required_inputs: []
    produces:
      artifact_id_prefix: "PRD"
      output_filename: "01.md"
    freeze_gate: false
`;
      expect(() => parseFlowDefinition(yaml)).toThrow(
        FlowDefinitionParseError,
      );
      expect(() => parseFlowDefinition(yaml)).toThrow(/id/);
    });

    it('FT-3: invalid stepType throws FlowDefinitionParseError', () => {
      const yaml = `
kit:
  name: "Test"
  id: "test"
  version: "1.0"
steps:
  - id: "step-1"
    name: "Bad Type"
    artifact_type: "prd"
    step_type: "invalid-type"
    dependencies: []
    four_files:
      spec: "s.md"
      template: "t.md"
      prompt: "p.md"
      validator: "v.md"
    required_inputs: []
    produces:
      artifact_id_prefix: "PRD"
      output_filename: "01.md"
    freeze_gate: false
`;
      expect(() => parseFlowDefinition(yaml)).toThrow(
        FlowDefinitionParseError,
      );
      expect(() => parseFlowDefinition(yaml)).toThrow(/invalid-type/);
    });

    it('FT-4: duplicate step IDs throws FlowDefinitionParseError', () => {
      const yaml = `
kit:
  name: "Test"
  id: "test"
  version: "1.0"
steps:
  - id: "step-1"
    name: "First"
    artifact_type: "prd"
    step_type: "llm-generated"
    dependencies: []
    four_files:
      spec: "s.md"
      template: "t.md"
      prompt: "p.md"
      validator: "v.md"
    required_inputs: []
    produces:
      artifact_id_prefix: "PRD"
      output_filename: "01.md"
    freeze_gate: false
  - id: "step-1"
    name: "Duplicate"
    artifact_type: "acf"
    step_type: "human-intake"
    dependencies: []
    four_files:
      spec: "s.md"
      template: "t.md"
      prompt: "p.md"
      validator: "v.md"
    required_inputs: []
    produces:
      artifact_id_prefix: "ACF"
      output_filename: "02.md"
    freeze_gate: false
`;
      expect(() => parseFlowDefinition(yaml)).toThrow(
        FlowDefinitionParseError,
      );
      expect(() => parseFlowDefinition(yaml)).toThrow(/Duplicate.*step-1/);
    });

    it('FT-5: malformed YAML throws FlowDefinitionParseError', () => {
      const yaml = `kit:\n  name: test\n  : broken`;
      expect(() => parseFlowDefinition(yaml)).toThrow(
        FlowDefinitionParseError,
      );
    });
  });

  describe('edge cases', () => {
    it('EC-1: optional handoff absent returns undefined', () => {
      const yaml = `
kit:
  name: "Test"
  id: "test"
  version: "1.0"
steps:
  - id: "step-1"
    name: "Step"
    artifact_type: "prd"
    step_type: "llm-generated"
    dependencies: []
    four_files:
      spec: "s.md"
      template: "t.md"
      prompt: "p.md"
      validator: "v.md"
    required_inputs: []
    produces:
      artifact_id_prefix: "PRD"
      output_filename: "01.md"
    freeze_gate: false
`;
      const result = parseFlowDefinition(yaml);
      expect(result.handoff).toBeUndefined();
    });

    it('EC-2: empty dependencies array', () => {
      const yaml = `
kit:
  name: "Test"
  id: "test"
  version: "1.0"
steps:
  - id: "step-1"
    name: "Step"
    artifact_type: "prd"
    step_type: "llm-generated"
    dependencies: []
    four_files:
      spec: "s.md"
      template: "t.md"
      prompt: "p.md"
      validator: "v.md"
    required_inputs: []
    produces:
      artifact_id_prefix: "PRD"
      output_filename: "01.md"
    freeze_gate: false
`;
      const result = parseFlowDefinition(yaml);
      expect(result.steps[0].dependencies).toEqual([]);
    });

    it('EC-3: prompt is null in four_files', () => {
      const yaml = `
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
      const result = parseFlowDefinition(yaml);
      expect(result.steps[0].fourFiles.prompt).toBeNull();
    });

    it('EC-4: empty required_inputs array', () => {
      const yaml = `
kit:
  name: "Test"
  id: "test"
  version: "1.0"
steps:
  - id: "step-1"
    name: "Step"
    artifact_type: "prd"
    step_type: "llm-generated"
    dependencies: []
    four_files:
      spec: "s.md"
      template: "t.md"
      prompt: "p.md"
      validator: "v.md"
    required_inputs: []
    produces:
      artifact_id_prefix: "PRD"
      output_filename: "01.md"
    freeze_gate: false
`;
      const result = parseFlowDefinition(yaml);
      expect(result.steps[0].requiredInputs).toEqual([]);
    });

    it('EC-5: multiple steps with valid cross-references', () => {
      const yaml = `
kit:
  name: "Test"
  id: "test"
  version: "1.0"
steps:
  - id: "step-a"
    name: "Step A"
    artifact_type: "prd"
    step_type: "llm-generated"
    dependencies: []
    four_files:
      spec: "s.md"
      template: "t.md"
      prompt: "p.md"
      validator: "v.md"
    required_inputs: []
    produces:
      artifact_id_prefix: "PRD"
      output_filename: "01.md"
    freeze_gate: true
  - id: "step-b"
    name: "Step B"
    artifact_type: "acf"
    step_type: "acceptance-check"
    dependencies:
      - "step-a"
    four_files:
      spec: "s2.md"
      template: "t2.md"
      prompt: null
      validator: "v2.md"
    required_inputs:
      - path: "01.md"
        role: "input"
    produces:
      artifact_id_prefix: "ACF"
      output_filename: "02.md"
    freeze_gate: false
`;
      const result = parseFlowDefinition(yaml);
      expect(result.steps).toHaveLength(2);
      expect(result.steps[1].dependencies).toEqual(['step-a']);
    });

    it('EC-6: missing kit.name throws FlowDefinitionParseError', () => {
      const yaml = `
kit:
  id: "test"
  version: "1.0"
steps: []
`;
      expect(() => parseFlowDefinition(yaml)).toThrow(
        FlowDefinitionParseError,
      );
      expect(() => parseFlowDefinition(yaml)).toThrow(/kit\.name/);
    });

    it('EC-7: missing kit.id throws FlowDefinitionParseError', () => {
      const yaml = `
kit:
  name: "Test"
  version: "1.0"
steps: []
`;
      expect(() => parseFlowDefinition(yaml)).toThrow(
        FlowDefinitionParseError,
      );
      expect(() => parseFlowDefinition(yaml)).toThrow(/kit\.id/);
    });

    it('EC-8: missing step four_files throws FlowDefinitionParseError', () => {
      const yaml = `
kit:
  name: "Test"
  id: "test"
  version: "1.0"
steps:
  - id: "step-1"
    name: "Step"
    artifact_type: "prd"
    step_type: "llm-generated"
    dependencies: []
    required_inputs: []
    produces:
      artifact_id_prefix: "PRD"
      output_filename: "01.md"
    freeze_gate: false
`;
      expect(() => parseFlowDefinition(yaml)).toThrow(
        FlowDefinitionParseError,
      );
      expect(() => parseFlowDefinition(yaml)).toThrow(/four_files/);
    });

    it('EC-9: missing step name throws FlowDefinitionParseError', () => {
      const yaml = `
kit:
  name: "Test"
  id: "test"
  version: "1.0"
steps:
  - id: "step-1"
    artifact_type: "prd"
    step_type: "llm-generated"
    dependencies: []
    four_files:
      spec: "s.md"
      template: "t.md"
      prompt: "p.md"
      validator: "v.md"
    required_inputs: []
    produces:
      artifact_id_prefix: "PRD"
      output_filename: "01.md"
    freeze_gate: false
`;
      expect(() => parseFlowDefinition(yaml)).toThrow(
        FlowDefinitionParseError,
      );
      expect(() => parseFlowDefinition(yaml)).toThrow(/name/);
    });

    it('EC-10: empty steps array is valid', () => {
      const yaml = `
kit:
  name: "Test"
  id: "test"
  version: "1.0"
steps: []
`;
      const result = parseFlowDefinition(yaml);
      expect(result.steps).toEqual([]);
    });

    it('EC-11: freeze_gate boolean mapping', () => {
      const yaml = `
kit:
  name: "Test"
  id: "test"
  version: "1.0"
steps:
  - id: "step-1"
    name: "Freeze"
    artifact_type: "prd"
    step_type: "llm-generated"
    dependencies: []
    four_files:
      spec: "s.md"
      template: "t.md"
      prompt: "p.md"
      validator: "v.md"
    required_inputs: []
    produces:
      artifact_id_prefix: "PRD"
      output_filename: "01.md"
    freeze_gate: true
  - id: "step-2"
    name: "No Freeze"
    artifact_type: "acf"
    step_type: "acceptance-check"
    dependencies: []
    four_files:
      spec: "s.md"
      template: "t.md"
      prompt: null
      validator: "v.md"
    required_inputs: []
    produces:
      artifact_id_prefix: "ACF"
      output_filename: "02.md"
    freeze_gate: false
`;
      const result = parseFlowDefinition(yaml);
      expect(result.steps[0].freezeGate).toBe(true);
      expect(result.steps[1].freezeGate).toBe(false);
    });
  });
});
