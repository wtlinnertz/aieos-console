'use client';

import type { ProjectState } from '@/lib/services/state-types';

interface ProjectOverviewProps {
  state: ProjectState;
}

export default function ProjectOverview({ state }: ProjectOverviewProps) {
  return (
    <section>
      <h2>Project Overview</h2>
      <p>
        <strong>Project ID:</strong> {state.projectId}
      </p>

      <h3>Kit Configurations</h3>
      {state.kitConfigs.length === 0 ? (
        <p>No kits configured.</p>
      ) : (
        <ul>
          {state.kitConfigs.map((kit) => (
            <li key={kit.kitId}>
              <a href={`/flow/${kit.kitId}`}>{kit.kitId}</a> &mdash; {kit.kitPath}
            </li>
          ))}
        </ul>
      )}

      <h3>LLM Configurations</h3>
      {state.llmConfigs.length === 0 ? (
        <p>No LLM configs.</p>
      ) : (
        <ul>
          {state.llmConfigs.map((llm, i) => (
            <li key={`${llm.providerId}-${llm.model}-${i}`}>
              {llm.providerId} / {llm.model} (env: {llm.apiKeyEnvVar})
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
