import { FlowStepper } from '@/components/FlowStepper';
import { getServices } from '@/lib/services/service-factory';
import { getProjectDir } from '@/lib/api-utils';

interface FlowPageProps {
  params: Promise<{ kitId: string }>;
}

/**
 * G-20 fix — flow overview route.
 *
 * This is a SERVER component that reads the orchestration service directly,
 * the pattern the step page (WDD-CONSOLE-013 / G-21) established. Its previous
 * form fetched its own HTTP API with a hardcoded `http://localhost:3000`
 * fallback — made sticky across restarts by compile-time NEXT_PUBLIC inlining
 * — and a silent catch that rendered backend failure as a plausible empty
 * flow. That was G-20.
 *
 * Failures propagate. There is no fallback render. A page that cannot load
 * its flow must not resemble a flow with no steps in it.
 */
export default async function FlowPage({ params }: FlowPageProps) {
  const { kitId } = await params;

  const { orchestration } = getServices();
  const flowStatus = await orchestration.getFlowStatus(getProjectDir(), kitId);

  return (
    <main>
      <h1>Flow: {kitId}</h1>
      <FlowStepper flowStatus={flowStatus} kitId={kitId} />
    </main>
  );
}
