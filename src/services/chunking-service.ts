import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { CodeChunk } from './rag-service';
import { RAGConfig } from '../utils/rag-config';
import { CodeParser } from '../utils/code-parser';
import { RAGConfigManager } from '../utils/rag-config';

export interface ChunkingStats {
  totalFiles: number;
  processedFiles: number;
  totalChunks: number;
  skippedFiles: number;
  errors: string[];
}

export class ChunkingService {
  private config: RAGConfig;
  private projectPath: string;

  constructor(projectPath: string = process.cwd(), config?: RAGConfig) {
    this.projectPath = projectPath;
    this.config = config || RAGConfigManager.loadConfig(projectPath);
  }

  async chunkProject(): Promise<{ chunks: CodeChunk[]; stats: ChunkingStats }> {
    const stats: ChunkingStats = {
      totalFiles: 0,
      processedFiles: 0,
      totalChunks: 0,
      skippedFiles: 0,
      errors: []
    };

    const chunks: CodeChunk[] = [];

    try {
      // Find all files matching include patterns
      const allFiles = await this.findFiles();
      stats.totalFiles = allFiles.length;

      console.log(`📁 Found ${allFiles.length} files to process`);

      // Process files in batches to avoid memory issues
      const batchSize = 50;
      for (let i = 0; i < allFiles.length; i += batchSize) {
        const batch = allFiles.slice(i, i + batchSize);
        
        for (const filePath of batch) {
          try {
            const fileChunks = await this.chunkFile(filePath);
            chunks.push(...fileChunks);
            stats.processedFiles++;
            stats.totalChunks += fileChunks.length;

            if (stats.processedFiles % 10 === 0) {
              console.log(`📊 Processed ${stats.processedFiles}/${stats.totalFiles} files (${stats.totalChunks} chunks)`);
            }
          } catch (error: any) {
            stats.skippedFiles++;
            stats.errors.push(`${filePath}: ${error.message}`);
            console.warn(`⚠️  Skipped ${filePath}: ${error.message}`);
          }
        }
      }

      console.log(`✅ Chunking complete: ${stats.processedFiles} files, ${stats.totalChunks} chunks`);
      
      if (stats.errors.length > 0) {
        console.warn(`⚠️  Encountered ${stats.errors.length} errors during chunking`);
      }

      return { chunks, stats };
    } catch (error: any) {
      stats.errors.push(`Project chunking failed: ${error.message}`);
      throw error;
    }
  }

  async chunkFile(filePath: string): Promise<CodeChunk[]> {
    try {
      // Check if file should be excluded
      if (this.shouldExcludeFile(filePath)) {
        return [];
      }

      // Check file size before reading
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(this.projectPath, filePath);
      const stats = fs.statSync(absolutePath);
      const fileSizeKB = stats.size / 1024;
      
      // Skip files that exceed the configured size limit
      const maxFileSizeKB = this.config.maxFileSizeKB || 500;
      if (fileSizeKB > maxFileSizeKB) {
        console.warn(`⚠️  Skipping large file: ${filePath} (${Math.round(fileSizeKB)}KB > ${maxFileSizeKB}KB limit)`);
        return [];
      }

      // Read file content
      const content = fs.readFileSync(absolutePath, 'utf-8');

      // Skip empty files
      if (content.trim().length === 0) {
        return [];
      }

      // Use logical chunking if enabled and supported
      if (this.config.chunkingStrategy === 'logical') {
        const chunks = CodeParser.parseFile(filePath, content);
        
        // If logical parsing failed or produced no chunks, fall back to fixed chunking
        if (chunks.length === 0) {
          return this.createFixedChunks(filePath, content);
        }
        
        return chunks;
      } else {
        return this.createFixedChunks(filePath, content);
      }
    } catch (error: any) {
      throw new Error(`Failed to chunk file ${filePath}: ${error.message}`);
    }
  }

  private async findFiles(): Promise<string[]> {
    const allFiles: string[] = [];

    // Process each include pattern
    for (const pattern of this.config.includePatterns) {
      try {
        const files = await glob(pattern, {
          cwd: this.projectPath,
          ignore: this.config.excludePatterns,
          nodir: true,
          absolute: false
        });
        
        console.log(`📁 Pattern "${pattern}": found ${files.length} files`);
        allFiles.push(...files);
      } catch (error) {
        console.warn(`⚠️  Failed to process pattern ${pattern}:`, error);
      }
    }

    // Remove duplicates and sort
    const uniqueFiles = [...new Set(allFiles)].sort();
    
    // Limit the number of files to process
    const maxFiles = this.config.maxFiles || 1000;
    if (uniqueFiles.length > maxFiles) {
      console.warn(`⚠️  Too many files found (${uniqueFiles.length}), limiting to ${maxFiles} for performance`);
      return uniqueFiles.slice(0, maxFiles);
    }
    
    return uniqueFiles;
  }

