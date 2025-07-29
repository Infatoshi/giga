export interface OpenRouterProvider {
  id: string;
  name: string;
  description?: string;
  pricing?: {
    prompt: number;
    completion: number;
  };
  quantization?: string;
  uptime?: number;
  context_length?: number;
}

export interface OpenRouterModelDetails {
  id: string;
  name: string;
  description?: string;
  providers: OpenRouterProvider[];
  context_length?: number;
  architecture?: {
    modality?: string;
    tokenizer?: string;
    instruct_type?: string;
  };
}

export interface ProviderFetchResult {
  success: boolean;
  providers: OpenRouterProvider[];
  error?: string;
}

// Fetch available providers for a specific model from OpenRouter
export async function fetchModelProviders(modelId: string, apiKey: string): Promise<ProviderFetchResult> {
  if (!apiKey || !apiKey.trim()) {
    return { success: false, providers: [], error: 'OpenRouter API key is required' };
  }

  try {
    // The correct endpoint format is /api/v1/models/{author}/{slug}/endpoints
    // Split the modelId into author and slug
    const modelParts = modelId.split('/');
    if (modelParts.length !== 2) {
      return { success: false, providers: [], error: `Invalid model ID format. Expected 'author/model', got: ${modelId}` };
    }
    
    const [author, slug] = modelParts;
    const url = `https://openrouter.ai/api/v1/models/${encodeURIComponent(author)}/${encodeURIComponent(slug)}/endpoints`;
    console.log(`DEBUG: Fetching providers for model: ${modelId} from URL: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error response');
      console.log(`DEBUG: HTTP ${response.status} error:`, errorText);
      return { success: false, providers: [], error: `HTTP ${response.status}: ${response.statusText} - ${errorText}` };
    }

    const endpointsData = await response.json() as any;
    
    // The actual response format is: { "data": { "id": "...", "endpoints": [...] } }
    const providers: OpenRouterProvider[] = [];
    
    let endpointsArray: any[] = [];
    
    // Handle different possible response formats
    if (endpointsData.data && endpointsData.data.endpoints && Array.isArray(endpointsData.data.endpoints)) {
      // Format: { data: { endpoints: [...] } }
      endpointsArray = endpointsData.data.endpoints;
    } else if (endpointsData.endpoints && Array.isArray(endpointsData.endpoints)) {
      // Format: { endpoints: [...] }
      endpointsArray = endpointsData.endpoints;
    }
    
    if (endpointsArray.length > 0) {
      // Parse the endpoints into our provider format
      providers.push(...endpointsArray.map((endpoint: any) => ({
        id: endpoint.provider_name || endpoint.name || 'unknown',
        name: endpoint.provider_name || endpoint.name || 'Unknown Provider',
        description: endpoint.name,
        pricing: endpoint.pricing ? {
          prompt: parseFloat(endpoint.pricing.prompt || '0'),
          completion: parseFloat(endpoint.pricing.completion || '0')
        } : undefined,
        quantization: endpoint.quantization,
        uptime: endpoint.uptime_last_30m ? parseFloat(endpoint.uptime_last_30m.toFixed(1)) : undefined,
        context_length: endpoint.context_length
      })));
    }
    
    if (providers.length === 0) {
      return { success: false, providers: [], error: 'No providers available for this model' };
    }

    return { success: true, providers };
  } catch (error: any) {
    return { success: false, providers: [], error: error.message };
  }
}

// Fetch all available providers for all models (for caching)
export async function fetchAllModelProviders(apiKey: string): Promise<Map<string, OpenRouterProvider[]>> {
  if (!apiKey || !apiKey.trim()) {
    return new Map();
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error(`Failed to fetch OpenRouter models: HTTP ${response.status}`);
      return new Map();
    }

    const data = await response.json() as any;
    const models = data.data || [];
    const modelProvidersMap = new Map<string, OpenRouterProvider[]>();

    // Build map of model ID to providers
    models.forEach((model: OpenRouterModelDetails) => {
      if (model.id && model.providers) {
        modelProvidersMap.set(model.id, model.providers);
      }
    });

    return modelProvidersMap;
  } catch (error: any) {
    console.error('Error fetching all model providers:', error);
    return new Map();
  }
}

// Common OpenRouter provider names for fallback when API fails
export const COMMON_OPENROUTER_PROVIDERS: OpenRouterProvider[] = [
  { id: 'Groq', name: 'Groq', description: 'Fast inference with Groq chips' },
  { id: 'Cerebras', name: 'Cerebras', description: 'Ultra-fast inference with Cerebras wafer-scale engine' },
  { id: 'OpenAI', name: 'OpenAI', description: 'Official OpenAI API' },
  { id: 'Anthropic', name: 'Anthropic', description: 'Official Anthropic API' },
  { id: 'Google', name: 'Google', description: 'Google AI models' },
  { id: 'Meta', name: 'Meta', description: 'Meta Llama models' },
  { id: 'Mistral', name: 'Mistral', description: 'Mistral AI models' },
  { id: 'Qwen', name: 'Qwen', description: 'Alibaba Qwen models' },
  { id: 'DeepSeek', name: 'DeepSeek', description: 'DeepSeek models' },
];

// Check if a model ID is in OpenRouter format (author/model)
export function isOpenRouterModel(modelId: string): boolean {
  return modelId.includes('/') && modelId.split('/').length === 2;
}

// Get providers for a model with fallback
export async function getModelProvidersWithFallback(
  modelId: string, 
  apiKey: string
): Promise<OpenRouterProvider[]> {
  // Only try to fetch providers for OpenRouter models
  if (!isOpenRouterModel(modelId)) {
    console.warn(`Model ${modelId} is not in OpenRouter format (author/model), skipping provider fetch`);
    return [];
  }
  
  const result = await fetchModelProviders(modelId, apiKey);
  
  if (result.success && result.providers.length > 0) {
    return result.providers;
  }
  
  // If API call failed, return empty array instead of hardcoded fallbacks
  // This forces the user to check their API key or model availability
  console.warn(`Failed to fetch providers for model ${modelId}: ${result.error}`);
  return [];
}