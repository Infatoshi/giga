import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat';
import Cerebras from '@cerebras/cerebras_cloud_sdk';
import { sessionManager } from '../utils/session-manager';
import { getOpenRouterProvider } from '../utils/added-models';
import { createTokenCounter } from '../utils/token-counter';

export type GrokMessage = ChatCompletionMessageParam;

export interface GrokTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required: string[];
    };
  };
}

export interface GrokToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface GrokResponse {
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: GrokToolCall[];
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  metrics?: {
    prefillTimeMs: number;
    decodeTimeMs: number;
    outputTokens: number;
    tokensPerSecond: number;
  };
}

export interface ApiCallMetrics {
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  durationMs: number;
  tokensPerSecond: number;
}

interface APIConfig {
  baseURL: string;
  apiKey: string;
}

export class GigaClient {
  private xaiClient: OpenAI;
  private groqClient: OpenAI;
  private anthropicClient: OpenAI;
  private openRouterClient: OpenAI;
  private googleClient: OpenAI;
  private cerebrasClient: Cerebras;
  private perplexityClient: OpenAI;
  private openaiClient: OpenAI;
  private ollamaClient: OpenAI;
  // Remove instance-level currentModel - now managed by sessionManager
  private groqApiKey?: string;
  private anthropicApiKey?: string;
  private openRouterApiKey?: string;
  private googleApiKey?: string;
  private cerebrasApiKey?: string;
  private perplexityApiKey?: string;
  private openaiApiKey?: string;
  private ollamaBaseUrl?: string;
  private lastStreamingMetrics?: {
    prefillTimeMs: number;
    decodeTimeMs: number;
    outputTokens: number;
    tokensPerSecond: number;
  };

  constructor(
    apiKey: string, 
    model?: string, 
    groqApiKey?: string, 
    anthropicApiKey?: string, 
    openRouterApiKey?: string,
    googleApiKey?: string,
    cerebrasApiKey?: string,
    perplexityApiKey?: string,
    openaiApiKey?: string,
    ollamaBaseUrl?: string
  ) {
    this.xaiClient = new OpenAI({
      apiKey,
      baseURL: 'https://api.x.ai/v1',
      timeout: 360000,
    });
    
    this.groqApiKey = groqApiKey;
    if (groqApiKey) {
      this.groqClient = new OpenAI({
        apiKey: groqApiKey,
        baseURL: 'https://api.groq.com/openai/v1',
        timeout: 360000,
      });
    }
    
    this.anthropicApiKey = anthropicApiKey;
    if (anthropicApiKey) {
      this.anthropicClient = new OpenAI({
        apiKey: anthropicApiKey,
        baseURL: 'https://api.anthropic.com/v1',
        timeout: 360000,
      });
    }
    
    this.openRouterApiKey = openRouterApiKey;
    if (openRouterApiKey) {
      this.openRouterClient = new OpenAI({
        apiKey: openRouterApiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        timeout: 360000
      });
    }
    
    this.googleApiKey = googleApiKey;
    if (googleApiKey) {
      this.googleClient = new OpenAI({
        apiKey: googleApiKey,
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
        timeout: 360000,
      });
    }
    
    this.cerebrasApiKey = cerebrasApiKey;
    if (cerebrasApiKey) {
      this.cerebrasClient = new Cerebras({
        apiKey: cerebrasApiKey,
        timeout: 360000,
      });
    }
    
    this.perplexityApiKey = perplexityApiKey;
    if (perplexityApiKey) {
      this.perplexityClient = new OpenAI({
        apiKey: perplexityApiKey,
        baseURL: 'https://api.perplexity.ai',
        timeout: 360000,
      });
    }
    
    this.openaiApiKey = openaiApiKey;
    if (openaiApiKey) {
      this.openaiClient = new OpenAI({
        apiKey: openaiApiKey,
        baseURL: 'https://api.openai.com/v1',
        timeout: 360000,
      });
    }
    
    this.ollamaBaseUrl = ollamaBaseUrl || 'http://localhost:11434';
    
    // Ensure Ollama base URL has proper protocol
    let cleanOllamaUrl = this.ollamaBaseUrl;
    if (!cleanOllamaUrl.startsWith('http://') && !cleanOllamaUrl.startsWith('https://')) {
      cleanOllamaUrl = `http://${cleanOllamaUrl}`;
    }
    
    this.ollamaClient = new OpenAI({
      apiKey: 'ollama', // Ollama doesn't require a real API key
      baseURL: cleanOllamaUrl + '/v1',
      timeout: 360000,
    });
    
    if (model) {
      sessionManager.setCurrentModel(model);
    }
  }

