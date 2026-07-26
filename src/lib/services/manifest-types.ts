/**
 * Types for kit-manifest.yml — the framework's declared single source of
 * truth for topology (FR-023). The authoritative schema is
 * aieos-governance-foundation/schema/kit-manifest.schema.json; these types
 * mirror the fields the console consumes.
 */

export interface ManifestInput {
  ref: string;
  role: string;
  source: 'human' | 'framework' | 'upstream';
}

export interface ManifestArtifact {
  id: string;
  fullName: string;
  specFile: string;
  humanAuthored: boolean;
  optional: boolean;
  /** G-3/G-5 (manifest 1.1): declared non-upstream inputs. */
  inputs: ManifestInput[];
}

export interface ManifestKit {
  abbr: string;
  layer: number;
  fullName: string;
  repository: string;
  category: string;
  status: string;
  artifacts: ManifestArtifact[];
  artifactFlow: string[];
}

export interface DependencyEdge {
  from: string; // "KIT:ARTIFACT"
  to: string; // "KIT:ARTIFACT"
  type: 'freeze' | 'trigger' | 'escalation';
}

export interface KitManifest {
  manifestVersion: string;
  kits: Map<string, ManifestKit>;
  dependencyEdges: DependencyEdge[];
}
