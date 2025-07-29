import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat';
import { sessionManager } from '../utils/session-manager';
import { getOpenRouterProvider } from '../utils/added-models';

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
}

interface APIConfig {
  baseURL: string;
  apiKey: string;
}

export class GrokClient {
  private xaiClient: OpenAI;
  private groqClient: OpenAI;
  private anthropicClient: OpenAI;
  private openRouterClient: OpenAI;
  private googleClient: OpenAI;
  private cerebrasClient: OpenAI;
  private perplexityClient: OpenAI;
  private openaiClient: OpenAI;
  // Remove instance-level currentModel - now managed by sessionManager
  private groqApiKey?: string;
  private anthropicApiKey?: string;
  private openRouterApiKey?: string;
  private googleApiKey?: string;
  private cerebrasApiKey?: string;
  private perplexityApiKey?: string;
  private openaiApiKey?: string;

  constructor(
    apiKey: string, 
    model?: string, 
    groqApiKey?: string, 
    anthropicApiKey?: string, 
    openRouterApiKey?: string,
    googleApiKey?: string,
    cerebrasApiKey?: string,
    perplexityApiKey?: string,
    openaiApiKey?: string
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
      this.cerebrasClient = new OpenAI({
        apiKey: cerebrasApiKey,
        baseURL: 'https://api.cerebras.ai/v1',
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
    
    if (model) {
      sessionManager.setCurrentModel(model);
    }
  }

  private getClientForModel(model: string): OpenAI {
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
      'qwen-3-235b-a22b'
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

  async chat(
    messages: GrokMessage[],
    tools?: GrokTool[],
    model?: string
  ): Promise<GrokResponse> {
    try {
      const targetModel = model || sessionManager.getCurrentModel();
      const client = this.getClientForModel(targetModel);
      
      // Check for OpenRouter provider preference and prepare request body
      const openRouterProvider = getOpenRouterProvider(targetModel);
      const requestBody: any = {
        model: targetModel,
        messages,
        tools: tools || [],
        tool_choice: tools ? 'auto' : undefined,
        temperature: 0.7,
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
      
      const response = await client.chat.completions.create(requestBody);

      return response as GrokResponse;
    } catch (error: any) {
      console.log(`DEBUG: API Error for model ${model || sessionManager.getCurrentModel()}:`, error.message);
      throw new Error(`API error: ${error.message}`);
    }
  }

  async *chatStream(
    messages: GrokMessage[],
    tools?: GrokTool[],
    model?: string
  ): AsyncGenerator<any, void, unknown> {
    try {
      const targetModel = model || sessionManager.getCurrentModel();
      const client = this.getClientForModel(targetModel);
      
      // Check for OpenRouter provider preference and prepare request body
      const openRouterProvider = getOpenRouterProvider(targetModel);
      const requestBody: any = {
        model: targetModel,
        messages,
        tools: tools || [],
        tool_choice: tools ? 'auto' : undefined,
        temperature: 0.7,
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
      
      const stream = await client.chat.completions.create(requestBody) as any;

      for await (const chunk of stream) {
        yield chunk;
      }
    } catch (error: any) {
      throw new Error(`API error: ${error.message}`);
    }
  }
}
