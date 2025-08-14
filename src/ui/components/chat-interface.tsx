import React, { useState, useEffect, useRef } from "react";
import { Box, Text } from "ink";
import { GigaAgent, ChatEntry } from "../../agent/giga-agent";
import { useInputHandler } from "../../hooks/use-input-handler";
import { LoadingSpinner } from "./loading-spinner";
import { CommandSuggestions } from "./command-suggestions";
import TokenProgressBar from "./token-progress-bar";
import { ModelSelection } from "./model-selection";
import { RouteSelection } from "./route-selection";
import { TemperatureSelector } from "./temperature-selector";
import { ExpertModels } from "./expert-models";
import ProviderSettings from "./provider-settings";
import AddModel from "./add-model";
import DeleteModel from "./delete-model";
import AddPrompt from "./add-prompt";
import DeletePrompt from "./delete-prompt";
import PromptsList from "./prompts-list";
import AddMcpServer from "./add-mcp-server";
import DeleteMcpServer from "./delete-mcp-server";
import { McpServerSelection } from "./mcp-server-selection";
import { ChatHistory } from "./chat-history";
import { ConversationHistory } from "./conversation-history";
import { ChatInput } from "./chat-input";
import { FileFinder } from "./file-finder";
import ConfirmationDialog from "./confirmation-dialog";
import { ConfirmationService, ConfirmationOptions } from "../../utils/confirmation-service";
import ApiKeyInput from "./api-key-input";
import ExaApiKeyInput from "./exa-api-key-input";
import { addModel, deleteModel } from "../../utils/added-models";
import { addPrompt, deletePrompt } from "../../utils/prompts";
import { addMcpServer, deleteMcpServer } from "../../utils/added-mcp-servers";
import { ConversationManager } from "../../utils/conversation-manager";
import { loadApiKeys } from "../../utils/api-keys";
import { sessionManager } from "../../utils/session-manager";
import { modeManager } from "../../utils/mode-manager";
import { AgentMode } from "../../types";
import { loadAddedMcpServers } from "../../utils/added-mcp-servers";
import cfonts from "cfonts";

// Memoized ChatHistory component to prevent unnecessary re-renders
const ChatHistoryMemo = React.memo(ChatHistory);

interface ChatInterfaceProps {
  agent?: GigaAgent;
  initialMessages?: ChatEntry[];
  initialConversationId?: string;
}

// Component showing session info and setup status
const SessionStatus = React.memo(function SessionStatus({ currentModel }: { currentModel?: string }) {
  const sessionInfo = sessionManager.getSessionInfo();
  const displayModel = currentModel || sessionInfo?.currentModel || '';
  const noModelConfigured = !displayModel || displayModel.trim() === '';
  
  // Only show if model is not configured
  if (!noModelConfigured) return null;

  return (
    <Box flexDirection="column" marginBottom={1}>      
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="yellow">⚠️  First-time setup required:</Text>
        <Text color="gray">1. Configure API keys: /providers</Text>
        <Text color="gray">2. Add models: /add-model</Text>
        <Text color="gray">3. Select a model: /models</Text>
      </Box>
    </Box>
  );
});

