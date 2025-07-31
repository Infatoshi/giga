import { GigaClient, GrokMessage, GrokToolCall } from "../giga/client";
import { GROK_TOOLS, getAllTools } from "../giga/tools";
import { TextEditorTool, BashTool, TodoTool, ConfirmationTool, McpTool, PerplexityTool } from "../tools";
import { ToolResult } from "../types";
import { EventEmitter } from "events";
import { createTokenCounter, TokenCounter } from "../utils/token-counter";
import { loadCustomInstructions } from "../utils/custom-instructions";
import { loadApiKeys } from "../utils/api-keys";
import { McpManager } from "../mcp/mcp-manager";
import { sessionManager } from "../utils/session-manager";
import { expertModelsManager, ExpertModelsConfig } from "../utils/expert-models-manager";
import { modeManager } from "../utils/mode-manager";
import { AgentMode } from "../types";

export interface ChatEntry {
  type: "user" | "assistant" | "tool_result";
  content: string;
  timestamp: Date;
  toolCalls?: GrokToolCall[];
  toolCall?: GrokToolCall;
  toolResult?: { success: boolean; output?: string; error?: string; metadata?: { userSummary?: string; query?: string; [key: string]: any; } };
  isStreaming?: boolean;
  metrics?: {
    prefillTimeMs: number;
    decodeTimeMs: number;
    outputTokens: number;
    tokensPerSecond: number;
  };
}

export interface StreamingChunk {
  type: "content" | "tool_calls" | "tool_result" | "done" | "token_count";
  content?: string;
  toolCalls?: GrokToolCall[];
  toolCall?: GrokToolCall;
  toolResult?: ToolResult;
  tokenCount?: number;
}

export class GigaAgent extends EventEmitter {
  private gigaClient: GigaClient;
  private textEditor: TextEditorTool;
  private bash: BashTool;
  private todoTool: TodoTool;
  private confirmationTool: ConfirmationTool;
  private mcpTool: McpTool;
  private perplexityTool: PerplexityTool;
  private mcpManager: McpManager;
  private chatHistory: ChatEntry[] = [];
  private messages: GrokMessage[] = [];
  private tokenCounter: TokenCounter;
  private abortController: AbortController | null = null;
  private selectedCustomPrompt: string | null = null;
  private baseSystemPrompt: string;

