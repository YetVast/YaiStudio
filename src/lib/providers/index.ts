/**
 * YAI Studio — Provider Orchestration Service (server-only)
 *
 * @module lib/providers/index
 */
import 'server-only';

import { getProviderKey } from '@/lib/providers/key-store';
import { generateOpenRouterCompletion, listOpenRouterModels } from '@/lib/providers/openrouter';
import { generateGoogleAICompletion, listGoogleAIModels } from '@/lib/providers/google-ai';
import {
  type GenerationRequest,
  type GenerationResponse,
  type ProviderModel,
  ProviderError,
} from '@/lib/providers/types';

export async function executeGeneration(
  yvUserId: string,
  request: GenerationRequest,
  provider: 'openrouter' | 'google-ai' = 'openrouter',
): Promise<GenerationResponse> {
  const apiKey = await getProviderKey(yvUserId, provider);
  if (!apiKey) {
    throw new ProviderError(
      `No API key configured for provider "${provider}". Please configure your key in Settings > AI Providers.`,
      'auth_error',
    );
  }

  if (provider === 'openrouter') {
    return generateOpenRouterCompletion(request, apiKey);
  } else if (provider === 'google-ai') {
    return generateGoogleAICompletion(request, apiKey);
  } else {
    throw new ProviderError(`Unsupported provider: ${provider}`, 'provider_error');
  }
}

export async function listModelsForProvider(
  yvUserId: string,
  provider: 'openrouter' | 'google-ai',
): Promise<ProviderModel[]> {
  const apiKey = await getProviderKey(yvUserId, provider);
  if (!apiKey) {
    throw new ProviderError(`Provider "${provider}" is not configured with an API key`, 'auth_error');
  }

  if (provider === 'openrouter') {
    return listOpenRouterModels(apiKey);
  } else if (provider === 'google-ai') {
    return listGoogleAIModels(apiKey);
  } else {
    return [];
  }
}