  private shouldExcludeFile(filePath: string): boolean {
    const relativePath = path.relative(this.projectPath, filePath);
    
    // Check exclude patterns
    for (const pattern of this.config.excludePatterns) {
      // Convert glob pattern to regex for testing
      const regexPattern = pattern
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '[^/]');
      
      const regex = new RegExp(`^${regexPattern}$`);
      if (regex.test(relativePath) || regex.test(filePath)) {
        return true;
      }
    }

    return false;
  }

  private createFixedChunks(filePath: string, content: string): CodeChunk[] {
    const maxChunkSize = 2000; // characters
    const overlap = 200; // characters overlap between chunks
    
    if (content.length <= maxChunkSize) {
      // File is small enough to be a single chunk
      return [{
        id: this.generateChunkId(filePath, 'file', 'complete', 1),
        content,
        filePath,
        type: 'file',
        name: 'complete',
        startLine: 1,
        endLine: content.split('\n').length,
        metadata: {
          language: this.getLanguageFromPath(filePath),
          size: content.length,
          chunkingStrategy: 'fixed'
        }
      }];
    }

    const chunks: CodeChunk[] = [];
    const lines = content.split('\n');
    let currentPos = 0;
    let chunkIndex = 1;

    while (currentPos < content.length) {
      const chunkEnd = Math.min(currentPos + maxChunkSize, content.length);
      const chunkContent = content.substring(currentPos, chunkEnd);
      
      // Try to end chunk at a line boundary
      let adjustedEnd = chunkEnd;
      if (chunkEnd < content.length) {
        const remainingContent = content.substring(chunkEnd);
        const nextNewline = remainingContent.indexOf('\n');
        if (nextNewline !== -1 && nextNewline < 100) {
          adjustedEnd = chunkEnd + nextNewline;
        }
      }

      const finalChunkContent = content.substring(currentPos, adjustedEnd);
      const startLine = content.substring(0, currentPos).split('\n').length;
      const endLine = content.substring(0, adjustedEnd).split('\n').length;

      chunks.push({
        id: this.generateChunkId(filePath, 'file', `chunk-${chunkIndex}`, startLine),
        content: finalChunkContent,
        filePath,
        type: 'file',
        name: `chunk-${chunkIndex}`,
        startLine,
        endLine,
        metadata: {
          language: this.getLanguageFromPath(filePath),
          size: finalChunkContent.length,
          chunkingStrategy: 'fixed',
          chunkIndex,
          totalChunks: 0 // Will be updated after all chunks are created
        }
      });

      currentPos = adjustedEnd - overlap;
      chunkIndex++;
    }

    // Update total chunks count
    chunks.forEach(chunk => {
      chunk.metadata.totalChunks = chunks.length;
    });

    return chunks;
  }

  private generateChunkId(filePath: string, type: string, name: string, startLine: number): string {
    const identifier = `${filePath}:${type}:${name}:${startLine}`;
    return Buffer.from(identifier).toString('base64').substring(0, 16);
  }

  private getLanguageFromPath(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.h': 'c',
      '.go': 'go',
      '.rs': 'rust',
      '.php': 'php',
      '.rb': 'ruby',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.cs': 'csharp',
      '.scala': 'scala',
      '.clj': 'clojure',
      '.sh': 'shell',
      '.yml': 'yaml',
      '.yaml': 'yaml',
      '.json': 'json',
      '.md': 'markdown'
    };
    
    return languageMap[ext] || 'text';
  }

  updateConfig(newConfig: RAGConfig): void {
    this.config = newConfig;
  }

  getConfig(): RAGConfig {
    return { ...this.config };
  }

  async getProjectStats(): Promise<{
    totalFiles: number;
    includedFiles: number;
    excludedFiles: number;
    estimatedChunks: number;
  }> {
    try {
      const allFiles = await this.findFiles();
      const includedFiles = allFiles.length;
      
      // Get total files in project (rough estimate)
      const allProjectFiles = await glob('**/*', {
        cwd: this.projectPath,
        nodir: true,
        absolute: false
      });
      
      const totalFiles = allProjectFiles.length;
      const excludedFiles = totalFiles - includedFiles;
      
      // Estimate chunks (assume average 3 chunks per file for logical, 1 for fixed)
      const avgChunksPerFile = this.config.chunkingStrategy === 'logical' ? 3 : 1;
      const estimatedChunks = includedFiles * avgChunksPerFile;

      return {
        totalFiles,
        includedFiles,
        excludedFiles,
        estimatedChunks
      };
    } catch (error) {
      console.error('Failed to get project stats:', error);
      return {
        totalFiles: 0,
        includedFiles: 0,
        excludedFiles: 0,
        estimatedChunks: 0
      };
    }
  }
}