  private getClientForModel(model: string): OpenAI | Cerebras {
    // First check added models to get the correct provider
    const addedModels = require('../utils/added-models').loadAddedModels();
    const addedModel = addedModels.find((m: any) => m.modelName === model);
    
    if (addedModel) {
      const providerName = addedModel.providerName.toLowerCase();
      switch (providerName) {
        case 'openrouter':
          if (!this.openRouterClient) {
            throw new Error('OpenRouter API key not provided. Please configure it in /providers.');
          }
          return this.openRouterClient;
        case 'anthropic':
          if (!this.anthropicClient) {
            throw new Error('Anthropic API key not provided. Please configure it in /providers.');
          }
          return this.anthropicClient;
        case 'google':
          if (!this.googleClient) {
            throw new Error('Google API key not provided. Please configure it in /providers.');
          }
          return this.googleClient;
        case 'xai':
          return this.xaiClient;
        case 'groq':
          if (!this.groqClient) {
            throw new Error('Groq API key not provided. Please configure it in /providers.');
          }
          return this.groqClient;
        case 'cerebras':
          if (!this.cerebrasClient) {
            throw new Error('Cerebras API key not provided. Please configure it in /providers.');
          }
          return this.cerebrasClient;
        case 'perplexity':
          if (!this.perplexityClient) {
            throw new Error('Perplexity API key not provided. Please configure it in /providers.');
          }
          return this.perplexityClient;
        case 'openai':
          if (!this.openaiClient) {
            throw new Error('OpenAI API key not provided. Please configure it in /providers.');
          }
          return this.openaiClient;
        case 'ollama':
          return this.ollamaClient;
      }
    }
    // OpenRouter models (access to multiple providers through one API)
    const openRouterModels = [
      'qwen/qwen3-235b-a22b-07-25',
      'openai/gpt-4.1',
      'qwen/qwen3-coder',
      'deepseek/deepseek-r1-0528',
      'deepseek/deepseek-chat',
      'deepseek/deepseek-coder',
      'z-ai/glm-4.5',
      'meta-llama/llama-3.2-1b-instruct',
      'anthropic/claude-3.5-sonnet',
      'openai/gpt-4o',
      'openai/gpt-3.5-turbo'
    ];
    
    // Anthropic models
    const anthropicModels = [
      'claude-sonnet-4-20250514',
      'claude-3-5-sonnet-20241022',
      'claude-3-opus-20240229'
    ];
    
    // Google models
    const googleModels = [
      'gemini-2.0-flash',
      'gemini-2.5-flash',
      'gemini-1.5-pro'
    ];
    
    // xAI models (Grok)
    const xaiModels = [
      'grok-4-latest',
      'grok-3-latest',
      'grok-3-fast',
      'grok-3-mini-fast',
      'grok-beta'
    ];
    
    // Groq models
    const groqModels = [
      'moonshotai/kimi-k2-instruct',
      'llama-3.3-70b-versatile',
      'llama3-8b-8192',
      'llama3-70b-8192',
      'llama-3.1-8b-instant',
      'gemma2-9b-it'
    ];
    
    // Cerebras models
    const cerebrasModels = [
      'llama3.1-8b',
      'llama-4-scout-17b-16e-instruct',
      'llama-3.3-70b',
      'qwen-3-32b',
      'qwen-3-235b-a22b-instruct-2507'
    ];
    
    // Perplexity models
    const perplexityModels = [
      'sonar',
      'sonar-pro',
      'sonar-deep-research',
      'llama-3.1-sonar-small-128k-online'
    ];
    
    // OpenAI models
    const openaiModels = [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-3.5-turbo',
      'gpt-4'
    ];
    
    // Ollama models (dynamic - check by model format or known models)
    const isOllamaModel = (modelName: string): boolean => {
      // Check if it's a known Ollama model format or common Ollama models
      const commonOllamaModels = [
        'llama2', 'llama2:7b', 'llama2:13b', 'llama2:70b',
        'llama3', 'llama3:8b', 'llama3:70b', 'llama3.1', 'llama3.1:8b', 'llama3.1:70b', 'llama3.1:405b',
        'llama3.2', 'llama3.2:3b', 'llama3.2:11b', 'llama3.2:90b',
        'codellama', 'codellama:7b', 'codellama:13b', 'codellama:34b',
        'mistral', 'mistral:7b', 'mistral:instruct',
        'mixtral', 'mixtral:8x7b', 'mixtral:8x22b',
        'qwen', 'qwen:4b', 'qwen:7b', 'qwen:14b', 'qwen:32b', 'qwen:72b',
        'qwen2', 'qwen2:0.5b', 'qwen2:1.5b', 'qwen2:7b', 'qwen2:72b',
        'qwen2.5', 'qwen2.5:0.5b', 'qwen2.5:1.5b', 'qwen2.5:3b', 'qwen2.5:7b', 'qwen2.5:14b', 'qwen2.5:32b', 'qwen2.5:72b',
        'deepseek-coder', 'deepseek-coder:6.7b', 'deepseek-coder:33b',
        'gemma', 'gemma:2b', 'gemma:7b', 'gemma2', 'gemma2:9b', 'gemma2:27b',
        'phi', 'phi3', 'phi3:3.8b', 'phi3:14b',
        'vicuna', 'vicuna:7b', 'vicuna:13b', 'vicuna:33b',
        'orca-mini', 'orca-mini:3b', 'orca-mini:7b', 'orca-mini:13b',
        'neural-chat', 'neural-chat:7b',
        'starling-lm', 'starling-lm:7b',
        'tinyllama', 'tinyllama:1.1b',
        'wizard-vicuna-uncensored', 'wizard-vicuna-uncensored:7b', 'wizard-vicuna-uncensored:13b',
        'nous-hermes', 'nous-hermes:7b', 'nous-hermes:13b', 'nous-hermes2',
        'dolphin-mistral', 'dolphin-mistral:7b',
        'solar', 'solar:10.7b'
      ];
      
      if (commonOllamaModels.includes(modelName.toLowerCase())) {
        return true;
      }
      
      // Check for Ollama model format patterns (model:tag or model/variant)
      return /^[a-zA-Z0-9._-]+:[a-zA-Z0-9._-]+$/.test(modelName) || 
             /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(modelName) ||
             // Simple heuristic: if it doesn't match other providers and contains certain patterns
             (modelName.includes('llama') || modelName.includes('qwen') || modelName.includes('mistral') || 
              modelName.includes('gemma') || modelName.includes('phi') || modelName.includes('deepseek')) &&
             !openRouterModels.includes(modelName) && 
             !anthropicModels.includes(modelName) &&
             !googleModels.includes(modelName) &&
             !xaiModels.includes(modelName) &&
             !groqModels.includes(modelName) &&
             !cerebrasModels.includes(modelName) &&
             !perplexityModels.includes(modelName) &&
             !openaiModels.includes(modelName);
    };
    
    if (openRouterModels.includes(model)) {
      if (!this.openRouterClient) {
        throw new Error('OpenRouter API key not provided. Please configure it in /providers.');
      }
      return this.openRouterClient;
    } else if (anthropicModels.includes(model)) {
      if (!this.anthropicClient) {
        throw new Error('Anthropic API key not provided. Please configure it in /providers.');
      }
      return this.anthropicClient;
    } else if (googleModels.includes(model)) {
      if (!this.googleClient) {
        throw new Error('Google API key not provided. Please configure it in /providers.');
      }
      return this.googleClient;
    } else if (xaiModels.includes(model)) {
      return this.xaiClient; // Default xAI client
    } else if (groqModels.includes(model)) {
      if (!this.groqClient) {
        throw new Error('Groq API key not provided. Please configure it in /providers.');
      }
      return this.groqClient;
    } else if (cerebrasModels.includes(model)) {
      if (!this.cerebrasClient) {
        throw new Error('Cerebras API key not provided. Please configure it in /providers.');
      }
      return this.cerebrasClient;
    } else if (perplexityModels.includes(model)) {
      if (!this.perplexityClient) {
        throw new Error('Perplexity API key not provided. Please configure it in /providers.');
      }
      return this.perplexityClient;
    } else if (openaiModels.includes(model)) {
      if (!this.openaiClient) {
        throw new Error('OpenAI API key not provided. Please configure it in /providers.');
      }
      return this.openaiClient;
    } else if (isOllamaModel(model)) {
      return this.ollamaClient;
    }
    
    // Default to XAI for unknown models or grok models
    return this.xaiClient;
  }

