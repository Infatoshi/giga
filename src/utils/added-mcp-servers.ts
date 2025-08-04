import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface AddedMcpServer {
  name: string;
  type: 'process' | 'http';
  command?: string;
  httpUrl?: string;
  port?: number;
  enabled: boolean;
  args?: string[];
  env?: Record<string, string>;
  description?: string;
  dateAdded: string;
}

interface AddedMcpServersStorage {
  servers: AddedMcpServer[];
}

const getStorageFile = (): string => {
  const homeDir = os.homedir();
  const gigaDir = path.join(homeDir, '.giga');
  
  // Create .giga directory if it doesn't exist
  if (!fs.existsSync(gigaDir)) {
    fs.mkdirSync(gigaDir, { mode: 0o700 });
  }
  
  return path.join(gigaDir, 'added-mcp-servers.json');
};

export function loadAddedMcpServers(): AddedMcpServer[] {
  try {
    const storageFile = getStorageFile();
    
    if (!fs.existsSync(storageFile)) {
      return [];
    }
    
    const data: AddedMcpServersStorage = JSON.parse(fs.readFileSync(storageFile, 'utf8'));
    let servers = data.servers || [];
    
    // Migrate old servers to new format
    servers = servers.map(server => {
      if (!(server as any).type) {
        return {
          ...server,
          type: 'process' as const,
          enabled: true, // Default to enabled for existing servers
        };
      }
      return server;
    });
    
    return servers;
  } catch (error) {
    console.error('Error loading added MCP servers:', error);
    return [];
  }
}

export function saveAddedMcpServers(servers: AddedMcpServer[]): void {
  try {
    const storageFile = getStorageFile();
    const data: AddedMcpServersStorage = { servers };
    
    fs.writeFileSync(storageFile, JSON.stringify(data, null, 2), { mode: 0o600 });
  } catch (error) {
    console.error('Error saving added MCP servers:', error);
  }
}

export function addMcpServer(
  name: string, 
  command: string, 
  args?: string[], 
  env?: Record<string, string>,
  description?: string
): void {
  const servers = loadAddedMcpServers();
  
  // Check if server already exists
  const exists = servers.some(s => s.name === name);
  if (!exists) {
    const newServer: AddedMcpServer = {
      name,
      type: 'process',
      command,
      enabled: true,
      args,
      env,
      description,
      dateAdded: new Date().toISOString(),
    };
    
    servers.push(newServer);
    saveAddedMcpServers(servers);
  }
}

export function addHttpMcpServer(
  name: string,
  httpUrl: string,
  port?: number,
  description?: string
): void {
  const servers = loadAddedMcpServers();
  
  // Check if server already exists
  const exists = servers.some(s => s.name === name);
  if (!exists) {
    const newServer: AddedMcpServer = {
      name,
      type: 'http',
      httpUrl,
      port,
      enabled: true,
      description,
      dateAdded: new Date().toISOString(),
    };
    
    servers.push(newServer);
    saveAddedMcpServers(servers);
  }
}

export function deleteMcpServer(name: string): boolean {
  const servers = loadAddedMcpServers();
  const initialLength = servers.length;
  
  const filteredServers = servers.filter(s => s.name !== name);
  
  if (filteredServers.length < initialLength) {
    saveAddedMcpServers(filteredServers);
    return true;
  }
  
  return false;
}

export function getAllAddedMcpServers(): AddedMcpServer[] {
  return loadAddedMcpServers();
}

export function isMcpServerAdded(name: string): boolean {
  const servers = loadAddedMcpServers();
  return servers.some(s => s.name === name);
}

export function getMcpServerByName(name: string): AddedMcpServer | undefined {
  const servers = loadAddedMcpServers();
  return servers.find(s => s.name === name);
}

export function setMcpServerEnabled(name: string, enabled: boolean): boolean {
  const servers = loadAddedMcpServers();
  const server = servers.find(s => s.name === name);
  
  if (server) {
    server.enabled = enabled;
    saveAddedMcpServers(servers);
    return true;
  }
  
  return false;
}

export function getEnabledMcpServers(): AddedMcpServer[] {
  return loadAddedMcpServers().filter(server => server.enabled);
}

export function getDisabledMcpServers(): AddedMcpServer[] {
  return loadAddedMcpServers().filter(server => !server.enabled);
}

// Available ports for HTTP MCP servers
export const AVAILABLE_PORTS = [6969, 4200, 9420, 3333, 7777, 8888, 5555];

export function getNextAvailablePort(): number {
  const servers = loadAddedMcpServers();
  const usedPorts = new Set(servers.map(s => s.port).filter(Boolean));
  
  for (const port of AVAILABLE_PORTS) {
    if (!usedPorts.has(port)) {
      return port;
    }
  }
  
  // If all predefined ports are used, generate a random one
  return Math.floor(Math.random() * 9000) + 1000;
}

export function addContext7Server(): void {
  const servers = loadAddedMcpServers();
  
  // Check if Context7 server already exists
  const existingIndex = servers.findIndex(s => s.name === 'context7');
  if (existingIndex >= 0) {
    // Update existing server to process type (Context7 uses stdio, not HTTP)
    const existing = servers[existingIndex];
    
    servers[existingIndex] = {
      ...existing,
      type: 'process',
      command: 'npx -y @upstash/context7-mcp',
      // Remove HTTP-specific fields
      httpUrl: undefined,
      port: undefined,
      enabled: existing.enabled ?? true,
      description: existing.description || 'Context7 MCP server for library documentation',
    };
    
    saveAddedMcpServers(servers);
    console.log(`Updated Context7 MCP server to process type (stdio)`);
  } else {
    // Create new server
    const newServer: AddedMcpServer = {
      name: 'context7',
      type: 'process',
      command: 'npx -y @upstash/context7-mcp',
      enabled: true,
      description: 'Context7 MCP server for library documentation',
      dateAdded: new Date().toISOString(),
    };
    
    servers.push(newServer);
    saveAddedMcpServers(servers);
    console.log(`Added Context7 MCP server as process type`);
  }
}