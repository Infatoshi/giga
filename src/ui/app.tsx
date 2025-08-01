import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { Agent } from '../agent';
import { ToolResult, AgentMode } from '../types';
import { ConfirmationService, ConfirmationOptions } from '../utils/confirmation-service';
import ConfirmationDialog from './components/confirmation-dialog';
import { modeManager } from '../utils/mode-manager';
import chalk from 'chalk';

interface Props {
  agent: Agent;
}

export default function App({ agent }: Props) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<Array<{ command: string; result: ToolResult }>>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmationOptions, setConfirmationOptions] = useState<ConfirmationOptions | null>(null);
  const [currentMode, setCurrentMode] = useState<AgentMode>(modeManager.getCurrentMode());
  const { exit } = useApp();
  
  const confirmationService = ConfirmationService.getInstance();

  useEffect(() => {
    const handleConfirmationRequest = (options: ConfirmationOptions) => {
      setConfirmationOptions(options);
    };

    confirmationService.on('confirmation-requested', handleConfirmationRequest);

    return () => {
      confirmationService.off('confirmation-requested', handleConfirmationRequest);
    };
  }, [confirmationService]);

  // Reset confirmation service session on app start
  useEffect(() => {
    confirmationService.resetSession();
  }, []);

  useInput(async (inputChar: string, key: any) => {
    // If confirmation dialog is open, don't handle normal input
    if (confirmationOptions) {
      return;
    }
    
    // Handle Shift+Tab for mode cycling (Note: This is handled in ChatInterface now)
    if (key.shift && key.tab) {
      return;
    }
    
    if (key.ctrl && inputChar === 'c') {
      exit();
      return;
    }

    if (key.return) {
      if (input.trim() === 'exit' || input.trim() === 'quit') {
        exit();
        return;
      }

      if (input.trim()) {
        setIsProcessing(true);
        const result = await agent.processCommand(input.trim());
        setHistory(prev => [...prev, { command: input.trim(), result }]);
        setInput('');
        setIsProcessing(false);
      }
      return;
    }

    if (key.backspace || key.delete) {
      setInput(prev => prev.slice(0, -1));
      return;
    }

    if (inputChar && !key.ctrl && !key.meta) {
      setInput(prev => prev + inputChar);
    }
  });

  const renderResult = (result: ToolResult) => {
    if (result.success) {
      return (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="green">✓ Success</Text>
          {result.output && (
            <Box marginLeft={2}>
              <Text>{result.output}</Text>
            </Box>
          )}
        </Box>
      );
    } else {
      return (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="red">✗ Error</Text>
          {result.error && (
            <Box marginLeft={2}>
              <Text color="red">{result.error}</Text>
            </Box>
          )}
        </Box>
      );
    }
  };

  const handleConfirmation = (dontAskAgain?: boolean) => {
    confirmationService.confirmOperation(true, dontAskAgain);
    setConfirmationOptions(null);
  };

  const handleRejection = (feedback?: string) => {
    confirmationService.rejectOperation(feedback);
    setConfirmationOptions(null);
  };

  if (confirmationOptions) {
    return (
      <ConfirmationDialog
        operation={confirmationOptions.operation}
        filename={confirmationOptions.filename}
        showVSCodeOpen={confirmationOptions.showVSCodeOpen}
        onConfirm={handleConfirmation}
        onReject={handleRejection}
      />
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1} flexDirection="column">
        <Text bold color="cyan">
          🔧 Grok CLI - Text Editor Agent
        </Text>
        <Box marginTop={1}>
          <Text bold color={currentMode === AgentMode.GIGA ? 'yellow' : currentMode === AgentMode.CHILL ? 'green' : 'blue'}>
            {modeManager.getModeDisplayName()}
          </Text>
          <Text dimColor> - {modeManager.getModeDescription()}</Text>
        </Box>
      </Box>
      
      <Box flexDirection="column" marginBottom={1}>
        <Text dimColor>
          Available commands: view, str_replace, create, insert, undo_edit, bash, help
        </Text>
        <Text dimColor>
          Type 'help' for detailed usage, 'exit' or Ctrl+C to quit, Shift+Tab to cycle modes
        </Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        {history.slice(-10).map((entry, index) => (
          <Box key={index} flexDirection="column" marginBottom={1}>
            <Box>
              <Text color="blue">$ </Text>
              <Text>{entry.command}</Text>
            </Box>
            {renderResult(entry.result)}
          </Box>
        ))}
      </Box>

      <Box>
        <Text color="blue">$ </Text>
        <Text>
          {input}
          {!isProcessing && <Text color="white">█</Text>}
        </Text>
        {isProcessing && <Text color="yellow"> (processing...)</Text>}
      </Box>
    </Box>
  );
}