  setModel(model: string): void {
    sessionManager.setCurrentModel(model);
  }

  getCurrentModel(): string {
    return sessionManager.getCurrentModel();
  }

  getLastStreamingMetrics(): { prefillTimeMs: number; decodeTimeMs: number; outputTokens: number; tokensPerSecond: number; } | undefined {
    return this.lastStreamingMetrics;
  }

  async chat(
    messages: GrokMessage[],
    tools?: GrokTool[],
    model?: string
  ): Promise<GrokResponse> {
    const startTime = Date.now();
    const targetModel = model || sessionManager.getCurrentModel();
    
    try {
      // Check if no model is configured
      if (!targetModel) {
        throw new Error('No model selected. Please configure a model first:\n\n1. Set up API keys: /providers\n2. Add models: /add-model\n3. Select a model: /models\n\nFor a quick start, try:\n• /providers → Add your API keys\n• /add-model → Add models from your providers\n• /models → Select the current model');
      }
      
      const tokenCounter = createTokenCounter(targetModel);
      const inputTokens = tokenCounter.countMessageTokens(messages as any);
      const client = this.getClientForModel(targetModel);
      
      // Check if this is a Cerebras client
      if (client === this.cerebrasClient) {
        const requestBody: any = {
          model: targetModel,
          messages,
          temperature: sessionManager.getTemperature(),
          max_completion_tokens: 4000,
          top_p: 0.95,
        };
        
        console.log(`DEBUG: Using Cerebras model: ${targetModel}`);
        console.log(`DEBUG: Cerebras API Key present: ${this.cerebrasApiKey ? 'Yes' : 'No'}`);
        
        const response = await client.chat.completions.create(requestBody);
        const endTime = Date.now();
        const durationMs = endTime - startTime;
        
        // Calculate tokens and throughput for Cerebras
        let outputTokens = 0;
        if ((response as any).usage?.completion_tokens) {
          outputTokens = (response as any).usage.completion_tokens;
        } else {
          // Fallback: estimate from response content
          const content = response.choices[0]?.message?.content || '';
          outputTokens = tokenCounter.countTokens(content);
        }
        
        const totalTokens = inputTokens + outputTokens;
        const outputTokensPerSecond = outputTokens / (durationMs / 1000);
        
        // Add metrics to response (console display handled by streaming or agent)
        // For non-streaming, estimate prefill as 30% of total time or max 1s
        const prefillTime = Math.min(1000, Math.round(durationMs * 0.3));
        const decodeTime = durationMs - prefillTime;
        const decodeTokensPerSecond = decodeTime > 0 ? outputTokens / (decodeTime / 1000) : 0;
        (response as any).metrics = {
          prefillTimeMs: prefillTime,
          decodeTimeMs: decodeTime,
          outputTokens: outputTokens,
          tokensPerSecond: Math.round(decodeTokensPerSecond)
        };
        
        tokenCounter.dispose();
        return response as GrokResponse;
      }
      
      // Handle OpenAI-compatible clients
      const openRouterProvider = getOpenRouterProvider(targetModel);
      const requestBody: any = {
        model: targetModel,
        messages,
        tools: tools || [],
        tool_choice: tools ? 'auto' : undefined,
        temperature: sessionManager.getTemperature(),
        max_tokens: 4000,
      };

      // If using OpenRouter client and have a provider preference, add provider routing
      if (client === this.openRouterClient && openRouterProvider) {
        requestBody.provider = {
          order: [openRouterProvider],
          allow_fallbacks: true
        };
        
        console.log(`DEBUG: Using preferred OpenRouter provider: ${openRouterProvider} for model: ${targetModel}`);
      }
      
      // Debug logging
      console.log(`DEBUG: Using model: ${targetModel}`);
      console.log(`DEBUG: Client type: ${client === this.openRouterClient ? 'OpenRouter' : client === this.groqClient ? 'Groq' : client === this.xaiClient ? 'XAI' : 'Other'}`);
      console.log(`DEBUG: API Key present: ${this.openRouterApiKey ? 'Yes' : 'No'}`);
      console.log(`DEBUG: Request payload:`, {
        model: targetModel,
        messages: messages.slice(0, 1), // Only show first message for brevity
        provider: requestBody.provider,
      });
      
      const response = await (client as OpenAI).chat.completions.create(requestBody);
      const endTime = Date.now();
      const durationMs = endTime - startTime;
      
      // Calculate tokens and throughput
      let outputTokens = 0;
      if ((response as any).usage?.completion_tokens) {
        outputTokens = (response as any).usage.completion_tokens;
      } else {
        // Fallback: estimate from response content
        const content = response.choices[0]?.message?.content || '';
        outputTokens = tokenCounter.countTokens(content);
      }
      
      const totalTokens = inputTokens + outputTokens;
      const outputTokensPerSecond = outputTokens / (durationMs / 1000);
      
      // Add metrics to response (console display handled by streaming or agent)
      // For non-streaming, estimate prefill as 30% of total time or max 1s
      const prefillTime = Math.min(1000, Math.round(durationMs * 0.3));
      const decodeTime = durationMs - prefillTime;
      const decodeTokensPerSecond = decodeTime > 0 ? outputTokens / (decodeTime / 1000) : 0;
      (response as any).metrics = {
        prefillTimeMs: prefillTime,
        decodeTimeMs: decodeTime,
        outputTokens: outputTokens,
        tokensPerSecond: Math.round(decodeTokensPerSecond)
      };
      
      tokenCounter.dispose();
      return response as GrokResponse;
    } catch (error: any) {
      const endTime = Date.now();
      const durationMs = endTime - startTime;
      console.log(`DEBUG: API Error for model ${targetModel} after ${(durationMs/1000).toFixed(1)}s:`, error.message);
      throw new Error(`API error: ${error.message}`);
    }
  }

