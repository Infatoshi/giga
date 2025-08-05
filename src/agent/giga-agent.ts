import { GigaClient, GrokMessage, GrokToolCall } from "../giga/client";
import { GROK_TOOLS, getAllTools } from "../giga/tools";
import { TextEditorTool, BashTool, TodoTool, ConfirmationTool, McpTool, SemanticSearchTool } from "../tools";
import { ToolResult } from "../types";
import { EventEmitter } from "events";
import { createTokenCounter, TokenCounter } from "../utils/token-counter";
import { ConversationTokenTracker } from "../utils/conversation-token-tracker";
import { loadCustomInstructions } from "../utils/custom-instructions";
import { loadApiKeys } from "../utils/api-keys";
import { McpManager } from "../mcp/mcp-manager";
import { sessionManager } from "../utils/session-manager";
import { expertModelsManager, ExpertModelsConfig } from "../utils/expert-models-manager";
import { modeManager } from "../utils/mode-manager";
import { AgentMode } from "../types";
import { RAGContextService } from "../services/rag-context-service";
import { GlobalSettingsManager } from "../utils/global-settings";
import { ModelInfo } from "../utils/dynamic-model-fetcher";

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
  type: "content" | "tool_calls" | "tool_result" | "done" | "token_count" | "status";
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
  private semanticSearchTool: SemanticSearchTool;
  private mcpManager: McpManager;
  private ragContextService: RAGContextService;
  private chatHistory: ChatEntry[] = [];
  private messages: GrokMessage[] = [];
  private tokenCounter: TokenCounter;
  private tokenTracker: ConversationTokenTracker | null = null;
  private availableModels: ModelInfo[] = [];
  private abortController: AbortController | null = null;
  private selectedCustomPrompt: string | null = null;
  private lastBashOutput: string | null = null;
  private async getBaseSystemPrompt(): Promise<string> {
    const directoryStructure = await this.getDirectoryStructure();
    const directoryContents = await this.getDirectoryContents();
    const ragIndexStatus = await this.getRagIndexStatus();
    const mcpSection = await this.generateMcpSection();
    
    return `You are GIGA, an AI assistant that helps with file editing, coding tasks, and system operations.

You have access to these tools:
- view_file: View file contents or directory listings
- create_file: Create new files with content (ONLY use this for files that don't exist yet)
- str_replace_editor: Replace text in existing files (ALWAYS use this to edit or update existing files)
- bash: Execute bash commands (use for searching, file discovery, navigation, and system operations)
- semantic_search: Search through your codebase using semantic similarity to find relevant code snippets, functions, classes, and files
- index_project: Index the current project for semantic search (creates embeddings of all code files)
- get_index_status: Get the current status of the semantic search index
- create_todo_list: Create a visual todo list for planning and tracking tasks
- update_todo_list: Update existing todos in your todo list${mcpSection}

IMPORTANT TOOL USAGE RULES:
- NEVER use create_file on files that already exist - this will overwrite them completely
- ALWAYS use str_replace_editor to modify existing files, even for small changes
- Before editing a file, use view_file to see its current contents
- Use create_file ONLY when creating entirely new files that don't exist
SEARCHING AND EXPLORATION: Use bash commands like 'find', 'grep', 'rg', and 'ls' for file discovery and content search. Use 'view_file' to read specific files.

EDITING AND CREATING FILES: To edit an existing file, first use 'view_file' to see its contents, then use 'str_replace_editor' to make changes. To create a new file, use 'create_file'.

TASK PLANNING: For complex requests, create a todo list to plan your approach. Use 'create_todo_list' to break down tasks and 'update_todo_list' to track progress ('in_progress', 'completed'). Priorities can be set to 'high', 'medium', or 'low'.

USER CONFIRMATION: File and bash operations require user confirmation. If an operation is rejected, the tool will return an error, and you should not proceed.

SEMANTIC SEARCH (RAG ENABLED): When RAG is enabled, code context may be automatically added to your prompts. Use 'semantic_search' to find code, and run 'index_project' once per project to enable this feature.
  96 | RESPONSE FORMATTING:
  97 | - Your output MUST emulate a terminal/CLI. Use only plain text, symbols, and indentation.
  98 | - STRICTLY NO MARKDOWN. Never use '#', '##', or '###' for headers.
  99 | - BE EXTREMELY SPATIALLY CONSCIOUS. Compress information. Use single lines with separators (e.g., commas or pipes) instead of multi-line lists.
 100 | - For lists, use simple bullets like '*' or '-'. Your entire response should be a single, dense block of text.
Current working directory: ${process.cwd()}

PROJECT CONTEXT:
Current directory: ${process.cwd()}
Directory structure: ${directoryStructure}
Directory contents: ${directoryContents}

RAG INDEX STATUS:
${ragIndexStatus}
CRITICAL SEARCH QUERY ROUTING (RAG ENABLED): When RAG is enabled, user queries like "find X" or "search for X" must use the 'semantic_search' tool, not bash commands. Use bash commands only for explicit file system operations.`;
  }

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
      openaiKey,
      savedKeys.ollamaBaseUrl
    );
    this.textEditor = new TextEditorTool();
    this.bash = new BashTool();
    this.todoTool = new TodoTool();
    this.confirmationTool = new ConfirmationTool();
    this.mcpTool = new McpTool();
    this.semanticSearchTool = new SemanticSearchTool();
    this.mcpManager = McpManager.getInstance();
    this.ragContextService = new RAGContextService();
    this.tokenCounter = createTokenCounter("grok-4-latest");

    // Initialize MCP connections
    this.initializeMcpConnections().catch(error => {
      console.warn('Failed to initialize MCP connections:', error);
    });

    // Attempt to migrate expert models config from sessions if needed
    expertModelsManager.migrateFromAllSessions();

    // Initialize with system message
    this.updateSystemPrompt().catch(console.error);
  }

  private emitStatus(message: string): void {
    this.emit('status', message);
  }

  private async initializeMcpConnections(): Promise<void> {
    try {
      this.emitStatus('Initializing MCP connections...');
      // Initialize RAG index if RAG is enabled
      await this.ensureRagIndexExists();
      
      await this.mcpManager.initializeAllServers();
      this.emitStatus('MCP connections initialized.');
    } catch (error) {
      this.emitStatus('Failed to initialize some MCP servers.');
      console.warn('Failed to initialize some MCP servers:', error);
    }
  }

  private async ensureRagIndexExists(): Promise<void> {
    try {
      // Initialize the RAG project configuration first
      const { RAGConfigManager } = await import('../utils/rag-config');
      RAGConfigManager.initializeProject();
      
      // Always attempt to initialize RAG index when Giga starts
      const indexInfo = await this.ragContextService.getIndexInfo();
      if (indexInfo.count === 0) {
        console.log('🚀 RAG index not found, creating initial index...');
        console.log('📁 This may take a moment to index your project files...');
        await this.ragContextService.indexProject();
        console.log('✅ RAG index created successfully - semantic search is now available!');
      } else {
        console.log('✅ RAG index found - semantic search is ready');
      }
    } catch (error) {
      console.warn('Failed to initialize RAG index:', error);
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
    // Enhance message with RAG context if enabled
    let processedMessage = message;
    try {
      if (this.ragContextService.isEnabled() && modeManager.getCurrentMode() === AgentMode.GIGA) {
        this.emitStatus('Enhancing prompt with RAG context...');
        const conversationHistory = this.chatHistory
          .filter(entry => entry.type === 'user')
          .slice(-3)
          .map(entry => entry.content);
        
        const enrichmentResult = await this.ragContextService.enrichUserPrompt(
          message, 
          this.lastBashOutput || undefined,
          conversationHistory
        );
        
        if (enrichmentResult.shouldEnrich) {
          processedMessage = enrichmentResult.enhancedPrompt;
          this.emitStatus(`Enhanced prompt with ${enrichmentResult.searchResults.length} context items.`);
        } else {
          this.emitStatus('No relevant RAG context found.');
        }
      }
    } catch (error) {
      this.emitStatus('Failed to enhance prompt with RAG context.');
      console.warn('Failed to enhance prompt with RAG context:', error);
      // Continue with original message
    }

    // Add user message to conversation (use original message for history)
    const userEntry: ChatEntry = {
      type: "user",
      content: message,
      timestamp: new Date(),
    };
    this.chatHistory.push(userEntry);
    this.messages.push({ role: "user", content: processedMessage });

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
    
    // Enhance message with RAG context if enabled
    let processedMessage = message;
    
    if (this.tokenTracker) {
      this.tokenTracker.reset();
      this.tokenTracker.addTokens(message);
    }
    try {
      if (this.ragContextService.isEnabled() && modeManager.getCurrentMode() === AgentMode.GIGA) {
        this.emitStatus('Enhancing prompt with RAG context...');
        const conversationHistory = this.chatHistory
          .filter(entry => entry.type === 'user')
          .slice(-3)
          .map(entry => entry.content);
        
        const enrichmentResult = await this.ragContextService.enrichUserPrompt(
          message, 
          this.lastBashOutput || undefined,
          conversationHistory
        );
        
        if (enrichmentResult.shouldEnrich) {
          processedMessage = enrichmentResult.enhancedPrompt;
          this.emitStatus(`Enhanced prompt with ${enrichmentResult.searchResults.length} context items.`);
        } else {
          this.emitStatus('No relevant RAG context found.');
        }
      }
    } catch (error) {
      this.emitStatus('Failed to enhance prompt with RAG context.');
      console.warn('Failed to enhance prompt with RAG context:', error);
      // Continue with original message
    }
    
    // Add user message to conversation (use original message for history)
    const userEntry: ChatEntry = {
      type: "user",
      content: message,
      timestamp: new Date(),
    };
    this.chatHistory.push(userEntry);
    this.messages.push({ role: "user", content: processedMessage });

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

            const chunkContent = chunk.choices[0].delta.content;
            if (this.tokenTracker) {
              this.tokenTracker.addTokens(chunkContent);
            }
            // Update token count in real-time
            const currentOutputTokens =
              this.tokenCounter.estimateStreamingTokens(accumulatedContent);
            totalOutputTokens = currentOutputTokens;

            yield {
              type: "content",
              content: chunkContent,
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
      'call_mcp_tool'
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
          const bashResult = await this.bash.execute(args.command);
          // Store bash output for RAG context enhancement
          if (bashResult.success && bashResult.output) {
            this.lastBashOutput = bashResult.output;
          }
          return bashResult;

        case "create_todo_list":
          return await this.todoTool.createTodoList(args.todos);

        case "update_todo_list":
          return await this.todoTool.updateTodoList(args.updates);

        case "list_mcp_tools":
          return await this.mcpTool.listMcpTools();

        case "call_mcp_tool":
          return await this.mcpTool.callMcpTool(args.tool_name, args.arguments || {});

        case "semantic_search":
          return await this.semanticSearchTool.search(args.query, args.max_results);

        case "index_project":
          return await this.semanticSearchTool.indexProject();

        case "get_index_status":
          return await this.semanticSearchTool.getIndexStatus();

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

  setModel(model: string, allModels?: ModelInfo[]): void {
    this.gigaClient.setModel(model);
    // Update token counter for new model
    this.tokenCounter.dispose();
    this.tokenCounter = createTokenCounter(model);
    
    if (allModels) {
      this.availableModels = allModels;
    }
    
    const modelInfo = this.availableModels.find(m => m.id === model);
    if (modelInfo && modelInfo.context_length) {
      this.tokenTracker = new ConversationTokenTracker({
        model: model,
        maxTokens: modelInfo.context_length,
      });
    } else {
      this.tokenTracker = null;
    }
  }

  abortCurrentOperation(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  getTokenTrackerInfo() {
    return this.tokenTracker?.a;
  }

  setSelectedCustomPrompt(promptName: string | null): void {
    this.selectedCustomPrompt = promptName;
    this.updateSystemPrompt().catch(console.error);
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

  async toggleMcpServer(serverName: string, enabled: boolean): Promise<{ success: boolean; message: string }> {
    try {
      const success = await this.mcpManager.setServerEnabled(serverName, enabled);
      
      if (success) {
        // Immediately refresh system prompt for current conversation
        await this.updateSystemPrompt();
        
        const action = enabled ? 'enabled' : 'disabled';
        return {
          success: true,
          message: `MCP server '${serverName}' has been ${action} and system prompt updated.`
        };
      } else {
        return {
          success: false,
          message: `MCP server '${serverName}' not found.`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to toggle MCP server '${serverName}': ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  getMcpServerStatus(): { name: string; enabled: boolean; connected: boolean; type: string }[] {
    const { loadAddedMcpServers } = require('../utils/added-mcp-servers');
    const allServers = loadAddedMcpServers();
    return allServers.map(server => ({
      name: server.name,
      enabled: server.enabled,
      connected: this.mcpManager.isServerConnected(server.name),
      type: server.type
    }));
  }

  private async getDirectoryStructure(): Promise<string> {
    try {
      // Bypass confirmation for context commands
      const result = await this.executeCommandDirectly('tree -L 2');
      return result.success ? result.output : 'tree command not available';
    } catch {
      return 'tree command not available';
    }
  }

  private async getDirectoryContents(): Promise<string> {
    try {
      // Bypass confirmation for context commands
      const result = await this.executeCommandDirectly('ls -la');
      return result.success ? result.output : 'ls command failed';
    } catch {
      return 'ls command failed';
    }
  }

  private async executeCommandDirectly(command: string): Promise<ToolResult> {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    try {
      if (command.startsWith('cd ')) {
        const newDir = command.substring(3).trim();
        try {
          process.chdir(newDir);
          return {
            success: true,
            output: `Changed directory to: ${process.cwd()}`
          };
        } catch (error: any) {
          return {
            success: false,
            error: `Cannot change directory: ${error.message}`
          };
        }
      }

      const { stdout, stderr } = await execAsync(command, {
        cwd: this.bash.getCurrentDirectory(),
        timeout: 10000,
        maxBuffer: 1024 * 1024
      });

      const output = stdout + (stderr ? `\nSTDERR: ${stderr}` : '');
      
      return {
        success: true,
        output: output.trim() || 'Command executed successfully (no output)'
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Command failed: ${error.message}`
      };
    }
  }

  private async updateSystemPrompt(): Promise<void> {
    let systemContent = '';
    
    // If a custom prompt is selected, use ONLY that prompt
    if (this.selectedCustomPrompt) {
      const { getPromptByName } = require('../utils/prompts');
      const customPrompt = getPromptByName(this.selectedCustomPrompt);
      if (customPrompt) {
        systemContent = customPrompt.content;
      } else {
        // Fallback to base system prompt if custom prompt not found
        systemContent = await this.getBaseSystemPrompt();
      }
    } else {
      // Use base GIGA system prompt when no custom prompt is selected
      systemContent = await this.getBaseSystemPrompt();
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

  private async getRagIndexStatus(): Promise<string> {
    try {
      // Initialize RAG context service to get index info
      const ragService = new RAGContextService();
      
      // Check if there's an existing index
      const semanticSearchTool = new SemanticSearchTool();
      const indexInfo = await semanticSearchTool.getIndexStatus();
      
      if (indexInfo.success && indexInfo.output && indexInfo.output.includes('indexed')) {
        // Parse the index count from the response
        const match = indexInfo.output.match(/(\d+)\s+chunks?.*indexed/);
        const chunkCount = match ? parseInt(match[1]) : 0;
                                return `RAG Index: ${chunkCount} chunks indexed. Semantic search available.`;
                              } else {
                                return `RAG Index: Not indexed. Run 'index_project' to enable semantic search.`;
                              }
                            } catch (error) {
                              return 'RAG Index: Status unavailable. Semantic search may not be initialized.';
                            }
                          }
  private async generateMcpSection(): Promise<string> {
    const enabledServers = this.mcpManager.getEnabledServers();
    
    if (enabledServers.length === 0) {
      return ""; // No MCP section if no enabled servers
    }
    
    let mcpSection = "\n\nMCP TOOLS (External Documentation & Capabilities):";
    mcpSection += "\nAvailable when MCP servers are enabled:\n";
    
    for (const server of enabledServers) {
      const tools = this.mcpManager.getToolsByServer(server.name);
      if (tools.length === 0) continue;
      
      mcpSection += `\n📡 ${server.name} Server (${server.type}):\n`;
      
      // Add server-specific documentation
      if (server.name === 'context7') {
        mcpSection += `- mcp_context7_resolve-library-id: Convert library names to Context7-compatible IDs
- mcp_context7_get-library-docs: Fetch comprehensive library documentation with code examples

Context7 Usage Pattern:
1. First resolve library ID: mcp_context7_resolve-library-id(libraryName: "react")
2. Then get documentation: mcp_context7_get-library-docs(context7CompatibleLibraryID: "/react/docs", topic: "hooks", tokens: 10000)

Use Context7 tools when users ask about:
- Library installation and setup instructions
- API documentation and usage examples  
- Code snippets for specific frameworks (React, Vue, Next.js, etc.)
- Best practices and implementation patterns
- Version-specific information and migration guides\n`;
      } else {
        // Generic documentation for other servers
        tools.forEach(tool => {
          mcpSection += `- mcp_${server.name}_${tool.name}: ${tool.description || tool.name}\n`;
        });
      }
    }
    
    if (enabledServers.length > 1) {
      mcpSection += `\nMCP TOOL NAMING: All MCP tools are prefixed with 'mcp_{serverName}_{toolName}'`;
    }
    
    return mcpSection;
  }
}
