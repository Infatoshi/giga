import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import * as crypto from "crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { QdrantClient } from "@qdrant/js-client-rest";

dotenv.config();

interface Document {
  content: string;
  filePath: string;
  id: string;
}

class QdrantRAG {
  private qdrantClient: QdrantClient;
  private genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  private collectionName = "giga_codebase";
  private embeddingModel = "gemini-embedding-001";
  private searchThreshold = 0.40;

  constructor() {
    this.qdrantClient = new QdrantClient({
      url: "http://localhost:6333",
      // apiKey can be added if needed: apiKey: process.env.QDRANT_API_KEY
    });
  }

  private async createEmbedding(text: string): Promise<number[]> {
    try {
      // Chunk text if it's too large (Gemini has ~30k byte limit)
      const maxChars = 25000; // Conservative limit
      if (text.length > maxChars) {
        text = text.substring(0, maxChars) + "...";
      }
      
      const model = this.genAI.getGenerativeModel({ model: this.embeddingModel });
      const result = await model.embedContent(text);
      return result.embedding.values;
    } catch (error) {
      console.error("Error creating embedding:", error);
      throw error;
    }
  }

  private readDirectoryRecursively(dir: string): Document[] {
    const documents: Document[] = [];
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        if (!file.startsWith('.') && file !== 'node_modules' && file !== 'storage' && file !== 'dist') {
          documents.push(...this.readDirectoryRecursively(filePath));
        }
      } else if (file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.tsx') || file.endsWith('.jsx')) {
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          if (content.trim().length > 0) {
            documents.push({
              content,
              filePath,
              id: crypto.randomUUID()
            });
          }
        } catch (error) {
          console.warn(`Could not read file ${filePath}:`, error);
        }
      }
    }
    
    return documents;
  }

  async initializeCollection(): Promise<void> {
    try {
      // Check if collection exists
      const collections = await this.qdrantClient.getCollections();
      const collectionExists = collections.collections.some(
        col => col.name === this.collectionName
      );

      if (collectionExists) {
        console.log(`Collection '${this.collectionName}' already exists, deleting...`);
        await this.qdrantClient.deleteCollection(this.collectionName);
      }

      // Create collection with proper vector configuration for Gemini embeddings (3072 dimensions)
      await this.qdrantClient.createCollection(this.collectionName, {
        vectors: {
          size: 3072, // Gemini embedding dimensions
          distance: "Cosine"
        }
      });

      console.log(`✅ Created collection '${this.collectionName}' with 3072 dimensions`);
    } catch (error) {
      console.error("Error initializing collection:", error);
      throw error;
    }
  }

  async indexDocuments(directory: string): Promise<void> {
    console.log("🚀 Starting Qdrant indexing process...");
    
    await this.initializeCollection();
    
    const documents = this.readDirectoryRecursively(directory);
    console.log(`📚 Found ${documents.length} files to index.`);

    // Process documents in batches to avoid rate limits
    const batchSize = 10;
    let processed = 0;

    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      const points = [];

      for (const doc of batch) {
        try {
          console.log(`Processing ${processed + 1}/${documents.length}: ${doc.filePath}`);
          const embedding = await this.createEmbedding(doc.content);
          
          points.push({
            id: doc.id,
            vector: embedding,
            payload: {
              content: doc.content,
              filePath: doc.filePath,
              fileSize: doc.content.length,
              createdAt: new Date().toISOString()
            }
          });
          
          processed++;
          
          // Small delay to respect API limits
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Failed to process ${doc.filePath}:`, error);
        }
      }

      if (points.length > 0) {
        await this.qdrantClient.upsert(this.collectionName, {
          wait: true,
          points
        });
        console.log(`✅ Uploaded batch of ${points.length} documents to Qdrant`);
      }
    }

    console.log(`✅ Successfully indexed ${processed} documents in Qdrant`);
  }

  async query(queryText: string, limit: number = 3): Promise<void> {
    console.log(`🔎 Querying Qdrant: "${queryText}"`);
    
    try {
      // Create embedding for query
      const queryEmbedding = await this.createEmbedding(queryText);
      
      // Search in Qdrant
      const searchResult = await this.qdrantClient.search(this.collectionName, {
        vector: queryEmbedding,
        limit,
        score_threshold: this.searchThreshold,
        with_payload: true
      });

      if (searchResult.length === 0) {
        console.log(`❌ No results found above threshold ${this.searchThreshold}`);
        return;
      }

      console.log(`\n📊 Found ${searchResult.length} results:`);

      // Create context from search results
      const context = searchResult.map(result => {
        const payload = result.payload as any;
        return `File: ${payload.filePath}\nScore: ${result.score?.toFixed(4)}\nContent:\n${payload.content.substring(0, 800)}...\n`;
      }).join('\n---\n');

      // Use Gemini to generate answer
      try {
        const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `Based on the following code context, answer the question: "${queryText}"\n\nContext:\n${context}\n\nAnswer:`;
        
        const result = await model.generateContent(prompt);
        const response = result.response.text();
        
        console.log("\n💬 AI Response:");
        console.log(response);
        
      } catch (error) {
        console.warn("AI generation failed:", error);
      }
      
      console.log("\n🔍 Top Matching Files:");
      searchResult.forEach((result, index) => {
        const payload = result.payload as any;
        console.log(`\n--- Match ${index + 1} (Score: ${result.score?.toFixed(4)}) ---`);
        console.log(`File: ${payload.filePath}`);
        console.log(`Size: ${payload.fileSize} chars`);
        console.log(`Content preview:\n${payload.content.substring(0, 200)}...`);
      });

    } catch (error) {
      console.error("Error querying:", error);
    }
  }

  async getCollectionInfo(): Promise<void> {
    try {
      const info = await this.qdrantClient.getCollection(this.collectionName);
      console.log(`\n📊 Collection '${this.collectionName}' info:`);
      console.log(`- Points count: ${info.points_count}`);
      
      const vectors = info.config?.params?.vectors;
      if (vectors && typeof vectors === 'object' && 'size' in vectors) {
        console.log(`- Vector size: ${vectors.size}`);
        console.log(`- Distance: ${vectors.distance}`);
      }
    } catch (error) {
      console.error("Error getting collection info:", error);
    }
  }
}

export { QdrantRAG };