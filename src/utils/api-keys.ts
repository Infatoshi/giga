import * as fs from "fs";
import * as path from "path";
import * as os from "os";

interface UserSettings {
  apiKey?: string;
  groqApiKey?: string;
  anthropicApiKey?: string;
  openRouterApiKey?: string;
  googleApiKey?: string;
  xaiApiKey?: string;
  cerebrasApiKey?: string;
  exaApiKey?: string;
  openaiApiKey?: string;
  ollamaBaseUrl?: string;
}

export interface ApiKeys {
  xaiApiKey?: string;
  groqApiKey?: string;
  anthropicApiKey?: string;
  openRouterApiKey?: string;
  googleApiKey?: string;
  cerebrasApiKey?: string;
  exaApiKey?: string;
  openaiApiKey?: string;
  ollamaBaseUrl?: string;
}

function checkShellFiles(): ApiKeys {
  const homeDir = os.homedir();
  const shellFiles = [
    path.join(homeDir, '.bashrc'),
    path.join(homeDir, '.zshrc'),
    path.join(homeDir, '.bash_profile'),
    path.join(homeDir, '.profile')
  ];
  
  const keys: ApiKeys = {};
  const keyPatterns = {
    xaiApiKey: /export\s+XAI_API_KEY\s*=\s*['"]?([^'";\s]+)['"]?/,
    groqApiKey: /export\s+GROQ_API_KEY\s*=\s*['"]?([^'";\s]+)['"]?/,
    anthropicApiKey: /export\s+(?:ANTHROPIC_API_KEY|CLAUDE_API_KEY)\s*=\s*['"]?([^'";\s]+)['"]?/,
    openRouterApiKey: /export\s+OPENROUTER_API_KEY\s*=\s*['"]?([^'";\s]+)['"]?/,
    googleApiKey: /export\s+GOOGLE_API_KEY\s*=\s*['"]?([^'";\s]+)['"]?/,
    cerebrasApiKey: /export\s+CEREBRAS_API_KEY\s*=\s*['"]?([^'";\s]+)['"]?/,
    exaApiKey: /export\s+EXA_API_KEY\s*=\s*['"]?([^'";\s]+)['"]?/,
    openaiApiKey: /export\s+OPENAI_API_KEY\s*=\s*['"]?([^'";\s]+)['"]?/,
    ollamaBaseUrl: /export\s+OLLAMA_BASE_URL\s*=\s*['"]?([^'";\s]+)['"]?/,
  } as const;
  
  for (const file of shellFiles) {
    try {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        
        for (const [keyName, pattern] of Object.entries(keyPatterns)) {
          if (!keys[keyName as keyof ApiKeys]) {
            const match = content.match(pattern);
            if (match && match[1]) {
              (keys as any)[keyName] = match[1];
            }
          }
        }
      }
    } catch (error) {
      // Ignore errors reading shell files
    }
  }
  
  return keys;
}

function saveShellKeysToSettings(shellKeys: ApiKeys): void {
  try {
    const homeDir = os.homedir();
    const settingsDir = path.join(homeDir, '.giga');
    const settingsFile = path.join(settingsDir, 'user-settings.json');
    
    // Load existing settings or create empty object
    let settings: UserSettings = {};
    if (fs.existsSync(settingsFile)) {
      settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    }
    
    // Only save shell keys that are not already in settings and are not empty
    let hasChanges = false;
    const keyMappings: { [K in keyof ApiKeys]: keyof UserSettings } = {
      xaiApiKey: 'xaiApiKey',
      groqApiKey: 'groqApiKey', 
      anthropicApiKey: 'anthropicApiKey',
      openRouterApiKey: 'openRouterApiKey',
      googleApiKey: 'googleApiKey',
      cerebrasApiKey: 'cerebrasApiKey',
      exaApiKey: 'exaApiKey',
      openaiApiKey: 'openaiApiKey',
      ollamaBaseUrl: 'ollamaBaseUrl',
    };
    
    for (const [apiKeyName, settingsKeyName] of Object.entries(keyMappings)) {
      const shellValue = shellKeys[apiKeyName as keyof ApiKeys];
      if (shellValue && !settings[settingsKeyName]) {
        (settings as any)[settingsKeyName] = shellValue;
        hasChanges = true;
      }
    }
    
    // Handle legacy apiKey field
    if (shellKeys.xaiApiKey && !settings.apiKey && !settings.xaiApiKey) {
      settings.apiKey = shellKeys.xaiApiKey;
      hasChanges = true;
    }
    
    // Save settings file if there were changes
    if (hasChanges) {
      fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
      // Refresh global shared info after changes
      try {
        const now = new Date();
        fs.utimesSync(settingsFile, now, now);
      } catch (refreshError) {
        // Silently ignore refresh errors
      }
    }
  } catch (error) {
    // Silently ignore errors to avoid disrupting the application
  }
}

