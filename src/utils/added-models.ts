import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface AddedModel {
  modelName: string;
  providerName: string;
  dateAdded: string;
  openRouterProvider?: string; // For OpenRouter models, stores the preferred compute provider (e.g., "Groq", "Cerebras")
}

interface AddedModelsStorage {
  models: AddedModel[];
}

const getStorageFile = (): string => {
  const homeDir = os.homedir();
  const gigaDir = path.join(homeDir, '.giga');
  
  // Create .giga directory if it doesn't exist
  if (!fs.existsSync(gigaDir)) {
    fs.mkdirSync(gigaDir, { mode: 0o700 });
  }
  
  return path.join(gigaDir, 'added-models.json');
};

export function loadAddedModels(): AddedModel[] {
  try {
    const storageFile = getStorageFile();
    
    if (!fs.existsSync(storageFile)) {
      return [];
    }
    
    const data: AddedModelsStorage = JSON.parse(fs.readFileSync(storageFile, 'utf8'));
    return data.models || [];
  } catch (error) {
    console.error('Error loading added models:', error);
    return [];
  }
}

export function saveAddedModels(models: AddedModel[]): void {
  try {
    const storageFile = getStorageFile();
    const data: AddedModelsStorage = { models };
    
    fs.writeFileSync(storageFile, JSON.stringify(data, null, 2), { mode: 0o600 });
  } catch (error) {
    console.error('Error saving added models:', error);
  }
}

export function addModel(modelName: string, providerName: string): void {
  const models = loadAddedModels();
  
  // Check if model already exists
  const exists = models.some(m => m.modelName === modelName && m.providerName === providerName);
  if (!exists) {
    const newModel: AddedModel = {
      modelName,
      providerName,
      dateAdded: new Date().toISOString(),
    };
    
    models.push(newModel);
    saveAddedModels(models);
  }
}

export function deleteModel(modelName: string, providerName: string): boolean {
  const models = loadAddedModels();
  const initialLength = models.length;
  
  const filteredModels = models.filter(m => 
    !(m.modelName === modelName && m.providerName === providerName)
  );
  
  if (filteredModels.length < initialLength) {
    saveAddedModels(filteredModels);
    return true;
  }
  
  return false;
}

export function getAddedModelsForProvider(providerName: string): AddedModel[] {
  const models = loadAddedModels();
  return models.filter(m => m.providerName === providerName);
}

export function getAllAddedModels(): AddedModel[] {
  return loadAddedModels();
}

export function isModelAdded(modelName: string, providerName: string): boolean {
  const models = loadAddedModels();
  return models.some(m => m.modelName === modelName && m.providerName === providerName);
}

export function setOpenRouterProvider(modelName: string, openRouterProvider: string): boolean {
  const models = loadAddedModels();
  console.log(`DEBUG: Looking for model ${modelName} with provider OpenRouter`);
  console.log(`DEBUG: Available models:`, models.map(m => `${m.modelName} (${m.providerName})`));
  
  const modelIndex = models.findIndex(m => m.modelName === modelName && m.providerName === 'OpenRouter');
  console.log(`DEBUG: Found model at index: ${modelIndex}`);
  
  if (modelIndex === -1) {
    console.log(`DEBUG: Model ${modelName} not found or not an OpenRouter model`);
    return false; // Model not found or not an OpenRouter model
  }
  
  console.log(`DEBUG: Setting openRouterProvider to ${openRouterProvider} for ${modelName}`);
  models[modelIndex].openRouterProvider = openRouterProvider;
  saveAddedModels(models);
  return true;
}

export function getOpenRouterProvider(modelName: string): string | null {
  const models = loadAddedModels();
  const model = models.find(m => m.modelName === modelName && m.providerName === 'OpenRouter');
  return model?.openRouterProvider || null;
}