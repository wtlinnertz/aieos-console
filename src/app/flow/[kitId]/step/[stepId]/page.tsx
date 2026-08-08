import Link from 'next/link';

import { StepView } from '@/components/StepView';
import { getServices } from '@/lib/services/service-factory';
import { getProjectDir } from '@/lib/api-utils';
import { StepNotFoundError } from '@/lib/services/errors';

interface StepPageProps {
  params: Promise<{ kitId: string; stepId: string }>;
}

/**
 * WDD-CONSOLE-013 — step detail route.
 *
 * This is a SERVER component that reads the orchestration service directly.
 * It deliberately does NOT fetch its own HTTP API: the sibling flow page did
 * exactly that and produced G-20 — a hardcoded `http://localhost:3000`
 * fallback that broke the moment the console ran on any other port, made
 * sticky across restarts by compile-time NEXT_PUBLIC inlining, and hidden by
 * a catch that returned an empty-but-valid-looking result.
 *
 * Failures propagate. There is no fallback render. A page that cannot load
 * its step must not look like a step with nothing in it — that
 * indistinguishability is the whole G-20 defect, and re-introducing it here
 * would recreate it one route over.
 */
export default async function StepPage({ params }: StepPageProps) {
  const { kitId, stepId } = await params;

  const { orchestration } = getServices();
  const flowStatus = await orchestration.getFlowStatus(getProjectDir(), kitId);

  const stepStatus = flowStatus.steps.find((s) => s.step.id === stepId);
  if (!stepStatus) {
    // 404 condition — api-utils maps StepNotFoundError to a 404. Not an
    // empty page.
    throw new StepNotFoundError(`Step '${stepId}' not found in kit '${kitId}'`);
  }

  return (
    <main>
      <nav style={{ marginBottom: '16px' }}>
        <Link href={`/flow/${kitId}`}>Back to flow overview</Link>
      </nav>
      <StepView
        step={stepStatus.step}
        state={stepStatus.state}
        kitId={kitId}
        blockedReason={stepStatus.blockedReason}
      />
    </main>
  );
}
