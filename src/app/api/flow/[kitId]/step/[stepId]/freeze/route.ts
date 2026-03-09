import { NextResponse } from 'next/server';
import { getServices } from '@/lib/services/service-factory';
import { errorResponse, getProjectDir, badRequest } from '@/lib/api-utils';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ kitId: string; stepId: string }> },
): Promise<NextResponse> {
  try {
    const { kitId, stepId } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return badRequest('Request body must be valid JSON');
    }

    if (
      body === null ||
      typeof body !== 'object' ||
      !('artifactId' in body) ||
      typeof (body as Record<string, unknown>).artifactId !== 'string'
    ) {
      return badRequest('Request body must contain "artifactId" (string)');
    }

    const { artifactId } = body as { artifactId: string };
    const { orchestration } = getServices();
    await orchestration.freezeArtifact(getProjectDir(), kitId, stepId, artifactId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
