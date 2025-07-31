import OpenAI from 'openai';
import Cerebras from '@cerebras/cerebras_cloud_sdk';
import { testOllamaConnection } from './ollama-models';

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
export async function validateCerebrasKey(apiKey: string, model?: string): Promise<ApiKeyValidationResult> {
  try {
    const client = new Cerebras({
      apiKey,
      timeout: 10000,
    });
    
    // Use the provided model or default to qwen-3-235b-a22b-instruct-2507 for validation
    const validationModel = model || 'qwen-3-235b-a22b-instruct-2507';
    
    // Try a simple chat completion request instead of listing models
    const response = await client.chat.completions.create({
      model: validationModel,
      messages: [{ role: 'user', content: 'test' }],
      max_completion_tokens: 1,
      temperature: 0.1,
    });
    
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

// Validate Ollama connection (baseUrl instead of API key)
export async function validateOllamaUrl(baseUrl: string): Promise<ApiKeyValidationResult> {
  try {
    const result = await testOllamaConnection(baseUrl);
    
    if (result.success) {
      return { 
        isValid: true, 
      };
    } else {
      return { 
        isValid: false, 
        error: result.error || "Cannot connect to Ollama" 
      };
    }
  } catch (error: any) {
    return { isValid: false, error: error?.message || "Ollama connection failed" };
  }
}

// Main validation function that routes to the correct provider
export async function validateApiKey(provider: string, apiKey: string, model?: string): Promise<ApiKeyValidationResult> {
  // Special case for Ollama - it's a base URL, not an API key, and can be empty (defaults to localhost)
  if (provider.toLowerCase() === 'ollama') {
    const baseUrl = apiKey || 'http://localhost:11434';
    return validateOllamaUrl(baseUrl);
  }

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
      return validateCerebrasKey(apiKey, model);
    case 'perplexity':
      return validatePerplexityKey(apiKey);
    case 'openai':
      return validateOpenaiKey(apiKey);
    default:
      return { isValid: false, error: 'Unknown provider' };
  }
}