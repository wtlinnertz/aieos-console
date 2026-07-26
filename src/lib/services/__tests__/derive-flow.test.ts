import { describe, it, expect } from 'vitest';
import { deriveFlow, tokenFor } from '../derive-flow.js';
import { FlowDefinitionParseError } from '../errors.js';
import type { KitManifest, ManifestKit } from '../manifest-types.js';

function kit(partial: Partial<ManifestKit> & { abbr: string }): ManifestKit {
  return {
    layer: 4,
    fullName: `${partial.abbr} kit`,
    repository: `aieos-${partial.abbr.toLowerCase()}-kit`,
    category: 'pipeline',
    status: 'built',
    artifacts: [],
    artifactFlow: [],
    ...partial,
  };
}

function manifest(kits: ManifestKit[], edges: KitManifest['dependencyEdges'] = []): KitManifest {
  return {
    manifestVersion: '1.0',
    kits: new Map(kits.map((k) => [k.abbr, k])),
    dependencyEdges: edges,
  };
}

const EEK = kit({
  abbr: 'EEK',
  artifacts: [
    // KER is one of the nine divergent artifacts: token != id.toLowerCase()
    { id: 'KER', fullName: 'Kit Entry Record', specFile: 'kit-entry-spec.md', humanAuthored: true, optional: false, inputs: [] },
    {
      id: 'PRD',
      fullName: 'Product Requirements Document',
      specFile: 'prd-spec.md',
      humanAuthored: false,
      optional: false,
      inputs: [
        { ref: 'docs/brief.md', role: 'brief', source: 'human' },
        { ref: 'docs/principles/product-craftsmanship.md', role: 'principles', source: 'framework' },
        { ref: 'ignored', role: 'x', source: 'upstream' },
      ],
    },
    { id: 'SAD', fullName: 'Solution Architecture Document', specFile: 'sad-spec.md', humanAuthored: false, optional: false, inputs: [] },
  ],
  artifactFlow: ['KER', 'PRD', 'SAD'],
});

const REK = kit({
  abbr: 'REK',
  artifacts: [
    { id: 'RER', fullName: 'Release Entry Record', specFile: 'release-entry-spec.md', humanAuthored: true, optional: false, inputs: [] },
  ],
  artifactFlow: ['RER'],
});

const EDGES: KitManifest['dependencyEdges'] = [
  { from: 'EEK:KER', to: 'EEK:PRD', type: 'freeze' },
  { from: 'EEK:PRD', to: 'EEK:SAD', type: 'freeze' },
  { from: 'EEK:SAD', to: 'REK:RER', type: 'freeze' }, // cross-kit (R3)
  { from: 'EEK:SAD', to: 'EEK:PRD', type: 'trigger' }, // never a dependency
];

describe('deriveFlow', () => {
  it('derives one step per artifact_flow entry, in order', () => {
    const flow = deriveFlow('EEK', manifest([EEK, REK], EDGES));
    expect(flow.kit).toEqual({ name: 'EEK kit', id: 'EEK', version: '1.0' });
    expect(flow.steps.map((s) => s.id)).toEqual(['kit-entry', 'prd', 'sad']);
  });

  it('uses the corrected token rule (R1): spec_file minus -spec.md, not id', () => {
    const flow = deriveFlow('EEK', manifest([EEK, REK], EDGES));
    const ker = flow.steps[0];
    expect(ker.id).toBe('kit-entry');
    expect(ker.fourFiles.template).toBe('docs/artifacts/kit-entry-template.md');
    expect(ker.fourFiles.validator).toBe('docs/validators/kit-entry-validator.md');
    expect(ker.produces.outputFilename).toBe('kit-entry.md');
    expect(ker.produces.artifactIdPrefix).toBe('KER');
  });

  it('maps human_authored to human-intake with a null prompt', () => {
    const flow = deriveFlow('EEK', manifest([EEK, REK], EDGES));
    expect(flow.steps[0].stepType).toBe('human-intake');
    expect(flow.steps[0].fourFiles.prompt).toBeNull();
    expect(flow.steps[1].stepType).toBe('llm-generated');
    expect(flow.steps[1].fourFiles.prompt).toBe('docs/prompts/prd-prompt.md');
  });

  it('turns within-kit freeze edges into dependencies; trigger edges never block', () => {
    const flow = deriveFlow('EEK', manifest([EEK, REK], EDGES));
    expect(flow.steps[1].dependencies).toEqual(['kit-entry']);
    expect(flow.steps[2].dependencies).toEqual(['prd']);
  });

  it('renders cross-kit freeze edges as upstream FROZEN preconditions (R3)', () => {
    const flow = deriveFlow('REK', manifest([EEK, REK], EDGES));
    const rer = flow.steps[0];
    expect(rer.upstreamPreconditions).toEqual(['EEK:SAD']);
    // never a drivable in-flow step
    expect(flow.steps.map((s) => s.id)).toEqual(['release-entry']);
    expect(rer.dependencies).toEqual([]);
  });

  it('maps declared inputs to requiredInputs; upstream entries filtered (G-3)', () => {
    const flow = deriveFlow('EEK', manifest([EEK, REK], EDGES));
    expect(flow.steps[1].requiredInputs).toEqual([
      { path: 'docs/brief.md', role: 'brief', source: 'human' },
      {
        path: 'docs/principles/product-craftsmanship.md',
        role: 'principles',
        source: 'framework',
      },
    ]);
    expect(flow.steps[2].requiredInputs).toEqual([]);
  });

  it('fails fast on an artifact_flow entry with no artifacts[] declaration', () => {
    const broken = kit({
      abbr: 'BAD',
      artifacts: EEK.artifacts,
      artifactFlow: ['KER', 'NOPE'],
    });
    expect(() => deriveFlow('BAD', manifest([broken]))).toThrow(
      FlowDefinitionParseError,
    );
  });

  it('fails on an unknown kit abbreviation', () => {
    expect(() => deriveFlow('ZZZ', manifest([EEK]))).toThrow(
      FlowDefinitionParseError,
    );
  });
});

describe('tokenFor', () => {
  it('rejects a spec_file that does not end with -spec.md', () => {
    const bad = kit({
      abbr: 'BAD',
      artifacts: [
        { id: 'X', fullName: 'X', specFile: 'x-specification.md', humanAuthored: false, optional: false, inputs: [] },
      ],
      artifactFlow: ['X'],
    });
    expect(() => tokenFor(bad, 'X')).toThrow(FlowDefinitionParseError);
  });
});
