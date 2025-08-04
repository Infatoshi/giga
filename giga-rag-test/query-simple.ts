import { SimpleRAG } from './simple-rag';

async function main() {
  const query = process.argv[2];
  if (!query) {
    console.error("Please provide a query. Usage: npx ts-node query-simple.ts 'Your question here'");
    process.exit(1);
  }

  const rag = new SimpleRAG();
  await rag.query(query);
}

main().catch(console.error);