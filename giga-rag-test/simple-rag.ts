import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

interface Document {
  content: string;
  filePath: string;
  embedding?: number[];
}

class SimpleRAG {
  private documents: Document[] = [];
  private genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

  // Simple embedding using text characteristics
  private createSimpleEmbedding(text: string): number[] {
    const words = text.toLowerCase().split(/\s+/);
    const embedding = new Array(100).fill(0);
    
    // Create a simple feature vector based on text characteristics
    embedding[0] = words.length / 100; // Document length
    embedding[1] = (text.match(/function/g) || []).length / 10; // Function count
    embedding[2] = (text.match(/class/g) || []).length / 10; // Class count
    embedding[3] = (text.match(/import/g) || []).length / 10; // Import count
    embedding[4] = (text.match(/export/g) || []).length / 10; // Export count
    
    // Add some randomness for variety
    for (let i = 5; i < 100; i++) {
      embedding[i] = Math.random() * 0.1;
    }
    
    return embedding;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }

  private readDirectoryRecursively(dir: string): void {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        if (!file.startsWith('.') && file !== 'node_modules' && file !== 'storage') {
          this.readDirectoryRecursively(filePath);
        }
      } else if (file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.tsx') || file.endsWith('.jsx')) {
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          if (content.trim().length > 0) {
            this.documents.push({
              content,
              filePath,
              embedding: this.createSimpleEmbedding(content)
            });
          }
        } catch (error) {
          console.warn(`Could not read file ${filePath}:`, error);
        }
      }
    }
  }

  async indexDocuments(directory: string): Promise<void> {
    console.log("🚀 Starting the indexing process...");
    this.readDirectoryRecursively(directory);
    console.log(`📚 Indexed ${this.documents.length} files.`);
    
    // Save index to file
    const indexData = {
      documents: this.documents.map(doc => ({
        content: doc.content,
        filePath: doc.filePath,
        embedding: doc.embedding
      }))
    };
    
    fs.writeFileSync('./index.json', JSON.stringify(indexData, null, 2));
    console.log("✅ Index saved to ./index.json");
  }

  loadIndex(): void {
    if (fs.existsSync('./index.json')) {
      const indexData = JSON.parse(fs.readFileSync('./index.json', 'utf-8'));
      this.documents = indexData.documents;
      console.log(`📚 Loaded ${this.documents.length} documents from index.`);
    } else {
      console.log("❌ No index found. Please run indexing first.");
    }
  }

  async query(queryText: string): Promise<void> {
    console.log(`🔎 Querying: "${queryText}"`);
    
    if (this.documents.length === 0) {
      this.loadIndex();
    }
    
    if (this.documents.length === 0) {
      console.log("❌ No documents found. Please index first.");
      return;
    }

    // Create embedding for query
    const queryEmbedding = this.createSimpleEmbedding(queryText);
    
    // Find most similar documents
    const similarities = this.documents.map(doc => ({
      doc,
      similarity: this.cosineSimilarity(queryEmbedding, doc.embedding!)
    }));
    
    // Sort by similarity
    similarities.sort((a, b) => b.similarity - a.similarity);
    
    // Get top 3 results
    const topResults = similarities.slice(0, 3);
    
    // Create context from top results
    const context = topResults.map(result => 
      `File: ${result.doc.filePath}\nContent:\n${result.doc.content.substring(0, 800)}...\n`
    ).join('\n---\n');
    
    // Use Gemini to generate answer
    try {
      const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = `Based on the following code context, answer the question: "${queryText}"\n\nContext:\n${context}\n\nAnswer:`;
      
      const result = await model.generateContent(prompt);
      const response = result.response.text();
      
      console.log("\n💬 AI Response:");
      console.log(response);
      
    } catch (error) {
      console.warn("AI generation failed, showing raw context instead:", error);
      console.log("\n📄 Raw Context:");
    }
    
    console.log("\n🔍 Top Matching Files:");
    topResults.forEach((result, index) => {
      console.log(`\n--- Match ${index + 1} (Similarity: ${result.similarity.toFixed(4)}) ---`);
      console.log(`File: ${result.doc.filePath}`);
      console.log(`Content preview:\n${result.doc.content.substring(0, 200)}...`);
    });
  }
}

export { SimpleRAG };