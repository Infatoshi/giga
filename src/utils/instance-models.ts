import * as fs from "fs";
import * as path from "path";
import { sessionManager } from "./session-manager";
import { AddedModel, loadAddedModels, saveAddedModels } from "./added-models";

export interface InstanceModelPreferences {
  instanceId: string;
  favoriteModels: string[];
  recentlyUsedModels: string[];
  lastUpdated: string;
}

const getInstancePreferencesPath = (): string => {
  const sessionInfo = sessionManager.getSessionInfo();
  if (!sessionInfo) {
    throw new Error('No active session found');
  }
  
  const homeDir = require('os').homedir();
  const sessionDir = path.join(homeDir, '.giga', 'sessions', sessionInfo.instanceId);
  
  // Ensure session directory exists
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true, mode: 0o700 });
  }
  
  return path.join(sessionDir, 'model-preferences.json');
};

export function loadInstanceModelPreferences(): InstanceModelPreferences {
  try {
    const preferencesPath = getInstancePreferencesPath();
    const sessionInfo = sessionManager.getSessionInfo();
    
    if (!sessionInfo) {
      throw new Error('No active session found');
    }
    
    if (!fs.existsSync(preferencesPath)) {
      // Return default preferences for new session
      return {
        instanceId: sessionInfo.instanceId,
        favoriteModels: [],
        recentlyUsedModels: [sessionInfo.currentModel],
        lastUpdated: new Date().toISOString()
      };
    }
    
    const data: InstanceModelPreferences = JSON.parse(fs.readFileSync(preferencesPath, 'utf8'));
    return data;
  } catch (error) {
    console.error('Error loading instance model preferences:', error);
    const sessionInfo = sessionManager.getSessionInfo();
    return {
      instanceId: sessionInfo?.instanceId || 'unknown',
      favoriteModels: [],
      recentlyUsedModels: [],
      lastUpdated: new Date().toISOString()
    };
  }
}

export function saveInstanceModelPreferences(preferences: InstanceModelPreferences): void {
  try {
    const preferencesPath = getInstancePreferencesPath();
    preferences.lastUpdated = new Date().toISOString();
    
    fs.writeFileSync(
      preferencesPath, 
      JSON.stringify(preferences, null, 2), 
      { mode: 0o600 }
    );
  } catch (error) {
    console.error('Error saving instance model preferences:', error);
  }
}

export function addModelToRecentlyUsed(modelName: string): void {
  try {
    const preferences = loadInstanceModelPreferences();
    
    // Remove model if it already exists in the list
    preferences.recentlyUsedModels = preferences.recentlyUsedModels.filter(m => m !== modelName);
    
    // Add to the beginning of the list
    preferences.recentlyUsedModels.unshift(modelName);
    
    // Keep only the last 10 recently used models
    preferences.recentlyUsedModels = preferences.recentlyUsedModels.slice(0, 10);
    
    saveInstanceModelPreferences(preferences);
  } catch (error) {
    console.error('Error adding model to recently used:', error);
  }
}

export function toggleModelFavorite(modelName: string): boolean {
  try {
    const preferences = loadInstanceModelPreferences();
    
    const isFavorite = preferences.favoriteModels.includes(modelName);
    
    if (isFavorite) {
      // Remove from favorites
      preferences.favoriteModels = preferences.favoriteModels.filter(m => m !== modelName);
    } else {
      // Add to favorites
      preferences.favoriteModels.push(modelName);
    }
    
    saveInstanceModelPreferences(preferences);
    return !isFavorite; // Return new favorite status
  } catch (error) {
    console.error('Error toggling model favorite:', error);
    return false;
  }
}

export function getInstanceAvailableModels(): { model: string; description: string; isFavorite: boolean; isRecentlyUsed: boolean }[] {
  try {
    const preferences = loadInstanceModelPreferences();
    const globalModels = loadAddedModels();
    
    // Only show global added models (no built-in models)
    const modelsWithPreferences = globalModels.map(m => ({
      model: m.modelName,
      description: `${m.modelName} (${m.providerName})`,
      isFavorite: preferences.favoriteModels.includes(m.modelName),
      isRecentlyUsed: preferences.recentlyUsedModels.includes(m.modelName)
    }));
    
    // Sort: favorites first, then recently used, then alphabetically
    return modelsWithPreferences.sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      if (a.isRecentlyUsed && !b.isRecentlyUsed) return -1;
      if (!a.isRecentlyUsed && b.isRecentlyUsed) return 1;
      return a.model.localeCompare(b.model);
    });
  } catch (error) {
    console.error('Error getting instance available models:', error);
    return [];
  }
}

// Update recently used when model is selected
export function onModelSelected(modelName: string): void {
  addModelToRecentlyUsed(modelName);
  sessionManager.setCurrentModel(modelName);
}