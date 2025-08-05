import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { saveAddedMcpServers, AddedMcpServer, loadAddedMcpServers } from "./added-mcp-servers";

const GIGA_DIR = path.join(os.homedir(), '.giga');

const DEFAULT_MCP_SERVERS: AddedMcpServer[] = [
  {
    name: 'exa',
    type: 'process',
    command: 'npx -y exa-mcp-server',
    enabled: true,
    description: 'Exa MCP server for web search',
    dateAdded: new Date().toISOString(),
  },
  {
    name: 'context7',
    type: 'process',
    command: 'npx -y @upstash/context7-mcp',
    enabled: true,
    description: 'Context7 MCP server for library documentation',
    dateAdded: new Date().toISOString(),
  }
];

function ensureDirExists(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
}

function initializeDefaultMcpServers(): void {
  const existingServers = loadAddedMcpServers();
  let hasChanges = false;

  for (const defaultServer of DEFAULT_MCP_SERVERS) {
    const exists = existingServers.some(s => s.name === defaultServer.name);
    if (!exists) {
      existingServers.push(defaultServer);
      hasChanges = true;
    }
  }

  if (hasChanges) {
    saveAddedMcpServers(existingServers);
  }
}

export function initializeGlobalConfig(): void {
  ensureDirExists(GIGA_DIR);
  ensureDirExists(path.join(GIGA_DIR, 'sessions'));
  ensureDirExists(path.join(GIGA_DIR, 'conversations'));

  // Initialize other config files as needed here...

  initializeDefaultMcpServers();
}