// Main chat component that handles input when agent is available
function ChatInterfaceWithAgent({ agent, initialMessages = [], initialConversationId }: { 
  agent: GigaAgent; 
  initialMessages?: ChatEntry[]; 
  initialConversationId?: string;
}) {
  const [chatHistory, setChatHistory] = useState<ChatEntry[]>(initialMessages);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingTime, setProcessingTime] = useState(0);
  const [tokenCount, setTokenCount] = useState(0);
  const [tokenTrackerInfo, setTokenTrackerInfo] = useState(agent.getTokenTrackerInfo());
  const [isStreaming, setIsStreaming] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [confirmationOptions, setConfirmationOptions] = useState<ConfirmationOptions | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(initialConversationId || null);
  const [currentMode, setCurrentMode] = useState<AgentMode>(modeManager.getCurrentMode());
  const scrollRef = useRef<any>();
  const processingStartTime = useRef<number>(0);
  const hasInitialized = useRef<boolean>(false);
  
  const confirmationService = ConfirmationService.getInstance();
  const conversationManager = ConversationManager.getInstance();

  const {
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
    availableModels,
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
    closeRouteSelection,
    closeFileFinder,
    refreshModels,
    refreshMcpServers,
    openRouterModels,
    showExaApiKeyInput,
    closeExaApiKeyInput,
  } = useInputHandler({
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
    isConfirmationActive: !!confirmationOptions,
    onModeChange: setCurrentMode,
  });

  useEffect(() => {
    // Only show banner on initial mount, not on re-renders
    if (!hasInitialized.current) {
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
      hasInitialized.current = true;
      setChatHistory([]);
    }
  }, []); // Remove dependencies to run only once on mount

  useEffect(() => {
    const handleConfirmationRequest = (options: ConfirmationOptions) => {
      setConfirmationOptions(options);
    };

    confirmationService.on('confirmation-requested', handleConfirmationRequest);

    const handleStatusUpdate = (message: string) => {
      setStatusMessage(message);
    };

    agent.on('status', handleStatusUpdate);

    return () => {
      confirmationService.off('confirmation-requested', handleConfirmationRequest);
      agent.off('status', handleStatusUpdate);
    };
  }, [confirmationService, agent]);

  useEffect(() => {
    if (!isProcessing && !isStreaming) {
      setProcessingTime(0);
      processingStartTime.current = 0;
      return;
    }

    if (processingStartTime.current === 0) {
      processingStartTime.current = Date.now();
    }

    const interval = setInterval(() => {
      // Double-check we're still processing before updating
      if (processingStartTime.current > 0) {
        setProcessingTime(
          Math.floor((Date.now() - processingStartTime.current) / 1000)
        );
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isProcessing, isStreaming]);

  const handleConfirmation = (dontAskAgain?: boolean) => {
    confirmationService.confirmOperation(true, dontAskAgain);
    setConfirmationOptions(null);
  };

  const handleRejection = (feedback?: string) => {
    confirmationService.rejectOperation(feedback);
    setConfirmationOptions(null);
    
    // Reset processing states when operation is cancelled
    setIsProcessing(false);
    setIsStreaming(false);
    setTokenCount(0);
    setProcessingTime(0);
    processingStartTime.current = 0;
    setTokenTrackerInfo(agent.getTokenTrackerInfo());
  };

  const handleAddModel = (providerName: string, modelName: string) => {
    // Save the model to storage
    addModel(modelName, providerName);
    
    const confirmEntry: ChatEntry = {
      type: "assistant",
      content: `✓ Added model: ${modelName} from ${providerName}`,
      timestamp: new Date(),
    };
    setChatHistory((prev) => [...prev, confirmEntry]);
    refreshModels(); // Refresh the available models list
    closeAddModel();
  };

  const handleDeleteModel = (modelName: string, providerName: string) => {
    // Delete the model from storage
    const success = deleteModel(modelName, providerName);
    
    if (success) {
      const confirmEntry: ChatEntry = {
        type: "assistant",
        content: `✓ Deleted model: ${modelName} from ${providerName}`,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, confirmEntry]);
      refreshModels(); // Refresh the available models list
    } else {
      const errorEntry: ChatEntry = {
        type: "assistant",
        content: `❌ Failed to delete model: ${modelName}`,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, errorEntry]);
    }
    
    closeDeleteModel();
  };

  const handleAddPrompt = (name: string, content: string) => {
    // Add the prompt
    addPrompt(name, content);

    const confirmEntry: ChatEntry = {
      type: "assistant",
      content: `✓ Added custom prompt: ${name}`,
      timestamp: new Date(),
    };
    setChatHistory((prev) => [...prev, confirmEntry]);
    closeAddPrompt();
  };

  const handleDeletePrompt = (name: string) => {
    // Delete the prompt
    const success = deletePrompt(name);

    if (success) {
      const confirmEntry: ChatEntry = {
        type: "assistant",
        content: `✓ Deleted custom prompt: ${name}`,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, confirmEntry]);
    } else {
      const errorEntry: ChatEntry = {
        type: "assistant",
        content: `❌ Failed to delete prompt: ${name}`,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, errorEntry]);
    }

    closeDeletePrompt();
  };

  const handleAddMcpServer = (
    name: string, 
    command: string, 
    args?: string[], 
    env?: Record<string, string>,
    description?: string
  ) => {
    // Save the MCP server to storage
    addMcpServer(name, command, args, env, description);
    
    const confirmEntry: ChatEntry = {
      type: "assistant",
      content: `✓ Added MCP server: ${name}`,
      timestamp: new Date(),
    };
    setChatHistory((prev) => [...prev, confirmEntry]);
    refreshMcpServers(); // Refresh the available servers list
    
    // Refresh MCP connections in the agent
    agent.refreshMcpConnections();
    
    closeAddMcpServer();
  };

  const handleDeleteMcpServer = (name: string) => {
    // Delete the MCP server from storage
    const success = deleteMcpServer(name);
    
    if (success) {
      const confirmEntry: ChatEntry = {
        type: "assistant",
        content: `✓ Deleted MCP server: ${name}`,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, confirmEntry]);
      refreshMcpServers(); // Refresh the available servers list
      
      // Refresh MCP connections in the agent
      agent.refreshMcpConnections();
    } else {
      const errorEntry: ChatEntry = {
        type: "assistant",
        content: `❌ Failed to delete MCP server: ${name}`,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, errorEntry]);
    }
    
    closeDeleteMcpServer();
  };

  const handleSelectConversation = async (conversationId: string) => {
    try {
      // Save current conversation if there are messages
      if (chatHistory.length > 0 && currentConversationId) {
        await conversationManager.saveConversation(
          chatHistory, 
          agent.getCurrentModel(), 
          currentConversationId
        );
      }

      // Load the selected conversation
      const conversation = await conversationManager.loadConversation(conversationId);
      if (conversation) {
        // Update the model if it's different
        if (conversation.model !== agent.getCurrentModel()) {
          agent.setModel(conversation.model);
        }

        // Restore conversation state in the agent (this restores AI context)
        agent.restoreConversation(conversation.messages);
        
        // Update UI state
        setChatHistory(conversation.messages);
        setCurrentConversationId(conversationId);

        const switchEntry: ChatEntry = {
          type: "assistant",
          content: `📚 Switched to conversation: **${conversation.title}**`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, switchEntry]);
      }
    } catch (error) {
      console.error('Failed to switch conversation:', error);
      const errorEntry: ChatEntry = {
        type: "assistant",
        content: `❌ Failed to load conversation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, errorEntry]);
    }
  };

  // Auto-save current conversation when chat history changes
  useEffect(() => {
    if (chatHistory.length > 0) {
      const saveConversation = async () => {
        try {
          const conversationId = await conversationManager.saveConversation(
            chatHistory,
            agent.getCurrentModel(),
            currentConversationId || undefined
          );
          
          if (!currentConversationId) {
            setCurrentConversationId(conversationId);
          }
        } catch (error) {
          console.error('Failed to auto-save conversation:', error);
        }
      };

      // Debounce the save operation
      const timeoutId = setTimeout(saveConversation, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [chatHistory, agent, conversationManager, currentConversationId]);

  const handleExaApiKeySet = () => {
    const confirmEntry: ChatEntry = {
      type: "assistant",
      content: `✓ EXA API key saved successfully.`,
      timestamp: new Date(),
    };
    setChatHistory((prev) => [...prev, confirmEntry]);
    closeExaApiKeyInput();
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setTokenTrackerInfo(agent.getTokenTrackerInfo());
    }, 100);
    return () => clearInterval(interval);
  }, [agent]);

  return (
    <Box flexDirection="column" padding={1}>
        <SessionStatus currentModel={agent.getCurrentModel()} />
        
        <Box flexDirection="column" marginBottom={1}>
          <Text dimColor>
            Type your request in natural language. Type 'exit' or Ctrl+C to quit. Shift+Tab to cycle modes.
          </Text>
        </Box>

        <Box key="chat-main" flexDirection="column" ref={scrollRef}>
          <ChatHistoryMemo entries={chatHistory} />
        </Box>

      {tokenTrackerInfo && (
        <TokenProgressBar
          current={tokenTrackerInfo.current}
          max={tokenTrackerInfo.max}
          model={tokenTrackerInfo.model}
        />
      )}

      {!confirmationOptions && (
        <>
          <LoadingSpinner
            isActive={isProcessing || isStreaming}
            processingTime={processingTime}
            tokenCount={tokenCount}
            statusMessage={statusMessage}
          />

          {!showAddPrompt && !showDeletePrompt && !showPromptsList && (
            <ChatInput
              input={input}
              isProcessing={isProcessing}
              isStreaming={isStreaming}
              currentModel={agent.getCurrentModel()}
              currentMode={currentMode}
            />
          )}

          {!showAddPrompt && !showDeletePrompt && !showPromptsList && (
            <CommandSuggestions
              suggestions={commandSuggestions}
              input={input}
              selectedIndex={selectedCommandIndex}
              isVisible={showCommandSuggestions}
            />
          )}

          {!showAddPrompt && !showDeletePrompt && !showPromptsList && (
            <FileFinder
              files={filteredFiles}
              selectedIndex={selectedFileIndex}
              query={fileQuery}
              isVisible={showFileFinder}
            />
          )}

          {!showAddPrompt && !showDeletePrompt && !showPromptsList && (
            <ModelSelection
              models={availableModels}
              selectedIndex={selectedModelIndex}
              isVisible={showModelSelection}
              currentModel={agent.getCurrentModel()}
            />
          )}

          {!showAddPrompt && !showDeletePrompt && !showPromptsList && (
            <RouteSelection
              models={openRouterModels}
              selectedModelIndex={selectedRouteModelIndex}
              selectedProviderIndex={selectedRouteProviderIndex}
              isVisible={showRouteSelection}
              currentModel={agent.getCurrentModel()}
              viewMode={routeViewMode}
              currentSelectedModel={currentSelectedModel}
              providers={routeProviders}
              isLoadingProviders={isLoadingProviders}
              onModelSelect={() => {}} // Handled internally by input handler
              onProviderSelect={() => {}} // Handled internally by input handler
              onBack={() => {}} // Handled internally by input handler
            />
          )}
          <TemperatureSelector
            temperature={currentTemperature}
            isVisible={showTemperatureSelector}
          />

          {showExpertModels && (
            <ExpertModels
              onExit={closeExpertModels}
            />
          )}

          {showProviderSettings && (
            <ProviderSettings
              providers={providerList}
              selectedIndex={selectedProviderIndex}
              onClose={closeProviderSettings}
            />
          )}

          {showAddModel && (
            <AddModel
              providers={providerList}
              onClose={closeAddModel}
              onAddModel={handleAddModel}
            />
          )}

          {showDeleteModel && (
            <DeleteModel
              onClose={closeDeleteModel}
              onDeleteModel={handleDeleteModel}
            />
          )}

          {showPromptsList && (
            <PromptsList
              onClose={closePromptsList}
              onSelectPrompt={(promptName) => {
                if (agent) {
                  agent.setSelectedCustomPrompt(promptName);
                  
                  // Add a system message to chat history showing the change
                  const promptDisplayName = promptName || "GIGA (Default)";
                  const systemMessage: ChatEntry = {
                    type: "assistant", 
                    content: `🎯 System prompt changed to: **${promptDisplayName}**`,
                    timestamp: new Date(),
                  };
                  
                  // Add to chat history
                  setChatHistory(prev => [...prev, systemMessage]);
                }
              }}
              selectedPrompt={agent?.getSelectedCustomPrompt() || null}
            />
          )}

          {showAddPrompt && (
            <AddPrompt
              onClose={closeAddPrompt}
              onAddPrompt={handleAddPrompt}
            />
          )}

          {showDeletePrompt && (
            <DeletePrompt
              onClose={closeDeletePrompt}
              onDeletePrompt={handleDeletePrompt}
            />
          )}

          {showConversationHistory && (
            <ConversationHistory
              isVisible={showConversationHistory}
              onClose={closeConversationHistory}
              onSelectConversation={handleSelectConversation}
            />
          )}

          <McpServerSelection
            servers={mcpServers}
            selectedIndex={selectedMcpServerIndex}
            isVisible={showMcpServers}
          />

          {showAddMcpServer && (
            <AddMcpServer
              onClose={closeAddMcpServer}
              onAddServer={handleAddMcpServer}
            />
          )}

          {showDeleteMcpServer && (
            <DeleteMcpServer
              onClose={closeDeleteMcpServer}
              onDeleteServer={handleDeleteMcpServer}
            />
          )}

          {showExaApiKeyInput && (
            <ExaApiKeyInput
              onClose={closeExaApiKeyInput}
              onApiKeySet={handleExaApiKeySet}
            />
          )}
        </>
      )}

      {/* Show confirmation dialog at the bottom if one is pending */}
      {confirmationOptions && (
        <ConfirmationDialog
          operation={confirmationOptions.operation}
          filename={confirmationOptions.filename}
          showVSCodeOpen={confirmationOptions.showVSCodeOpen}
          content={confirmationOptions.content}
          onConfirm={handleConfirmation}
          onReject={handleRejection}
        />
      )}
    </Box>
  );
}

// Main component that handles API key input or chat interface
export default function ChatInterface({ agent, initialMessages, initialConversationId }: ChatInterfaceProps) {
  const [currentAgent, setCurrentAgent] = useState<GigaAgent | null>(agent || null);

  const handleApiKeySet = (newAgent: GigaAgent) => {
    setCurrentAgent(newAgent);
  };

  if (!currentAgent) {
    return <ApiKeyInput onApiKeySet={handleApiKeySet} />;
  }

  return <ChatInterfaceWithAgent 
    agent={currentAgent} 
    initialMessages={initialMessages} 
    initialConversationId={initialConversationId}
  />;
}
