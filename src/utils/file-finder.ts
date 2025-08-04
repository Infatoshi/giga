import * as fs from 'fs';
import * as path from 'path';

export interface FileInfo {
  name: string;
  relativePath: string;
  isDirectory: boolean;
}

/**
 * Get all files in the current directory and subdirectories
 */
export function getAllFiles(rootDir: string = process.cwd(), maxDepth: number = 3): FileInfo[] {
  const files: FileInfo[] = [];
  
  function walkDirectory(dir: string, currentDepth: number = 0) {
    if (currentDepth > maxDepth) return;
    
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        // Skip hidden files and common ignore patterns
        if (entry.name.startsWith('.') || 
            entry.name === 'node_modules' || 
            entry.name === 'dist' || 
            entry.name === 'build' ||
            entry.name === '.git') {
          continue;
        }
        
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(rootDir, fullPath);
        
        if (entry.isDirectory()) {
          files.push({
            name: entry.name,
            relativePath,
            isDirectory: true
          });
          walkDirectory(fullPath, currentDepth + 1);
        } else {
          files.push({
            name: entry.name,
            relativePath,
            isDirectory: false
          });
        }
      }
    } catch (error) {
      // Ignore permission errors and continue
    }
  }
  
  walkDirectory(rootDir);
  return files;
}

/**
 * Extract file search query from input text after @ symbol
 * Only returns a result if @ is the last "word" (no spaces after @)
 */
export function extractFileQuery(input: string): { beforeAt: string; query: string; afterAt: string; isDirectory: boolean } | null {
  const atIndex = input.lastIndexOf('@');
  if (atIndex === -1) return null;
  
  // Check if there are any spaces after the @ symbol
  const afterAt = input.substring(atIndex + 1);
  if (afterAt.includes(' ')) {
    // There's a space after @, so this is not an active file query
    return null;
  }
  
  const beforeAt = input.substring(0, atIndex);
  const query = afterAt; // Everything after @ until end of string
  const isDirectory = query.endsWith('/');
  
  // Only show file finder if there's at least the @ symbol
  // Allow empty query to show all files/directories
  return { beforeAt, query, afterAt: '', isDirectory };
}

/**
 * Filter files to get only files or only directories based on query
 */
export function getFilteredItems(files: FileInfo[], query: string, isDirectory: boolean): string[] {
  // Remove trailing slash for directory search
  const searchQuery = isDirectory ? query.slice(0, -1) : query;
  
  if (isDirectory) {
    // Filter for directories only
    let results = files
      .filter(file => file.isDirectory)
      .map(file => file.relativePath + '/');
    
    // If there's a search query, filter by it
    if (searchQuery) {
      results = results.filter(path => 
        path.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return results.sort().slice(0, 10); // Limit results
  } else {
    // Filter for files only
    let results = files
      .filter(file => !file.isDirectory)
      .map(file => file.relativePath);
    
    // If there's a search query, filter by it
    if (query) {
      results = results.filter(path => 
        path.toLowerCase().includes(query.toLowerCase())
      );
    }
    
    return results.sort().slice(0, 10); // Limit results
  }
}

/**
 * Replace the file query in input with the selected file path
 */
export function replaceFileQuery(input: string, selectedFile: string): string {
  const queryInfo = extractFileQuery(input);
  if (!queryInfo) return input;
  
  return queryInfo.beforeAt + selectedFile + queryInfo.afterAt;
}