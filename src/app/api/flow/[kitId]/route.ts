import { NextResponse } from 'next/server';
import { getServices } from '@/lib/services/service-factory';
import { errorResponse, getProjectDir } from '@/lib/api-utils';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ kitId: string }> },
): Promise<NextResponse> {
  try {
    const { kitId } = await params;
    const { orchestration } = getServices();
    const status = await orchestration.getFlowStatus(getProjectDir(), kitId);
    return NextResponse.json(status);
  } catch (err) {
    return errorResponse(err);
  }
}
