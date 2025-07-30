import { PROVIDER_MODELS, ProviderName } from './provider-models';

export interface ModelInfo {
  id: string;
  name?: string;
  description?: string;
  provider?: string;
}

export interface ModelFetchResult {
  success: boolean;
  models: string[];
  error?: string;
}

// Fetch models from OpenRouter API
async function fetchOpenRouterModels(apiKey: string): Promise<ModelFetchResult> {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return { success: false, models: [], error: `HTTP ${response.status}` };
    }

    const data = await response.json() as any;
    const models = data.data || data;
    const modelIds = Array.isArray(models) 
      ? models.map((model: any) => model.id).filter(Boolean)
      : [];

    return { success: true, models: modelIds };
  } catch (error: any) {
    return { success: false, models: [], error: error.message };
  }
}

// Fetch models from Google AI API
async function fetchGoogleModels(apiKey: string): Promise<ModelFetchResult> {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return { success: false, models: [], error: `HTTP ${response.status}` };
    }

    const data = await response.json() as any;
    const models = data.models || [];
    const modelIds = models
      .map((model: any) => model.name?.replace('models/', '') || model.id)
      .filter(Boolean);

    return { success: true, models: modelIds };
  } catch (error: any) {
    return { success: false, models: [], error: error.message };
  }
}

// Fetch models from xAI API
async function fetchXaiModels(apiKey: string): Promise<ModelFetchResult> {
  try {
    const response = await fetch('https://api.x.ai/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return { success: false, models: [], error: `HTTP ${response.status}` };
    }

    const data = await response.json() as any;
    const models = data.data || data;
    const modelIds = Array.isArray(models) 
      ? models.map((model: any) => model.id).filter(Boolean)
      : [];

    return { success: true, models: modelIds };
  } catch (error: any) {
    return { success: false, models: [], error: error.message };
  }
}

// Fetch models from Groq API
async function fetchGroqModels(apiKey: string): Promise<ModelFetchResult> {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return { success: false, models: [], error: `HTTP ${response.status}` };
    }

    const data = await response.json() as any;
    const models = data.data || [];
    const modelIds = models.map((model: any) => model.id).filter(Boolean);

    return { success: true, models: modelIds };
  } catch (error: any) {
    return { success: false, models: [], error: error.message };
  }
}

// Fetch models from Cerebras API
async function fetchCerebrasModels(apiKey: string): Promise<ModelFetchResult> {
  try {
    const response = await fetch('https://api.cerebras.ai/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return { success: false, models: [], error: `HTTP ${response.status}` };
    }

    const data = await response.json() as any;
    const models = data.data || [];
    const modelIds = models.map((model: any) => model.id).filter(Boolean);

    return { success: true, models: modelIds };
  } catch (error: any) {
    return { success: false, models: [], error: error.message };
  }
}

// Fetch models from Perplexity API
async function fetchPerplexityModels(apiKey: string): Promise<ModelFetchResult> {
  try {
    const response = await fetch('https://api.perplexity.ai/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return { success: false, models: [], error: `HTTP ${response.status}` };
    }

    const data = await response.json() as any;
    const models = Array.isArray(data) ? data : data.data || [];
    const modelIds = models.map((model: any) => model.id || model.name).filter(Boolean);

    return { success: true, models: modelIds };
  } catch (error: any) {
    return { success: false, models: [], error: error.message };
  }
}

// Fetch models from OpenAI API
async function fetchOpenaiModels(apiKey: string): Promise<ModelFetchResult> {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return { success: false, models: [], error: `HTTP ${response.status}` };
    }

    const data = await response.json() as any;
    const models = data.data || [];
    const modelIds = models.map((model: any) => model.id).filter(Boolean);

    return { success: true, models: modelIds };
  } catch (error: any) {
    return { success: false, models: [], error: error.message };
  }
}

// Main function to fetch models for a provider
export async function fetchProviderModels(provider: ProviderName, apiKey: string): Promise<ModelFetchResult> {
  if (!apiKey || !apiKey.trim()) {
    return { success: false, models: [], error: 'API key is required' };
  }

  try {
    switch (provider.toLowerCase() as ProviderName) {
      case 'openrouter':
        return await fetchOpenRouterModels(apiKey);
      case 'google':
        return await fetchGoogleModels(apiKey);
      case 'xai':
        return await fetchXaiModels(apiKey);
      case 'groq':
        return await fetchGroqModels(apiKey);
      case 'cerebras':
        // Cerebras uses static models since API doesn't return correct model names
        return { success: true, models: PROVIDER_MODELS.cerebras };
      case 'perplexity':
        return await fetchPerplexityModels(apiKey);
      case 'openai':
        return await fetchOpenaiModels(apiKey);
      case 'anthropic':
        // Anthropic doesn't have a public models endpoint, use static list
        return { success: true, models: PROVIDER_MODELS.anthropic };
      default:
        return { success: false, models: [], error: 'Unknown provider' };
    }
  } catch (error: any) {
    return { success: false, models: [], error: error.message };
  }
}

// Fetch models with fallback to static list
export async function fetchModelsWithFallback(provider: ProviderName, apiKey: string): Promise<string[]> {
  const result = await fetchProviderModels(provider, apiKey);
  
  if (result.success && result.models.length > 0) {
    return result.models.sort();
  }
  
  // Fallback to static models
  const staticModels = PROVIDER_MODELS[provider] || [];
  return staticModels.sort();
}