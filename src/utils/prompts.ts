import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface CustomPrompt {
  name: string;
  content: string;
  dateAdded: string;
}

interface PromptsStorage {
  prompts: CustomPrompt[];
}

const getStorageFile = (): string => {
  const homeDir = os.homedir();
  const gigaDir = path.join(homeDir, '.giga');
  
  // Create .giga directory if it doesn't exist
  if (!fs.existsSync(gigaDir)) {
    fs.mkdirSync(gigaDir, { mode: 0o700 });
  }
  
  return path.join(gigaDir, 'prompts.json');
};

export function loadPrompts(): CustomPrompt[] {
  try {
    const storageFile = getStorageFile();
    
    if (!fs.existsSync(storageFile)) {
      return [];
    }
    
    const data: PromptsStorage = JSON.parse(fs.readFileSync(storageFile, 'utf8'));
    return data.prompts || [];
  } catch (error) {
    console.error('Error loading prompts:', error);
    return [];
  }
}

export function savePrompts(prompts: CustomPrompt[]): void {
  try {
    const storageFile = getStorageFile();
    const data: PromptsStorage = { prompts };
    
    fs.writeFileSync(storageFile, JSON.stringify(data, null, 2), { mode: 0o600 });
  } catch (error) {
    console.error('Error saving prompts:', error);
  }
}

export function addPrompt(name: string, content: string): void {
  const prompts = loadPrompts();
  
  // Check if prompt already exists
  const exists = prompts.some(p => p.name === name);
  if (!exists) {
    const newPrompt: CustomPrompt = {
      name,
      content,
      dateAdded: new Date().toISOString(),
    };
    
    prompts.push(newPrompt);
    savePrompts(prompts);
  }
}

export function deletePrompt(name: string): boolean {
  const prompts = loadPrompts();
  const initialLength = prompts.length;
  
  const filteredPrompts = prompts.filter(p => p.name !== name);
  
  if (filteredPrompts.length < initialLength) {
    savePrompts(filteredPrompts);
    return true;
  }
  
  return false;
}

export function getAllPrompts(): CustomPrompt[] {
  return loadPrompts();
}

export function getPromptByName(name: string): CustomPrompt | undefined {
  const prompts = loadPrompts();
  return prompts.find(p => p.name === name);
}

export function isPromptExists(name: string): boolean {
  const prompts = loadPrompts();
  return prompts.some(p => p.name === name);
}

export function getPromptsAsSystemPrompt(): string {
  const prompts = loadPrompts();
  if (prompts.length === 0) {
    return '';
  }
  
  return prompts.map(prompt => prompt.content).join('\n\n');
}