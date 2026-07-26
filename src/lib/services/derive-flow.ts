import { FlowDefinitionParseError } from './errors.js';
import type { FlowDefinition, FlowStep } from './flow-types.js';
import type { KitManifest, ManifestKit } from './manifest-types.js';

/**
 * deriveFlow (FR-023): build the console's FlowDefinition for one kit from
 * kit-manifest.yml + the artifact-file convention — topology from the
 * manifest (the declared single source of truth), physical paths derived by
 * the convention every driver shares. Replaces the console-private flow.yaml.
 *
 * Rules (ratified 2026-07-25, FR-023 build spec):
 * - Token rule (R1, corrected): token = spec_file minus "-spec.md". NEVER
 *   id.toLowerCase() — nine artifacts diverge (PIK×7, EEK/KER, REK/RER).
 * - Within-kit `freeze` dependency edges become step dependencies; `trigger`
 *   and `escalation` edges never block a flow.
 * - Cross-kit `freeze` edges into this kit become NON-INTERACTIVE upstream
 *   FROZEN preconditions (R3) — displayed and checked, never dropped, never
 *   a drivable in-flow step.
 * - human_authored artifacts map to `human-intake` with prompt: null (entry
 *   gates have no prompt file).
 * - Output name is the harness convention `{token}.md`; display ordinals
 *   derive from artifact_flow index as presentation only.
 */
export function deriveFlow(
  kitAbbr: string,
  manifest: KitManifest,
): FlowDefinition {
  const kit = manifest.kits.get(kitAbbr);
  if (!kit) {
    throw new FlowDefinitionParseError(
      `Kit "${kitAbbr}" is not declared in the manifest`,
    );
  }

  const byId = new Map(kit.artifacts.map((a) => [a.id, a]));
  const tokens = new Map<string, string>();
  for (const artifact of kit.artifacts) {
    tokens.set(artifact.id, tokenFor(kit, artifact.id));
  }

  const steps: FlowStep[] = kit.artifactFlow.map((artifactId) => {
    const artifact = byId.get(artifactId);
    if (!artifact) {
      throw new FlowDefinitionParseError(
        `${kitAbbr}: artifact_flow entry "${artifactId}" has no matching ` +
          'artifacts[] declaration',
      );
    }
    const token = tokens.get(artifactId) as string;

    return {
      id: token,
      name: artifact.fullName,
      artifactType: token,
      stepType: artifact.humanAuthored ? 'human-intake' : 'llm-generated',
      dependencies: [],
      fourFiles: {
        spec: `docs/specs/${artifact.specFile}`,
        template: `docs/artifacts/${token}-template.md`,
        prompt: artifact.humanAuthored ? null : `docs/prompts/${token}-prompt.md`,
        validator: `docs/validators/${token}-validator.md`,
      },
      // G-3/G-5 (manifest 1.1): declared inputs become required inputs;
      // upstream-sourced entries stay modeled by dependency_edges.
      requiredInputs: artifact.inputs
        .filter((i) => i.source !== 'upstream')
        .map((i) => ({
          path: i.ref,
          role: i.role,
          source: i.source as 'framework' | 'human',
        })),
      produces: {
        artifactIdPrefix: artifact.id,
        outputFilename: `${token}.md`,
      },
      freezeGate: true,
      upstreamPreconditions: [],
    };
  });

  const stepByArtifactId = new Map<string, FlowStep>();
  kit.artifactFlow.forEach((artifactId, i) => {
    stepByArtifactId.set(artifactId, steps[i]);
  });

  for (const edge of manifest.dependencyEdges) {
    if (edge.type !== 'freeze') {
      continue;
    }
    const [fromKit, fromArtifact] = splitRef(edge.from);
    const [toKit, toArtifact] = splitRef(edge.to);
    if (toKit !== kitAbbr) {
      continue;
    }
    const target = stepByArtifactId.get(toArtifact);
    if (!target) {
      continue; // edge into an artifact this kit's flow does not drive
    }
    if (fromKit === kitAbbr) {
      const depToken = tokens.get(fromArtifact);
      if (depToken && !target.dependencies.includes(depToken)) {
        target.dependencies.push(depToken);
      }
    } else {
      // R3: cross-kit freeze edge -> upstream FROZEN precondition.
      if (!target.upstreamPreconditions?.includes(edge.from)) {
        target.upstreamPreconditions?.push(edge.from);
      }
    }
  }

  return {
    kit: {
      name: kit.fullName,
      id: kit.abbr,
      version: manifest.manifestVersion,
    },
    steps,
  };
}

/** Token rule (R1, corrected): spec_file minus the trailing "-spec.md". */
export function tokenFor(kit: ManifestKit, artifactId: string): string {
  const artifact = kit.artifacts.find((a) => a.id === artifactId);
  if (!artifact) {
    throw new FlowDefinitionParseError(
      `${kit.abbr}: unknown artifact id "${artifactId}"`,
    );
  }
  const suffix = '-spec.md';
  if (!artifact.specFile.endsWith(suffix)) {
    throw new FlowDefinitionParseError(
      `${kit.abbr}/${artifactId}: spec_file "${artifact.specFile}" does not ` +
        `end with "${suffix}" — cannot derive the file token`,
    );
  }
  return artifact.specFile.slice(0, -suffix.length);
}

function splitRef(ref: string): [string, string] {
  const idx = ref.indexOf(':');
  if (idx <= 0) {
    throw new FlowDefinitionParseError(
      `Malformed dependency edge reference: "${ref}" (expected KIT:ARTIFACT)`,
    );
  }
  return [ref.slice(0, idx), ref.slice(idx + 1)];
}