  async *chatStream(
    messages: GrokMessage[],
    tools?: GrokTool[],
    model?: string
  ): AsyncGenerator<any, void, unknown> {
    const startTime = Date.now();
    const targetModel = model || sessionManager.getCurrentModel();
    let accumulatedContent = '';
    let firstTokenTime: number | null = null;
    
    try {
      // Check if no model is configured
      if (!targetModel) {
        throw new Error('No model selected. Please configure a model first:\n\n1. Set up API keys: /providers\n2. Add models: /add-model\n3. Select a model: /models\n\nFor a quick start, try:\n• /providers → Add your API keys\n• /add-model → Add models from your providers\n• /models → Select the current model');
      }
      
      const tokenCounter = createTokenCounter(targetModel);
      const inputTokens = tokenCounter.countMessageTokens(messages as any);
      const client = this.getClientForModel(targetModel);
      
      // Check if this is a Cerebras client
      if (client === this.cerebrasClient) {
        const requestBody: any = {
          model: targetModel,
          messages,
          temperature: sessionManager.getTemperature(),
          max_completion_tokens: 4000,
          top_p: 0.95,
          stream: true,
        };
        
        console.log(`DEBUG: Streaming with Cerebras model: ${targetModel}`);
        
        const stream = await client.chat.completions.create(requestBody) as any;

        for await (const chunk of stream) {
          if (chunk.choices?.[0]?.delta?.content) {
            if (firstTokenTime === null) {
              firstTokenTime = Date.now();
            }
            accumulatedContent += chunk.choices[0].delta.content;
          }
          yield chunk;
        }
        
        // Calculate and display metrics for Cerebras streaming
        const endTime = Date.now();
        const durationMs = endTime - startTime;
        const outputTokens = tokenCounter.countTokens(accumulatedContent);
        const totalTokens = inputTokens + outputTokens;
        const outputTokensPerSecond = outputTokens / (durationMs / 1000);
        
        // Calculate actual prefill and decode times
        const prefillTime = firstTokenTime ? firstTokenTime - startTime : Math.round(durationMs * 0.3);
        const decodeTime = firstTokenTime ? endTime - firstTokenTime : durationMs - prefillTime;
        const decodeTokensPerSecond = decodeTime > 0 ? outputTokens / (decodeTime / 1000) : 0;
        
        console.log(`\x1b[34mprefill - ${prefillTime}ms\x1b[0m | \x1b[33mdecode - ${Math.round(decodeTokensPerSecond)} toks/sec (${outputTokens} out / ${decodeTime}ms)\x1b[0m`);
        this.lastStreamingMetrics = {
          prefillTimeMs: prefillTime,
          decodeTimeMs: decodeTime,
          outputTokens: outputTokens,
          tokensPerSecond: Math.round(decodeTokensPerSecond)
        };
        tokenCounter.dispose();
        return;
      }
      
      // Handle OpenAI-compatible clients
      const openRouterProvider = getOpenRouterProvider(targetModel);
      const requestBody: any = {
        model: targetModel,
        messages,
        tools: tools || [],
        tool_choice: tools ? 'auto' : undefined,
        temperature: sessionManager.getTemperature(),
        max_tokens: 4000,
        stream: true,
      };

      // If using OpenRouter client and have a provider preference, add provider routing
      if (client === this.openRouterClient && openRouterProvider) {
        requestBody.provider = {
          order: [openRouterProvider],
          allow_fallbacks: true
        };
        
        console.log(`DEBUG: Streaming with preferred OpenRouter provider: ${openRouterProvider} for model: ${targetModel}`);
      }
      
      const stream = await (client as OpenAI).chat.completions.create(requestBody) as any;

      for await (const chunk of stream) {
        if (chunk.choices?.[0]?.delta?.content) {
          if (firstTokenTime === null) {
            firstTokenTime = Date.now();
          }
          accumulatedContent += chunk.choices[0].delta.content;
        }
        yield chunk;
      }
      
      // Calculate and display metrics for streaming
      const endTime = Date.now();
      const durationMs = endTime - startTime;
      const outputTokens = tokenCounter.countTokens(accumulatedContent);
      const totalTokens = inputTokens + outputTokens;
      const outputTokensPerSecond = outputTokens / (durationMs / 1000);
      
      // Calculate actual prefill and decode times
      const prefillTime = firstTokenTime ? firstTokenTime - startTime : Math.round(durationMs * 0.3);
      const decodeTime = firstTokenTime ? endTime - firstTokenTime : durationMs - prefillTime;
      const decodeTokensPerSecond = decodeTime > 0 ? outputTokens / (decodeTime / 1000) : 0;
      
      console.log(`\x1b[34mprefill - ${prefillTime}ms\x1b[0m | \x1b[33mdecode - ${Math.round(decodeTokensPerSecond)} toks/sec (${outputTokens} out / ${decodeTime}ms)\x1b[0m`);
      this.lastStreamingMetrics = {
        prefillTimeMs: prefillTime,
        decodeTimeMs: decodeTime,
        outputTokens: outputTokens,
        tokensPerSecond: Math.round(decodeTokensPerSecond)
      };
      tokenCounter.dispose();
    } catch (error: any) {
      const endTime = Date.now();
      const durationMs = endTime - startTime;
      console.log(`DEBUG: Streaming API Error for model ${targetModel} after ${(durationMs/1000).toFixed(1)}s:`, error.message);
      throw new Error(`API error: ${error.message}`);
    }
  }
}