  constructor(apiKey: string, groqApiKey?: string) {
    super();
    
    // Load all API keys from settings file and environment variables
    const savedKeys = loadApiKeys();
    const xaiKey = apiKey || savedKeys.xaiApiKey || process.env.XAI_API_KEY;
    const groqKey = groqApiKey || savedKeys.groqApiKey || process.env.GROQ_API_KEY;
    const anthropicKey = savedKeys.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
    const openRouterKey = savedKeys.openRouterApiKey || process.env.OPENROUTER_API_KEY;
    const googleKey = savedKeys.googleApiKey || process.env.GOOGLE_API_KEY;
    const cerebrasKey = savedKeys.cerebrasApiKey || process.env.CEREBRAS_API_KEY;
    const perplexityKey = savedKeys.perplexityApiKey || process.env.PERPLEXITY_API_KEY;
    const openaiKey = savedKeys.openaiApiKey || process.env.OPENAI_API_KEY;
    
    if (!xaiKey) {
      throw new Error('XAI API key is required. Please configure it in /providers or set XAI_API_KEY environment variable.');
    }
    
    this.gigaClient = new GigaClient(
      xaiKey,
      undefined,
      groqKey,
      anthropicKey,
      openRouterKey,
      googleKey,
      cerebrasKey,
      perplexityKey,
      openaiKey,
      savedKeys.ollamaBaseUrl
    );
    this.textEditor = new TextEditorTool();
    this.bash = new BashTool();
    this.todoTool = new TodoTool();
    this.confirmationTool = new ConfirmationTool();
    this.mcpTool = new McpTool();
    this.perplexityTool = new PerplexityTool();
    this.mcpManager = McpManager.getInstance();
    this.tokenCounter = createTokenCounter("grok-4-latest");

    // Initialize MCP connections
    this.initializeMcpConnections();

    // Attempt to migrate expert models config from sessions if needed
    expertModelsManager.migrateFromAllSessions();

    // Store base system prompt
    this.baseSystemPrompt = `You are GIGA, an AI assistant that helps with file editing, coding tasks, and system operations.

You have access to these tools:
- view_file: View file contents or directory listings
- create_file: Create new files with content (ONLY use this for files that don't exist yet)
- str_replace_editor: Replace text in existing files (ALWAYS use this to edit or update existing files)
- bash: Execute bash commands (use for searching, file discovery, navigation, and system operations)
- perplexity_search: Search the web for current information, documentation, and research using Perplexity
- create_todo_list: Create a visual todo list for planning and tracking tasks
- update_todo_list: Update existing todos in your todo list

IMPORTANT TOOL USAGE RULES:
- NEVER use create_file on files that already exist - this will overwrite them completely
- ALWAYS use str_replace_editor to modify existing files, even for small changes
- Before editing a file, use view_file to see its current contents
- Use create_file ONLY when creating entirely new files that don't exist

SEARCHING AND EXPLORATION:
- Use bash with commands like 'find', 'grep', 'rg' (ripgrep), 'ls', etc. for searching files and content
- Examples: 'find . -name "*.js"', 'grep -r "function" src/', 'rg "import.*react"'
- Use bash for directory navigation, file discovery, and content searching
- view_file is best for reading specific files you already know exist

When a user asks you to edit, update, modify, or change an existing file:
1. First use view_file to see the current contents
2. Then use str_replace_editor to make the specific changes
3. Never use create_file for existing files

When a user asks you to create a new file that doesn't exist:
1. Use create_file with the full content

TASK PLANNING WITH TODO LISTS:
- For complex requests with multiple steps, ALWAYS create a todo list first to plan your approach
- Use create_todo_list to break down tasks into manageable items with priorities
- Mark tasks as 'in_progress' when you start working on them (only one at a time)
- Mark tasks as 'completed' immediately when finished
- Use update_todo_list to track your progress throughout the task
- Todo lists provide visual feedback with colors: ✅ Green (completed), 🔄 Cyan (in progress), ⏳ Yellow (pending)
- Always create todos with priorities: 'high' (🔴), 'medium' (🟡), 'low' (🟢)

USER CONFIRMATION SYSTEM:
File operations (create_file, str_replace_editor) and bash commands will automatically request user confirmation before execution. The confirmation system will show users the actual content or command before they decide. Users can choose to approve individual operations or approve all operations of that type for the session.

If a user rejects an operation, the tool will return an error and you should not proceed with that specific operation.

Be helpful, direct, and efficient. Always explain what you're doing and show the results.

IMPORTANT RESPONSE GUIDELINES:
- After using tools, do NOT respond with pleasantries like "Thanks for..." or "Great!"
- Only provide necessary explanations or next steps if relevant to the task
- Keep responses concise and focused on the actual work being done
- If a tool execution completes the user's request, you can remain silent or give a brief confirmation

Current working directory: ${process.cwd()}`;

    // Initialize with system message
    this.updateSystemPrompt();
  }

  private async initializeMcpConnections(): Promise<void> {
    try {
      await this.mcpManager.initializeAllServers();
    } catch (error) {
      console.warn('Failed to initialize some MCP servers:', error);
    }
  }

  async refreshMcpConnections(): Promise<void> {
    try {
      await this.mcpManager.refreshConnections();
    } catch (error) {
      console.warn('Failed to refresh MCP connections:', error);
    }
  }

