import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ManifestService } from '../manifest-service.js';
import {
  KitNotInManifestError,
  ManifestNotFoundError,
  ManifestParseError,
  ManifestVersionSkewError,
  RepoCheckoutMissingError,
} from '../errors.js';

const VALID = `
manifest_version: "1.0"
kits:
  QAK:
    layer: 9
    full_name: "Quality Assurance Kit"
    repository: "aieos-quality-assurance-kit"
    category: "cross-cutting"
    status: "built"
    artifacts:
      - id: QAER
        full_name: "Quality Assurance Entry Record"
        spec_file: "qaer-spec.md"
        human_authored: true
    artifact_flow: [QAER]
dependency_edges:
  - { from: "EEK:ORD", to: "QAK:QAER", type: "freeze" }
`;

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manifest-test-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function write(content: string): ManifestService {
  const manifestPath = path.join(dir, 'kit-manifest.yml');
  fs.writeFileSync(manifestPath, content, 'utf-8');
  return new ManifestService({ manifestPath, kitRoot: dir });
}

describe('ManifestService', () => {
  it('parses a valid manifest', () => {
    const m = write(VALID).loadManifest();
    expect(m.manifestVersion).toBe('1.0');
    expect(m.kits.get('QAK')?.artifacts[0].specFile).toBe('qaer-spec.md');
    expect(m.dependencyEdges).toHaveLength(1);
  });

  it('fails closed when the manifest file is missing', () => {
    const svc = new ManifestService({
      manifestPath: path.join(dir, 'nope.yml'),
      kitRoot: dir,
    });
    expect(() => svc.loadManifest()).toThrow(ManifestNotFoundError);
  });

  it('fails closed when no manifest is configured at all', () => {
    const svc = new ManifestService({ manifestPath: '', kitRoot: '' });
    expect(() => svc.loadManifest()).toThrow(ManifestNotFoundError);
  });

  it('fails closed on invalid YAML', () => {
    expect(() => write('kits: [unclosed').loadManifest()).toThrow(
      ManifestParseError,
    );
  });

  it('refuses an unsupported manifest_version major (O2)', () => {
    expect(() =>
      write(VALID.replace('"1.0"', '"2.0"')).loadManifest(),
    ).toThrow(ManifestVersionSkewError);
  });

  it('resolveKitPath fails closed when the checkout is missing (D4)', () => {
    expect(() => write(VALID).resolveKitPath('QAK')).toThrow(
      RepoCheckoutMissingError,
    );
  });

  it('resolveKitPath returns the checkout under kitRoot when present', () => {
    const svc = write(VALID);
    fs.mkdirSync(path.join(dir, 'aieos-quality-assurance-kit'));
    expect(svc.resolveKitPath('QAK')).toBe(
      path.join(dir, 'aieos-quality-assurance-kit'),
    );
  });

  it('abbrForKitPath maps a kit directory back to its abbreviation', () => {
    const svc = write(VALID);
    expect(
      svc.abbrForKitPath(path.join(dir, 'aieos-quality-assurance-kit')),
    ).toBe('QAK');
    expect(() => svc.abbrForKitPath(path.join(dir, 'not-a-kit'))).toThrow(
      KitNotInManifestError,
    );
  });
});
