/**
 * YAI Studio — AI Provider Types
 *
 * @module lib/providers/types
 */

export interface GenerationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface GenerationRequest {
  messages: GenerationMessage[];
  model: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface GenerationResponse {
  content: string;
  model: string;
  provider: string;
  inputTokens?: number;
  outputTokens?: number;
  finishReason?: string;
}

export interface ProviderModel {
  id: string;
  name: string;
  contextLength?: number;
  pricing?: {
    prompt: string;
    completion: string;
  };
}

export type ProviderErrorCode =
  | 'auth_error'
  | 'rate_limit'
  | 'quota_exceeded'
  | 'model_not_found'
  | 'provider_error'
  | 'invalid_key';

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly code: ProviderErrorCode,
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
