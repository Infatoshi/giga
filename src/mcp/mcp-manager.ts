import { McpClient, McpTool, McpToolResult } from './mcp-client';
import { loadAddedMcpServers, AddedMcpServer } from '../utils/added-mcp-servers';

export interface McpToolWithServer extends McpTool {
  serverName: string;
}

export class McpManager {
  private clients = new Map<string, McpClient>();
  private static instance: McpManager | null = null;

  static getInstance(): McpManager {
    if (!McpManager.instance) {
      McpManager.instance = new McpManager();
    }
    return McpManager.instance;
  }

  async initializeAllServers(): Promise<void> {
    const servers = loadAddedMcpServers();
    const connectionPromises = servers.map(server => this.connectToServer(server));
    
    // Connect to all servers, but don't fail if some connections fail
    const results = await Promise.allSettled(connectionPromises);
    
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Failed to connect to MCP server ${servers[index].name}:`, result.reason);
      }
    });
  }

  async connectToServer(server: AddedMcpServer): Promise<McpClient> {
    const existingClient = this.clients.get(server.name);
    if (existingClient && existingClient.isConnectedToServer()) {
      return existingClient;
    }

    const client = new McpClient(server);
    try {
      await client.connect();
      this.clients.set(server.name, client);
      console.log(`Connected to MCP server: ${server.name}`);
      return client;
    } catch (error) {
      console.error(`Failed to connect to MCP server ${server.name}:`, error);
      throw error;
    }
  }

  async disconnectFromServer(serverName: string): Promise<void> {
    const client = this.clients.get(serverName);
    if (client) {
      await client.disconnect();
      this.clients.delete(serverName);
      console.log(`Disconnected from MCP server: ${serverName}`);
    }
  }

  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.clients.keys()).map(serverName => 
      this.disconnectFromServer(serverName)
    );
    await Promise.all(disconnectPromises);
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
    // Reload servers from storage and connect to any new ones
    const servers = loadAddedMcpServers();
    const currentServers = new Set(this.clients.keys());
    const newServers = servers.filter(server => !currentServers.has(server.name));
    
    // Connect to new servers
    const connectionPromises = newServers.map(server => this.connectToServer(server));
    const results = await Promise.allSettled(connectionPromises);
    
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Failed to connect to new MCP server ${newServers[index].name}:`, result.reason);
      }
    });

    // Disconnect from servers that are no longer in the configuration
    const configuredServerNames = new Set(servers.map(s => s.name));
    for (const serverName of currentServers) {
      if (!configuredServerNames.has(serverName)) {
        await this.disconnectFromServer(serverName);
      }
    }
  }
}