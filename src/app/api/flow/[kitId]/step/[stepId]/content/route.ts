import { NextResponse } from 'next/server';
import { getServices } from '@/lib/services/service-factory';
import { errorResponse, getProjectDir, badRequest } from '@/lib/api-utils';

export async function PUT(
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
      !('content' in body) ||
      typeof (body as Record<string, unknown>).content !== 'string'
    ) {
      return badRequest('Request body must contain "content" (string)');
    }

    const { content } = body as { content: string };
    const { orchestration } = getServices();
    await orchestration.updateArtifactContent(getProjectDir(), kitId, stepId, content);
    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
