import * as fs from 'fs';
import * as path from 'path';
import { getPromptsAsSystemPrompt } from './prompts';

export function loadCustomInstructions(workingDirectory: string = process.cwd()): string | null {
  try {
    const instructionsPath = path.join(workingDirectory, '.giga', 'GIGA.md');
    
    let customInstructions = '';
    
    // Load global custom prompts first
    const globalPrompts = getPromptsAsSystemPrompt();
    if (globalPrompts) {
      customInstructions += globalPrompts;
    }
    
    // Then load project-specific GIGA.md if it exists
    if (fs.existsSync(instructionsPath)) {
      const projectInstructions = fs.readFileSync(instructionsPath, 'utf-8');
      if (projectInstructions.trim()) {
        if (customInstructions) {
          customInstructions += '\n\n' + projectInstructions.trim();
        } else {
          customInstructions = projectInstructions.trim();
        }
      }
    }
    
    return customInstructions || null;
  } catch (error) {
    console.warn('Failed to load custom instructions:', error);
    return null;
  }
}