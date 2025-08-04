import * as fs from 'fs';
import * as path from 'path';
export interface RAGConfig {
  enabled: boolean;
  embeddingProvider: 'gemini' | 'openai';
  embeddingModel: string;
  searchThreshold: number;
  maxResults: number;
  chunkingStrategy: 'logical' | 'fixed';
  includePatterns: string[];
  excludePatterns: string[];
}

const DEFAULT_RAG_CONFIG: RAGConfig = {
  enabled: true,
  embeddingProvider: 'gemini',
  embeddingModel: 'gemini-embedding-001',
  searchThreshold: 0.40,
  maxResults: 5,
  chunkingStrategy: 'logical',
  includePatterns: [
    '**/*.ts',
    '**/*.js', 
    '**/*.tsx',
    '**/*.jsx',
    '**/*.py',
    '**/*.java',
    '**/*.cpp',
    '**/*.c',
    '**/*.h',
    '**/*.go',
    '**/*.rs',
    '**/*.php',
    '**/*.rb',
    '**/*.swift',
    '**/*.kt',
    '**/*.cs',
    '**/*.scala',
    '**/*.clj',
    '**/*.sh',
    '**/*.yml',
    '**/*.yaml',
    '**/*.json',
    '**/*.md',
    '**/*.txt'
  ],
  excludePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.git/**',
    '**/coverage/**',
    '**/target/**',
    '**/bin/**',
    '**/obj/**',
    '**/.next/**',
    '**/.nuxt/**',
    '**/vendor/**',
    '**/__pycache__/**',
    '**/*.min.js',
    '**/*.min.css',
    '**/package-lock.json',
    '**/yarn.lock',
    '**/pnpm-lock.yaml'
  ]
};

export class RAGConfigManager {
  static getConfigPath(projectPath: string = process.cwd()): string {
    return path.join(projectPath, '.giga', 'rag-config.json');
  }

  static getGigaDirPath(projectPath: string = process.cwd()): string {
    return path.join(projectPath, '.giga');
  }

  static ensureGigaDirectory(projectPath: string = process.cwd()): void {
    const gigaDir = this.getGigaDirPath(projectPath);
    if (!fs.existsSync(gigaDir)) {
      fs.mkdirSync(gigaDir, { recursive: true });
    }
  }

  static loadConfig(projectPath: string = process.cwd()): RAGConfig {
    const configPath = this.getConfigPath(projectPath);
    
    try {
      if (fs.existsSync(configPath)) {
        const configFile = fs.readFileSync(configPath, 'utf-8');
        const userConfig = JSON.parse(configFile);
        
        // Merge with defaults to ensure all properties exist
        return {
          ...DEFAULT_RAG_CONFIG,
          ...userConfig,
          // Ensure arrays are properly merged
          includePatterns: userConfig.includePatterns || DEFAULT_RAG_CONFIG.includePatterns,
          excludePatterns: userConfig.excludePatterns || DEFAULT_RAG_CONFIG.excludePatterns
        };
      }
    } catch (error) {
      console.warn('Failed to load RAG config, using defaults:', error);
    }

    return { ...DEFAULT_RAG_CONFIG };
  }

  static saveConfig(config: RAGConfig, projectPath: string = process.cwd()): void {
    try {
      this.ensureGigaDirectory(projectPath);
      const configPath = this.getConfigPath(projectPath);
      
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save RAG config:', error);
      throw error;
    }
  }

  static updateConfig(updates: Partial<RAGConfig>, projectPath: string = process.cwd()): RAGConfig {
    const currentConfig = this.loadConfig(projectPath);
    const newConfig = { ...currentConfig, ...updates };
    this.saveConfig(newConfig, projectPath);
    return newConfig;
  }

  static getDefaultConfig(): RAGConfig {
    return { ...DEFAULT_RAG_CONFIG };
  }

  static isRAGEnabled(projectPath: string = process.cwd()): boolean {
    const config = this.loadConfig(projectPath);
    return config.enabled;
  }

  static enableRAG(projectPath: string = process.cwd()): void {
    this.updateConfig({ enabled: true }, projectPath);
  }

  static disableRAG(projectPath: string = process.cwd()): void {
    this.updateConfig({ enabled: false }, projectPath);
  }

  static hasGigaDirectory(projectPath: string = process.cwd()): boolean {
    return fs.existsSync(this.getGigaDirPath(projectPath));
  }

  static hasRAGConfig(projectPath: string = process.cwd()): boolean {
    return fs.existsSync(this.getConfigPath(projectPath));
  }

  static initializeProject(projectPath: string = process.cwd()): RAGConfig {
    this.ensureGigaDirectory(projectPath);
    const config = this.loadConfig(projectPath);
    
    if (!this.hasRAGConfig(projectPath)) {
      this.saveConfig(config, projectPath);
    }
    
    return config;
  }

  static validateConfig(config: Partial<RAGConfig>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.embeddingProvider && !['gemini', 'openai'].includes(config.embeddingProvider)) {
      errors.push('embeddingProvider must be either "gemini" or "openai"');
    }

    if (config.searchThreshold !== undefined && (config.searchThreshold < 0 || config.searchThreshold > 1)) {
      errors.push('searchThreshold must be between 0 and 1');
    }

    if (config.maxResults !== undefined && (config.maxResults < 1 || config.maxResults > 50)) {
      errors.push('maxResults must be between 1 and 50');
    }

    if (config.chunkingStrategy && !['logical', 'fixed'].includes(config.chunkingStrategy)) {
      errors.push('chunkingStrategy must be either "logical" or "fixed"');
    }

    if (config.includePatterns && !Array.isArray(config.includePatterns)) {
      errors.push('includePatterns must be an array of strings');
    }

    if (config.excludePatterns && !Array.isArray(config.excludePatterns)) {
      errors.push('excludePatterns must be an array of strings');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  static getConfigSummary(projectPath: string = process.cwd()): string {
    const config = this.loadConfig(projectPath);
    const hasConfig = this.hasRAGConfig(projectPath);
    
    return `RAG Configuration ${hasConfig ? '(from .giga/rag-config.json)' : '(defaults)'}:
• Status: ${config.enabled ? '✅ Enabled' : '❌ Disabled'}
• Provider: ${config.embeddingProvider} (${config.embeddingModel})
• Search Threshold: ${config.searchThreshold}
• Max Results: ${config.maxResults}
• Chunking: ${config.chunkingStrategy}
• Include Patterns: ${config.includePatterns.length} patterns
• Exclude Patterns: ${config.excludePatterns.length} patterns`;
  }
}