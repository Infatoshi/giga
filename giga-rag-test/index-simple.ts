import { SimpleRAG } from './simple-rag';

async function main() {
  const rag = new SimpleRAG();
  await rag.indexDocuments('../');
}

main().catch(console.error);