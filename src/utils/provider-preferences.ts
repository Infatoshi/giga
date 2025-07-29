import * as fs from "fs";
import * as path from "path";
import { sessionManager } from "./session-manager";

export interface ModelProviderPreference {
  modelId: string;
  preferredProvider: string;
  providerName: string;
  dateAdded: string;
  lastUsed: string;
}

export interface ProviderPreferences {
  instanceId: string;
  modelProviderMap: ModelProviderPreference[];
  lastUpdated: string;
}

const getProviderPreferencesPath = (): string => {
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
  
  return path.join(sessionDir, 'provider-preferences.json');
};

export function loadProviderPreferences(): ProviderPreferences {
  try {
    const preferencesPath = getProviderPreferencesPath();
    const sessionInfo = sessionManager.getSessionInfo();
    
    if (!sessionInfo) {
      throw new Error('No active session found');
    }
    
    if (!fs.existsSync(preferencesPath)) {
      // Return default preferences for new session
      return {
        instanceId: sessionInfo.instanceId,
        modelProviderMap: [],
        lastUpdated: new Date().toISOString()
      };
    }
    
    const data: ProviderPreferences = JSON.parse(fs.readFileSync(preferencesPath, 'utf8'));
    return data;
  } catch (error) {
    console.error('Error loading provider preferences:', error);
    const sessionInfo = sessionManager.getSessionInfo();
    return {
      instanceId: sessionInfo?.instanceId || 'unknown',
      modelProviderMap: [],
      lastUpdated: new Date().toISOString()
    };
  }
}

export function saveProviderPreferences(preferences: ProviderPreferences): void {
  try {
    const preferencesPath = getProviderPreferencesPath();
    preferences.lastUpdated = new Date().toISOString();
    
    fs.writeFileSync(
      preferencesPath, 
      JSON.stringify(preferences, null, 2), 
      { mode: 0o600 }
    );
  } catch (error) {
    console.error('Error saving provider preferences:', error);
  }
}

export function setModelProviderPreference(
  modelId: string, 
  providerId: string, 
  providerName: string
): void {
  try {
    const preferences = loadProviderPreferences();
    const now = new Date().toISOString();
    
    // Remove existing preference for this model
    preferences.modelProviderMap = preferences.modelProviderMap.filter(
      p => p.modelId !== modelId
    );
    
    // Add new preference
    preferences.modelProviderMap.push({
      modelId,
      preferredProvider: providerId,
      providerName,
      dateAdded: now,
      lastUsed: now
    });
    
    saveProviderPreferences(preferences);
  } catch (error) {
    console.error('Error setting model provider preference:', error);
  }
}

export function getModelProviderPreference(modelId: string): ModelProviderPreference | null {
  try {
    const preferences = loadProviderPreferences();
    return preferences.modelProviderMap.find(p => p.modelId === modelId) || null;
  } catch (error) {
    console.error('Error getting model provider preference:', error);
    return null;
  }
}

export function updateModelProviderLastUsed(modelId: string): void {
  try {
    const preferences = loadProviderPreferences();
    const preference = preferences.modelProviderMap.find(p => p.modelId === modelId);
    
    if (preference) {
      preference.lastUsed = new Date().toISOString();
      saveProviderPreferences(preferences);
    }
  } catch (error) {
    console.error('Error updating model provider last used:', error);
  }
}

export function removeModelProviderPreference(modelId: string): void {
  try {
    const preferences = loadProviderPreferences();
    preferences.modelProviderMap = preferences.modelProviderMap.filter(
      p => p.modelId !== modelId
    );
    saveProviderPreferences(preferences);
  } catch (error) {
    console.error('Error removing model provider preference:', error);
  }
}

export function getAllModelProviderPreferences(): ModelProviderPreference[] {
  try {
    const preferences = loadProviderPreferences();
    return preferences.modelProviderMap.sort((a, b) => 
      new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
    );
  } catch (error) {
    console.error('Error getting all model provider preferences:', error);
    return [];
  }
}