import React from "react";
import { Box, Text } from "ink";
import { AgentMode } from "../../types";

interface ChatInputProps {
  input: string;
  isProcessing: boolean;
  isStreaming: boolean;
  currentModel?: string;
  currentMode?: AgentMode;
}

export function ChatInput({ input, isProcessing, isStreaming, currentModel, currentMode }: ChatInputProps) {
  const getModeColor = () => {
    switch (currentMode) {
      case AgentMode.GIGA: return 'yellow';
      case AgentMode.CHILL: return 'green';
      case AgentMode.PLAN: return 'blue';
      default: return 'gray';
    }
  };

  const getModeDisplayName = () => {
    switch (currentMode) {
      case AgentMode.GIGA: return 'GIGA MODE';
      case AgentMode.CHILL: return 'CHILL MODE';
      case AgentMode.PLAN: return 'PLAN MODE';
      default: return '';
    }
  };

  return (
    <Box flexDirection="column">
      <Box borderStyle="round" borderColor="gray" paddingX={1} marginTop={1}>
        <Text color="gray">❯ </Text>
        <Text>
          {input}
          {!isProcessing && !isStreaming && <Text color="white">█</Text>}
        </Text>
      </Box>
      {currentMode && (
        <Box justifyContent="flex-end" marginTop={1}>
          <Text color={getModeColor()} bold>{getModeDisplayName()}</Text>
        </Box>
      )}
    </Box>
  );
}