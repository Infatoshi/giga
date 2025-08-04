import {
  Document,
  VectorStoreIndex,
  storageContextFromDefaults,
  Settings,
  OpenAIEmbedding,
} from "llamaindex";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

// Set up embedding model - try OpenAI first
Settings.embedModel = new OpenAIEmbedding({
  model: "text-embedding-3-small",
  apiKey: process.env.OPENAI_API_KEY,
});

function readDirectoryRecursively(dir: string): Document[] {
  const documents: Document[] = [];
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      if (!file.startsWith('.') && file !== 'node_modules') {
        documents.push(...readDirectoryRecursively(filePath));
      }
    } else if (file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.tsx') || file.endsWith('.jsx')) {
      const content = fs.readFileSync(filePath, 'utf-8');
      documents.push(new Document({ text: content, metadata: { file_path: filePath } }));
    }
  }
  
  return documents;
}

async function createIndex() {
  console.log("🚀 Starting the indexing process...");

  const documents = readDirectoryRecursively("../");
  console.log(`📚 Found ${documents.length} files to index.`);

  const storageContext = await storageContextFromDefaults({
    persistDir: "./storage",
  });

  const index = await VectorStoreIndex.fromDocuments(documents, {
    storageContext,
  });
  
  console.log("✅ Index created and saved successfully to ./storage");
}

createIndex().catch(console.error);