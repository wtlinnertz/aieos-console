import { NextResponse } from 'next/server';
import { getServices } from '@/lib/services/service-factory';
import { errorResponse, badRequest } from '@/lib/api-utils';
import type { KitConfig, LlmConfig } from '@/lib/services/state-types';

interface InitializeBody {
  projectDir: string;
  kitConfigs: KitConfig[];
  llmConfigs: LlmConfig[];
}

function isValidBody(body: unknown): body is InitializeBody {
  if (body === null || typeof body !== 'object') return false;
  const obj = body as Record<string, unknown>;
  return (
    typeof obj.projectDir === 'string' &&
    Array.isArray(obj.kitConfigs) &&
    Array.isArray(obj.llmConfigs)
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return badRequest('Request body must be valid JSON');
    }

    if (!isValidBody(body)) {
      return badRequest(
        'Request body must contain "projectDir" (string), "kitConfigs" (array), and "llmConfigs" (array)',
      );
    }

    const { state } = getServices();
    await state.initializeProject(body.projectDir, body.kitConfigs, body.llmConfigs);
    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
