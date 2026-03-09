import { getServices } from '@/lib/services/service-factory';
import { errorResponse, getProjectDir } from '@/lib/api-utils';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ kitId: string; stepId: string }> },
): Promise<Response> {
  try {
    const { kitId, stepId } = await params;
    const { orchestration } = getServices();

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const event of orchestration.generateArtifact(
            getProjectDir(),
            kitId,
            stepId,
          )) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
            );
          }
        } catch (err) {
          const errorEvent = {
            type: 'error',
            error: err instanceof Error ? err.message : 'Unknown error',
          };
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
