'use client';

import { useState, type FormEvent } from 'react';

interface InitializeResponse {
  projectId: string;
  kitConfigs: { kitId: string; kitPath: string }[];
}

interface ErrorResponse {
  error: string;
}

export default function ProjectSetup() {
  const [projectDir, setProjectDir] = useState('');
  const [kitPaths, setKitPaths] = useState('');
  const [provider, setProvider] = useState('anthropic');
  const [model, setModel] = useState('');
  const [apiKeyEnvVar, setApiKeyEnvVar] = useState('LLM_API_KEY');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const kitConfigs = kitPaths
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
      .map((kitPath) => {
        const segments = kitPath.split('/');
        const kitId = segments[segments.length - 1];
        return { kitId, kitPath };
      });

    const llmConfigs = [
      {
        providerId: provider,
        model,
        apiKeyEnvVar,
      },
    ];

    try {
      const res = await fetch('/api/project/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectDir, kitConfigs, llmConfigs }),
      });

      if (res.status === 409) {
        setError('Project is already initialized.');
        return;
      }

      if (!res.ok) {
        const body = (await res.json()) as ErrorResponse;
        setError(body.error || 'Initialization failed.');
        return;
      }

      const data = (await res.json()) as InitializeResponse;
      if (data.kitConfigs.length > 0) {
        window.location.href = `/flow/${data.kitConfigs[0].kitId}`;
      } else {
        setSuccess(`Project initialized: ${data.projectId}`);
      }
    } catch {
      setError('Network error. Could not reach server.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <h2>Initialize Project</h2>
      {error && <p role="alert" style={{ color: 'red' }}>{error}</p>}
      {success && <p role="status">{success}</p>}
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="projectDir">Project Directory</label>
          <br />
          <input
            id="projectDir"
            type="text"
            value={projectDir}
            onChange={(e) => setProjectDir(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="kitPaths">Kit Directory Paths (comma-separated)</label>
          <br />
          <input
            id="kitPaths"
            type="text"
            value={kitPaths}
            onChange={(e) => setKitPaths(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="provider">LLM Provider</label>
          <br />
          <input
            id="provider"
            type="text"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="model">LLM Model</label>
          <br />
          <input
            id="model"
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="apiKeyEnvVar">API Key Env Var Name</label>
          <br />
          <input
            id="apiKeyEnvVar"
            type="text"
            value={apiKeyEnvVar}
            onChange={(e) => setApiKeyEnvVar(e.target.value)}
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Initializing...' : 'Initialize Project'}
        </button>
      </form>
    </section>
  );
}
