import {
  VectorStoreIndex,
  storageContextFromDefaults,
} from "llamaindex";
import * as dotenv from "dotenv";

dotenv.config();

async function queryIndex(query: string) {
  console.log(`🔎 Querying index with: "${query}"`);

  const storageContext = await storageContextFromDefaults({ persistDir: "./storage" });
  
  const index = await VectorStoreIndex.init({
    storageContext,
  });

  const queryEngine = index.asQueryEngine();

  const response = await queryEngine.query({ query });

  console.log("\n💬 Response:");
  console.log(response.toString());

  console.log("\n🔍 Source Nodes:");
  response.sourceNodes?.forEach((node, index) => {
    console.log(`\n--- Node ${index + 1} (Score: ${node.score?.toFixed(4)}) ---`);
    console.log(`File: ${node.metadata.file_path}`);
    console.log(`Content:\n${node.text?.substring(0, 250)}...`);
  });
}

const userQuery = process.argv[2];
if (!userQuery) {
  console.error("Please provide a query. Usage: npx ts-node query.ts 'Your question here'");
  process.exit(1);
}

queryIndex(userQuery).catch(console.error);