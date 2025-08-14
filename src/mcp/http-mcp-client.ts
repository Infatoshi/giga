import { AddedMcpServer } from '../utils/added-mcp-servers';
import { McpTool, McpResource, McpServerInfo, McpToolResult } from './mcp-client';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params: any;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export class HttpMcpClient {
  private server: AddedMcpServer;
  private messageId = 0;
  private isConnected = false;
  private serverInfo: McpServerInfo | null = null;

  constructor(server: AddedMcpServer) {
    this.server = server;
  }

  async connect(): Promise<void> {
    if (this.server.type !== 'http') {
      throw new Error('HttpMcpClient can only connect to HTTP servers');
    }

    try {
      // Test connection by calling initialize
      await this.initialize();
      this.isConnected = true;
    } catch (error) {
      throw new Error(`Failed to connect to HTTP MCP server ${this.server.name}: ${error}`);
    }
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

    // Send initialized notification (for HTTP servers that need it)
    try {
      await this.sendRequest('initialized', {});
    } catch (error) {
      // Some servers may not implement initialized, ignore errors
    }

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
      this.serverInfo.resources = [];
    }
  }

  private async sendRequest(method: string, params: any): Promise<any> {
    if (!this.server.httpUrl) {
      throw new Error('HTTP URL not configured for server');
    }

    const id = ++this.messageId;
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    try {
      const response = await fetch(this.server.httpUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Handle Server-Sent Events response
      if (response.headers.get('content-type')?.includes('text/event-stream')) {
        return await this.parseServerSentEvents(response);
      }

      // Handle regular JSON response
      const jsonResponse = await response.json() as JsonRpcResponse;
      
      if (jsonResponse.error) {
        throw new Error(`JSON-RPC Error: ${jsonResponse.error.message}`);
      }

      return jsonResponse.result;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Request failed: ${String(error)}`);
    }
  }

  private async parseServerSentEvents(response: Response): Promise<any> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body available');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let result: any = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Process complete events
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.jsonrpc === '2.0') {
                if (data.error) {
                  throw new Error(`JSON-RPC Error: ${data.error.message}`);
                }
                result = data.result;
              }
            } catch (error) {
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return result;
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
          text: `Error calling HTTP MCP tool: ${error instanceof Error ? error.message : String(error)}`,
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
    this.isConnected = false;
    this.serverInfo = null;
  }

  isConnectedToServer(): boolean {
    return this.isConnected;
  }

  async healthCheck(): Promise<boolean> {
    if (!this.server.httpUrl) {
      return false;
    }

    try {
      const response = await fetch(this.server.httpUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'ping',
          params: {},
        }),
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }
}