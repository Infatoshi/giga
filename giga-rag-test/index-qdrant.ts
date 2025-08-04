import { QdrantRAG } from './qdrant-rag';

async function main() {
  const rag = new QdrantRAG();
  
  try {
    await rag.indexDocuments('../');
    await rag.getCollectionInfo();
  } catch (error) {
    console.error("Indexing failed:", error);
    process.exit(1);
  }
}

main();