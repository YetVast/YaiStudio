/**
 * YAI Studio — OpenRouter BYOK Adapter (server-only)
 *
 * Implements cloud inference via OpenRouter API.
 * Provider secrets are handled strictly server-side and never returned to the browser.
 *
 * @module lib/providers/openrouter
 */
import 'server-only';

import {
  type GenerationRequest,
  type GenerationResponse,
  type ProviderModel,
  ProviderError,
} from '@/lib/providers/types';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

export async function generateOpenRouterCompletion(
  request: GenerationRequest,
  apiKey: string,
): Promise<GenerationResponse> {
  const messages = [...request.messages];
  if (request.systemPrompt) {
    messages.unshift({ role: 'system', content: request.systemPrompt });
  }

  const appOrigin = process.env.NEXT_PUBLIC_YAI_ORIGIN || 'https://yaistudio.yetvast.com';

  const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': appOrigin,
      'X-Title': 'YAI Studio',
    },
    body: JSON.stringify({
      model: request.model || 'anthropic/claude-3.5-sonnet',
      messages,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = errorBody?.error?.message || `HTTP ${response.status} from OpenRouter`;

    if (response.status === 401 || response.status === 403) {
      throw new ProviderError(message, 'invalid_key');
    }
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get('retry-after')) || undefined;
      throw new ProviderError(message, 'rate_limit', retryAfter);
    }
    if (response.status === 402) {
      throw new ProviderError(message, 'quota_exceeded');
    }
    if (response.status === 404) {
      throw new ProviderError(message, 'model_not_found');
    }

    throw new ProviderError(message, 'provider_error');
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  const content = choice?.message?.content || '';

  return {
    content,
    model: data.model || request.model,
    provider: 'openrouter',
    inputTokens: data.usage?.prompt_tokens,
    outputTokens: data.usage?.completion_tokens,
    finishReason: choice?.finish_reason,
  };
}

export async function listOpenRouterModels(apiKey: string): Promise<ProviderModel[]> {
  const response = await fetch(`${OPENROUTER_BASE}/models`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ProviderError('Invalid OpenRouter API Key', 'invalid_key');
    }
    throw new ProviderError(`Failed to fetch models: HTTP ${response.status}`, 'provider_error');
  }

  const data = await response.json();
  const models = (data.data || []).map((m: any) => ({
    id: m.id,
    name: m.name || m.id,
    contextLength: m.context_length,
    pricing: m.pricing
      ? {
          prompt: m.pricing.prompt,
          completion: m.pricing.completion,
        }
      : undefined,
  }));

  return models;
}
