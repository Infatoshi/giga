import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { RAGConfig } from '../utils/rag-config';

export interface CodeChunk {
  id: string;
  content: string;
  filePath: string;
  type: 'function' | 'class' | 'import' | 'file' | 'comment' | 'interface' | 'type';
  name?: string; // function/class name
  startLine?: number;
  endLine?: number;
  metadata: Record<string, any>;
}

export interface SearchResult {
  chunk: CodeChunk;
  score: number;
  distance: number;
}

interface StoredDocument {
  id: string;
  content: string;
  embedding: number[];
  metadata: Record<string, any>;
}

interface VectorIndex {
  documents: StoredDocument[];
  metadata: {
    count: number;
    lastUpdated: string;
    version: string;
  };
}

export class RAGService {
  private genAI: GoogleGenerativeAI | null = null;
  private config: RAGConfig;
  private dbPath: string;
  private indexPath: string;
  private vectorIndex: VectorIndex | null = null;

  constructor(projectPath: string, config?: Partial<RAGConfig>) {
    this.dbPath = path.join(projectPath, '.giga', 'embeddings');
    this.indexPath = path.join(this.dbPath, 'vectors.json');
    
    // Default configuration
    this.config = {
      enabled: true,
      embeddingProvider: 'gemini',
      embeddingModel: 'gemini-embedding-001',
      searchThreshold: 0.20,
      maxResults: 5,
      chunkingStrategy: 'logical',
      includePatterns: ['**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx', '**/*.py', '**/*.java', '**/*.cpp', '**/*.c', '**/*.h'],
      excludePatterns: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**', '**/coverage/**'],
      ...config
    };

    // Initialize Gemini AI if using Gemini embeddings
    if (this.config.embeddingProvider === 'gemini') {
      const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      if (apiKey) {
        this.genAI = new GoogleGenerativeAI(apiKey);
      }
    }
  }

  async initialize(): Promise<void> {
    try {
      // Ensure database directory exists
      if (!fs.existsSync(this.dbPath)) {
        fs.mkdirSync(this.dbPath, { recursive: true });
      }

      // Load existing index or create new one
      await this.loadIndex();
    } catch (error) {
      console.error('Failed to initialize RAG service:', error);
      throw error;
    }
  }

  private async loadIndex(): Promise<void> {
    if (fs.existsSync(this.indexPath)) {
      try {
        const indexData = fs.readFileSync(this.indexPath, 'utf-8');
        this.vectorIndex = JSON.parse(indexData);
      } catch (error) {
        console.warn('Failed to load existing index, creating new one:', error);
        this.createEmptyIndex();
      }
    } else {
      this.createEmptyIndex();
    }
  }

  private createEmptyIndex(): void {
    this.vectorIndex = {
      documents: [],
      metadata: {
        count: 0,
        lastUpdated: new Date().toISOString(),
        version: '1.0.0'
      }
    };
  }

  private async saveIndex(): Promise<void> {
    if (!this.vectorIndex) return;
    
    this.vectorIndex.metadata.lastUpdated = new Date().toISOString();
    this.vectorIndex.metadata.count = this.vectorIndex.documents.length;
    
    fs.writeFileSync(this.indexPath, JSON.stringify(this.vectorIndex, null, 2));
  }

  private truncateText(text: string, maxChars: number = 25000): string {
    if (text.length <= maxChars) {
      return text;
    }
    return text.substring(0, maxChars) + '...';
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    if (this.config.embeddingProvider === 'gemini' && this.genAI) {
      try {
        const model = this.genAI.getGenerativeModel({ model: this.config.embeddingModel });
        const result = await model.embedContent(this.truncateText(text));
        return result.embedding.values;
      } catch (error) {
        console.error('Failed to generate Gemini embedding:', error);
        // Fall back to simple embedding
        return this.createSimpleEmbedding(text);
      }
    } else {
      // Fall back to simple embedding if no API key or different provider
      return this.createSimpleEmbedding(text);
    }
  }

  private createSimpleEmbedding(text: string): number[] {
    // Create a simple feature vector with same dimensions as Gemini (3072)
    const words = text.toLowerCase().split(/\s+/);
    const embedding = new Array(3072).fill(0); // Match Gemini dimension size
    
    // Basic text features
    embedding[0] = Math.min(words.length / 100, 1); // Document length (normalized)
    embedding[1] = Math.min((text.match(/function/g) || []).length / 10, 1); // Function count
    embedding[2] = Math.min((text.match(/class/g) || []).length / 10, 1); // Class count
    embedding[3] = Math.min((text.match(/import/g) || []).length / 10, 1); // Import count
    embedding[4] = Math.min((text.match(/export/g) || []).length / 10, 1); // Export count
    embedding[5] = Math.min((text.match(/interface/g) || []).length / 10, 1); // Interface count
    embedding[6] = Math.min((text.match(/type/g) || []).length / 10, 1); // Type count
    embedding[7] = Math.min((text.match(/const/g) || []).length / 10, 1); // Const count
    embedding[8] = Math.min((text.match(/let/g) || []).length / 10, 1); // Let count
    embedding[9] = Math.min((text.match(/var/g) || []).length / 10, 1); // Var count
    
    // Character-based features for better diversity
    for (let i = 10; i < embedding.length; i++) {
      const charIndex = i % text.length;
      const charCode = text.charCodeAt(charIndex) || 0;
      embedding[i] = (charCode / 255) * 0.01; // Very small normalized character features
    }
    
    return embedding;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      console.warn('Embedding dimension mismatch');
      return 0;
    }
    
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    
    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    
    return dotProduct / (magnitudeA * magnitudeB);
  }

  async indexChunks(chunks: CodeChunk[]): Promise<void> {
    if (!this.vectorIndex) {
      await this.initialize();
    }

    if (!this.vectorIndex || chunks.length === 0) {
      return;
    }

    try {
      console.log(`🚀 Indexing ${chunks.length} code chunks...`);
      
      // Process chunks in batches to avoid overwhelming the embedding API
      const batchSize = 5; // Smaller batch size for API rate limits
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        
        for (const chunk of batch) {
          // Check if chunk already exists
          const existingIndex = this.vectorIndex.documents.findIndex(doc => doc.id === chunk.id);
          
          // Generate embedding
          const embedding = await this.generateEmbedding(chunk.content);
          
          const storedDoc: StoredDocument = {
            id: chunk.id,
            content: chunk.content,
            embedding,
            metadata: {
              filePath: chunk.filePath,
              type: chunk.type,
              name: chunk.name || '',
              startLine: chunk.startLine || 0,
              endLine: chunk.endLine || 0,
              ...chunk.metadata
            }
          };
          
          if (existingIndex >= 0) {
            // Update existing document
            this.vectorIndex.documents[existingIndex] = storedDoc;
          } else {
            // Add new document
            this.vectorIndex.documents.push(storedDoc);
          }
        }

        // Save progress and add delay to respect API rate limits
        await this.saveIndex();
        if (i + batchSize < chunks.length) {
          console.log(`📊 Progress: ${i + batch.length}/${chunks.length} chunks indexed`);
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      await this.saveIndex();
      console.log(`✅ Indexed ${chunks.length} code chunks`);
    } catch (error) {
      console.error('Failed to index chunks:', error);
      throw error;
    }
  }

  async search(query: string, maxResults?: number): Promise<SearchResult[]> {
    if (!this.vectorIndex) {
      await this.initialize();
    }

    if (!this.vectorIndex || this.vectorIndex.documents.length === 0) {
      return [];
    }

    try {
      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Calculate similarity scores for all documents
      const searchResults: SearchResult[] = [];
      
      for (const doc of this.vectorIndex.documents) {
        const similarity = this.cosineSimilarity(queryEmbedding, doc.embedding);
        const distance = 1 - similarity; // Convert similarity to distance
        
        if (similarity >= this.config.searchThreshold) {
          const chunk: CodeChunk = {
            id: doc.id,
            content: doc.content,
            filePath: doc.metadata.filePath,
            type: doc.metadata.type as any,
            name: doc.metadata.name || undefined,
            startLine: doc.metadata.startLine || undefined,
            endLine: doc.metadata.endLine || undefined,
            metadata: doc.metadata
          };

          searchResults.push({
            chunk,
            score: similarity,
            distance
          });
        }
      }

      // Sort by similarity score (highest first) and limit results
      return searchResults
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults || this.config.maxResults);
    } catch (error) {
      console.error('Failed to search:', error);
      return [];
    }
  }

  async deleteChunk(chunkId: string): Promise<void> {
    if (!this.vectorIndex) {
      await this.initialize();
    }

    if (!this.vectorIndex) {
      return;
    }

    try {
      const index = this.vectorIndex.documents.findIndex(doc => doc.id === chunkId);
      if (index >= 0) {
        this.vectorIndex.documents.splice(index, 1);
        await this.saveIndex();
      }
    } catch (error) {
      console.error('Failed to delete chunk:', error);
    }
  }

  async deleteByFilePath(filePath: string): Promise<void> {
    if (!this.vectorIndex) {
      await this.initialize();
    }

    if (!this.vectorIndex) {
      return;
    }

    try {
      const initialCount = this.vectorIndex.documents.length;
      this.vectorIndex.documents = this.vectorIndex.documents.filter(doc => doc.metadata.filePath !== filePath);
      const deletedCount = initialCount - this.vectorIndex.documents.length;
      
      if (deletedCount > 0) {
        await this.saveIndex();
        console.log(`🗑️ Deleted ${deletedCount} chunks from ${filePath}`);
      }
    } catch (error) {
      console.error('Failed to delete chunks by file path:', error);
    }
  }

  async getCollectionInfo(): Promise<{ count: number; config: RAGConfig }> {
    if (!this.vectorIndex) {
      await this.initialize();
    }

    const count = this.vectorIndex?.documents.length || 0;
    return { count, config: this.config };
  }

  async clearCollection(): Promise<void> {
    try {
      this.createEmptyIndex();
      await this.saveIndex();
      console.log('🗑️ Cleared vector index');
    } catch (error) {
      console.error('Failed to clear collection:', error);
    }
  }

  updateConfig(newConfig: Partial<RAGConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): RAGConfig {
    return { ...this.config };
  }

  static generateChunkId(filePath: string, type: string, name?: string, startLine?: number): string {
    const identifier = `${filePath}:${type}:${name || 'anonymous'}:${startLine || 0}`;
    return crypto.createHash('sha256').update(identifier).digest('hex').substring(0, 16);
  }
}