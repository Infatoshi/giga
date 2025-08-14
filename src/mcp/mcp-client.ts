import { spawn, ChildProcess } from 'child_process';
import { AddedMcpServer } from '../utils/added-mcp-servers';

export interface McpTool {
  name: string;
  description?: string;
  inputSchema: any;
}

export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface McpServerInfo {
  name: string;
  version: string;
  tools?: McpTool[];
  resources?: McpResource[];
}

export interface McpToolCall {
  name: string;
  arguments: any;
}

export interface McpToolResult {
  content?: Array<{
    type: string;
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
  _meta?: any;
}

export class McpClient {
  private process: ChildProcess | null = null;
  private server: AddedMcpServer;
  private messageId = 0;
  private pendingRequests = new Map<number, { resolve: Function; reject: Function }>();
  private isConnected = false;
  private serverInfo: McpServerInfo | null = null;

  constructor(server: AddedMcpServer) {
    this.server = server;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Parse command and args
        const commandParts = this.server.command.split(' ');
        const command = commandParts[0];
        const args = [...commandParts.slice(1), ...(this.server.args || [])];

        // Spawn the MCP server process
        this.process = spawn(command, args, {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, ...this.server.env },
        });

        this.process.on('error', (error) => {
          reject(new Error(`Failed to start MCP server: ${error.message}`));
        });

        // Set up message handling
        let buffer = '';
        this.process.stdout?.on('data', (data) => {
          buffer += data.toString();
          
          // Process complete JSON-RPC messages
          let newlineIndex;
          while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, newlineIndex).trim();
            buffer = buffer.slice(newlineIndex + 1);
            
            if (line) {
              try {
                const message = JSON.parse(line);
                this.handleMessage(message);
              } catch (error) {
              }
            }
          }
        });

        this.process.stderr?.on('data', (data) => {
          // Suppress MCP server stderr logs
        });

        this.process.on('close', (code) => {
          this.isConnected = false;
          if (code !== 0) {
          }
        });

        // Initialize the connection
        this.initialize().then(() => {
          this.isConnected = true;
          resolve();
        }).catch(reject);

      } catch (error) {
        reject(error);
      }
    });
  }

  private async initialize(): Promise<void> {
    // Send initialize request
    const initResponse = await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {},
      },
      clientInfo: {
        name: 'giga-code',
        version: '1.0.0',
      },
    });

    this.serverInfo = {
      name: initResponse.serverInfo?.name || this.server.name,
      version: initResponse.serverInfo?.version || '1.0.0',
    };

    // Send initialized notification
    this.sendNotification('initialized', {});

    // Get available tools
    try {
      const toolsResponse = await this.sendRequest('tools/list', {});
      if (toolsResponse.tools) {
        this.serverInfo.tools = toolsResponse.tools;
      }
    } catch (error) {
      this.serverInfo.tools = [];
    }

    // Get available resources
    try {
      const resourcesResponse = await this.sendRequest('resources/list', {});
      if (resourcesResponse.resources) {
        this.serverInfo.resources = resourcesResponse.resources;
      }
    } catch (error) {
      // Many MCP servers don't implement resources/list - silently ignore "Method not found" errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('Method not found')) {
      }
      this.serverInfo.resources = [];
    }
  }

  private handleMessage(message: any): void {
    if (message.id !== undefined && this.pendingRequests.has(message.id)) {
      // This is a response to a request
      const { resolve, reject } = this.pendingRequests.get(message.id)!;
      this.pendingRequests.delete(message.id);

      if (message.error) {
        reject(new Error(message.error.message || 'MCP error'));
      } else {
        resolve(message.result);
      }
    } else {
      // This is a notification or request from the server
    }
  }

  private sendRequest(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.process) {
        reject(new Error('MCP client process not started'));
        return;
      }

      const id = ++this.messageId;
      const message = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      this.pendingRequests.set(id, { resolve, reject });

      const messageStr = JSON.stringify(message) + '\n';
      this.process.stdin?.write(messageStr);

      // Set timeout for requests
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('MCP request timeout'));
        }
      }, 30000); // 30 second timeout
    });
  }

  private sendNotification(method: string, params: any): void {
    if (!this.process) {
      return;
    }

    const message = {
      jsonrpc: '2.0',
      method,
      params,
    };

    const messageStr = JSON.stringify(message) + '\n';
    this.process.stdin?.write(messageStr);
  }

  async callTool(name: string, arguments_: any): Promise<McpToolResult> {
    try {
      const response = await this.sendRequest('tools/call', {
        name,
        arguments: arguments_,
      });

      return {
        content: response.content || [],
        isError: response.isError || false,
        _meta: response._meta,
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error calling tool: ${error instanceof Error ? error.message : String(error)}`,
        }],
        isError: true,
      };
    }
  }

  getServerInfo(): McpServerInfo | null {
    return this.serverInfo;
  }

  getTools(): McpTool[] {
    return this.serverInfo?.tools || [];
  }

  getResources(): McpResource[] {
    return this.serverInfo?.resources || [];
  }

  async disconnect(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.isConnected = false;
    this.pendingRequests.clear();
  }

  isConnectedToServer(): boolean {
    return this.isConnected;
  }
}
