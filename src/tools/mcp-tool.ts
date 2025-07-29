import { McpManager } from '../mcp/mcp-manager';
import { ToolResult } from '../types';

export class McpTool {
  private mcpManager: McpManager;

  constructor() {
    this.mcpManager = McpManager.getInstance();
  }

  async listMcpServers(): Promise<ToolResult> {
    try {
      const connectedServers = this.mcpManager.getConnectedServers();
      
      if (connectedServers.length === 0) {
        return {
          success: true,
          output: 'No MCP servers are currently connected.',
        };
      }

      let output = 'Connected MCP Servers:\n\n';
      
      for (const serverName of connectedServers) {
        const serverInfo = this.mcpManager.getServerInfo(serverName);
        const tools = this.mcpManager.getToolsByServer(serverName);
        
        output += `📡 ${serverName}\n`;
        if (serverInfo) {
          output += `   Version: ${serverInfo.version}\n`;
        }
        output += `   Tools: ${tools.length}\n`;
        
        if (tools.length > 0) {
          output += `   Available tools:\n`;
          tools.forEach(tool => {
            output += `     • ${tool.name}`;
            if (tool.description) {
              output += ` - ${tool.description}`;
            }
            output += '\n';
          });
        }
        output += '\n';
      }

      return {
        success: true,
        output,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to list MCP servers: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async listMcpTools(): Promise<ToolResult> {
    try {
      const allTools = this.mcpManager.getAllTools();
      
      if (allTools.length === 0) {
        return {
          success: true,
          output: 'No MCP tools are currently available.',
        };
      }

      let output = 'Available MCP Tools:\n\n';
      
      const toolsByServer = new Map<string, typeof allTools>();
      allTools.forEach(tool => {
        if (!toolsByServer.has(tool.serverName)) {
          toolsByServer.set(tool.serverName, []);
        }
        toolsByServer.get(tool.serverName)!.push(tool);
      });

      for (const [serverName, tools] of toolsByServer) {
        output += `📡 ${serverName}:\n`;
        tools.forEach(tool => {
          output += `   🔧 ${tool.name}`;
          if (tool.description) {
            output += ` - ${tool.description}`;
          }
          output += '\n';
        });
        output += '\n';
      }

      return {
        success: true,
        output,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to list MCP tools: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async callMcpTool(toolName: string, arguments_: any): Promise<ToolResult> {
    try {
      const tool = this.mcpManager.findToolByName(toolName);
      
      if (!tool) {
        const availableTools = this.mcpManager.getAllTools();
        const toolNames = availableTools.map(t => t.name).join(', ');
        return {
          success: false,
          error: `MCP tool '${toolName}' not found. Available tools: ${toolNames}`,
        };
      }

      const result = await this.mcpManager.callTool(tool.serverName, toolName, arguments_);
      
      if (result.isError) {
        const errorMessage = result.content?.find(c => c.type === 'text')?.text || 'Unknown error';
        return {
          success: false,
          error: `MCP tool error: ${errorMessage}`,
        };
      }

      // Convert MCP result to tool result
      let output = '';
      if (result.content) {
        for (const content of result.content) {
          if (content.type === 'text' && content.text) {
            output += content.text + '\n';
          } else if (content.type === 'resource' && content.data) {
            output += `[Resource: ${content.mimeType || 'unknown'}]\n${content.data}\n`;
          }
        }
      }

      return {
        success: true,
        output: output.trim() || 'Tool executed successfully (no output)',
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to call MCP tool: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async refreshMcpConnections(): Promise<ToolResult> {
    try {
      await this.mcpManager.refreshConnections();
      return {
        success: true,
        output: 'MCP server connections refreshed successfully.',
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to refresh MCP connections: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}