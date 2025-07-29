import OpenAI from 'openai';

export interface ApiKeyValidationResult {
  isValid: boolean;
  error?: string;
}

// Validate OpenRouter API key
export async function validateOpenRouterKey(apiKey: string): Promise<ApiKeyValidationResult> {
  try {
    const client = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      timeout: 10000,
    });
    
    await client.models.list();
    return { isValid: true };
  } catch (error: any) {
    return { isValid: false, error: error?.message || "API validation failed" };
  }
}

// Validate Anthropic API key
export async function validateAnthropicKey(apiKey: string): Promise<ApiKeyValidationResult> {
  try {
    const client = new OpenAI({
      apiKey,
      baseURL: 'https://api.anthropic.com/v1',
      timeout: 10000,
    });
    
    await client.models.list();
    return { isValid: true };
  } catch (error: any) {
    return { isValid: false, error: error?.message || "API validation failed" };
  }
}

// Validate Google API key
export async function validateGoogleKey(apiKey: string): Promise<ApiKeyValidationResult> {
  try {
    const client = new OpenAI({
      apiKey,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
      timeout: 10000,
    });
    
    await client.models.list();
    return { isValid: true };
  } catch (error: any) {
    return { isValid: false, error: error?.message || "API validation failed" };
  }
}

// Validate xAI API key
export async function validateXaiKey(apiKey: string): Promise<ApiKeyValidationResult> {
  try {
    const client = new OpenAI({
      apiKey,
      baseURL: 'https://api.x.ai/v1',
      timeout: 10000,
    });
    
    await client.models.list();
    return { isValid: true };
  } catch (error: any) {
    return { isValid: false, error: error?.message || "API validation failed" };
  }
}

// Validate Groq API key
export async function validateGroqKey(apiKey: string): Promise<ApiKeyValidationResult> {
  try {
    const client = new OpenAI({
      apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
      timeout: 10000,
    });
    
    await client.models.list();
    return { isValid: true };
  } catch (error: any) {
    return { isValid: false, error: error?.message || "API validation failed" };
  }
}

// Validate Cerebras API key
export async function validateCerebrasKey(apiKey: string): Promise<ApiKeyValidationResult> {
  try {
    const client = new OpenAI({
      apiKey,
      baseURL: 'https://api.cerebras.ai/v1',
      timeout: 10000,
    });
    
    await client.models.list();
    return { isValid: true };
  } catch (error: any) {
    return { isValid: false, error: error?.message || "API validation failed" };
  }
}

// Validate Perplexity API key
export async function validatePerplexityKey(apiKey: string): Promise<ApiKeyValidationResult> {
  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
      }),
      signal: AbortSignal.timeout(10000),
    });
    
    if (response.status === 401) {
      return { isValid: false, error: 'Invalid API key' };
    }
    
    return { isValid: true };
  } catch (error: any) {
    return { isValid: false, error: error?.message || "API validation failed" };
  }
}

// Validate OpenAI API key
export async function validateOpenaiKey(apiKey: string): Promise<ApiKeyValidationResult> {
  try {
    const client = new OpenAI({
      apiKey,
      baseURL: 'https://api.openai.com/v1',
      timeout: 10000,
    });
    
    await client.models.list();
    return { isValid: true };
  } catch (error: any) {
    return { isValid: false, error: error?.message || "API validation failed" };
  }
}

// Main validation function that routes to the correct provider
export async function validateApiKey(provider: string, apiKey: string): Promise<ApiKeyValidationResult> {
  if (!apiKey || !apiKey.trim()) {
    return { isValid: false, error: 'API key is empty' };
  }

  switch (provider.toLowerCase()) {
    case 'openrouter':
      return validateOpenRouterKey(apiKey);
    case 'anthropic':
      return validateAnthropicKey(apiKey);
    case 'google':
      return validateGoogleKey(apiKey);
    case 'xai':
      return validateXaiKey(apiKey);
    case 'groq':
      return validateGroqKey(apiKey);
    case 'cerebras':
      return validateCerebrasKey(apiKey);
    case 'perplexity':
      return validatePerplexityKey(apiKey);
    case 'openai':
      return validateOpenaiKey(apiKey);
    default:
      return { isValid: false, error: 'Unknown provider' };
  }
}