  async processUserMessage(message: string): Promise<ChatEntry[]> {
    // Add user message to conversation
    const userEntry: ChatEntry = {
      type: "user",
      content: message,
      timestamp: new Date(),
    };
    this.chatHistory.push(userEntry);
    this.messages.push({ role: "user", content: message });

    const newEntries: ChatEntry[] = [userEntry];
    const maxToolRounds = 20; // Prevent infinite loops
    let toolRounds = 0;

    try {
      // For initial response, always use the main model - expert routing happens at tool level
      let currentResponse = await this.gigaClient.chat(
        this.messages,
        getAllTools()
      );

      // Agent loop - continue until no more tool calls or max rounds reached
      while (toolRounds < maxToolRounds) {
        const assistantMessage = currentResponse.choices[0]?.message;

        if (!assistantMessage) {
          throw new Error("No response from Grok");
        }

        // Handle tool calls
        if (
          assistantMessage.tool_calls &&
          assistantMessage.tool_calls.length > 0
        ) {
          toolRounds++;

          // Add assistant message with tool calls
          const assistantEntry: ChatEntry = {
            type: "assistant",
            content: assistantMessage.content || "Using tools to help you...",
            timestamp: new Date(),
            toolCalls: assistantMessage.tool_calls,
          };
          this.chatHistory.push(assistantEntry);
          newEntries.push(assistantEntry);

          // Add assistant message to conversation
          this.messages.push({
            role: "assistant",
            content: assistantMessage.content || "",
            tool_calls: assistantMessage.tool_calls,
          } as any);

          // Execute tool calls
          for (const toolCall of assistantMessage.tool_calls) {
            const result = await this.executeTool(toolCall);
            
            // Log expert model usage for debugging
            const expertModel = this.getExpertModelForTool(toolCall.function.name);
            if (expertModel) {
              console.log(`DEBUG: Used expert model ${expertModel} for tool ${toolCall.function.name}`);
            }

            const toolResultEntry: ChatEntry = {
              type: "tool_result",
              content: result.success
                ? result.output || "Success"
                : result.error || "Error occurred",
              timestamp: new Date(),
              toolCall: toolCall,
              toolResult: result,
            };
            this.chatHistory.push(toolResultEntry);
            newEntries.push(toolResultEntry);

            // Add tool result to messages with proper format (needed for AI context)
            this.messages.push({
              role: "tool",
              content: result.success
                ? result.output || "Success"
                : result.error || "Error",
              tool_call_id: toolCall.id,
            });
          }

          // Get next response - this might contain more tool calls
          // Use the main model for coordinating between tools
          currentResponse = await this.gigaClient.chat(
            this.messages,
            getAllTools()
          );
        } else {
          // No more tool calls, add final response
          const finalEntry: ChatEntry = {
            type: "assistant",
            content:
              assistantMessage.content ||
              "I understand, but I don't have a specific response.",
            timestamp: new Date(),
            metrics: currentResponse.metrics,
          };
          this.chatHistory.push(finalEntry);
          this.messages.push({
            role: "assistant",
            content: assistantMessage.content || "",
          });
          newEntries.push(finalEntry);
          break; // Exit the loop
        }
      }

      if (toolRounds >= maxToolRounds) {
        const warningEntry: ChatEntry = {
          type: "assistant",
          content:
            "Maximum tool execution rounds reached. Stopping to prevent infinite loops.",
          timestamp: new Date(),
        };
        this.chatHistory.push(warningEntry);
        newEntries.push(warningEntry);
      }

      return newEntries;
    } catch (error: any) {
      const errorEntry: ChatEntry = {
        type: "assistant",
        content: `Sorry, I encountered an error: ${error.message}`,
        timestamp: new Date(),
      };
      this.chatHistory.push(errorEntry);
      return [userEntry, errorEntry];
    }
  }

  private messageReducer(previous: any, item: any): any {
    const reduce = (acc: any, delta: any) => {
      acc = { ...acc };
      for (const [key, value] of Object.entries(delta)) {
        if (acc[key] === undefined || acc[key] === null) {
          acc[key] = value;
          // Clean up index properties from tool calls
          if (Array.isArray(acc[key])) {
            for (const arr of acc[key]) {
              delete arr.index;
            }
          }
        } else if (typeof acc[key] === "string" && typeof value === "string") {
          (acc[key] as string) += value;
        } else if (Array.isArray(acc[key]) && Array.isArray(value)) {
          const accArray = acc[key] as any[];
          for (let i = 0; i < value.length; i++) {
            if (!accArray[i]) accArray[i] = {};
            accArray[i] = reduce(accArray[i], value[i]);
          }
        } else if (typeof acc[key] === "object" && typeof value === "object") {
          acc[key] = reduce(acc[key], value);
        }
      }
      return acc;
    };

    return reduce(previous, item.choices[0]?.delta || {});
  }

