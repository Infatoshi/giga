import { ToolResult } from '../types';
import { RAGContextService } from '../services/rag-context-service';

export class SemanticSearchTool {
  private ragService: RAGContextService;

  constructor() {
    this.ragService = new RAGContextService();
  }

  async search(query: string, maxResults: number = 5): Promise<ToolResult> {
    try {
      if (!this.ragService.isEnabled()) {
        return {
          success: false,
          error: 'Semantic search is not enabled. Enable RAG in your .giga/rag-config.json file.'
        };
      }

      const results = await this.ragService.searchCode(query, maxResults);
      
      if (results.length === 0) {
        return {
          success: true,
          output: `No relevant code found for query: "${query}"\n\nTip: Try different keywords or make sure your project is indexed with 'giga index'`,
          metadata: {
            query,
            resultCount: 0
          }
        };
      }

      let output = `Found ${results.length} relevant code segments for: "${query}"\n\n`;
      
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const chunk = result.chunk;
        
        output += `## Result ${i + 1} (Score: ${result.score.toFixed(3)})\n`;
        output += `**File:** ${chunk.filePath}\n`;
        output += `**Type:** ${chunk.type}${chunk.name ? ` "${chunk.name}"` : ''}\n`;
        output += `**Lines:** ${chunk.startLine}-${chunk.endLine}\n`;
        
        if (chunk.metadata.language) {
          output += `**Language:** ${chunk.metadata.language}\n`;
        }
        
        output += '\n```' + (chunk.metadata.language || 'text') + '\n';
        
        // Limit content length for display
        const content = chunk.content.length > 800 
          ? chunk.content.substring(0, 800) + '\n... (truncated)'
          : chunk.content;
          
        output += content;
        output += '\n```\n\n';
      }

      return {
        success: true,
        output: output.trim(),
        metadata: {
          query,
          resultCount: results.length,
          results: results.map(r => ({
            filePath: r.chunk.filePath,
            type: r.chunk.type,
            name: r.chunk.name,
            score: r.score,
            startLine: r.chunk.startLine,
            endLine: r.chunk.endLine
          }))
        }
      };

    } catch (error: any) {
      return {
        success: false,
        error: `Semantic search failed: ${error.message}`
      };
    }
  }

  async indexProject(): Promise<ToolResult> {
    try {
      if (!this.ragService.isEnabled()) {
        return {
          success: false,
          error: 'RAG is not enabled. Enable it in your .giga/rag-config.json file.'
        };
      }

      const startTime = Date.now();
      await this.ragService.indexProject();
      const endTime = Date.now();
      
      const indexInfo = await this.ragService.getIndexInfo();
      
      return {
        success: true,
        output: `✅ Project indexing completed successfully!\n\n` +
               `📊 Index Statistics:\n` +
               `- Total chunks indexed: ${indexInfo.count}\n` +
               `- Time taken: ${((endTime - startTime) / 1000).toFixed(1)}s\n\n` +
               `You can now use semantic search to find relevant code in your project.`,
        metadata: {
          chunkCount: indexInfo.count,
          duration: endTime - startTime,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error: any) {
      return {
        success: false,
        error: `Project indexing failed: ${error.message}`
      };
    }
  }

  async getIndexStatus(): Promise<ToolResult> {
    try {
      const indexInfo = await this.ragService.getIndexInfo();
      
      let output = `📊 RAG Index Status:\n\n`;
      output += `- Local Config: ${indexInfo.enabled ? '✅ Enabled' : '❌ Disabled'}\n`;
      output += `- Indexed chunks: ${indexInfo.count}\n`;
      
      if (indexInfo.count === 0 && indexInfo.enabled) {
        output += `\n💡 Your project hasn't been indexed yet. Run the index command to enable semantic search.`;
      } else if (indexInfo.count > 0) {
        output += `\n✨ Semantic search is ready! Use the search command to find relevant code.`;
      }
      
      return {
        success: true,
        output,
        metadata: {
          enabled: indexInfo.enabled,
          chunkCount: indexInfo.count
        }
      };

    } catch (error: any) {
      return {
        success: false,
        error: `Failed to get index status: ${error.message}`
      };
    }
  }

  async clearIndex(): Promise<ToolResult> {
    try {
      if (!this.ragService.isEnabled()) {
        return {
          success: false,
          error: 'RAG is not enabled.'
        };
      }

      await this.ragService.clearIndex();
      
      return {
        success: true,
        output: '✅ Index cleared successfully. You can re-index your project anytime.',
        metadata: {
          action: 'clear',
          timestamp: new Date().toISOString()
        }
      };

    } catch (error: any) {
      return {
        success: false,
        error: `Failed to clear index: ${error.message}`
      };
    }
  }

  async updateConfig(updates: any): Promise<ToolResult> {
    try {
      this.ragService.updateConfig(updates);
      
      return {
        success: true,
        output: '✅ RAG configuration updated successfully.',
        metadata: {
          action: 'config_update',
          updates,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error: any) {
      return {
        success: false,
        error: `Failed to update configuration: ${error.message}`
      };
    }
  }
}