// Available models for each provider
export const PROVIDER_MODELS = {
  openrouter: [
    // OpenAI models on OpenRouter
    "openai/gpt-4o",
    "openai/gpt-4o-mini",
    "openai/gpt-4-turbo",
    "openai/gpt-4",
    "openai/gpt-3.5-turbo",
    "openai/o1-preview",
    "openai/o1-mini",
    
    // Anthropic models on OpenRouter
    "anthropic/claude-3.5-sonnet",
    "anthropic/claude-3-opus",
    "anthropic/claude-3-sonnet",
    "anthropic/claude-3-haiku",
    
    // Google models on OpenRouter
    "google/gemini-pro-1.5",
    "google/gemini-flash-1.5",
    "google/gemini-2.0-flash-exp",
    
    // Meta models
    "meta-llama/llama-3.3-70b-instruct",
    "meta-llama/llama-3.1-70b-instruct",
    "meta-llama/llama-3.1-8b-instruct",
    "meta-llama/llama-3.2-90b-vision-instruct",
    "meta-llama/llama-3.2-11b-vision-instruct",
    "meta-llama/llama-3.2-3b-instruct",
    "meta-llama/llama-3.2-1b-instruct",
    
    // Qwen models
    "qwen/qwen-2.5-72b-instruct",
    "qwen/qwen-2.5-32b-instruct",
    "qwen/qwen-2.5-14b-instruct",
    "qwen/qwen-2.5-7b-instruct",
    "qwen/qwen2-vl-72b-instruct",
    "qwen/qwen2-vl-7b-instruct",
    "qwen/qwen3-235b-a22b-07-25",
    "qwen/qwen3-coder",
    
    // DeepSeek models
    "deepseek/deepseek-chat",
    "deepseek/deepseek-coder",
    "deepseek/deepseek-r1-0528",
    
    // Mistral models
    "mistralai/mistral-large",
    "mistralai/mistral-medium",
    "mistralai/mistral-small",
    "mistralai/codestral-mamba",
    
    // Other popular models
    "microsoft/wizardlm-2-8x22b",
    "databricks/dbrx-instruct",
    "cohere/command-r-plus",
    "cohere/command-r",
    "z-ai/glm-4.5",
  ],
  
  anthropic: [
    "claude-3-5-sonnet-20241022",
    "claude-3-5-sonnet-20240620",
    "claude-3-opus-20240229",
    "claude-3-sonnet-20240229",
    "claude-3-haiku-20240307",
    "claude-sonnet-4-20250514",
  ],
  
  google: [
    "gemini-2.0-flash-exp",
    "gemini-1.5-pro-latest",
    "gemini-1.5-pro",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-1.0-pro",
    "gemini-pro-vision",
    "gemini-2.0-flash",
    "gemini-2.5-flash",
  ],
  
  xai: [
    "grok-beta",
    "grok-4-latest",
    "grok-3-latest",
    "grok-3-fast",
    "grok-3-mini-fast",
    "grok-2-1212",
    "grok-2-latest",
  ],
  
  groq: [
    "llama-3.3-70b-versatile",
    "llama-3.1-70b-versatile",
    "llama-3.1-8b-instant",
    "llama-3.2-90b-vision-preview",
    "llama-3.2-11b-vision-preview",
    "llama-3.2-3b-preview",
    "llama-3.2-1b-preview",
    "llama3-groq-70b-8192-tool-use-preview",
    "llama3-groq-8b-8192-tool-use-preview",
    "llama3-70b-8192",
    "llama3-8b-8192",
    "mixtral-8x7b-32768",
    "gemma-7b-it",
    "gemma2-9b-it",
    "moonshotai/kimi-k2-instruct",
  ],
  
  cerebras: [
    "llama3.1-8b",
    "llama3.1-70b",
    "llama-3.3-70b",
    "llama-4-scout-17b-16e-instruct",
    "qwen-3-32b",
    "qwen-3-235b-a22b",
    "qwen2.5-7b-instruct",
    "qwen2.5-14b-instruct",
    "qwen2.5-32b-instruct",
    "qwen2.5-72b-instruct",
  ],
  
  perplexity: [
    "llama-3.1-sonar-small-128k-online",
    "llama-3.1-sonar-large-128k-online",
    "llama-3.1-sonar-huge-128k-online",
    "llama-3.1-sonar-small-128k-chat",
    "llama-3.1-sonar-large-128k-chat",
    "llama-3.1-8b-instruct",
    "llama-3.1-70b-instruct",
    "sonar-small-online",
    "sonar-medium-online",
    "sonar-small-chat",
    "sonar-medium-chat",
    "sonar",
    "sonar-pro",
    "sonar-deep-research",
  ],
  
  openai: [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "gpt-4-turbo-preview",
    "gpt-4",
    "gpt-3.5-turbo",
    "gpt-3.5-turbo-16k",
    "o1-preview",
    "o1-mini",
    "text-davinci-003",
    "text-davinci-002",
    "code-davinci-002",
  ],
};

export type ProviderName = keyof typeof PROVIDER_MODELS;