  async *processUserMessageStream(
    message: string
  ): AsyncGenerator<StreamingChunk, void, unknown> {
    // Create new abort controller for this request
    this.abortController = new AbortController();
    
    // Add user message to conversation
    const userEntry: ChatEntry = {
      type: "user",
      content: message,
      timestamp: new Date(),
    };
    this.chatHistory.push(userEntry);
    this.messages.push({ role: "user", content: message });

    // Calculate input tokens
    const inputTokens = this.tokenCounter.countMessageTokens(
      this.messages as any
    );
    yield {
      type: "token_count",
      tokenCount: inputTokens,
    };

    const maxToolRounds = 30; // Prevent infinite loops
    let toolRounds = 0;
    let totalOutputTokens = 0;

    try {
      // Agent loop - continue until no more tool calls or max rounds reached
      while (toolRounds < maxToolRounds) {
        // Check if operation was cancelled
        if (this.abortController?.signal.aborted) {
          yield {
            type: "content",
            content: "\n\n[Operation cancelled by user]",
          };
          yield { type: "done" };
          return;
        }

        // Stream response and accumulate
        // Use the main model for conversation flow - expert routing happens at tool level
        const stream = this.gigaClient.chatStream(this.messages, getAllTools());
        let accumulatedMessage: any = {};
        let accumulatedContent = "";
        let toolCallsYielded = false;

        for await (const chunk of stream) {
          // Check for cancellation in the streaming loop
          if (this.abortController?.signal.aborted) {
            yield {
              type: "content",
              content: "\n\n[Operation cancelled by user]",
            };
            yield { type: "done" };
            return;
          }

          if (!chunk.choices?.[0]) continue;

          // Accumulate the message using reducer
          accumulatedMessage = this.messageReducer(accumulatedMessage, chunk);

          // Check for tool calls - yield when we have complete tool calls with function names
          if (!toolCallsYielded && accumulatedMessage.tool_calls?.length > 0) {
            // Check if we have at least one complete tool call with a function name
            const hasCompleteTool = accumulatedMessage.tool_calls.some(
              (tc: any) => tc.function?.name
            );
            if (hasCompleteTool) {
              yield {
                type: "tool_calls",
                toolCalls: accumulatedMessage.tool_calls,
              };
              toolCallsYielded = true;
            }
          }

          // Stream content as it comes
          if (chunk.choices[0].delta?.content) {
            accumulatedContent += chunk.choices[0].delta.content;

            // Update token count in real-time
            const currentOutputTokens =
              this.tokenCounter.estimateStreamingTokens(accumulatedContent);
            totalOutputTokens = currentOutputTokens;

            yield {
              type: "content",
              content: chunk.choices[0].delta.content,
            };

            // Emit token count update
            yield {
              type: "token_count",
              tokenCount: inputTokens + totalOutputTokens,
            };
          }
        }

        // Add assistant entry to history
        const assistantEntry: ChatEntry = {
          type: "assistant",
          content: accumulatedMessage.content || "Using tools to help you...",
          timestamp: new Date(),
          toolCalls: accumulatedMessage.tool_calls || undefined,
        };
        this.chatHistory.push(assistantEntry);

        // Add accumulated message to conversation
        this.messages.push({
          role: "assistant",
          content: accumulatedMessage.content || "",
          tool_calls: accumulatedMessage.tool_calls,
        } as any);

        // Handle tool calls if present
        if (accumulatedMessage.tool_calls?.length > 0) {
          toolRounds++;

          // Only yield tool_calls if we haven't already yielded them during streaming
          if (!toolCallsYielded) {
            yield {
              type: "tool_calls",
              toolCalls: accumulatedMessage.tool_calls,
            };
          }

          // Execute tools
          for (const toolCall of accumulatedMessage.tool_calls) {
            // Check for cancellation before executing each tool
            if (this.abortController?.signal.aborted) {
              yield {
                type: "content",
                content: "\n\n[Operation cancelled by user]",
              };
              yield { type: "done" };
              return;
            }

            const result = await this.executeTool(toolCall);
            
            // Log expert model usage for debugging
            const expertModel = this.getExpertModelForTool(toolCall.function.name);
            if (expertModel) {
              console.log(`DEBUG: Used expert model ${expertModel} for tool ${toolCall.function.name}`);
            }

            const toolResultEntry: ChatEntry = {
              type: "tool_result",
              content: result.success
                ? result.output || "Success"
                : result.error || "Error occurred",
              timestamp: new Date(),
              toolCall: toolCall,
              toolResult: result,
            };
            this.chatHistory.push(toolResultEntry);

            yield {
              type: "tool_result",
              toolCall,
              toolResult: result,
            };

            // Add tool result with proper format (needed for AI context)
            this.messages.push({
              role: "tool",
              content: result.success
                ? result.output || "Success"
                : result.error || "Error",
              tool_call_id: toolCall.id,
            });
          }

          // Continue the loop to get the next response (which might have more tool calls)
        } else {
          // No tool calls, we're done - add metrics to the last assistant entry
          const lastAssistantEntry = this.chatHistory
            .slice()
            .reverse()
            .find(entry => entry.type === "assistant");
          
          if (lastAssistantEntry) {
            const streamingMetrics = this.gigaClient.getLastStreamingMetrics();
            if (streamingMetrics) {
              lastAssistantEntry.metrics = streamingMetrics;
            }
          }
          break;
        }
      }

      if (toolRounds >= maxToolRounds) {
        yield {
          type: "content",
          content:
            "\n\nMaximum tool execution rounds reached. Stopping to prevent infinite loops.",
        };
      }

      yield { type: "done" };
    } catch (error: any) {
      // Check if this was a cancellation
      if (this.abortController?.signal.aborted) {
        yield {
          type: "content",
          content: "\n\n[Operation cancelled by user]",
        };
        yield { type: "done" };
        return;
      }

      const errorEntry: ChatEntry = {
        type: "assistant",
        content: `Sorry, I encountered an error: ${error.message}`,
        timestamp: new Date(),
      };
      this.chatHistory.push(errorEntry);
      yield {
        type: "content",
        content: errorEntry.content,
      };
      yield { type: "done" };
    } finally {
      // Clean up abort controller
      this.abortController = null;
    }
  }

