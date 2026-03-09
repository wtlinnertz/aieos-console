import {
  LlmProviderError,
  ValidationResponseParseError,
} from './errors.js';
import type {
  ILlmProvider,
  ILlmService,
  LlmChunk,
  LlmResponse,
} from './llm-types.js';
import type { ValidationResult } from './state-types.js';

export class LlmService implements ILlmService {
  private readonly providers = new Map<string, ILlmProvider>();

  registerProvider(provider: ILlmProvider): void {
    this.providers.set(provider.providerId, provider);
  }

  async generateArtifact(
    config: { providerId: string; model: string; apiKeyEnvVar: string },
    prompt: string,
    inputs: string,
  ): Promise<LlmResponse> {
    const provider = this.resolveProvider(config.providerId);
    return provider.sendRequest({
      systemPrompt: prompt,
      userContent: inputs,
      model: config.model,
    });
  }

  async *generateArtifactStreaming(
    config: { providerId: string; model: string; apiKeyEnvVar: string },
    prompt: string,
    inputs: string,
  ): AsyncIterable<LlmChunk> {
    const provider = this.resolveProvider(config.providerId);
    yield* provider.sendStreamingRequest({
      systemPrompt: prompt,
      userContent: inputs,
      model: config.model,
    });
  }

  async validateArtifact(
    config: { providerId: string; model: string; apiKeyEnvVar: string },
    validatorPrompt: string,
    artifact: string,
    spec: string,
  ): Promise<LlmResponse> {
    const provider = this.resolveProvider(config.providerId);
    const response = await provider.sendRequest({
      systemPrompt: validatorPrompt,
      userContent: `## Artifact\n\n${artifact}\n\n## Spec\n\n${spec}`,
      model: config.model,
    });

    // Validate that the response contains parseable ValidationResult JSON
    this.parseValidationResult(response.content);

    return response;
  }

  private resolveProvider(providerId: string): ILlmProvider {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new LlmProviderError(
        `Unknown LLM provider: "${providerId}"`,
      );
    }
    return provider;
  }

  private parseValidationResult(content: string): ValidationResult {
    // Extract JSON from potential markdown code fences
    const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      throw new ValidationResponseParseError(
        'Validation response is not valid JSON',
      );
    }

    if (parsed === null || typeof parsed !== 'object') {
      throw new ValidationResponseParseError(
        'Validation response must be a JSON object',
      );
    }

    const obj = parsed as Record<string, unknown>;
    if (typeof obj.status !== 'string' || !['PASS', 'FAIL'].includes(obj.status)) {
      throw new ValidationResponseParseError(
        'Validation response missing required field: status (must be "PASS" or "FAIL")',
      );
    }
    if (typeof obj.summary !== 'string') {
      throw new ValidationResponseParseError(
        'Validation response missing required field: summary',
      );
    }

    return parsed as ValidationResult;
  }
}
