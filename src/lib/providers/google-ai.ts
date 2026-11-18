/**
 * YAI Studio — Google AI Studio Provider Adapter (server-only)
 *
 * Implements secondary cloud inference via Google AI Studio (Gemini).
 *
 * @module lib/providers/google-ai
 */
import 'server-only';

import {
  type GenerationRequest,
  type GenerationResponse,
  type ProviderModel,
  ProviderError,
} from '@/lib/providers/types';

const GOOGLE_AI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export async function generateGoogleAICompletion(
  request: GenerationRequest,
  apiKey: string,
): Promise<GenerationResponse> {
  const model = request.model || 'gemini-1.5-flash';
  const url = `${GOOGLE_AI_BASE}/models/${model}:generateContent?key=${apiKey}`;

  // Format messages into Google's contents structure
  const contents = request.messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const body: any = { contents };
  if (request.systemPrompt) {
    body.systemInstruction = {
      parts: [{ text: request.systemPrompt }],
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = errorBody?.error?.message || `HTTP ${response.status} from Google AI`;

    if (response.status === 400 && message.toLowerCase().includes('key')) {
      throw new ProviderError(message, 'invalid_key');
    }
    if (response.status === 429) {
      throw new ProviderError(message, 'rate_limit');
    }

    throw new ProviderError(message, 'provider_error');
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text || '';

  return {
    content: text,
    model,
    provider: 'google-ai',
    inputTokens: data.usageMetadata?.promptTokenCount,
    outputTokens: data.usageMetadata?.candidatesTokenCount,
    finishReason: candidate?.finishReason,
  };
}

export async function listGoogleAIModels(apiKey: string): Promise<ProviderModel[]> {
  const url = `${GOOGLE_AI_BASE}/models?key=${apiKey}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new ProviderError(`Failed to fetch Google AI models: HTTP ${response.status}`, 'provider_error');
  }

  const data = await response.json();
  return (data.models || [])
    .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m: any) => ({
      id: m.name.replace(/^models\//, ''),
      name: m.displayName || m.name,
      contextLength: m.inputTokenLimit,
    }));
}
