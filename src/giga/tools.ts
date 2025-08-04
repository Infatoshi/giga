import { GrokTool } from './client';
import { McpManager } from '../mcp/mcp-manager';

export const GROK_TOOLS: GrokTool[] = [
  {
    type: 'function',
    function: {
      name: 'view_file',
      description: 'View contents of a file or list directory contents',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to file or directory to view'
          },
          start_line: {
            type: 'number',
            description: 'Starting line number for partial file view (optional)'
          },
          end_line: {
            type: 'number',
            description: 'Ending line number for partial file view (optional)'
          }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_file',
      description: 'Create a new file with specified content',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path where the file should be created'
          },
          content: {
            type: 'string',
            description: 'Content to write to the file'
          }
        },
        required: ['path', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'str_replace_editor',
      description: 'Replace specific text in a file',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the file to edit'
          },
          old_str: {
            type: 'string',
            description: 'Text to replace (must match exactly)'
          },
          new_str: {
            type: 'string',
            description: 'Text to replace with'
          }
        },
        required: ['path', 'old_str', 'new_str']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'bash',
      description: 'Execute a bash command',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The bash command to execute'
          }
        },
        required: ['command']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_todo_list',
      description: 'Create a new todo list for planning and tracking tasks',
      parameters: {
        type: 'object',
        properties: {
          todos: {
            type: 'array',
            description: 'Array of todo items',
            items: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'Unique identifier for the todo item'
                },
                content: {
                  type: 'string',
                  description: 'Description of the todo item'
                },
                status: {
                  type: 'string',
                  enum: ['pending', 'in_progress', 'completed'],
                  description: 'Current status of the todo item'
                },
                priority: {
                  type: 'string',
                  enum: ['high', 'medium', 'low'],
                  description: 'Priority level of the todo item'
                }
              },
              required: ['id', 'content', 'status', 'priority']
            }
          }
        },
        required: ['todos']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_todo_list',
      description: 'Update existing todos in the todo list',
      parameters: {
        type: 'object',
        properties: {
          updates: {
            type: 'array',
            description: 'Array of todo updates',
            items: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'ID of the todo item to update'
                },
                status: {
                  type: 'string',
                  enum: ['pending', 'in_progress', 'completed'],
                  description: 'New status for the todo item'
                },
                content: {
                  type: 'string',
                  description: 'New content for the todo item'
                },
                priority: {
                  type: 'string',
                  enum: ['high', 'medium', 'low'],
                  description: 'New priority for the todo item'
                }
              },
              required: ['id']
            }
          }
        },
        required: ['updates']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'perplexity_search',
      description: 'Search the web using Perplexity for current information, documentation, and research',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query to look up'
          },
          max_results: {
            type: 'number',
            description: 'Maximum number of results to return (default: 10)'
          },
          summarize: {
            type: 'boolean',
            description: 'Whether to summarize results for concise output (default: true)'
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_mcp_tools',
      description: 'List all available MCP tools from connected servers',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'call_mcp_tool',
      description: 'Call an MCP tool with specified arguments',
      parameters: {
        type: 'object',
        properties: {
          tool_name: {
            type: 'string',
            description: 'Name of the MCP tool to call'
          },
          arguments: {
            type: 'object',
            description: 'Arguments to pass to the MCP tool'
          }
        },
        required: ['tool_name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'semantic_search',
      description: 'Search through the codebase using semantic similarity to find relevant code snippets, functions, classes, and files',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query - can be a description of what you\'re looking for, error messages, function names, or technical concepts'
          },
          max_results: {
            type: 'number',
            description: 'Maximum number of results to return (default: 5, max: 20)',
            minimum: 1,
            maximum: 20
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'index_project',
      description: 'Index the current project for semantic search. This creates embeddings of all code files to enable semantic search functionality',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_index_status',
      description: 'Get the current status of the semantic search index, including whether it\'s enabled and how many chunks are indexed',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  }
];

export function getAllTools(): GrokTool[] {
  const mcpManager = McpManager.getInstance();
  const mcpTools = mcpManager.getAllTools();
  
  // Convert MCP tools to Grok tools
  const dynamicMcpTools: GrokTool[] = mcpTools.map(tool => ({
    type: 'function',
    function: {
      name: `mcp_${tool.serverName}_${tool.name}`,
      description: `[MCP: ${tool.serverName}] ${tool.description || tool.name}`,
      parameters: tool.inputSchema || {
        type: 'object',
        properties: {},
        required: []
      }
    }
  }));

  return [...GROK_TOOLS, ...dynamicMcpTools];
}