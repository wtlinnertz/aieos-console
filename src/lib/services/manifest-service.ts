import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse as parseYaml } from 'yaml';
import {
  KitNotInManifestError,
  ManifestNotFoundError,
  ManifestParseError,
  ManifestVersionSkewError,
  RepoCheckoutMissingError,
} from './errors.js';
import type {
  DependencyEdge,
  KitManifest,
  ManifestKit,
} from './manifest-types.js';

/**
 * The manifest_version majors this console release supports (O2). A manifest
 * outside this range fails closed with MANIFEST_VERSION_SKEW instead of
 * silently defaulting anything.
 */
const SUPPORTED_MAJOR = 1;

export interface IManifestService {
  loadManifest(): KitManifest;
  getKit(abbr: string): ManifestKit;
  /** Resolve a kit's local checkout root via manifest.repository (Q2). */
  resolveKitPath(abbr: string): string;
  /** Reverse lookup: a kit directory path -> manifest abbreviation. */
  abbrForKitPath(kitPath: string): string;
  invalidateCache(): void;
}

/**
 * Reads kit-manifest.yml — the framework's declared single source of truth
 * for topology (FR-023). This service intentionally uses node:fs directly:
 * the manifest is operator-designated configuration (MANIFEST_PATH /
 * KIT_ROOT), read-only, and may live outside the filesystem sandbox that
 * guards project/kit writes.
 */
export class ManifestService implements IManifestService {
  private readonly manifestPath: string;
  private readonly kitRoot: string;
  private cached: KitManifest | null = null;

  constructor(options: { manifestPath: string; kitRoot: string }) {
    this.manifestPath = options.manifestPath;
    this.kitRoot = options.kitRoot;
  }

  loadManifest(): KitManifest {
    if (this.cached) {
      return this.cached;
    }

    if (!this.manifestPath) {
      throw new ManifestNotFoundError(
        'No manifest configured — set MANIFEST_PATH, or KIT_ROOT to the ' +
          'directory containing aieos-governance-foundation',
      );
    }

    let content: string;
    try {
      content = fs.readFileSync(this.manifestPath, 'utf-8');
    } catch {
      throw new ManifestNotFoundError(
        `kit-manifest.yml not found at: ${this.manifestPath}`,
      );
    }

    let raw: unknown;
    try {
      raw = parseYaml(content);
    } catch (err) {
      throw new ManifestParseError(
        `Invalid YAML in ${this.manifestPath}: ${(err as Error).message}`,
      );
    }

    this.cached = this.validate(raw);
    return this.cached;
  }

  getKit(abbr: string): ManifestKit {
    const kit = this.loadManifest().kits.get(abbr);
    if (!kit) {
      throw new KitNotInManifestError(
        `Kit "${abbr}" is not declared in the manifest`,
      );
    }
    return kit;
  }

  resolveKitPath(abbr: string): string {
    const kit = this.getKit(abbr);
    const kitPath = path.join(this.kitRoot, kit.repository);
    if (!fs.existsSync(kitPath)) {
      throw new RepoCheckoutMissingError(
        `${abbr}: repository "${kit.repository}" has no local checkout ` +
          `under ${this.kitRoot}`,
      );
    }
    return kitPath;
  }

  abbrForKitPath(kitPath: string): string {
    const basename = path.basename(kitPath.replace(/[\\/]+$/, ''));
    for (const [abbr, kit] of this.loadManifest().kits) {
      if (kit.repository === basename) {
        return abbr;
      }
    }
    throw new KitNotInManifestError(
      `No manifest kit has repository "${basename}" (from path: ${kitPath})`,
    );
  }

  invalidateCache(): void {
    this.cached = null;
  }

