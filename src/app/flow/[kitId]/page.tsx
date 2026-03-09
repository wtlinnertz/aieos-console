import { FlowStepper } from '@/components/FlowStepper';
import type { FlowStatus } from '@/lib/services/orchestration-types';

interface FlowPageProps {
  params: Promise<{ kitId: string }>;
}

async function getFlowStatus(kitId: string): Promise<FlowStatus> {
  // TODO: Replace with real API call once backend is wired up.
  // For now, return a minimal mock so the page renders.
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
  try {
    const res = await fetch(`${baseUrl}/api/flow/${kitId}`, {
      cache: 'no-store',
    });
    if (res.ok) {
      return (await res.json()) as FlowStatus;
    }
  } catch {
    // Fall through to mock data
  }

  // Mock fallback for development / component testing
  return {
    steps: [],
    currentStep: null,
    completedSteps: 0,
    totalSteps: 0,
  };
}

export default async function FlowPage({ params }: FlowPageProps) {
  const { kitId } = await params;
  const flowStatus = await getFlowStatus(kitId);

  return (
    <main>
      <h1>Flow: {kitId}</h1>
      <FlowStepper flowStatus={flowStatus} kitId={kitId} />
    </main>
  );
}
