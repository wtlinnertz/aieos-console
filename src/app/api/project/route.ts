import { NextResponse } from 'next/server';
import { getServices } from '@/lib/services/service-factory';
import { errorResponse, getProjectDir } from '@/lib/api-utils';

export async function GET(): Promise<NextResponse> {
  try {
    const { state } = getServices();
    const projectState = await state.loadState(getProjectDir());
    return NextResponse.json(projectState);
  } catch (err) {
    return errorResponse(err);
  }
}