  private getExpertModelForTool(toolName: string): string | null {
    const expertConfig = expertModelsManager.getExpertModelsConfig();
    
    // Check if current mode allows expert models
    if (!modeManager.shouldAllowExpertModels() || !expertConfig.enabled) {
      return null;
    }

    // Fast operations (file navigation, simple commands)
    const fastTools = [
      'view_file',
      'bash'  // Only simple bash commands - complex ones should use reasoning
    ];

    // Code-specific operations
    const codeTools = [
      'str_replace_editor',
      'create_file'
    ];

    // Reasoning-heavy operations  
    const reasoningTools = [
      'create_todo_list',
      'update_todo_list'
    ];

    // Tool orchestration and complex workflows
    const toolsTools = [
      'list_mcp_tools',
      'call_mcp_tool',
      'perplexity_search'
    ];

    if (fastTools.includes(toolName)) {
      return expertConfig.fastModel;
    } else if (codeTools.includes(toolName)) {
      return expertConfig.codeModel;
    } else if (reasoningTools.includes(toolName)) {
      return expertConfig.reasoningModel;
    } else if (toolsTools.includes(toolName) || toolName.startsWith('mcp_')) {
      return expertConfig.toolsModel;
    }

    return null;
  }

  private async executeTool(toolCall: GrokToolCall): Promise<ToolResult> {
    try {
      const args = JSON.parse(toolCall.function.arguments);

      switch (toolCall.function.name) {
        case "view_file":
          const range: [number, number] | undefined =
            args.start_line && args.end_line
              ? [args.start_line, args.end_line]
              : undefined;
          return await this.textEditor.view(args.path, range);

        case "create_file":
          return await this.textEditor.create(args.path, args.content);

        case "str_replace_editor":
          return await this.textEditor.strReplace(
            args.path,
            args.old_str,
            args.new_str
          );

        case "bash":
          return await this.bash.execute(args.command);

        case "create_todo_list":
          return await this.todoTool.createTodoList(args.todos);

        case "update_todo_list":
          return await this.todoTool.updateTodoList(args.updates);

        case "perplexity_search":
          return await this.perplexityTool.search(args.query, args.max_results, args.summarize);

        case "list_mcp_tools":
          return await this.mcpTool.listMcpTools();

        case "call_mcp_tool":
          return await this.mcpTool.callMcpTool(args.tool_name, args.arguments || {});

        default:
          // Check if it's a dynamic MCP tool
          if (toolCall.function.name.startsWith("mcp_")) {
            const parts = toolCall.function.name.split("_");
            if (parts.length >= 3) {
              const serverName = parts[1];
              const toolName = parts.slice(2).join("_");
              return await this.mcpTool.callMcpTool(toolName, args);
            }
          }
          
          return {
            success: false,
            error: `Unknown tool: ${toolCall.function.name}`,
          };
      }
    } catch (error: any) {
      return {
        success: false,
        error: `Tool execution error: ${error.message}`,
      };
    }
  }

