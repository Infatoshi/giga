import { QdrantRAG } from './qdrant-rag';

async function main() {
  const query = process.argv[2];
  if (!query) {
    console.error("Please provide a query. Usage: npx ts-node query-qdrant.ts 'Your question here'");
    process.exit(1);
  }

  const rag = new QdrantRAG();
  
  try {
    await rag.query(query);
  } catch (error) {
    console.error("Query failed:", error);
    process.exit(1);
  }
}

main();