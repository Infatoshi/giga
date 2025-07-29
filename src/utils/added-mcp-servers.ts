import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface AddedMcpServer {
  name: string;
  command: string;
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
    return data.servers || [];
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
      command,
      args,
      env,
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