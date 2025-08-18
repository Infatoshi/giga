import { useState, useRef, useEffect, useCallback } from "react";
import { useInput, useApp } from "ink";
import { GigaAgent, ChatEntry } from "../agent/giga-agent";
import { ConfirmationService } from "../utils/confirmation-service";
import { loadAddedModels } from "../utils/added-models";
import { loadAddedMcpServers, AddedMcpServer } from "../utils/added-mcp-servers";
import { fuzzySearch } from "../utils/fuzzy-search";
import { getInstanceAvailableModels, onModelSelected } from "../utils/instance-models";
import { getAllFiles, extractFileQuery, replaceFileQuery, getFilteredItems, FileInfo } from "../utils/file-finder";
import { OpenRouterProvider, isOpenRouterModel } from "../utils/openrouter-providers";
import { setOpenRouterProvider, getOpenRouterProvider } from "../utils/added-models";
import { sessionManager } from "../utils/session-manager";
import { modeManager } from "../utils/mode-manager";
import { expertRouter } from "../utils/expert-router";
import { AgentMode } from "../types";

// Helper function to get OpenRouter models consistently
const getOpenRouterModels = (models: ModelOption[]): ModelOption[] => {
  return models.filter(model => model.description.includes('(OpenRouter)'));
};

interface UseInputHandlerProps {
  agent: GigaAgent;
  chatHistory: ChatEntry[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatEntry[]>>;
  setIsProcessing: (processing: boolean) => void;
  setIsStreaming: (streaming: boolean) => void;
  setTokenCount: (count: number) => void;
  setProcessingTime: (time: number) => void;
  setStatusMessage: (message: string | null) => void;
  processingStartTime: React.MutableRefObject<number>;
  isProcessing: boolean;
  isStreaming: boolean;
  isConfirmationActive?: boolean;
  onModeChange?: (mode: AgentMode) => void;
}

interface CommandSuggestion {
  command: string;
  description: string;
}

interface ModelOption {
  model: string;
  description: string;
}

interface Provider {
  name: string;
  keyName: string;
  description: string;
}

export function useInputHandler({
  agent,
  chatHistory,
  setChatHistory,
  setIsProcessing,
  setIsStreaming,
  setTokenCount,
  setProcessingTime,
  setStatusMessage,
  processingStartTime,
  isProcessing,
  isStreaming,
  isConfirmationActive = false,
  onModeChange,
}: UseInputHandlerProps) {
  const [input, setInput] = useState("");
  const [showCommandSuggestions, setShowCommandSuggestions] = useState(false);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [showModelSelection, setShowModelSelection] = useState(false);
  const [selectedModelIndex, setSelectedModelIndex] = useState(0);
  const [showProviderSettings, setShowProviderSettings] = useState(false);
  const [selectedProviderIndex, setSelectedProviderIndex] = useState(0);
  const [showAddModel, setShowAddModel] = useState(false);
  const [showDeleteModel, setShowDeleteModel] = useState(false);
  const [showPromptsList, setShowPromptsList] = useState(false);
  const [showAddPrompt, setShowAddPrompt] = useState(false);
  const [showDeletePrompt, setShowDeletePrompt] = useState(false);
  const [showMcpServers, setShowMcpServers] = useState(false);
  const [showAddMcpServer, setShowAddMcpServer] = useState(false);
  const [showDeleteMcpServer, setShowDeleteMcpServer] = useState(false);
  const [selectedMcpServerIndex, setSelectedMcpServerIndex] = useState(0);
  const [dynamicModels, setDynamicModels] = useState<ModelOption[]>([]);
  const [allModels, setAllModels] = useState<any[]>([]);
  const [mcpServers, setMcpServers] = useState<AddedMcpServer[]>([]);
  const [showConversationHistory, setShowConversationHistory] = useState(false);
  const [showTemperatureSelector, setShowTemperatureSelector] = useState(false);
  const [currentTemperature, setCurrentTemperature] = useState(0.7);
  const [showExpertModels, setShowExpertModels] = useState(false);
  const [showExaApiKeyInput, setShowExaApiKeyInput] = useState(false);
  
  // Route selection state
  const [showRouteSelection, setShowRouteSelection] = useState(false);
  const [routeViewMode, setRouteViewMode] = useState<'models' | 'providers'>('models');
  const [selectedRouteModelIndex, setSelectedRouteModelIndex] = useState(0);
  const [selectedRouteProviderIndex, setSelectedRouteProviderIndex] = useState(0);
  const [currentSelectedModel, setCurrentSelectedModel] = useState<string>('');
  const [routeProviders, setRouteProviders] = useState<OpenRouterProvider[]>([]);
  const [isLoadingProviders, setIsLoadingProviders] = useState(false);
  
  // Command history state
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [temporaryInput, setTemporaryInput] = useState("");
  
  // File finder state
  const [showFileFinder, setShowFileFinder] = useState(false);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [availableFiles, setAvailableFiles] = useState<FileInfo[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<string[]>([]);
  const [fileQuery, setFileQuery] = useState("");
  
  // Streaming content batching state
  const streamingBufferRef = useRef<string>("");
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Double Ctrl+C detection as fallback
  const lastCtrlCRef = useRef<number>(0);
  const ctrlCTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Batched state update for streaming content
  const flushStreamingBuffer = useCallback(() => {
    if (streamingBufferRef.current) {
      const content = streamingBufferRef.current;
      streamingBufferRef.current = "";
      
      setChatHistory((prev) =>
        prev.map((entry, idx) =>
          idx === prev.length - 1 && entry.isStreaming
            ? { ...entry, content: entry.content + content }
            : entry
        )
      );
    }
    
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
      batchTimeoutRef.current = null;
    }
  }, [setChatHistory]);

  // Debounced streaming content update
  const addStreamingContent = useCallback((content: string) => {
    streamingBufferRef.current += content;
    
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
    }
    
    batchTimeoutRef.current = setTimeout(() => {
      setImmediate(flushStreamingBuffer);
    }, 16); // 16ms debounce for ~60fps updates
  }, [flushStreamingBuffer]);

