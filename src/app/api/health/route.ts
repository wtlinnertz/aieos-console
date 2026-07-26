import { NextResponse } from 'next/server';
import { loadConfig } from '@/lib/config';
import { getServices } from '@/lib/services/service-factory';

/**
 * Health, extended for FR-023 (D4): in manifest mode the manifest is loaded
 * here so a missing/unparseable/skewed manifest is visible fail-closed at
 * the front door instead of surfacing later as a mystery 500.
 */
export async function GET() {
  const config = loadConfig();

  if (config.flowSource === 'flow-yaml') {
    return NextResponse.json({ status: 'ok', flowSource: 'flow-yaml' });
  }

  try {
    const { manifest } = getServices();
    const loaded = manifest?.loadManifest();
    return NextResponse.json({
      status: 'ok',
      flowSource: 'manifest',
      manifest: {
        version: loaded?.manifestVersion,
        kits: loaded ? [...loaded.kits.keys()] : [],
      },
    });
  } catch (err) {
    const e = err as Error;
    return NextResponse.json({
      status: 'degraded',
      flowSource: 'manifest',
      manifestError: { name: e.name, message: e.message },
    });
  }
}
