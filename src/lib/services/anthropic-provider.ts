import Anthropic from '@anthropic-ai/sdk';
import { LlmProviderError, LlmStreamError } from './errors.js';
import type { ILlmProvider, LlmRequest, LlmResponse, LlmChunk } from './llm-types.js';

export class AnthropicProvider implements ILlmProvider {
  readonly providerId = 'anthropic';
  private readonly apiKeyEnvVar: string;

  constructor(apiKeyEnvVar: string) {
    this.apiKeyEnvVar = apiKeyEnvVar;
  }

  async sendRequest(request: LlmRequest): Promise<LlmResponse> {
    const client = this.createClient();
    const start = Date.now();

    try {
      const response = await client.messages.create({
        model: request.model,
        max_tokens: request.maxTokens ?? 4096,
        system: request.systemPrompt,
        messages: [{ role: 'user', content: request.userContent }],
      });

      const content = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      return {
        content,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        model: response.model,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      throw new LlmProviderError(
        `Anthropic API error: ${(err as Error).message}`,
      );
    }
  }

  async *sendStreamingRequest(request: LlmRequest): AsyncIterable<LlmChunk> {
    const client = this.createClient();

    try {
      const stream = client.messages.stream({
        model: request.model,
        max_tokens: request.maxTokens ?? 4096,
        system: request.systemPrompt,
        messages: [{ role: 'user', content: request.userContent }],
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield { content: event.delta.text, done: false };
        }
      }

      const finalMessage = await stream.finalMessage();
      yield {
        content: '',
        done: true,
        inputTokens: finalMessage.usage.input_tokens,
        outputTokens: finalMessage.usage.output_tokens,
      };
    } catch (err) {
      throw new LlmStreamError(
        `Anthropic streaming error: ${(err as Error).message}`,
      );
    }
  }

  private createClient(): Anthropic {
    const apiKey = process.env[this.apiKeyEnvVar];
    if (!apiKey) {
      throw new LlmProviderError(
        `API key not found in environment variable: ${this.apiKeyEnvVar}`,
      );
    }
    return new Anthropic({ apiKey });
  }
}
