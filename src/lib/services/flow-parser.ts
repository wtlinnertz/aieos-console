import { parse as parseYaml } from 'yaml';
import { FlowDefinitionParseError } from './errors.js';
import type {
  FlowDefinition,
  FlowStep,
  HandoffDefinition,
} from './flow-types.js';

const VALID_STEP_TYPES = [
  'llm-generated',
  'human-intake',
  'acceptance-check',
  'consistency-check',
] as const;

export function parseFlowDefinition(content: string): FlowDefinition {
  let raw: unknown;
  try {
    raw = parseYaml(content);
  } catch {
    throw new FlowDefinitionParseError('Invalid YAML syntax');
  }

  if (raw === null || typeof raw !== 'object') {
    throw new FlowDefinitionParseError('Flow definition must be a YAML object');
  }

  const doc = raw as Record<string, unknown>;

  const kit = validateKit(doc);
  const steps = validateSteps(doc);
  const handoff = validateHandoff(doc);

  return { kit, steps, handoff };
}

function validateKit(
  doc: Record<string, unknown>,
): FlowDefinition['kit'] {
  if (!doc.kit || typeof doc.kit !== 'object') {
    throw new FlowDefinitionParseError('Missing required field: kit');
  }

  const kit = doc.kit as Record<string, unknown>;

  if (typeof kit.name !== 'string') {
    throw new FlowDefinitionParseError('Missing required field: kit.name');
  }
  if (typeof kit.id !== 'string') {
    throw new FlowDefinitionParseError('Missing required field: kit.id');
  }
  if (typeof kit.version !== 'string') {
    throw new FlowDefinitionParseError('Missing required field: kit.version');
  }

  return { name: kit.name, id: kit.id, version: kit.version };
}

function validateSteps(doc: Record<string, unknown>): FlowStep[] {
  if (!Array.isArray(doc.steps)) {
    throw new FlowDefinitionParseError('Missing required field: steps');
  }

  const stepIds = new Set<string>();
  const steps: FlowStep[] = [];

  for (const rawStep of doc.steps) {
    const step = validateStep(rawStep);

    if (stepIds.has(step.id)) {
      throw new FlowDefinitionParseError(
        `Duplicate step ID: "${step.id}"`,
      );
    }
    stepIds.add(step.id);
    steps.push(step);
  }

  // Validate dependency references
  for (const step of steps) {
    for (const dep of step.dependencies) {
      if (!stepIds.has(dep)) {
        throw new FlowDefinitionParseError(
          `Step "${step.id}" references non-existent dependency: "${dep}"`,
        );
      }
    }
  }

  return steps;
}

function validateStep(raw: unknown): FlowStep {
  if (raw === null || typeof raw !== 'object') {
    throw new FlowDefinitionParseError('Step must be an object');
  }

  const s = raw as Record<string, unknown>;

  if (typeof s.id !== 'string') {
    throw new FlowDefinitionParseError('Missing required step field: id');
  }
  if (typeof s.name !== 'string') {
    throw new FlowDefinitionParseError(
      `Missing required step field: name (step "${s.id}")`,
    );
  }
  if (typeof s.artifact_type !== 'string') {
    throw new FlowDefinitionParseError(
      `Missing required step field: artifact_type (step "${s.id}")`,
    );
  }

  const stepType = s.step_type as string;
  if (
    !VALID_STEP_TYPES.includes(
      stepType as (typeof VALID_STEP_TYPES)[number],
    )
  ) {
    throw new FlowDefinitionParseError(
      `Invalid step_type: "${stepType}" (step "${s.id}")`,
    );
  }

  const fourFiles = validateFourFiles(s, s.id as string);
  const requiredInputs = validateRequiredInputs(s);
  const produces = validateProduces(s, s.id as string);

  const dependencies = Array.isArray(s.dependencies) ? s.dependencies : [];
  const freezeGate =
    typeof s.freeze_gate === 'boolean' ? s.freeze_gate : false;

  return {
    id: s.id as string,
    name: s.name as string,
    artifactType: s.artifact_type as string,
    stepType: stepType as FlowStep['stepType'],
    dependencies: dependencies as string[],
    fourFiles,
    requiredInputs,
    produces,
    freezeGate,
  };
}

function validateFourFiles(
  s: Record<string, unknown>,
  stepId: string,
): FlowStep['fourFiles'] {
  if (!s.four_files || typeof s.four_files !== 'object') {
    throw new FlowDefinitionParseError(
      `Missing required step field: four_files (step "${stepId}")`,
    );
  }

  const ff = s.four_files as Record<string, unknown>;

  return {
    spec: ff.spec as string,
    template: ff.template as string,
    prompt: ff.prompt === null ? null : (ff.prompt as string),
    validator: ff.validator as string,
  };
}

function validateRequiredInputs(
  s: Record<string, unknown>,
): FlowStep['requiredInputs'] {
  if (!Array.isArray(s.required_inputs)) {
    return [];
  }

  return (s.required_inputs as Record<string, unknown>[]).map((ri) => ({
    path: ri.path as string,
    role: ri.role as string,
  }));
}

function validateProduces(
  s: Record<string, unknown>,
  stepId: string,
): FlowStep['produces'] {
  if (!s.produces || typeof s.produces !== 'object') {
    throw new FlowDefinitionParseError(
      `Missing required step field: produces (step "${stepId}")`,
    );
  }

  const p = s.produces as Record<string, unknown>;

  return {
    artifactIdPrefix: p.artifact_id_prefix as string,
    outputFilename: p.output_filename as string,
  };
}

function validateHandoff(
  doc: Record<string, unknown>,
): HandoffDefinition | undefined {
  if (!doc.handoff) {
    return undefined;
  }

  if (typeof doc.handoff !== 'object') {
    throw new FlowDefinitionParseError('handoff must be an object');
  }

  const h = doc.handoff as Record<string, unknown>;

  if (!h.artifact_placement || typeof h.artifact_placement !== 'object') {
    throw new FlowDefinitionParseError(
      'Missing required handoff field: artifact_placement',
    );
  }

  const ap = h.artifact_placement as Record<string, unknown>;

  return {
    targetKit: h.target_kit as string,
    artifactPlacement: {
      sourceStep: ap.source_step as string,
      targetPath: ap.target_path as string,
      acceptanceCheck: ap.acceptance_check as string,
    },
  };
}