  // Helper function to add command to history
  const addToHistory = (command: string) => {
    if (command.trim() && command !== commandHistory[commandHistory.length - 1]) {
      setCommandHistory(prev => [...prev, command.trim()]);
    }
    setHistoryIndex(-1);
    setTemporaryInput("");
  };

  const closeProviderSettings = () => {
    setShowProviderSettings(false);
    setSelectedProviderIndex(0);
  };

  const closeAddModel = () => {
    setShowAddModel(false);
  };

  const closeDeleteModel = () => {
    setShowDeleteModel(false);
  };

  const closePromptsList = () => {
    setShowPromptsList(false);
  };

  const closeAddPrompt = () => {
    setShowAddPrompt(false);
  };

  const closeDeletePrompt = () => {
    setShowDeletePrompt(false);
  };

  const closeMcpServers = () => {
    setShowMcpServers(false);
    setSelectedMcpServerIndex(0);
  };

  const closeAddMcpServer = () => {
    setShowAddMcpServer(false);
  };

  const closeDeleteMcpServer = () => {
    setShowDeleteMcpServer(false);
  };

  const closeRouteSelection = () => {
    setShowRouteSelection(false);
    setRouteViewMode('models');
    setSelectedRouteModelIndex(0);
    setSelectedRouteProviderIndex(0);
    setCurrentSelectedModel('');
    setRouteProviders([]);
    setIsLoadingProviders(false);
  };

  const closeConversationHistory = () => {
    setShowConversationHistory(false);
  };

  const closeTemperatureSelector = () => {
    setShowTemperatureSelector(false);
  };
const closeExpertModels = () => {
  setShowExpertModels(false);
};

const closeExaApiKeyInput = () => {
  setShowExaApiKeyInput(false);
};

  const closeFileFinder = () => {
    setShowFileFinder(false);
    setSelectedFileIndex(0);
    setFilteredFiles([]);
    setFileQuery("");
  };

  const updateFileFinder = (currentInput: string) => {
    const queryInfo = extractFileQuery(currentInput);
    if (queryInfo) {
      const { query, isDirectory } = queryInfo;
      setFileQuery(query);
      
      if (isDirectory) {
        // Handle directory search - use simple filtering
        const filtered = getFilteredItems(availableFiles, query, true);
        setFilteredFiles(filtered);
        setShowFileFinder(true); // Always show when @ query is active
        setSelectedFileIndex(0);
      } else {
        // Handle file search
        if (query === '') {
          // Just @ typed, show recent/common files
          const recentFiles = availableFiles
            .filter(file => !file.isDirectory)
            .map(file => file.relativePath)
            .sort()
            .slice(0, 10);
          setFilteredFiles(recentFiles);
        } else {
          // Use fuzzy search for better matching
          const filtered = fuzzySearch(
            query,
            availableFiles.filter(file => !file.isDirectory),
            (file) => file.relativePath,
            10
          ).map(file => file.relativePath);
          setFilteredFiles(filtered);
        }
        
        setShowFileFinder(true); // Always show when @ query is active
        setSelectedFileIndex(0);
      }
    } else {
      setShowFileFinder(false);
      setFilteredFiles([]);
      setFileQuery("");
    }
  };
const refreshModels = (allModelsData?: any[]) => {
  if (allModelsData) {
    setAllModels(allModelsData);
  }
  const instanceModels = getInstanceAvailableModels();
  const modelOptions: ModelOption[] = instanceModels.map(model => ({
    model: model.model,
    description: `${model.description}${model.isFavorite ? ' ⭐' : ''}${model.isRecentlyUsed ? ' 🕒' : ''}`
  }));
  
  setDynamicModels(modelOptions);
};

  const refreshMcpServers = () => {
    const addedServers = loadAddedMcpServers();
    setMcpServers(addedServers);
  };

