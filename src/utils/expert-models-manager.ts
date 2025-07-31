import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface ExpertModelsConfig {
  enabled: boolean;
  fastModel: string | null;
  codeModel: string | null;
  reasoningModel: string | null;
  toolsModel: string | null;
}

class ExpertModelsManager {
  private static instance: ExpertModelsManager;
  
  private constructor() {}

  static getInstance(): ExpertModelsManager {
    if (!ExpertModelsManager.instance) {
      ExpertModelsManager.instance = new ExpertModelsManager();
    }
    return ExpertModelsManager.instance;
  }
  
  private getGigaDir(): string {
    const homeDir = os.homedir();
    const gigaDir = path.join(homeDir, '.giga');
    
    if (!fs.existsSync(gigaDir)) {
      fs.mkdirSync(gigaDir, { mode: 0o700 });
    }
    
    return gigaDir;
  }
  
  private getConfigPath(): string {
    const gigaDir = this.getGigaDir();
    return path.join(gigaDir, 'expert-models.json');
  }
  
  public getExpertModelsConfig(): ExpertModelsConfig {
    try {
      const configPath = this.getConfigPath();
      
      if (!fs.existsSync(configPath)) {
        return {
          enabled: false,
          fastModel: null,
          codeModel: null,
          reasoningModel: null,
          toolsModel: null,
        };
      }
      
      const config: ExpertModelsConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      
      // Validate config structure
      if (typeof config.enabled !== 'boolean') {
        config.enabled = false;
      }
      
      return config;
    } catch (error) {
      console.error('Error loading expert models config:', error);
      return {
        enabled: false,
        fastModel: null,
        codeModel: null,
        reasoningModel: null,
        toolsModel: null,
      };
    }
  }
  
  public setExpertModelsConfig(expertModels: ExpertModelsConfig): void {
    try {
      const configPath = this.getConfigPath();
      
      fs.writeFileSync(
        configPath, 
        JSON.stringify(expertModels, null, 2), 
        { mode: 0o600 }
      );
    } catch (error) {
      console.error('Error saving expert models config:', error);
    }
  }

  public migrateFromSessionConfig(sessionConfigPath: string): boolean {
    try {
      if (!fs.existsSync(sessionConfigPath)) {
        return false;
      }

      const sessionConfig = JSON.parse(fs.readFileSync(sessionConfigPath, 'utf8'));
      
      if (sessionConfig.expertModels) {
        // Check if global config already exists
        const globalConfigPath = this.getConfigPath();
        if (!fs.existsSync(globalConfigPath)) {
          console.log('Migrating expert models config from session to global storage...');
          this.setExpertModelsConfig(sessionConfig.expertModels);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error migrating expert models config:', error);
      return false;
    }
  }

  public migrateFromAllSessions(): void {
    try {
      const homeDir = os.homedir();
      const sessionsDir = path.join(homeDir, '.giga', 'sessions');
      
      if (!fs.existsSync(sessionsDir)) {
        return;
      }

      // Check if global config already exists
      if (fs.existsSync(this.getConfigPath())) {
        return; // Don't overwrite existing global config
      }

      const sessionDirs = fs.readdirSync(sessionsDir);
      let latestConfig: ExpertModelsConfig | null = null;
      let latestTimestamp = 0;

      // Find the most recently used session with expert models config
      for (const sessionDir of sessionDirs) {
        const configPath = path.join(sessionsDir, sessionDir, 'config.json');
        
        if (fs.existsSync(configPath)) {
          try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            
            if (config.expertModels && config.lastUsed) {
              const timestamp = new Date(config.lastUsed).getTime();
              if (timestamp > latestTimestamp) {
                latestTimestamp = timestamp;
                latestConfig = config.expertModels;
              }
            }
          } catch (error) {
            // Skip invalid config files
            continue;
          }
        }
      }

      // If we found a config, migrate it
      if (latestConfig) {
        console.log('Migrating expert models config from most recent session to global storage...');
        this.setExpertModelsConfig(latestConfig);
      }
    } catch (error) {
      console.error('Error migrating expert models from sessions:', error);
    }
  }
}

// Export singleton instance
export const expertModelsManager = ExpertModelsManager.getInstance();