  getChatHistory(): ChatEntry[] {
    return [...this.chatHistory];
  }

  getCurrentDirectory(): string {
    return this.bash.getCurrentDirectory();
  }

  async executeBashCommand(command: string): Promise<ToolResult> {
    return await this.bash.execute(command);
  }

  getCurrentModel(): string {
    return this.gigaClient.getCurrentModel();
  }

  setModel(model: string): void {
    this.gigaClient.setModel(model);
    // Update token counter for new model
    this.tokenCounter.dispose();
    this.tokenCounter = createTokenCounter(model);
  }

  abortCurrentOperation(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  setSelectedCustomPrompt(promptName: string | null): void {
    this.selectedCustomPrompt = promptName;
    this.updateSystemPrompt();
  }

  getSelectedCustomPrompt(): string | null {
    return this.selectedCustomPrompt;
  }

  // Method to restore conversation state when switching conversations
  restoreConversation(chatEntries: ChatEntry[]): void {
    // Clear current messages (but keep system prompt)
    const systemMessage = this.messages.find(m => m.role === 'system');
    this.messages = systemMessage ? [systemMessage] : [];
    this.chatHistory = [];

    // Convert ChatEntry[] back to GrokMessage[] format
    for (const entry of chatEntries) {
      if (entry.type === 'user') {
        this.messages.push({
          role: 'user',
          content: entry.content
        });
      } else if (entry.type === 'assistant') {
        this.messages.push({
          role: 'assistant',
          content: entry.content,
          tool_calls: entry.toolCalls
        } as any);
      } else if (entry.type === 'tool_result' && entry.toolCall) {
        this.messages.push({
          role: 'tool',
          content: entry.content,
          tool_call_id: entry.toolCall.id
        });
      }
    }

    // Restore chat history
    this.chatHistory = [...chatEntries];
  }

  updateMode(mode: AgentMode): void {
    modeManager.setMode(mode);
  }

  getCurrentMode(): AgentMode {
    return modeManager.getCurrentMode();
  }

  getModeConfig() {
    return modeManager.getCurrentModeConfig();
  }

  private updateSystemPrompt(): void {
    let systemContent = '';
    
    // If a custom prompt is selected, use ONLY that prompt
    if (this.selectedCustomPrompt) {
      const { getPromptByName } = require('../utils/prompts');
      const customPrompt = getPromptByName(this.selectedCustomPrompt);
      if (customPrompt) {
        systemContent = customPrompt.content;
      } else {
        // Fallback to base system prompt if custom prompt not found
        systemContent = this.baseSystemPrompt;
      }
    } else {
      // Use base GIGA system prompt when no custom prompt is selected
      systemContent = this.baseSystemPrompt;
    }
    
    // Add mode-specific instructions
    const currentMode = modeManager.getCurrentMode();
    if (currentMode !== AgentMode.GIGA) {
      systemContent += `\n\nCURRENT MODE: ${modeManager.getModeDisplayName()}\n${modeManager.getModeDescription()}`;
      
      if (currentMode === AgentMode.PLAN) {
        systemContent += '\n\nIn PLAN MODE: Focus on planning and analysis. Avoid complex tool usage - prefer thinking through problems step by step.';
      } else if (currentMode === AgentMode.CHILL) {
        systemContent += '\n\nIn CHILL MODE: All capabilities available but ask for permission before making changes to files or running potentially impactful commands.';
      }
    }
    
    // Update or add system message
    if (this.messages.length > 0 && this.messages[0].role === 'system') {
      this.messages[0].content = systemContent;
    } else {
      this.messages.unshift({
        role: 'system',
        content: systemContent
      });
    }
  }
}
