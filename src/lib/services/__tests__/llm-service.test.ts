import { describe, it, expect, vi } from 'vitest';
import { LlmService } from '../llm-service.js';
import type { ILlmProvider, LlmChunk, LlmResponse } from '../llm-types.js';
import {
  LlmProviderError,
  LlmStreamError,
  ValidationResponseParseError,
} from '../errors.js';

function makeMockProvider(overrides?: Partial<ILlmProvider>): ILlmProvider {
  return {
    providerId: 'mock',
    sendRequest: vi.fn().mockResolvedValue({
      content: 'Generated artifact content',
      inputTokens: 100,
      outputTokens: 200,
      model: 'mock-model',
      durationMs: 500,
    } satisfies LlmResponse),
    sendStreamingRequest: vi.fn().mockImplementation(async function* () {
      yield { content: 'chunk1', done: false };
      yield { content: 'chunk2', done: false };
      yield { content: '', done: true, inputTokens: 50, outputTokens: 100 };
    }),
    ...overrides,
  };
}

const CONFIG = { providerId: 'mock', model: 'test-model', apiKeyEnvVar: 'TEST_KEY' };

describe('LlmService', () => {
  describe('acceptance tests', () => {
    it('AT-1: generateArtifact returns complete LlmResponse', async () => {
      const service = new LlmService();
      service.registerProvider(makeMockProvider());

      const result = await service.generateArtifact(CONFIG, 'system prompt', 'user input');

      expect(result.content).toBe('Generated artifact content');
      expect(result.inputTokens).toBe(100);
      expect(result.outputTokens).toBe(200);
      expect(result.model).toBe('mock-model');
      expect(result.durationMs).toBe(500);
    });

    it('AT-2: generateArtifactStreaming yields chunks with final usage', async () => {
      const service = new LlmService();
      service.registerProvider(makeMockProvider());

      const chunks: LlmChunk[] = [];
      for await (const chunk of service.generateArtifactStreaming(CONFIG, 'prompt', 'input')) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toEqual({ content: 'chunk1', done: false });
      expect(chunks[1]).toEqual({ content: 'chunk2', done: false });
      expect(chunks[2].done).toBe(true);
      expect(chunks[2].inputTokens).toBe(50);
      expect(chunks[2].outputTokens).toBe(100);
    });

    it('AT-3: validateArtifact parses valid ValidationResult JSON', async () => {
      const validationJson = JSON.stringify({
        status: 'PASS',
        summary: 'All checks passed',
        hardGates: { completeness: 'PASS' },
        blockingIssues: [],
        warnings: [],
        completenessScore: 95,
      });

      const service = new LlmService();
      service.registerProvider(makeMockProvider({
        sendRequest: vi.fn().mockResolvedValue({
          content: validationJson,
          inputTokens: 100,
          outputTokens: 50,
          model: 'mock-model',
          durationMs: 300,
        }),
      }));

      const result = await service.validateArtifact(CONFIG, 'validator', 'artifact', 'spec');
      expect(result.content).toBe(validationJson);
    });

    it('AT-4: non-JSON validation response throws ValidationResponseParseError', async () => {
      const service = new LlmService();
      service.registerProvider(makeMockProvider({
        sendRequest: vi.fn().mockResolvedValue({
          content: 'This is not JSON at all',
          inputTokens: 100,
          outputTokens: 50,
          model: 'mock-model',
          durationMs: 300,
        }),
      }));

      await expect(
        service.validateArtifact(CONFIG, 'validator', 'artifact', 'spec'),
      ).rejects.toThrow(ValidationResponseParseError);
    });

    it('AT-5: API error throws LlmProviderError', async () => {
      const service = new LlmService();
      service.registerProvider(makeMockProvider({
        sendRequest: vi.fn().mockRejectedValue(new LlmProviderError('API 500 error')),
      }));

      await expect(
        service.generateArtifact(CONFIG, 'prompt', 'input'),
      ).rejects.toThrow(LlmProviderError);
    });
  });

  describe('failure tests', () => {
    it('FT-1: unknown providerId throws LlmProviderError', async () => {
      const service = new LlmService();

      await expect(
        service.generateArtifact(
          { providerId: 'unknown', model: 'x', apiKeyEnvVar: 'KEY' },
          'prompt',
          'input',
        ),
      ).rejects.toThrow(LlmProviderError);
    });

    it('FT-2: stream interruption throws LlmStreamError', async () => {
      const service = new LlmService();
      service.registerProvider(makeMockProvider({
        sendStreamingRequest: vi.fn().mockImplementation(async function* () {
          yield { content: 'partial', done: false };
          throw new LlmStreamError('Connection lost');
        }),
      }));

      const chunks: LlmChunk[] = [];
      await expect(async () => {
        for await (const chunk of service.generateArtifactStreaming(CONFIG, 'prompt', 'input')) {
          chunks.push(chunk);
        }
      }).rejects.toThrow(LlmStreamError);
      expect(chunks).toHaveLength(1);
    });

    it('FT-3: validation JSON missing required fields throws ValidationResponseParseError', async () => {
      const service = new LlmService();
      service.registerProvider(makeMockProvider({
        sendRequest: vi.fn().mockResolvedValue({
          content: JSON.stringify({ summary: 'Missing status' }),
          inputTokens: 100,
          outputTokens: 50,
          model: 'mock-model',
          durationMs: 300,
        }),
      }));

      await expect(
        service.validateArtifact(CONFIG, 'validator', 'artifact', 'spec'),
      ).rejects.toThrow(ValidationResponseParseError);
    });
  });

  describe('edge cases', () => {
    it('EC-1: validation response in markdown code fence parsed', async () => {
      const validationJson = JSON.stringify({
        status: 'FAIL',
        summary: 'Issues found',
        hardGates: {},
        blockingIssues: [{ gate: 'test', description: 'fail', location: 'line 1' }],
        warnings: [],
        completenessScore: 40,
      });

      const service = new LlmService();
      service.registerProvider(makeMockProvider({
        sendRequest: vi.fn().mockResolvedValue({
          content: '```json\n' + validationJson + '\n```',
          inputTokens: 100,
          outputTokens: 50,
          model: 'mock-model',
          durationMs: 300,
        }),
      }));

      const result = await service.validateArtifact(CONFIG, 'validator', 'artifact', 'spec');
      expect(result.content).toContain('FAIL');
    });

    it('EC-2: API key not leaked in error messages', async () => {
      const service = new LlmService();
      service.registerProvider(makeMockProvider({
        sendRequest: vi.fn().mockRejectedValue(
          new LlmProviderError('Anthropic API error: invalid request'),
        ),
      }));

      try {
        await service.generateArtifact(
          { providerId: 'mock', model: 'x', apiKeyEnvVar: 'MY_SECRET_KEY' },
          'prompt',
          'input',
        );
      } catch (err) {
        const message = (err as Error).message;
        expect(message).not.toContain('MY_SECRET_KEY');
        const keyValue = process.env.MY_SECRET_KEY;
        if (keyValue) {
          expect(message).not.toContain(keyValue);
        }
      }
    });

    it('EC-3: generateArtifact includes durationMs', async () => {
      const service = new LlmService();
      service.registerProvider(makeMockProvider());

      const result = await service.generateArtifact(CONFIG, 'prompt', 'input');
      expect(typeof result.durationMs).toBe('number');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('EC-4: multiple streaming chunks content available incrementally', async () => {
      const service = new LlmService();
      service.registerProvider(makeMockProvider());

      let accumulated = '';
      for await (const chunk of service.generateArtifactStreaming(CONFIG, 'prompt', 'input')) {
        accumulated += chunk.content;
      }
      expect(accumulated).toBe('chunk1chunk2');
    });
  });
});
