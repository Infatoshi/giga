import { McpClient, McpTool, McpToolResult } from './mcp-client';
import { HttpMcpClient } from './http-mcp-client';
import { HttpMcpManager } from './http-mcp-manager';
import { loadAddedMcpServers, AddedMcpServer, getEnabledMcpServers, setMcpServerEnabled } from '../utils/added-mcp-servers';

export interface McpToolWithServer extends McpTool {
  serverName: string;
}

type AnyMcpClient = McpClient | HttpMcpClient;

export class McpManager {
  private clients = new Map<string, AnyMcpClient>();
  private httpManager: HttpMcpManager;
  private static instance: McpManager | null = null;

  constructor() {
    this.httpManager = HttpMcpManager.getInstance();
  }

  static getInstance(): McpManager {
    if (!McpManager.instance) {
      McpManager.instance = new McpManager();
    }
    return McpManager.instance;
  }

  async initializeAllServers(): Promise<void> {
    const servers = getEnabledMcpServers(); // Only connect to enabled servers
    
    // Start HTTP servers first
    await this.httpManager.startAllHttpServers();
    
    // Connect to all servers, but don't fail if some connections fail
    const connectionPromises = servers.map(server => this.connectToServer(server));
    const results = await Promise.allSettled(connectionPromises);
    
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Failed to connect to MCP server ${servers[index].name}:`, result.reason);
      }
    });
  }

  async connectToServer(server: AddedMcpServer): Promise<AnyMcpClient> {
    if (!server.enabled) {
      throw new Error(`Server ${server.name} is disabled`);
    }

    const existingClient = this.clients.get(server.name);
    if (existingClient && existingClient.isConnectedToServer()) {
      return existingClient;
    }

    let client: AnyMcpClient;
    
    if (server.type === 'http') {
      // For HTTP servers, get the client from HTTP manager
      const httpClient = this.httpManager.getHttpClient(server.name);
      if (httpClient && httpClient.isConnectedToServer()) {
        this.clients.set(server.name, httpClient);
        return httpClient;
      }
      
      // Start HTTP server if not already running
      client = await this.httpManager.startHttpServer(server);
    } else {
      // Process-based server
      client = new McpClient(server);
      await client.connect();
    }

    this.clients.set(server.name, client);
    return client;
  }

  async disconnectFromServer(serverName: string): Promise<void> {
    const client = this.clients.get(serverName);
    if (client) {
      await client.disconnect();
      this.clients.delete(serverName);
      
      // Also stop HTTP server if it's an HTTP server
      if (this.httpManager.isServerRunning(serverName)) {
        await this.httpManager.stopHttpServer(serverName);
      }
      
      console.log(`Disconnected from MCP server: ${serverName}`);
    }
  }

  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.clients.keys()).map(serverName => 
      this.disconnectFromServer(serverName)
    );
    await Promise.all(disconnectPromises);
    
    // Stop all HTTP servers
    await this.httpManager.stopAllHttpServers();
  }

  getAllTools(): McpToolWithServer[] {
    const tools: McpToolWithServer[] = [];
    
    for (const [serverName, client] of this.clients) {
      if (client.isConnectedToServer()) {
        const serverTools = client.getTools();
        serverTools.forEach(tool => {
          tools.push({
            ...tool,
            serverName,
          });
        });
      }
    }
    
    return tools;
  }

  getToolsByServer(serverName: string): McpTool[] {
    const client = this.clients.get(serverName);
    if (client && client.isConnectedToServer()) {
      return client.getTools();
    }
    return [];
  }

  async callTool(serverName: string, toolName: string, arguments_: any): Promise<McpToolResult> {
    const client = this.clients.get(serverName);
    if (!client) {
      return {
        content: [{
          type: 'text',
          text: `MCP server '${serverName}' not found or not connected`,
        }],
        isError: true,
      };
    }

    if (!client.isConnectedToServer()) {
      return {
        content: [{
          type: 'text',
          text: `MCP server '${serverName}' is not connected`,
        }],
        isError: true,
      };
    }

    return await client.callTool(toolName, arguments_);
  }

  findToolByName(toolName: string): McpToolWithServer | null {
    const allTools = this.getAllTools();
    return allTools.find(tool => tool.name === toolName) || null;
  }

  getConnectedServers(): string[] {
    const connectedServers: string[] = [];
    for (const [serverName, client] of this.clients) {
      if (client.isConnectedToServer()) {
        connectedServers.push(serverName);
      }
    }
    return connectedServers;
  }

  getServerInfo(serverName: string) {
    const client = this.clients.get(serverName);
    if (client && client.isConnectedToServer()) {
      return client.getServerInfo();
    }
    return null;
  }

  isServerConnected(serverName: string): boolean {
    const client = this.clients.get(serverName);
    return client ? client.isConnectedToServer() : false;
  }

  async refreshConnections(): Promise<void> {
    // Reload servers from storage and get enabled ones
    const enabledServers = getEnabledMcpServers();
    const allServers = loadAddedMcpServers();
    const currentServers = new Set(this.clients.keys());
    
    // Connect to enabled servers that aren't connected
    const enabledServerNames = new Set(enabledServers.map(s => s.name));
    const newServers = enabledServers.filter(server => !currentServers.has(server.name));
    
    // Start HTTP servers first
    await this.httpManager.startAllHttpServers();
    
    // Connect to new enabled servers
    const connectionPromises = newServers.map(server => this.connectToServer(server));
    const results = await Promise.allSettled(connectionPromises);
    
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Failed to connect to new MCP server ${newServers[index].name}:`, result.reason);
      }
    });

    // Disconnect from servers that are disabled or no longer in the configuration
    for (const serverName of currentServers) {
      if (!enabledServerNames.has(serverName)) {
        await this.disconnectFromServer(serverName);
      }
    }
  }

  async setServerEnabled(serverName: string, enabled: boolean): Promise<boolean> {
    const success = setMcpServerEnabled(serverName, enabled);
    
    if (success) {
      if (enabled) {
        // Connect to the server if it's now enabled
        const server = loadAddedMcpServers().find(s => s.name === serverName);
        if (server) {
          try {
            await this.connectToServer(server);
          } catch (error) {
            console.error(`Failed to connect to enabled server ${serverName}:`, error);
          }
        }
      } else {
        // Disconnect from the server if it's now disabled
        await this.disconnectFromServer(serverName);
      }
    }
    
    return success;
  }

  getEnabledServers(): AddedMcpServer[] {
    return getEnabledMcpServers();
  }
}