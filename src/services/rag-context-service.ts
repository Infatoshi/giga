import { RAGService, SearchResult } from './rag-service';
import { ChunkingService } from './chunking-service';
import { RAGConfigManager } from '../utils/rag-config';
import { PromptEnhancer, EnhancedPrompt } from '../utils/prompt-enhancer';
import * as path from 'path';

export interface ContextEnrichmentResult {
  shouldEnrich: boolean;
  enhancedPrompt: string;
  relevantContext: string;
  searchResults: SearchResult[];
  confidence: number;
  processedOriginal: EnhancedPrompt;
}

export class RAGContextService {
  private ragService: RAGService;
  private chunkingService: ChunkingService;
  private initialized: boolean = false;
  private projectPath: string;

  constructor(projectPath: string = process.cwd()) {
    this.projectPath = projectPath;
    const config = RAGConfigManager.loadConfig(projectPath);
    
    this.ragService = new RAGService(projectPath, config);
    this.chunkingService = new ChunkingService(projectPath, config);
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.ragService.initialize();
      this.initialized = true;
    } catch (error) {
      console.warn('⚠️ RAG context service unavailable (ChromaDB not accessible)');
      // Don't throw - allow GIGA to work without RAG
      this.initialized = false;
    }
  }

  async enrichUserPrompt(
    userPrompt: string, 
    recentBashOutput?: string,
    conversationHistory?: string[]
  ): Promise<ContextEnrichmentResult> {
    
    // Check if RAG is enabled
    const config = RAGConfigManager.loadConfig(this.projectPath);
    if (!config.enabled) {
      return {
        shouldEnrich: false,
        enhancedPrompt: userPrompt,
        relevantContext: '',
        searchResults: [],
        confidence: 0,
        processedOriginal: {
          originalPrompt: userPrompt,
          enhancedPrompt: userPrompt,
          extractedFiles: [],
          extractedKeywords: [],
          detectedIntent: PromptEnhancer.extractMainTopic(userPrompt) as any,
          suggestedSearchQueries: [],
          confidence: 0
        }
      };
    }

    try {
      await this.initialize();

      // If RAG initialization failed, return without enrichment
      if (!this.initialized) {
        const enhanced = PromptEnhancer.enhancePrompt(userPrompt, recentBashOutput);
        return {
          shouldEnrich: false,
          enhancedPrompt: enhanced.enhancedPrompt,
          relevantContext: '',
          searchResults: [],
          confidence: enhanced.confidence,
          processedOriginal: enhanced
        };
      }

      // Process and enhance the prompt
      const enhanced = PromptEnhancer.enhancePrompt(userPrompt, recentBashOutput);
      
      // Determine if we should enrich based on various factors
      const shouldEnrich = this.shouldEnrichPrompt(enhanced, conversationHistory);
      
      if (!shouldEnrich) {
        return {
          shouldEnrich: false,
          enhancedPrompt: enhanced.enhancedPrompt,
          relevantContext: '',
          searchResults: [],
          confidence: enhanced.confidence,
          processedOriginal: enhanced
        };
      }

      // Perform semantic search using the enhanced queries
      const searchResults = await this.performContextualSearch(enhanced);
      
      // Generate relevant context from search results
      const relevantContext = this.generateRelevantContext(searchResults, enhanced);
      
      // Create final enriched prompt
      const finalEnhancedPrompt = this.createContextEnrichedPrompt(
        enhanced.enhancedPrompt, 
        relevantContext,
        enhanced
      );

      return {
        shouldEnrich: true,
        enhancedPrompt: finalEnhancedPrompt,
        relevantContext,
        searchResults,
        confidence: Math.max(enhanced.confidence, searchResults.length > 0 ? 0.7 : 0.3),
        processedOriginal: enhanced
      };

    } catch (error) {
      console.error('Failed to enrich prompt with context:', error);
      
      // Fallback to basic enhancement
      const enhanced = PromptEnhancer.enhancePrompt(userPrompt, recentBashOutput);
      return {
        shouldEnrich: false,
        enhancedPrompt: enhanced.enhancedPrompt,
        relevantContext: '',
        searchResults: [],
        confidence: enhanced.confidence,
        processedOriginal: enhanced
      };
    }
  }

  private shouldEnrichPrompt(enhanced: EnhancedPrompt, conversationHistory?: string[]): boolean {
    // Always enrich if we have high confidence in the intent
    if (enhanced.confidence >= 0.7) {
      return true;
    }

    // Enrich if we found specific files or technical keywords
    if (enhanced.extractedFiles.length > 0 || enhanced.extractedKeywords.length >= 2) {
      return true;
    }

    // Always enrich search queries - they need RAG context
    if (enhanced.detectedIntent === 'search') {
      return true;
    }

    // Enrich if the prompt seems to be about code analysis or error fixing
    if (enhanced.detectedIntent === 'code_analysis' || enhanced.detectedIntent === 'error_fixing') {
      return true;
    }

    // Enrich if the prompt is very short and might benefit from context
    if (enhanced.originalPrompt.trim().split(' ').length <= 5) {
      return true;
    }

    // Don't enrich for very general conversations
    if (enhanced.detectedIntent === 'general' && enhanced.extractedFiles.length === 0) {
      return false;
    }

    return false;
  }

  private async performContextualSearch(enhanced: EnhancedPrompt): Promise<SearchResult[]> {
    const allResults: SearchResult[] = [];
    const seenChunks = new Set<string>();

    // Search using original prompt
    const originalResults = await this.ragService.search(enhanced.originalPrompt, 3);
    for (const result of originalResults) {
      if (!seenChunks.has(result.chunk.id)) {
        allResults.push(result);
        seenChunks.add(result.chunk.id);
      }
    }

    // Search using suggested queries
    for (const query of enhanced.suggestedSearchQueries.slice(0, 3)) { // Limit to first 3
      try {
        const queryResults = await this.ragService.search(query, 2);
        for (const result of queryResults) {
          if (!seenChunks.has(result.chunk.id)) {
            allResults.push(result);
            seenChunks.add(result.chunk.id);
          }
        }
      } catch (error) {
        console.warn(`Failed to search for query "${query}":`, error);
      }
    }

    // Search for specific files mentioned
    for (const file of enhanced.extractedFiles.slice(0, 2)) { // Limit to first 2
      try {
        const fileName = path.basename(file);
        const fileResults = await this.ragService.search(fileName, 2);
        for (const result of fileResults) {
          if (!seenChunks.has(result.chunk.id)) {
            allResults.push(result);
            seenChunks.add(result.chunk.id);
          }
        }
      } catch (error) {
        console.warn(`Failed to search for file "${file}":`, error);
      }
    }

    // Sort by score and return top results
    return allResults
      .sort((a, b) => b.score - a.score)
      .slice(0, 5); // Limit total results
  }

  private generateRelevantContext(searchResults: SearchResult[], enhanced: EnhancedPrompt): string {
    if (searchResults.length === 0) {
      return '';
    }

    const contextParts: string[] = [];
    
    // For search queries, show clean RAG results with percentages
    if (enhanced.detectedIntent === 'search') {
      contextParts.push(`🔍 RAG Search Results for "${enhanced.originalPrompt}":\n`);
      
      for (let i = 0; i < Math.min(searchResults.length, 5); i++) {
        const result = searchResults[i];
        const chunk = result.chunk;
        const percentage = Math.round(result.score * 100);
        const filePath = path.relative(this.projectPath, chunk.filePath);
        
        // Format: ├── 📄 file:line (95% match)
        const icon = i === searchResults.length - 1 || i === 4 ? '└──' : '├──';
        contextParts.push(`${icon} 📄 ${filePath}${chunk.startLine ? `:${chunk.startLine}` : ''} (${percentage}% match)`);
        
        // Show a preview of the code
        const preview = chunk.content.length > 100 
          ? chunk.content.substring(0, 100).trim() + '...'
          : chunk.content.trim();
        
        contextParts.push(`│   ├── Code: ${preview.split('\n')[0]}`);
        contextParts.push(`│   └── Context: ${chunk.type}${chunk.name ? ` "${chunk.name}"` : ''}`);
        
        if (i < Math.min(searchResults.length - 1, 4)) {
          contextParts.push('│');
        }
      }
      
      return contextParts.join('\n') + '\n';
    }

    // For non-search queries, use the existing detailed format
    contextParts.push('## Relevant Code Context\n');

    // Group results by file for better organization
    const resultsByFile = new Map<string, SearchResult[]>();
    for (const result of searchResults) {
      const filePath = result.chunk.filePath;
      if (!resultsByFile.has(filePath)) {
        resultsByFile.set(filePath, []);
      }
      resultsByFile.get(filePath)!.push(result);
    }

    // Add context for each file
    let contextLength = 0;
    const maxContextLength = 3000; // Limit total context length

    for (const [filePath, results] of resultsByFile.entries()) {
      if (contextLength >= maxContextLength) break;
      
      contextParts.push(`### ${path.relative(this.projectPath, filePath)}\n`);
      
      for (const result of results.slice(0, 2)) { // Max 2 chunks per file
        if (contextLength >= maxContextLength) break;
        
        const chunk = result.chunk;
        const preview = chunk.content.length > 500 
          ? chunk.content.substring(0, 500) + '...'
          : chunk.content;
        
        contextParts.push(`**${chunk.type}${chunk.name ? ` "${chunk.name}"` : ''}** (Score: ${result.score.toFixed(2)})`);
        contextParts.push('```' + (chunk.metadata.language || 'text'));
        contextParts.push(preview);
        contextParts.push('```\n');
        
        contextLength += preview.length;
      }
    }

    return contextParts.join('\n');
  }

  private createContextEnrichedPrompt(
    enhancedPrompt: string,
    relevantContext: string,
    enhanced: EnhancedPrompt
  ): string {
    if (!relevantContext.trim()) {
      return enhancedPrompt;
    }

    const parts: string[] = [];
    
    // Add the original enhanced prompt
    parts.push(enhancedPrompt);
    
    // Add a separator
    parts.push('\n---\n');
    
    // Add the relevant context
    parts.push(relevantContext);
    
    // Add instructions for using the context
    parts.push('\n**Instructions:**');
    parts.push('- Use the above code context to provide more accurate and specific responses');
    parts.push('- Reference specific files, functions, or code patterns when relevant');
    parts.push('- If the context doesn\'t seem relevant, feel free to ignore it and respond based on your general knowledge');
    
    return parts.join('\n');
  }

  async indexProject(): Promise<void> {
    try {
      await this.initialize();
      
      console.log('🚀 Starting project indexing...');
      const { chunks, stats } = await this.chunkingService.chunkProject();
      
      if (chunks.length === 0) {
        console.log('⚠️  No chunks to index');
        return;
      }
      
      await this.ragService.indexChunks(chunks);
      
      console.log(`✅ Indexing complete:`);
      console.log(`   - Files processed: ${stats.processedFiles}/${stats.totalFiles}`);
      console.log(`   - Total chunks: ${stats.totalChunks}`);
      console.log(`   - Skipped files: ${stats.skippedFiles}`);
      
      if (stats.errors.length > 0) {
        console.log(`   - Errors: ${stats.errors.length}`);
      }
      
    } catch (error) {
      console.error('Failed to index project:', error);
      throw error;
    }
  }

  async searchCode(query: string, maxResults: number = 5): Promise<SearchResult[]> {
    try {
      await this.initialize();
      return await this.ragService.search(query, maxResults);
    } catch (error) {
      console.error('Failed to search code:', error);
      return [];
    }
  }

  async getIndexInfo(): Promise<{ count: number; enabled: boolean }> {
    try {
      await this.initialize();
      const info = await this.ragService.getCollectionInfo();
      return {
        count: info.count,
        enabled: info.config.enabled
      };
    } catch (error) {
      console.error('Failed to get index info:', error);
      return { count: 0, enabled: false };
    }
  }

  async clearIndex(): Promise<void> {
    try {
      await this.initialize();
      await this.ragService.clearCollection();
      console.log('✅ Index cleared successfully');
    } catch (error) {
      console.error('Failed to clear index:', error);
      throw error;
    }
  }

  updateConfig(updates: any): void {
    const newConfig = RAGConfigManager.updateConfig(updates, this.projectPath);
    this.ragService.updateConfig(newConfig);
    this.chunkingService.updateConfig(newConfig);
  }

  isEnabled(): boolean {
    return RAGConfigManager.isRAGEnabled(this.projectPath);
  }
}