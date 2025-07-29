import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { randomUUID } from "crypto";

export interface SessionConfig {
  instanceId: string;
  currentModel: string;
  createdAt: string;
  lastUsed: string;
}

class SessionManager {
  private instanceId: string;
  private sessionDir: string;
  
  constructor() {
    this.instanceId = randomUUID();
    this.sessionDir = this.getSessionDir();
    this.ensureSessionDir();
    this.saveSessionConfig();
  }
  
  private getGigaDir(): string {
    const homeDir = os.homedir();
    const gigaDir = path.join(homeDir, '.giga');
    
    if (!fs.existsSync(gigaDir)) {
      fs.mkdirSync(gigaDir, { mode: 0o700 });
    }
    
    return gigaDir;
  }
  
  private getSessionDir(): string {
    const gigaDir = this.getGigaDir();
    return path.join(gigaDir, 'sessions', this.instanceId);
  }
  
  private ensureSessionDir(): void {
    if (!fs.existsSync(this.sessionDir)) {
      fs.mkdirSync(this.sessionDir, { recursive: true, mode: 0o700 });
    }
  }
  
  private getSessionConfigPath(): string {
    return path.join(this.sessionDir, 'config.json');
  }
  
  private saveSessionConfig(): void {
    try {
      const config: SessionConfig = {
        instanceId: this.instanceId,
        currentModel: 'moonshotai/kimi-k2-instruct', // default model
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString()
      };
      
      fs.writeFileSync(
        this.getSessionConfigPath(), 
        JSON.stringify(config, null, 2), 
        { mode: 0o600 }
      );
    } catch (error) {
      console.error('Error saving session config:', error);
    }
  }
  
  public getInstanceId(): string {
    return this.instanceId;
  }
  
  public getCurrentModel(): string {
    try {
      const configPath = this.getSessionConfigPath();
      
      if (!fs.existsSync(configPath)) {
        return 'moonshotai/kimi-k2-instruct'; // default fallback
      }
      
      const config: SessionConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return config.currentModel || 'moonshotai/kimi-k2-instruct';
    } catch (error) {
      console.error('Error loading current model:', error);
      return 'moonshotai/kimi-k2-instruct';
    }
  }
  
  public setCurrentModel(modelName: string): void {
    try {
      const configPath = this.getSessionConfigPath();
      let config: SessionConfig;
      
      if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      } else {
        config = {
          instanceId: this.instanceId,
          currentModel: modelName,
          createdAt: new Date().toISOString(),
          lastUsed: new Date().toISOString()
        };
      }
      
      config.currentModel = modelName;
      config.lastUsed = new Date().toISOString();
      
      fs.writeFileSync(
        configPath, 
        JSON.stringify(config, null, 2), 
        { mode: 0o600 }
      );
    } catch (error) {
      console.error('Error saving current model:', error);
    }
  }
  
  public getSessionInfo(): SessionConfig | null {
    try {
      const configPath = this.getSessionConfigPath();
      
      if (!fs.existsSync(configPath)) {
        return null;
      }
      
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (error) {
      console.error('Error loading session info:', error);
      return null;
    }
  }
  
  // Cleanup old sessions (optional - called periodically)
  public static cleanupOldSessions(olderThanDays: number = 7): void {
    try {
      const homeDir = os.homedir();
      const sessionsDir = path.join(homeDir, '.giga', 'sessions');
      
      if (!fs.existsSync(sessionsDir)) {
        return;
      }
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
      
      const sessionDirs = fs.readdirSync(sessionsDir);
      
      for (const sessionDir of sessionDirs) {
        const sessionPath = path.join(sessionsDir, sessionDir);
        const configPath = path.join(sessionPath, 'config.json');
        
        if (fs.existsSync(configPath)) {
          try {
            const config: SessionConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            const lastUsed = new Date(config.lastUsed);
            
            if (lastUsed < cutoffDate) {
              fs.rmSync(sessionPath, { recursive: true, force: true });
            }
          } catch (error) {
            // If we can't read the config, consider it for cleanup
            const stats = fs.statSync(sessionPath);
            if (stats.mtime < cutoffDate) {
              fs.rmSync(sessionPath, { recursive: true, force: true });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning up old sessions:', error);
    }
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();