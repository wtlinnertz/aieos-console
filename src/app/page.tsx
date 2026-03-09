'use client';

import { useEffect, useState } from 'react';
import ProjectSetup from '@/components/ProjectSetup';
import ProjectOverview from '@/components/ProjectOverview';
import type { ProjectState } from '@/lib/services/state-types';

type PageStatus = 'loading' | 'setup' | 'overview';

export default function HomePage() {
  const [status, setStatus] = useState<PageStatus>('loading');
  const [projectState, setProjectState] = useState<ProjectState | null>(null);

  useEffect(() => {
    async function loadProject() {
      try {
        const res = await fetch('/api/project');
        if (res.ok) {
          const data = (await res.json()) as ProjectState;
          setProjectState(data);
          setStatus('overview');
        } else {
          setStatus('setup');
        }
      } catch {
        setStatus('setup');
      }
    }
    loadProject();
  }, []);

  return (
    <main>
      <h1>AIEOS Console</h1>
      {status === 'loading' && <p>Loading...</p>}
      {status === 'setup' && <ProjectSetup />}
      {status === 'overview' && projectState && (
        <ProjectOverview state={projectState} />
      )}
    </main>
  );
}
