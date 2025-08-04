# GIGA RAG Test

A rapid prototype for semantic search and RAG functionality using LlamaIndex.TS and Gemini embeddings.

## Setup

1. Add your Gemini API key to `.env`:
   ```
   GEMINI_API_KEY="your_api_key_here"
   ```

2. Install dependencies (already done):
   ```bash
   npm install
   ```

## Usage

### Index your codebase
```bash
npm run index
# or
npx ts-node index.ts
```

This will:
- Read files from the parent directory (`../`)
- Create embeddings using Gemini's text-embedding-004 model
- Store the index in `./storage`

### Query the index
```bash
npm run query "your question here"
# or
npx ts-node query.ts "where is the database connection logic?"
```

Example queries:
- `"show me how user authentication is implemented"`
- `"what's the purpose of the calculateTotal function?"`
- `"where are the React components defined?"`

## Integration Path for GIGA

This prototype demonstrates the core RAG functionality that can be integrated into GIGA:

1. **`giga index` command**: Run the indexing process on the current directory
2. **Chat integration**: Use the query functionality to provide context for conversations
3. **Refinement**: Extract source nodes for custom prompt engineering

## Files

- `index.ts` - Creates and persists the vector index
- `query.ts` - Queries the index and returns synthesized answers
- `storage/` - Persistent vector store (created after first indexing)