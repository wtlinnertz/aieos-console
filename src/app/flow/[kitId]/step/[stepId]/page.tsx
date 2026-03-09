'use client';

import Link from 'next/link';
import { use } from 'react';

interface StepPageProps {
  params: Promise<{ kitId: string; stepId: string }>;
}

export default function StepPage({ params }: StepPageProps) {
  const { kitId, stepId } = use(params);

  return (
    <main>
      <nav style={{ marginBottom: '16px' }}>
        <Link href={`/flow/${kitId}`}>Back to flow overview</Link>
      </nav>
      <h1>Step: {stepId}</h1>
      <p>
        Flow: <strong>{kitId}</strong>
      </p>
      {/* Placeholder for step detail views (WDD-CONSOLE-013, WDD-CONSOLE-014) */}
      <section>
        <p>Step detail content will be rendered here.</p>
      </section>
    </main>
  );
}
