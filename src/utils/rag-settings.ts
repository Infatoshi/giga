import { RAGConfigManager, RAGConfig } from './rag-config';
import { RAGContextService } from '../services/rag-context-service';

export interface RAGSettings {
  enabled: boolean;
  embeddingProvider: 'gemini' | 'openai';
  embeddingModel: string;
  searchThreshold: number;
  maxResults: number;
  chunkingStrategy: 'logical' | 'fixed';
  autoContext: boolean;
  backgroundIndexing: boolean;
}

export class RAGSettingsManager {
  private static instance: RAGSettingsManager;
  private projectPath: string;

  private constructor(projectPath: string = process.cwd()) {
    this.projectPath = projectPath;
  }

  static getInstance(projectPath: string = process.cwd()): RAGSettingsManager {
    if (!RAGSettingsManager.instance) {
      RAGSettingsManager.instance = new RAGSettingsManager(projectPath);
    }
    return RAGSettingsManager.instance;
  }

  getSettings(): RAGSettings {
    const config = RAGConfigManager.loadConfig(this.projectPath);
    
    return {
      enabled: config.enabled,
      embeddingProvider: config.embeddingProvider,
      embeddingModel: config.embeddingModel,
      searchThreshold: config.searchThreshold,
      maxResults: config.maxResults,
      chunkingStrategy: config.chunkingStrategy,
      autoContext: true, // Always enabled for now
      backgroundIndexing: true // Always enabled for now
    };
  }

  updateSettings(updates: Partial<RAGSettings>): RAGSettings {
    const currentConfig = RAGConfigManager.loadConfig(this.projectPath);
    
    const configUpdates: Partial<RAGConfig> = {};
    
    if (updates.enabled !== undefined) {
      configUpdates.enabled = updates.enabled;
    }
    
    if (updates.embeddingProvider !== undefined) {
      configUpdates.embeddingProvider = updates.embeddingProvider;
    }
    
    if (updates.embeddingModel !== undefined) {
      configUpdates.embeddingModel = updates.embeddingModel;
    }
    
    if (updates.searchThreshold !== undefined) {
      configUpdates.searchThreshold = updates.searchThreshold;
    }
    
    if (updates.maxResults !== undefined) {
      configUpdates.maxResults = updates.maxResults;
    }
    
    if (updates.chunkingStrategy !== undefined) {
      configUpdates.chunkingStrategy = updates.chunkingStrategy;
    }
    
    // Update the configuration
    RAGConfigManager.updateConfig(configUpdates, this.projectPath);
    
    return this.getSettings();
  }

  async getIndexStatus(): Promise<{
    isIndexed: boolean;
    chunkCount: number;
    lastIndexed?: Date;
    indexSize?: string;
  }> {
    try {
      const ragService = new RAGContextService(this.projectPath);
      const indexInfo = await ragService.getIndexInfo();
      
      return {
        isIndexed: indexInfo.count > 0,
        chunkCount: indexInfo.count,
        // TODO: Add last indexed time from metadata
        // TODO: Add index size calculation
      };
    } catch (error) {
      return {
        isIndexed: false,
        chunkCount: 0
      };
    }
  }

  async rebuildIndex(): Promise<boolean> {
    try {
      const ragService = new RAGContextService(this.projectPath);
      await ragService.clearIndex();
      await ragService.indexProject();
      return true;
    } catch (error) {
      console.error('Failed to rebuild index:', error);
      return false;
    }
  }

  async clearIndex(): Promise<boolean> {
    try {
      const ragService = new RAGContextService(this.projectPath);
      await ragService.clearIndex();
      return true;
    } catch (error) {
      console.error('Failed to clear index:', error);
      return false;
    }
  }

  getProviderOptions(): Array<{ value: string; label: string }> {
    return [
      { value: 'gemini', label: 'Google Gemini' },
      { value: 'openai', label: 'OpenAI' }
    ];
  }

  getModelOptions(provider: string): Array<{ value: string; label: string }> {
    switch (provider) {
      case 'gemini':
        return [
          { value: 'gemini-embedding-001', label: 'Gemini Embedding 001 (Recommended)' },
          { value: 'text-embedding-004', label: 'Text Embedding 004' }
        ];
      case 'openai':
        return [
          { value: 'text-embedding-3-small', label: 'Text Embedding 3 Small' },
          { value: 'text-embedding-3-large', label: 'Text Embedding 3 Large' },
          { value: 'text-embedding-ada-002', label: 'Ada 002 (Legacy)' }
        ];
      default:
        return [];
    }
  }

  getChunkingStrategyOptions(): Array<{ value: string; label: string; description: string }> {
    return [
      {
        value: 'logical',
        label: 'Logical Chunking (Recommended)',
        description: 'Splits code by functions, classes, and logical boundaries'
      },
      {
        value: 'fixed',
        label: 'Fixed Size Chunking',
        description: 'Splits code into fixed-size chunks with overlap'
      }
    ];
  }

  validateSettings(settings: Partial<RAGSettings>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (settings.embeddingProvider && !['gemini', 'openai'].includes(settings.embeddingProvider)) {
      errors.push('Embedding provider must be either "gemini" or "openai"');
    }

    if (settings.searchThreshold !== undefined) {
      if (settings.searchThreshold < 0 || settings.searchThreshold > 1) {
        errors.push('Search threshold must be between 0.0 and 1.0');
      }
    }

    if (settings.maxResults !== undefined) {
      if (settings.maxResults < 1 || settings.maxResults > 50) {
        errors.push('Max results must be between 1 and 50');
      }
    }

    if (settings.chunkingStrategy && !['logical', 'fixed'].includes(settings.chunkingStrategy)) {
      errors.push('Chunking strategy must be either "logical" or "fixed"');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  getRecommendedSettings(): RAGSettings {
    return {
      enabled: true,
      embeddingProvider: 'gemini',
      embeddingModel: 'gemini-embedding-001',
      searchThreshold: 0.40,
      maxResults: 5,
      chunkingStrategy: 'logical',
      autoContext: true,
      backgroundIndexing: true
    };
  }

  exportSettings(): string {
    const settings = this.getSettings();
    return JSON.stringify(settings, null, 2);
  }

  importSettings(settingsJson: string): boolean {
    try {
      const settings = JSON.parse(settingsJson) as Partial<RAGSettings>;
      const validation = this.validateSettings(settings);
      
      if (!validation.valid) {
        console.error('Invalid settings:', validation.errors);
        return false;
      }

      this.updateSettings(settings);
      return true;
    } catch (error) {
      console.error('Failed to import settings:', error);
      return false;
    }
  }
}