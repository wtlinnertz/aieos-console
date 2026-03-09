import { NextResponse } from 'next/server';
import { getServices } from '@/lib/services/service-factory';
import { errorResponse, getProjectDir } from '@/lib/api-utils';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ kitId: string; stepId: string }> },
): Promise<NextResponse> {
  try {
    const { kitId, stepId } = await params;
    const { orchestration } = getServices();
    const result = await orchestration.validateArtifact(getProjectDir(), kitId, stepId);
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