  // Helper function to get current filtered suggestions based on input
  const getFilteredSuggestions = (currentInput: string): CommandSuggestion[] => {
    return currentInput.startsWith("/")
      ? fuzzySearch(
          currentInput.substring(1), // Remove the "/" for fuzzy matching
          commandSuggestions.filter(s => s.command.startsWith("/")),
          (suggestion) => suggestion.command.substring(1), // Remove "/" for matching
          8
        )
      : fuzzySearch(
          currentInput,
          commandSuggestions,
          (suggestion) => suggestion.command,
          8
        );
  };

  useEffect(() => {
    refreshModels();
    refreshMcpServers();
    setCurrentTemperature(sessionManager.getTemperature());
    
    // Load available files
    try {
      const files = getAllFiles();
      setAvailableFiles(files);
    } catch (error) {
      console.error('Failed to load files:', error);
    }
    
    // Cleanup function to clear any pending timeouts
    return () => {
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
        batchTimeoutRef.current = null;
      }
      if (ctrlCTimeoutRef.current) {
        clearTimeout(ctrlCTimeoutRef.current);
        ctrlCTimeoutRef.current = null;
      }
    };
  }, []);

  const { exit } = useApp();

  const commandSuggestions: CommandSuggestion[] = [
    { command: "/help", description: "Show help information" },
    { command: "/intro", description: "Show getting started information" },
    { command: "/clear", description: "Start new conversation" },
    { command: "/history", description: "Browse conversation history" },
    { command: "/models", description: "Switch Grok Model" },
    { command: "/route", description: "Configure model provider routing" },
    { command: "/add-model", description: "Add models from providers" },
    { command: "/delete-model", description: "Delete added models" },
    { command: "/prompts", description: "View custom prompts" },
    { command: "/add-prompt", description: "Add custom prompt" },
    { command: "/delete-prompt", description: "Delete custom prompt" },
    { command: "/mcps", description: "View MCP servers" },
    { command: "/add-mcp", description: "Add MCP server" },
    { command: "/delete-mcp", description: "Delete MCP server" },
    { command: "/sampling", description: "Adjust sampling temperature" },
    { command: "/experts", description: "Configure expert model routing" },
    { command: "/providers", description: "Configure API Keys" },
    { command: "/exa", description: "Set your EXA API key for search" },
    { command: "/exit", description: "Exit the application" },
  ];

  const availableModels: ModelOption[] = [];

  const providerList: Provider[] = [
    { name: "OpenRouter", keyName: "openRouterApiKey", description: "OpenRouter API (Multi-model access)" },
    { name: "Anthropic", keyName: "anthropicApiKey", description: "Claude models" },
    { name: "Google", keyName: "googleApiKey", description: "Gemini models" },
    { name: "xAI", keyName: "xaiApiKey", description: "Grok models" },
    { name: "Groq", keyName: "groqApiKey", description: "Fast inference" },
    { name: "Cerebras", keyName: "cerebrasApiKey", description: "Cerebras models" },
    { name: "OpenAI", keyName: "openaiApiKey", description: "GPT models" },
    { name: "Ollama", keyName: "ollamaBaseUrl", description: "Local Ollama models" },
  ];

  const handleDirectCommand = async (input: string): Promise<boolean> => {
    const trimmedInput = input.trim();

    if (trimmedInput === "/clear") {
      // Clear console and show GIGA art again
      console.clear();
      
      const cfonts = require('cfonts');
      cfonts.say("GIGA", {
        font: "3d",
        align: "left",
        colors: ["magenta", "gray"],
        space: true,
        maxLength: "0",
        gradient: ["magenta", "cyan"],
        independentGradient: false,
        transitionGradient: true,
        env: "node",
      });
      
      // Reset chat history
      setChatHistory([]);
      
      // Reset processing states
      setIsProcessing(false);
      setIsStreaming(false);
      setTokenCount(0);
      setProcessingTime(0);
      processingStartTime.current = 0;
      
      // Reset confirmation service session flags
      const confirmationService = ConfirmationService.getInstance();
      confirmationService.resetSession();
      
      addToHistory(trimmedInput);
      setInput("");
      return true;
    }

    if (trimmedInput === "/intro") {
      const introEntry: ChatEntry = {
        type: "assistant",
        content: `Getting started:
1. First time? Configure API keys: /providers
2. To enable web search, set your EXA API key: /exa
3. Add models from your providers: /add-model
4. Select your preferred model: /models
5. Ask questions, edit files, or run commands!

Need help? Type /help for more information.`,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, introEntry]);
      addToHistory(trimmedInput);
      setInput("");
      return true;
    }

    if (trimmedInput === "/help") {
      const helpEntry: ChatEntry = {
        type: "assistant",
        content: `GIGA Help:

Built-in Commands:
  /clear        - Start new conversation
  /help         - Show this help
  /intro        - Show getting started information
  /history      - Browse conversation history (Ctrl+H)
  /models       - Switch models
  /route        - Configure model provider routing
  /add-model    - Add models from providers
  /delete-model - Delete added models
  /prompts      - View custom prompts
  /add-prompt   - Add custom prompt
  /delete-prompt- Delete custom prompt
  /mcps         - View MCP servers
  /add-mcp      - Add MCP server
  /delete-mcp   - Delete MCP server
  /sampling     - Adjust sampling temperature
  /experts      - Configure expert model routing  
  /providers    - Configure API keys
  /exa          - Set your EXA API key for search
  /exit         - Exit application
  exit, quit    - Exit application

Direct Commands (executed immediately):
  ls [path]   - List directory contents
  pwd         - Show current directory
  cd <path>   - Change directory
  cat <file>  - View file contents
  mkdir <dir> - Create directory
  touch <file>- Create empty file

For complex operations, just describe what you want in natural language.
Examples:
  "edit package.json and add a new script"
  "create a new React component called Header"
  "show me all TypeScript files in this project"`,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, helpEntry]);
      addToHistory(trimmedInput);
      setInput("");
      return true;
    }

    if (trimmedInput === "/history") {
      setShowConversationHistory(true);
      addToHistory(trimmedInput);
      setInput("");
      return true;
    }

    if (trimmedInput === "/models") {
      setShowModelSelection(true);
      setSelectedModelIndex(0);
      addToHistory(trimmedInput);
      setInput("");
      return true;
    }

    if (trimmedInput === "/providers") {
      setShowProviderSettings(true);
      setSelectedProviderIndex(0);
      addToHistory(trimmedInput);
      setInput("");
      return true;
    }

    if (trimmedInput === "/add-model") {
        setShowAddModel(true);
        addToHistory(trimmedInput);
        setInput("");
        // Fetch models when the add model dialog is opened
        const { fetchModelsWithFallback } = await import('../utils/dynamic-model-fetcher');
        const { loadApiKeys } = await import('../utils/api-keys');
        const keys = loadApiKeys();
        const result = await fetchModelsWithFallback('openrouter', keys.openRouterApiKey || '');
        if (result.allModels) {
          refreshModels(result.allModels);
        }
        return true;
      }

    if (trimmedInput === "/delete-model") {
      setShowDeleteModel(true);
      addToHistory(trimmedInput);
      setInput("");
      return true;
    }

    if (trimmedInput === "/mcps") {
      setShowMcpServers(true);
      setSelectedMcpServerIndex(0);
      addToHistory(trimmedInput);
      setInput("");
      return true;
    }

    if (trimmedInput === "/add-mcp") {
      setShowAddMcpServer(true);
      addToHistory(trimmedInput);
      setInput("");
      return true;
    }

    if (trimmedInput === "/delete-mcp") {
      setShowDeleteMcpServer(true);
      addToHistory(trimmedInput);
      setInput("");
      return true;
    }

    if (trimmedInput === "/prompts") {
      setShowPromptsList(true);
      addToHistory(trimmedInput);
      setInput("");
      return true;
    }

    if (trimmedInput === "/add-prompt") {
      setShowAddPrompt(true);
      addToHistory(trimmedInput);
      setInput("");
      return true;
    }

    if (trimmedInput === "/delete-prompt") {
      setShowDeletePrompt(true);
      addToHistory(trimmedInput);
      setInput("");
      return true;
    }

    if (trimmedInput === "/route") {
      setShowRouteSelection(true);
      setRouteViewMode('models');
      setSelectedRouteModelIndex(0);
      addToHistory(trimmedInput);
      setInput("");
      return true;
    }

    if (trimmedInput === "/sampling") {
      setShowTemperatureSelector(true);
      setCurrentTemperature(sessionManager.getTemperature());
      addToHistory(trimmedInput);
      setInput("");
      return true;
    }

    if (trimmedInput === "/experts") {
      setShowExpertModels(true);
      addToHistory(trimmedInput);
      setInput("");
      return true;
    }

    if (trimmedInput === "/exa") {
      setShowExaApiKeyInput(true);
      addToHistory(trimmedInput);
      setInput("");
      return true;
    }


    if (trimmedInput.startsWith("/models ")) {
      const modelArg = trimmedInput.split(" ")[1];
      const modelNames = dynamicModels.map(m => m.model);

      if (modelNames.includes(modelArg)) {
        onModelSelected(modelArg);
        agent.setModel(modelArg, allModels);
        const confirmEntry: ChatEntry = {
          type: "assistant",
          content: `✓ Switched to model: ${modelArg}`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, confirmEntry]);
      } else {
        const errorEntry: ChatEntry = {
          type: "assistant",
          content: `Invalid model: ${modelArg}

Available models: ${modelNames.join(", ")}`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, errorEntry]);
      }

      addToHistory(trimmedInput);
      setInput("");
      return true;
    }

    const directBashCommands = [
      "ls", "pwd", "cd", "cat", "mkdir", "touch", "echo", "grep", "find", "cp", "mv", "rm",
    ];
    const firstWord = trimmedInput.split(" ")[0];

    if (directBashCommands.includes(firstWord)) {
      const userEntry: ChatEntry = {
        type: "user",
        content: trimmedInput,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, userEntry]);

      try {
        const result = await agent.executeBashCommand(trimmedInput);

        const commandEntry: ChatEntry = {
          type: "tool_result",
          content: result.success
            ? result.output || "Command completed"
            : result.error || "Command failed",
          timestamp: new Date(),
          toolCall: {
            id: `bash_${Date.now()}`,
            type: "function",
            function: {
              name: "bash",
              arguments: JSON.stringify({ command: trimmedInput }),
            },
          },
          toolResult: result,
        };
        setChatHistory((prev) => [...prev, commandEntry]);
      } catch (error: any) {
        const errorEntry: ChatEntry = {
          type: "assistant",
          content: `Error executing command: ${error.message}`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, errorEntry]);
      }

      addToHistory(trimmedInput);
      setInput("");
      return true;
    }

    return false;
  };

  const processUserMessage = async (userInput: string) => {
    const userEntry: ChatEntry = {
      type: "user",
      content: userInput,
      timestamp: new Date(),
    };
    setChatHistory((prev) => [...prev, userEntry]);
    addToHistory(userInput);

    setIsProcessing(true);
    setInput("");

    try {
      setIsStreaming(true);
      let streamingEntry: ChatEntry | null = null;

      for await (const chunk of agent.processUserMessageStream(userInput)) {
        switch (chunk.type) {
          case "content":
            if (chunk.content) {
              if (!streamingEntry) {
                const newStreamingEntry = {
                  type: "assistant" as const,
                  content: chunk.content,
                  timestamp: new Date(),
                  isStreaming: true,
                };
                setChatHistory((prev) => [...prev, newStreamingEntry]);
                streamingEntry = newStreamingEntry;
              } else {
                // Use batched streaming content update
                addStreamingContent(chunk.content);
              }
            }
            break;

          case "token_count":
            if (chunk.tokenCount !== undefined) {
              setTokenCount(chunk.tokenCount);
            }
            break;

          case "tool_calls":
            if (chunk.toolCalls) {
              // Stop streaming for the current assistant message
              setChatHistory((prev) =>
                prev.map((entry) =>
                  entry.isStreaming ? { ...entry, isStreaming: false, toolCalls: chunk.toolCalls } : entry
                )
              );
              streamingEntry = null;
            }
            break;

          case "tool_result":
            if (chunk.toolCall && chunk.toolResult) {
              setChatHistory((prev) =>
                prev.map((entry) =>
                  entry.isStreaming ? { ...entry, isStreaming: false } : entry
                )
              );

              const toolResultEntry: ChatEntry = {
                type: "tool_result",
                content: chunk.toolResult.success
                  ? chunk.toolResult.output || "Success"
                  : chunk.toolResult.error || "Error occurred",
                timestamp: new Date(),
                toolCall: chunk.toolCall,
                toolResult: chunk.toolResult,
              };
              setChatHistory((prev) => [...prev, toolResultEntry]);
              streamingEntry = null;
            }
            break;

          case "done":
            // Flush any remaining buffered content
            flushStreamingBuffer();
            
            if (streamingEntry) {
              setChatHistory((prev) =>
                prev.map((entry) =>
                  entry.isStreaming ? { ...entry, isStreaming: false } : entry
                )
              );
            }
            setIsStreaming(false);
            break;
        }
      }
    } catch (error: any) {
      const errorEntry: ChatEntry = {
        type: "assistant",
        content: `Error: ${error.message}`,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, errorEntry]);
      setIsStreaming(false);
    }

    setIsProcessing(false);
    processingStartTime.current = 0;
  };

  const handleRouteSelectionInput = async (inputChar: string, key: any) => {
    if (key.escape) {
      if (routeViewMode === 'providers') {
        // Go back to models view
        setRouteViewMode('models');
        setSelectedRouteProviderIndex(0);
        setCurrentSelectedModel('');
        setRouteProviders([]);
        setIsLoadingProviders(false);
      } else {
        // Close route selection entirely
        closeRouteSelection();
      }
      return;
    }

    if (routeViewMode === 'models') {
      // Filter to only show OpenRouter models (same as the component filter)
      const openRouterModels = getOpenRouterModels(dynamicModels);
      
      if (key.upArrow) {
        setSelectedRouteModelIndex((prev) =>
          prev === 0 ? openRouterModels.length - 1 : prev - 1
        );
        return;
      }
      if (key.downArrow) {
        setSelectedRouteModelIndex((prev) => (prev + 1) % openRouterModels.length);
        return;
      }
      if (key.return || key.tab) {
        const selectedModel = openRouterModels[selectedRouteModelIndex];
        console.log(`DEBUG: Selected model index: ${selectedRouteModelIndex}, Model: ${selectedModel?.model}`);
        if (selectedModel) {
          // Move to provider selection
          setCurrentSelectedModel(selectedModel.model);
          setRouteViewMode('providers');
          setSelectedRouteProviderIndex(0);
          setIsLoadingProviders(true);
          setRouteProviders([]);

          try {
            const { loadApiKeys } = await import('../utils/api-keys');
            const { getModelProvidersWithFallback } = await import('../utils/openrouter-providers');
            
            const apiKeys = loadApiKeys();
            const openRouterKey = apiKeys.openRouterApiKey;
            
            if (openRouterKey) {
              const modelProviders = await getModelProvidersWithFallback(selectedModel.model, openRouterKey);
              setRouteProviders(modelProviders);
            } else {
              // Show error message
              const errorEntry: ChatEntry = {
                type: "assistant",
                content: "OpenRouter API key is required to fetch providers. Please configure it in /providers.",
                timestamp: new Date(),
              };
              setChatHistory((prev) => [...prev, errorEntry]);
              closeRouteSelection();
            }
          } catch (error) {
            console.error('Error fetching providers:', error);
            setRouteProviders([]);
          } finally {
            setIsLoadingProviders(false);
          }
        }
        return;
      }
    } else if (routeViewMode === 'providers') {
      if (key.upArrow) {
        setSelectedRouteProviderIndex((prev) =>
          prev === 0 ? routeProviders.length - 1 : prev - 1
        );
        return;
      }
      if (key.downArrow) {
        setSelectedRouteProviderIndex((prev) => (prev + 1) % routeProviders.length);
        return;
      }
      if (key.return || key.tab) {
        const selectedProvider = routeProviders[selectedRouteProviderIndex];
        console.log(`DEBUG: Setting provider ${selectedProvider?.id} for model ${currentSelectedModel}`);
        if (selectedProvider && currentSelectedModel) {
          // Save OpenRouter provider preference to the global models file
          const success = setOpenRouterProvider(currentSelectedModel, selectedProvider.id);
          console.log(`DEBUG: setOpenRouterProvider result: ${success}`);
          
          if (success) {
            // Show confirmation message
            const confirmEntry: ChatEntry = {
              type: "assistant",
              content: `✓ Set OpenRouter provider for ${currentSelectedModel}: ${selectedProvider.name}`,
              timestamp: new Date(),
            };
            setChatHistory((prev) => [...prev, confirmEntry]);
          } else {
            const errorEntry: ChatEntry = {
              type: "assistant",
              content: `❌ Failed to set provider for ${currentSelectedModel} - model not found in OpenRouter`,
              timestamp: new Date(),
            };
            setChatHistory((prev) => [...prev, errorEntry]);
          }

          closeRouteSelection();
        }
        return;
      }
    }
  };

  useInput(async (inputChar: string, key: any) => {
    // Don't handle input if confirmation dialog or prompt dialogs are active
    if (isConfirmationActive || showAddPrompt || showDeletePrompt || showPromptsList || showRouteSelection || showConversationHistory || showTemperatureSelector || showExpertModels || showExaApiKeyInput) {
      // Special handling for route selection
      if (showRouteSelection) {
        await handleRouteSelectionInput(inputChar, key);
      }
      // Special handling for temperature selector
      if (showTemperatureSelector) {
        if (key.escape) {
          closeTemperatureSelector();
          return;
        }
        if (key.leftArrow) {
          const newTemp = Math.max(0.0, currentTemperature - 0.1);
          setCurrentTemperature(Math.round(newTemp * 10) / 10);
          return;
        }
        if (key.rightArrow) {
          const newTemp = Math.min(1.0, currentTemperature + 0.1);
          setCurrentTemperature(Math.round(newTemp * 10) / 10);
          return;
        }
        if (key.return) {
          sessionManager.setTemperature(currentTemperature);
          const confirmEntry: ChatEntry = {
            type: "assistant",
            content: `✓ Temperature set to ${currentTemperature.toFixed(1)}`,
            timestamp: new Date(),
          };
          setChatHistory((prev) => [...prev, confirmEntry]);
          closeTemperatureSelector();
          return;
        }
      }
      return;
    }
    
    // Ctrl+C is handled by the process-level handler for immediate exit
    if (key.ctrl && inputChar === "c") {
      // Let the process-level handler deal with it
      return;
    }

    // Handle Shift+Tab for mode cycling
    if (key.shift && key.tab) {
      const newMode = modeManager.cycleMode();
      agent.updateMode(newMode);
      if (onModeChange) {
        onModeChange(newMode);
      }
      
      // Mode change will be reflected in the SessionStatus component automatically
      // No need to add chat history entries for mode switches
      return;
    }

    if (key.ctrl && inputChar === "h") {
      setShowConversationHistory(true);
      return;
    }

    if (key.escape) {
      if (showCommandSuggestions) {
        setShowCommandSuggestions(false);
        setSelectedCommandIndex(0);
        return;
      }
      if (showModelSelection) {
        setShowModelSelection(false);
        setSelectedModelIndex(0);
        return;
      }
      if (showProviderSettings) {
        setShowProviderSettings(false);
        setSelectedProviderIndex(0);
        return;
      }
      if (showAddModel) {
        setShowAddModel(false);
        return;
      }
      if (showDeleteModel) {
        setShowDeleteModel(false);
        return;
      }
      if (showPromptsList) {
        setShowPromptsList(false);
        return;
      }
      if (showAddPrompt) {
        setShowAddPrompt(false);
        return;
      }
      if (showDeletePrompt) {
        setShowDeletePrompt(false);
        return;
      }
      if (showConversationHistory) {
        setShowConversationHistory(false);
        return;
      }
      if (showTemperatureSelector) {
        setShowTemperatureSelector(false);
        return;
      }
      if (showExpertModels) {
        setShowExpertModels(false);
        return;
      }
      if (showExaApiKeyInput) {
        closeExaApiKeyInput();
        return;
      }
      if (showMcpServers) {
        setShowMcpServers(false);
        setSelectedMcpServerIndex(0);
        return;
      }
      if (showAddMcpServer) {
        setShowAddMcpServer(false);
        return;
      }
      if (showDeleteMcpServer) {
        setShowDeleteMcpServer(false);
        return;
      }
      if (isProcessing || isStreaming) {
        agent.abortCurrentOperation();
        setIsProcessing(false);
        setIsStreaming(false);
        setTokenCount(0);
        setProcessingTime(0);
        processingStartTime.current = 0;
        return;
      }
    }

    if (showCommandSuggestions) {
      const filteredSuggestions = getFilteredSuggestions(input);
      
      if (key.upArrow) {
        setSelectedCommandIndex((prev) =>
          prev === 0 ? filteredSuggestions.length - 1 : prev - 1
        );
        return;
      }
      if (key.downArrow) {
        setSelectedCommandIndex((prev) => (prev + 1) % filteredSuggestions.length);
        return;
      }
      if (key.tab || key.return) {
        const selectedCommand = filteredSuggestions[selectedCommandIndex];
        if (selectedCommand) {
          setInput(selectedCommand.command + " ");
          setShowCommandSuggestions(false);
          setSelectedCommandIndex(0);
        }
        return;
      }
    }

    if (showModelSelection) {
      if (key.upArrow) {
        setSelectedModelIndex((prev) =>
          prev === 0 ? dynamicModels.length - 1 : prev - 1
        );
        return;
      }
      if (key.downArrow) {
        setSelectedModelIndex((prev) => (prev + 1) % dynamicModels.length);
        return;
      }
      if (key.tab || key.return) {
        const selectedModel = dynamicModels[selectedModelIndex];
        onModelSelected(selectedModel.model);
        agent.setModel(selectedModel.model, allModels);
        const confirmEntry: ChatEntry = {
          type: "assistant",
          content: `✓ Switched to model: ${selectedModel.model}`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, confirmEntry]);
        setShowModelSelection(false);
        setSelectedModelIndex(0);
        return;
      }
    }

    if (showMcpServers) {
      if (key.upArrow) {
        setSelectedMcpServerIndex((prev) =>
          prev === 0 ? mcpServers.length - 1 : prev - 1
        );
        return;
      }
      if (key.downArrow) {
        setSelectedMcpServerIndex((prev) => (prev + 1) % mcpServers.length);
        return;
      }
      if (key.tab || key.return) {
        const selectedServer = mcpServers[selectedMcpServerIndex];
        if (selectedServer) {
          const serverInfo: ChatEntry = {
            type: "assistant",
            content: `MCP Server: ${selectedServer.name}
Command: ${selectedServer.command}
${selectedServer.args ? `Args: ${selectedServer.args.join(' ')}` : ''}
${selectedServer.env ? `Environment: ${Object.entries(selectedServer.env).map(([k, v]) => `${k}=${v}`).join(' ')}` : ''}
${selectedServer.description ? `Description: ${selectedServer.description}` : ''}
Added: ${new Date(selectedServer.dateAdded).toLocaleDateString()}`,
            timestamp: new Date(),
          };
          setChatHistory((prev) => [...prev, serverInfo]);
        }
        setShowMcpServers(false);
        setSelectedMcpServerIndex(0);
        return;
      }
    }

    if (showAddModel || showDeleteModel || showAddMcpServer || showDeleteMcpServer) {
      return;
    }

    if (showProviderSettings) {
      return;
    }

    // Handle file finder navigation when active (takes precedence over history)
    if (showFileFinder && filteredFiles.length > 0) {
      if (key.upArrow) {
        setSelectedFileIndex((prev) =>
          prev === 0 ? filteredFiles.length - 1 : prev - 1
        );
        return;
      }
      if (key.downArrow) {
        setSelectedFileIndex((prev) => (prev + 1) % filteredFiles.length);
        return;
      }
      if (key.return || key.tab) {
        const selectedFile = filteredFiles[selectedFileIndex];
        if (selectedFile) {
          const newInput = replaceFileQuery(input, selectedFile);
          setInput(newInput);
          closeFileFinder();
        }
        return;
      }
    }

    // Handle command history navigation with up/down arrows
    if (key.upArrow && !showCommandSuggestions && !showModelSelection && !showMcpServers) {
      if (commandHistory.length > 0) {
        if (historyIndex === -1) {
          // Store current input before navigating history
          setTemporaryInput(input);
          setHistoryIndex(commandHistory.length - 1);
          setInput(commandHistory[commandHistory.length - 1]);
        } else if (historyIndex > 0) {
          setHistoryIndex(historyIndex - 1);
          setInput(commandHistory[historyIndex - 1]);
        }
      }
      return;
    }

    if (key.downArrow && !showCommandSuggestions && !showModelSelection && !showMcpServers) {
      if (commandHistory.length > 0 && historyIndex !== -1) {
        if (historyIndex < commandHistory.length - 1) {
          setHistoryIndex(historyIndex + 1);
          setInput(commandHistory[historyIndex + 1]);
        } else {
          // Return to original input
          setHistoryIndex(-1);
          setInput(temporaryInput);
        }
      }
      return;
    }

    if (key.return) {
      const userInput = input.trim();
      if (userInput === "exit" || userInput === "quit") {
        exit();
        return;
      }

      if (userInput) {
        const directCommandResult = await handleDirectCommand(userInput);
        if (!directCommandResult) {
          await processUserMessage(userInput);
        }
      }
      return;
    }

    if (key.backspace || key.delete) {
      const newInput = input.slice(0, -1);
      setInput(newInput);
      
      // Reset history navigation when user edits input
      if (historyIndex !== -1) {
        setHistoryIndex(-1);
        setTemporaryInput("");
      }

      // Update file finder
      updateFileFinder(newInput);

      if (!newInput.startsWith("/")) {
        setShowCommandSuggestions(false);
        setSelectedCommandIndex(0);
      } else if (showCommandSuggestions) {
        // Reset selected index when input changes to avoid out-of-bounds
        setSelectedCommandIndex(0);
      }
      return;
    }

    if (inputChar && !key.ctrl && !key.meta) {
      const newInput = input + inputChar;
      setInput(newInput);
      
      // Reset history navigation when user types new input
      if (historyIndex !== -1) {
        setHistoryIndex(-1);
        setTemporaryInput("");
      }

      // Update file finder based on @ symbol
      updateFileFinder(newInput);

      if (
        newInput === "/" ||
        ["ls", "pwd", "cd", "cat", "mkdir", "touch"].some((cmd) =>
          cmd.startsWith(newInput)
        )
      ) {
        setShowCommandSuggestions(true);
        setSelectedCommandIndex(0);
      } else if (
        !newInput.startsWith("/") &&
        !["ls", "pwd", "cd", "cat", "mkdir", "touch"].some((cmd) =>
          cmd.startsWith(newInput)
        )
      ) {
        setShowCommandSuggestions(false);
        setSelectedCommandIndex(0);
      } else if (showCommandSuggestions) {
        // Reset selected index when input changes to avoid out-of-bounds
        setSelectedCommandIndex(0);
      }
    }
  });

  return {
    input,
    showCommandSuggestions,
    selectedCommandIndex,
    showModelSelection,
    selectedModelIndex,
    showProviderSettings,
    selectedProviderIndex,
    showAddModel,
    showDeleteModel,
    showPromptsList,
    showAddPrompt,
    showDeletePrompt,
    showMcpServers,
    showAddMcpServer,
    showDeleteMcpServer,
    selectedMcpServerIndex,
    showConversationHistory,
    showTemperatureSelector,
    currentTemperature,
    showExpertModels,
    showExaApiKeyInput,
    showRouteSelection,
    routeViewMode,
    selectedRouteModelIndex,
    selectedRouteProviderIndex,
    currentSelectedModel,
    routeProviders,
    isLoadingProviders,
    showFileFinder,
    selectedFileIndex,
    filteredFiles,
    fileQuery,
    commandSuggestions,
    availableModels: dynamicModels,
    mcpServers,
    providerList,
    closeProviderSettings,
    closeAddModel,
    closeDeleteModel,
    closePromptsList,
    closeAddPrompt,
    closeDeletePrompt,
    closeMcpServers,
    closeAddMcpServer,
    closeDeleteMcpServer,
    closeConversationHistory,
    closeTemperatureSelector,
    closeExpertModels,
    closeExaApiKeyInput,
    closeRouteSelection,
    closeFileFinder,
    refreshModels,
    refreshMcpServers,
    openRouterModels: getOpenRouterModels(dynamicModels),
    agent,
  };
}