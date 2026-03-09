import type { ILlmProvider, LlmRequest, LlmResponse, LlmChunk } from './llm-types.js';

export class MockLlmProvider implements ILlmProvider {
  readonly providerId = 'mock';

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async sendRequest(request: LlmRequest): Promise<LlmResponse> {
    return {
      content: JSON.stringify({
        status: 'PASS',
        summary: 'All checks passed',
        hardGates: { completeness: 'PASS', consistency: 'PASS' },
        blockingIssues: [],
        warnings: [],
        completenessScore: 95,
      }),
      inputTokens: 100,
      outputTokens: 50,
      model: 'mock-model',
      durationMs: 10,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async *sendStreamingRequest(request: LlmRequest): AsyncIterable<LlmChunk> {
    yield { content: '# Generated Artifact\n\n', done: false };
    yield { content: 'This is mock-generated content for testing purposes.', done: false };
    yield { content: '', done: true, inputTokens: 100, outputTokens: 200 };
  }
}
