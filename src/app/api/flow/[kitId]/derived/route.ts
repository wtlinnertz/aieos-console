import { NextResponse } from 'next/server';
import { getServices } from '@/lib/services/service-factory';
import { deriveFlow } from '@/lib/services/derive-flow';
import { errorResponse } from '@/lib/api-utils';

/**
 * D8 (FR-023): derived-flow inspector. Returns deriveFlow's full output for
 * a kit abbreviation — the "one place to look" that flow.yaml used to give a
 * kit author. Only meaningful when the flow source is the manifest.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ kitId: string }> },
): Promise<NextResponse> {
  try {
    const { kitId } = await params;
    const { manifest } = getServices();
    if (!manifest) {
      return NextResponse.json(
        {
          error: 'Derived-flow inspector requires FLOW_SOURCE=manifest',
          code: 'FLOW_SOURCE_NOT_MANIFEST',
        },
        { status: 404 },
      );
    }
    const flow = deriveFlow(kitId, manifest.loadManifest());
    return NextResponse.json(flow);
  } catch (err) {
    return errorResponse(err);
  }
}