  private validate(raw: unknown): KitManifest {
    if (raw === null || typeof raw !== 'object') {
      throw new ManifestParseError('Manifest must be a YAML object');
    }
    const doc = raw as Record<string, unknown>;

    const version = doc.manifest_version;
    if (typeof version !== 'string') {
      throw new ManifestParseError('Missing required field: manifest_version');
    }
    const major = Number.parseInt(version.split('.')[0], 10);
    if (major !== SUPPORTED_MAJOR) {
      throw new ManifestVersionSkewError(
        `manifest_version ${version} is outside the supported range ` +
          `(major ${SUPPORTED_MAJOR}) — refusing to derive flows from it`,
      );
    }

    if (
      doc.kits === null ||
      typeof doc.kits !== 'object' ||
      Object.keys(doc.kits as object).length === 0
    ) {
      throw new ManifestParseError('Missing or empty required field: kits');
    }
    if (!Array.isArray(doc.dependency_edges)) {
      throw new ManifestParseError(
        'Missing required field: dependency_edges',
      );
    }

    const kits = new Map<string, ManifestKit>();
    for (const [abbr, rawKit] of Object.entries(
      doc.kits as Record<string, unknown>,
    )) {
      kits.set(abbr, this.validateKit(abbr, rawKit));
    }

    const edges: DependencyEdge[] = (doc.dependency_edges as unknown[]).map(
      (e, i) => {
        const edge = e as Record<string, unknown>;
        if (
          typeof edge.from !== 'string' ||
          typeof edge.to !== 'string' ||
          typeof edge.type !== 'string'
        ) {
          throw new ManifestParseError(
            `dependency_edges[${i}]: from/to/type are required`,
          );
        }
        return {
          from: edge.from,
          to: edge.to,
          type: edge.type as DependencyEdge['type'],
        };
      },
    );

    return { manifestVersion: version, kits, dependencyEdges: edges };
  }

  private validateKit(abbr: string, raw: unknown): ManifestKit {
    if (raw === null || typeof raw !== 'object') {
      throw new ManifestParseError(`Kit "${abbr}" must be an object`);
    }
    const k = raw as Record<string, unknown>;

    for (const field of ['full_name', 'repository'] as const) {
      if (typeof k[field] !== 'string') {
        throw new ManifestParseError(
          `Kit "${abbr}": missing required field ${field}`,
        );
      }
    }
    if (!Array.isArray(k.artifacts) || k.artifacts.length === 0) {
      throw new ManifestParseError(
        `Kit "${abbr}": missing or empty artifacts`,
      );
    }
    if (!Array.isArray(k.artifact_flow)) {
      throw new ManifestParseError(
        `Kit "${abbr}": missing required field artifact_flow`,
      );
    }

    const artifacts = (k.artifacts as unknown[]).map((a) => {
      const art = a as Record<string, unknown>;
      if (typeof art.id !== 'string' || typeof art.spec_file !== 'string') {
        throw new ManifestParseError(
          `Kit "${abbr}": every artifact needs id and spec_file`,
        );
      }
      const inputs = Array.isArray(art.inputs)
        ? (art.inputs as Record<string, unknown>[]).map((inp, idx) => {
            if (
              typeof inp.ref !== 'string' ||
              typeof inp.role !== 'string' ||
              !['human', 'framework', 'upstream'].includes(inp.source as string)
            ) {
              throw new ManifestParseError(
                `Kit "${abbr}"/${art.id}: inputs[${idx}] needs ref, role, ` +
                  'and source (human|framework|upstream)',
              );
            }
            return {
              ref: inp.ref,
              role: inp.role,
              source: inp.source as 'human' | 'framework' | 'upstream',
            };
          })
        : [];
      return {
        id: art.id,
        fullName: (art.full_name as string) ?? art.id,
        specFile: art.spec_file,
        humanAuthored: art.human_authored === true,
        optional: art.optional === true,
        inputs,
      };
    });

    return {
      abbr,
      layer: (k.layer as number) ?? 0,
      fullName: k.full_name as string,
      repository: k.repository as string,
      category: (k.category as string) ?? '',
      status: (k.status as string) ?? '',
      artifacts,
      artifactFlow: k.artifact_flow as string[],
    };
  }
}
