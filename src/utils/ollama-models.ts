import axios from 'axios';

export interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    parent_model?: string;
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
}

export interface OllamaModelsResponse {
  models: OllamaModel[];
}

export async function fetchOllamaModels(baseUrl: string = 'http://localhost:11434'): Promise<string[]> {
  try {
    // Remove any trailing slashes and ensure proper URL format
    let cleanBaseUrl = baseUrl.replace(/\/+$/, '');
    
    // Add http:// protocol if missing
    if (!cleanBaseUrl.startsWith('http://') && !cleanBaseUrl.startsWith('https://')) {
      cleanBaseUrl = `http://${cleanBaseUrl}`;
    }
    
    const apiUrl = `${cleanBaseUrl}/api/tags`;
    
    const response = await axios.get(apiUrl, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000, // 10 second timeout
    });

    const data = response.data as OllamaModelsResponse;
    
    if (!data.models || !Array.isArray(data.models)) {
      throw new Error('Invalid response format from Ollama API');
    }

    // Extract model names and sort them
    const modelNames = data.models
      .map(model => model.name)
      .filter(name => name && name.trim())
      .sort();

    return modelNames;
  } catch (error: any) {
    console.error('Error fetching Ollama models:', error.message);
    
    // Return empty array on error - will fallback to static list
    return [];
  }
}

export async function searchOllamaModels(
  query: string, 
  baseUrl: string = 'http://localhost:11434'
): Promise<string[]> {
  try {
    const allModels = await fetchOllamaModels(baseUrl);
    
    if (!query || !query.trim()) {
      return allModels;
    }

    const searchTerm = query.toLowerCase().trim();
    
    // Filter models that contain the search term
    const filtered = allModels.filter(model => 
      model.toLowerCase().includes(searchTerm)
    );

    // Sort by relevance: exact matches first, then starts with, then contains
    const sorted = filtered.sort((a, b) => {
      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();
      
      // Exact match
      if (aLower === searchTerm && bLower !== searchTerm) return -1;
      if (bLower === searchTerm && aLower !== searchTerm) return 1;
      
      // Starts with
      if (aLower.startsWith(searchTerm) && !bLower.startsWith(searchTerm)) return -1;
      if (bLower.startsWith(searchTerm) && !aLower.startsWith(searchTerm)) return 1;
      
      // Alphabetical for same relevance
      return a.localeCompare(b);
    });

    return sorted;
  } catch (error) {
    console.error('Error searching Ollama models:', error);
    return [];
  }
}

export async function testOllamaConnection(baseUrl: string = 'http://localhost:11434'): Promise<{
  success: boolean;
  error?: string;
  modelCount?: number;
}> {
  try {
    const models = await fetchOllamaModels(baseUrl);
    
    return {
      success: true,
      modelCount: models.length
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown error'
    };
  }
}

// Get popular/recommended Ollama models for new users
export function getRecommendedOllamaModels(): string[] {
  return [
    'llama3.2:3b',    // Latest Llama, good balance
    'llama3.2:1b',    // Fastest small model
    'qwen2.5:7b',     // Good alternative
    'phi3:3.8b',      // Microsoft's efficient model
    'gemma2:9b',      // Google's model
    'mistral:7b',     // Popular choice
    'codellama:7b',   // Code-focused
    'neural-chat:7b', // Conversational
    'tinyllama:1.1b', // Ultra-fast tiny model
  ];
}