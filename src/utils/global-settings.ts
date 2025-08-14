import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface GlobalSettings {
  // Empty for now - can add other settings later
}

const SETTINGS_DIR = path.join(os.homedir(), '.giga');
const SETTINGS_FILE = path.join(SETTINGS_DIR, 'settings.json');

export class GlobalSettingsManager {
  private static instance: GlobalSettingsManager;
  
  private constructor() {}

  static getInstance(): GlobalSettingsManager {
    if (!GlobalSettingsManager.instance) {
      GlobalSettingsManager.instance = new GlobalSettingsManager();
    }
    return GlobalSettingsManager.instance;
  }

  private ensureSettingsDir(): void {
    if (!fs.existsSync(SETTINGS_DIR)) {
      fs.mkdirSync(SETTINGS_DIR, { recursive: true });
    }
  }

  getSettings(): GlobalSettings {
    this.ensureSettingsDir();
    
    if (!fs.existsSync(SETTINGS_FILE)) {
      const defaultSettings: GlobalSettings = {};
      this.saveSettings(defaultSettings);
      return defaultSettings;
    }

    try {
      const settingsContent = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      const settings = JSON.parse(settingsContent) as GlobalSettings;
      
      return { ...settings };
    } catch (error) {
      console.warn('Failed to load global settings, using defaults:', error);
      const defaultSettings: GlobalSettings = {};
      return defaultSettings;
    }
  }

  saveSettings(settings: GlobalSettings): void {
    this.ensureSettingsDir();
    
    try {
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    } catch (error) {
      console.error('Failed to save global settings:', error);
      throw error;
    }
  }

  updateSettings(updates: Partial<GlobalSettings>): GlobalSettings {
    const currentSettings = this.getSettings();
    const newSettings = { ...currentSettings, ...updates };
    this.saveSettings(newSettings);
    return newSettings;
  }

}