export function refreshGlobalSharedInfo(): void {
  try {
    const homeDir = os.homedir();
    const settingsFile = path.join(homeDir, '.giga', 'user-settings.json');
    
    // If user-settings.json exists, refresh global shared info
    if (fs.existsSync(settingsFile)) {
      // Trigger refresh by updating modification time
      const now = new Date();
      fs.utimesSync(settingsFile, now, now);
    }
  } catch (error) {
    // Silently ignore errors
  }
}

export function saveExaApiKey(apiKey: string): void {
  try {
    const homeDir = os.homedir();
    const settingsDir = path.join(homeDir, '.giga');
    const settingsFile = path.join(settingsDir, 'user-settings.json');

    let settings: UserSettings = {};
    if (fs.existsSync(settingsFile)) {
      settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    }

    settings.exaApiKey = apiKey;

    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
    refreshGlobalSharedInfo();
  } catch (error) {
    // Silently ignore
  }
}

export function loadApiKeys(): ApiKeys {
  try {
    const homeDir = os.homedir();
    const settingsFile = path.join(homeDir, '.giga', 'user-settings.json');
    
    // Start with environment variables
    const envKeys: ApiKeys = {
      xaiApiKey: process.env.XAI_API_KEY,
      groqApiKey: process.env.GROQ_API_KEY,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY,
      openRouterApiKey: process.env.OPENROUTER_API_KEY,
      googleApiKey: process.env.GOOGLE_API_KEY,
      cerebrasApiKey: process.env.CEREBRAS_API_KEY,
      exaApiKey: process.env.EXA_API_KEY,
      openaiApiKey: process.env.OPENAI_API_KEY,
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL,
    };
    
    // Check shell files for exported variables
    const shellKeys = checkShellFiles();
    
    // Save shell keys to settings if they're not already saved
    saveShellKeysToSettings(shellKeys);
    
    // Load settings file
    let settingsKeys: ApiKeys = {};
    if (fs.existsSync(settingsFile)) {
      const settings: UserSettings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
      settingsKeys = {
        xaiApiKey: settings.apiKey || settings.xaiApiKey, // backwards compatibility
        groqApiKey: settings.groqApiKey,
        anthropicApiKey: settings.anthropicApiKey,
        openRouterApiKey: settings.openRouterApiKey,
        googleApiKey: settings.googleApiKey,
        cerebrasApiKey: settings.cerebrasApiKey,
        exaApiKey: settings.exaApiKey,
        openaiApiKey: settings.openaiApiKey,
        ollamaBaseUrl: settings.ollamaBaseUrl,
      };
    }
    
    // Priority: env vars > shell files > settings file
    return {
      xaiApiKey: envKeys.xaiApiKey || shellKeys.xaiApiKey || settingsKeys.xaiApiKey,
      groqApiKey: envKeys.groqApiKey || shellKeys.groqApiKey || settingsKeys.groqApiKey,
      anthropicApiKey: envKeys.anthropicApiKey || shellKeys.anthropicApiKey || settingsKeys.anthropicApiKey,
      openRouterApiKey: envKeys.openRouterApiKey || shellKeys.openRouterApiKey || settingsKeys.openRouterApiKey,
      googleApiKey: envKeys.googleApiKey || shellKeys.googleApiKey || settingsKeys.googleApiKey,
      cerebrasApiKey: envKeys.cerebrasApiKey || shellKeys.cerebrasApiKey || settingsKeys.cerebrasApiKey,
      exaApiKey: envKeys.exaApiKey || shellKeys.exaApiKey || settingsKeys.exaApiKey,
      openaiApiKey: envKeys.openaiApiKey || shellKeys.openaiApiKey || settingsKeys.openaiApiKey,
      ollamaBaseUrl: envKeys.ollamaBaseUrl || shellKeys.ollamaBaseUrl || settingsKeys.ollamaBaseUrl || 'http://localhost:11434',
    };
  } catch (error) {
    return {};
  }
}