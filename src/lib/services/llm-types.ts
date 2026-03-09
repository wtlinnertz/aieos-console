export interface LlmRequest {
  systemPrompt: string;
  userContent: string;
  model: string;
  maxTokens?: number;
}

export interface LlmResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  durationMs: number;
}

export interface LlmChunk {
  content: string;
  done: boolean;
  inputTokens?: number;
  outputTokens?: number;
}

export interface ILlmProvider {
  providerId: string;
  sendRequest(request: LlmRequest): Promise<LlmResponse>;
  sendStreamingRequest(request: LlmRequest): AsyncIterable<LlmChunk>;
}

export interface ILlmService {
  generateArtifact(
    config: { providerId: string; model: string; apiKeyEnvVar: string },
    prompt: string,
    inputs: string,
  ): Promise<LlmResponse>;
  generateArtifactStreaming(
    config: { providerId: string; model: string; apiKeyEnvVar: string },
    prompt: string,
    inputs: string,
  ): AsyncIterable<LlmChunk>;
  validateArtifact(
    config: { providerId: string; model: string; apiKeyEnvVar: string },
    validatorPrompt: string,
    artifact: string,
    spec: string,
  ): Promise<LlmResponse>;
}
